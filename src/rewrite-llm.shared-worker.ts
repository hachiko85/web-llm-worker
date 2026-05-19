import {
  DEFAULT_ALIAS,
  type BackendState,
  type BrokerToClientMessage,
  type ClientToBrokerMessage,
  type EngineToBrokerMessage,
  type SerializedError,
  serializeError
} from "./types";
import EngineWorker from "./rewrite-llm.engine-worker.ts?worker";
import { runEngineJob } from "./engine-runner";

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
let running = false;
let completedJobs = 0;
let lastStartedAt: number | null = null;
let lastFinishedAt: number | null = null;
let fallbackDedicatedWorker = false;

const state = (): BackendState => ({
  alias,
  brokerId,
  engineId,
  clients: ports.size,
  running,
  queued: queue.length,
  completedJobs,
  lastStartedAt,
  lastFinishedAt,
  webgpu: Boolean(navigator.gpu),
  fallbackDedicatedWorker
});

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
  lastFinishedAt = Date.now();
  running = false;

  if (engine) {
    engine.terminate();
    engine = null;
  }
  engineId = null;

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
  engineId = crypto.randomUUID();
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

    engine = new EngineWorker({
      name: `rewrite-llm-engine-${engineId}`
    });

    engine.onmessage = (event: MessageEvent<EngineToBrokerMessage>) => {
      const message = event.data;

      if (message.type === "progress") {
        send(job.port, message);
        return;
      }

      if (message.type === "result") {
        finishJob(job, {
          type: "result",
          id: message.id,
          result: message.result
        });
        return;
      }

      finishJob(job, {
        type: "error",
        id: message.id,
        error: message.error
      });
    };

    engine.onerror = (event) => {
      finishJob(job, {
        type: "error",
        id: job.message.id,
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
  queue.length = 0;
  if (engine) {
    engine.terminate();
    engine = null;
  }
  running = false;
  engineId = null;
  lastFinishedAt = Date.now();
  send(port, { type: "state", id, state: state() });
  broadcastState(id);
};

const handleMessage = (port: PortLike, event: MessageEvent<ClientToBrokerMessage>) => {
  const message = event.data;

  if (message.type === "client-hello") {
    alias = message.alias || DEFAULT_ALIAS;
    send(port, { type: "hello", id: message.id, state: state() });
    broadcastState(message.id);
    return;
  }

  if (message.type === "get-state") {
    send(port, { type: "state", id: message.id, state: state() });
    return;
  }

  if (message.type === "restart-engine") {
    restartEngine(message.id, port);
    return;
  }

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
