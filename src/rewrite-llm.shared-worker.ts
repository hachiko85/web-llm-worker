import {
  DEFAULT_ALIAS,
  type BackendState,
  type BrokerToClientMessage,
  type ClientToBrokerMessage,
  type EngineToBrokerMessage,
  type MemoryMetricSnapshot,
  type ModelSourceConfig,
  type RewriteLLMMetrics,
  type SerializedError,
  type WorkerPersistenceConfig,
  type WorkerReloadStatus,
  serializeError
} from "./types";
import EngineWorker from "./rewrite-llm.engine-worker.ts?worker";
import { disposeEngineRuntime, runEngineJob } from "./engine-runner";

type PortLike = {
  postMessage: (message: BrokerToClientMessage) => void;
  start?: () => void;
  close?: () => void;
};

type Job = {
  port: PortLike;
  message: Extract<ClientToBrokerMessage, { type: "run" }>;
};

type JobResponse =
  | {
      type: "result";
      id: string;
      result: unknown;
    }
  | {
      type: "error";
      id: string;
      error: SerializedError;
    };

const brokerId = crypto.randomUUID();
const ports = new Set<PortLike>();
const queue: Job[] = [];
let alias = DEFAULT_ALIAS;
let engine: Worker | null = null;
let engineId: string | null = null;
let activeJob: Job | null = null;
let running = false;
let completedJobs = 0;
let completedJobsSinceRestart = 0;
let lastStartedAt: number | null = null;
let lastFinishedAt: number | null = null;
let lastRestartedAt: number | null = null;
let fallbackDedicatedWorker = false;
let modelSource: ModelSourceConfig | undefined;
let persistence: WorkerPersistenceConfig = {
  enabled: false,
  idleTimeoutMs: 0,
  maxCompletedJobsBeforeReload: 20,
  usedHeapRatioThreshold: 0.82,
  usedHeapBytesThreshold: undefined,
  userAgentMemoryBytesThreshold: undefined,
  storageUsageRatioThreshold: 0.9
};
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let lastReloadStatus: WorkerReloadStatus = {
  checkedAt: Date.now(),
  recommended: false,
  level: "ok",
  reasons: [],
  persistence,
  completedJobsSinceRestart,
  engineId
};

const state = (): BackendState => ({
  alias,
  brokerId,
  engineId,
  modelSource: modelSource ?? null,
  persistence,
  reloadRecommended: lastReloadStatus.recommended,
  reloadReasons: lastReloadStatus.reasons,
  clients: ports.size,
  running,
  queued: queue.length,
  completedJobs,
  completedJobsSinceRestart,
  lastStartedAt,
  lastFinishedAt,
  lastRestartedAt,
  webgpu: Boolean(navigator.gpu),
  fallbackDedicatedWorker
});

const collectWorkerMetrics = async (): Promise<MemoryMetricSnapshot> => {
  const performanceWithMemory = performance as Performance & {
    memory?: {
      jsHeapSizeLimit?: number;
      totalJSHeapSize?: number;
      usedJSHeapSize?: number;
    };
    measureUserAgentSpecificMemory?: () => Promise<{ bytes?: number }>;
  };
  const navigatorWithMemory = navigator as Navigator & {
    deviceMemory?: number;
    storage?: {
      estimate?: () => Promise<{ quota?: number; usage?: number }>;
    };
  };
  const storageEstimate = await navigatorWithMemory.storage?.estimate?.();
  const userAgentMemory = await performanceWithMemory.measureUserAgentSpecificMemory?.().catch((error: unknown) => {
    return {
      error
    };
  });
  const memory = performanceWithMemory.memory;
  const notes: string[] = [];

  if (!memory) {
    notes.push("performance.memory is not available inside this worker.");
  }
  if (navigatorWithMemory.deviceMemory === undefined) {
    notes.push("navigator.deviceMemory is not available inside this worker.");
  }
  if (!performanceWithMemory.measureUserAgentSpecificMemory) {
    notes.push("performance.measureUserAgentSpecificMemory is not available inside this worker.");
  } else if (userAgentMemory && "error" in userAgentMemory) {
    notes.push("performance.measureUserAgentSpecificMemory failed inside this worker.");
  }

  return {
    context: "broker-worker",
    capturedAt: Date.now(),
    supported: {
      performanceMemory: Boolean(memory),
      userAgentSpecificMemory: Boolean(userAgentMemory && !("error" in userAgentMemory)),
      deviceMemory: navigatorWithMemory.deviceMemory !== undefined,
      storageEstimate: Boolean(storageEstimate)
    },
    jsHeapSizeLimit: memory?.jsHeapSizeLimit,
    totalJSHeapSize: memory?.totalJSHeapSize,
    usedJSHeapSize: memory?.usedJSHeapSize,
    userAgentSpecificMemory: userAgentMemory && !("error" in userAgentMemory) ? userAgentMemory.bytes : undefined,
    deviceMemoryGB: navigatorWithMemory.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    storageQuota: storageEstimate?.quota,
    storageUsage: storageEstimate?.usage,
    crossOriginIsolated: self.crossOriginIsolated,
    notes
  };
};

const collectReloadStatus = (worker?: MemoryMetricSnapshot): WorkerReloadStatus => {
  const reasons: string[] = [];

  if (persistence.enabled && persistence.maxCompletedJobsBeforeReload && completedJobsSinceRestart >= persistence.maxCompletedJobsBeforeReload) {
    reasons.push(`completedJobsSinceRestart reached ${completedJobsSinceRestart}/${persistence.maxCompletedJobsBeforeReload}`);
  }

  const used = worker?.usedJSHeapSize;
  const limit = worker?.jsHeapSizeLimit;
  if (used !== undefined && limit && persistence.usedHeapRatioThreshold && used / limit >= persistence.usedHeapRatioThreshold) {
    reasons.push(`worker JS heap ratio reached ${(used / limit * 100).toFixed(1)}%`);
  }

  if (used !== undefined && persistence.usedHeapBytesThreshold && used >= persistence.usedHeapBytesThreshold) {
    reasons.push(`worker JS heap used reached ${used} bytes`);
  }

  if (worker?.userAgentSpecificMemory !== undefined && persistence.userAgentMemoryBytesThreshold && worker.userAgentSpecificMemory >= persistence.userAgentMemoryBytesThreshold) {
    reasons.push(`worker user-agent memory reached ${worker.userAgentSpecificMemory} bytes`);
  }

  if (worker?.storageUsage !== undefined && worker.storageQuota && persistence.storageUsageRatioThreshold && worker.storageUsage / worker.storageQuota >= persistence.storageUsageRatioThreshold) {
    reasons.push(`storage usage ratio reached ${(worker.storageUsage / worker.storageQuota * 100).toFixed(1)}%`);
  }

  const recommended = reasons.length > 0;
  return {
    checkedAt: Date.now(),
    recommended,
    level: recommended ? "reload" : persistence.enabled ? "watch" : "ok",
    reasons,
    persistence,
    completedJobsSinceRestart,
    engineId
  };
};

const collectMetrics = async (): Promise<RewriteLLMMetrics> => {
  const worker = await collectWorkerMetrics();
  lastReloadStatus = collectReloadStatus(worker);

  return {
    state: state(),
    worker,
    reloadStatus: lastReloadStatus
  };
};

const send = (port: PortLike, message: BrokerToClientMessage) => {
  port.postMessage(message);
};

const broadcastState = (id?: string) => {
  const current = state();
  for (const port of ports) {
    send(port, { type: "state", id, state: current });
  }
};

const finishJob = (job: Job, response: JobResponse) => {
  completedJobs += 1;
  completedJobsSinceRestart += 1;
  lastFinishedAt = Date.now();
  running = false;
  activeJob = null;
  lastReloadStatus = collectReloadStatus();

  if (!persistence.enabled && engine) {
    engine.terminate();
    engine = null;
  }
  if (!persistence.enabled) {
    engineId = null;
    void disposeEngineRuntime();
  } else {
    scheduleIdleRestart();
  }

  send(job.port, { ...response, state: state() } as BrokerToClientMessage);
  broadcastState(job.message.id);
  void pumpQueue();
};

const engineError = (error: unknown): SerializedError => serializeError(error);

const pumpQueue = async () => {
  if (running) {
    return;
  }

  const job = queue.shift();
  if (!job) {
    broadcastState();
    return;
  }

  running = true;
  lastStartedAt = Date.now();
  if (!engineId) {
    engineId = crypto.randomUUID();
  }
  activeJob = job;
  clearIdleRestart();
  broadcastState(job.message.id);

  try {
    if (typeof Worker === "undefined") {
      const result = await runEngineJob(
        {
          ...job.message,
          engineId
        },
        (message) => {
          if (message.type === "progress") {
            send(job.port, message);
          }
        }
      );

      finishJob(job, {
        type: "result",
        id: job.message.id,
        result
      });
      return;
    }

    if (!engine) {
      engine = new EngineWorker({
        name: `rewrite-llm-engine-${engineId}`
      });
    }

    engine.onmessage = (event: MessageEvent<EngineToBrokerMessage>) => {
      const message = event.data;
      const currentJob = activeJob;
      if (!currentJob) {
        return;
      }

      if (message.type === "progress") {
        send(currentJob.port, message);
        return;
      }

      if (message.type === "result") {
        finishJob(currentJob, {
          type: "result",
          id: message.id,
          result: message.result
        });
        return;
      }

      finishJob(currentJob, {
        type: "error",
        id: message.id,
        error: message.error
      });
    };

    engine.onerror = (event) => {
      if (!activeJob) {
        return;
      }
      finishJob(activeJob, {
        type: "error",
        id: activeJob.message.id,
        error: engineError(event.message)
      });
    };

    engine.postMessage({
      ...job.message,
      engineId
    });
  } catch (error) {
    finishJob(job, {
      type: "error",
      id: job.message.id,
      error: engineError(error)
    });
  }
};

const restartEngine = (id: string, port: PortLike) => {
  clearIdleRestart();
  queue.length = 0;
  if (engine) {
    engine.terminate();
    engine = null;
  }
  activeJob = null;
  running = false;
  engineId = null;
  completedJobsSinceRestart = 0;
  lastFinishedAt = Date.now();
  lastRestartedAt = Date.now();
  void disposeEngineRuntime();
  lastReloadStatus = collectReloadStatus();
  send(port, { type: "state", id, state: state() });
  broadcastState(id);
};

const clearIdleRestart = () => {
  if (idleTimer !== undefined) {
    clearTimeout(idleTimer);
    idleTimer = undefined;
  }
};

const scheduleIdleRestart = () => {
  clearIdleRestart();
  if (!persistence.enabled || !persistence.idleTimeoutMs || persistence.idleTimeoutMs <= 0) {
    return;
  }

  idleTimer = setTimeout(() => {
    if (!running && queue.length === 0) {
      const port = ports.values().next().value;
      if (port) {
        restartEngine(crypto.randomUUID(), port);
      }
    }
  }, persistence.idleTimeoutMs);
};

const applyPersistence = (next?: WorkerPersistenceConfig) => {
  if (!next) {
    return;
  }
  persistence = {
    ...persistence,
    ...next
  };
  lastReloadStatus = collectReloadStatus();
};

const handleMessage = (port: PortLike, event: MessageEvent<ClientToBrokerMessage>) => {
  const message = event.data;

  if (message.type === "client-hello") {
    alias = message.alias || DEFAULT_ALIAS;
    modelSource = message.modelSource || modelSource;
    applyPersistence(message.persistence);
    send(port, { type: "hello", id: message.id, state: state() });
    broadcastState(message.id);
    return;
  }

  if (message.type === "get-state") {
    send(port, { type: "state", id: message.id, state: state() });
    return;
  }

  if (message.type === "get-metrics") {
    void collectMetrics().then((metrics) => {
      send(port, { type: "metrics", id: message.id, metrics });
    });
    return;
  }

  if (message.type === "get-reload-status") {
    void collectMetrics().then((metrics) => {
      send(port, { type: "reload-status", id: message.id, status: metrics.reloadStatus });
    });
    return;
  }

  if (message.type === "restart-engine") {
    restartEngine(message.id, port);
    return;
  }

  modelSource = message.modelSource || modelSource;
  applyPersistence(message.persistence);
  queue.push({ port, message });
  broadcastState(message.id);
  void pumpQueue();
};

const bindPort = (port: MessagePort) => {
  ports.add(port);
  port.addEventListener("message", (event: MessageEvent<ClientToBrokerMessage>) => handleMessage(port, event));
  port.start();
  broadcastState();
};

const bindDedicatedWorkerFallback = () => {
  fallbackDedicatedWorker = true;
  const port: PortLike = {
    postMessage: (message) => self.postMessage(message),
    close: () => self.close()
  };
  ports.add(port);
  self.addEventListener("message", (event: MessageEvent<ClientToBrokerMessage>) => handleMessage(port, event));
};

const scope = self as unknown as SharedWorkerGlobalScope;
if ("onconnect" in scope) {
  scope.onconnect = (event: MessageEvent) => {
    bindPort(event.ports[0]);
  };
} else {
  bindDedicatedWorkerFallback();
}
