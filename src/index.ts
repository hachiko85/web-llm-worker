import {
  DEFAULT_ALIAS,
  DEFAULT_MODEL,
  DEFAULT_TASK,
  type BackendState,
  type BrokerToClientMessage,
  type ClientToBrokerMessage,
  type GenerationOptions,
  type ModelSourceConfig,
  type PipelineInput,
  type PipelineOptions,
  type PipelineTask,
  type ProgressEvent,
  type RewriteLLMConfig,
  type RewriteLLMGlobalConfig,
  type RunRuntimeOptions,
  type SummarizeOptions,
  type TranslateOptions
} from "./types";
import sharedWorkerUrl from "./rewrite-llm.shared-worker.ts?sharedworker&url";

export {
  DEFAULT_ALIAS,
  DEFAULT_MODEL,
  DEFAULT_TASK,
  type BackendState,
  type ChatMessage,
  type GenerationOptions,
  type ModelSourceConfig,
  type PipelineInput,
  type PipelineOptions,
  type PipelineTask,
  type ProgressEvent,
  type RewriteLLMConfig,
  type RewriteLLMGlobalConfig,
  type RunRuntimeOptions,
  type SummarizeOptions,
  type TranslateOptions
} from "./types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  onProgress?: (event: ProgressEvent) => void;
  onStatus?: (state: BackendState) => void;
  expectsStateResult?: boolean;
  timeoutId?: number;
};

type BackendTransport = {
  postMessage: (message: ClientToBrokerMessage) => void;
  start?: () => void;
};

const registryKey = "__rewriteLLMBackendRegistry_v1";
const globalConfigKey = "RewriteLLMConfig";

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toError = (message: BrokerToClientMessage & { type: "error" }) => {
  const error = new Error(message.error.message);
  error.name = message.error.name;
  if (message.error.stack) {
    error.stack = message.error.stack;
  }
  return error;
};

class BackendConnection {
  readonly alias: string;
  readonly modelSource?: ModelSourceConfig;
  readonly workerUrl: string;
  readonly clientId = createId();
  private transport: BackendTransport;
  private pending = new Map<string, PendingRequest>();
  private currentState: BackendState | null = null;
  private helloPromise: Promise<BackendState>;
  private helloResolve!: (state: BackendState) => void;

  constructor(alias: string, workerUrl: string, modelSource?: ModelSourceConfig) {
    this.alias = alias;
    this.modelSource = modelSource;
    this.workerUrl = workerUrl;
    this.helloPromise = new Promise((resolve) => {
      this.helloResolve = resolve;
    });
    this.transport = this.createTransport();
    this.post({
      type: "client-hello",
      id: createId(),
      alias,
      modelSource
    });
  }

  ready() {
    return this.helloPromise;
  }

  get state() {
    return this.currentState;
  }

  run(
    message: Omit<Extract<ClientToBrokerMessage, { type: "run" }>, "id" | "type">,
    callbacks: Pick<RunRuntimeOptions, "onProgress" | "onStatus" | "timeoutMs"> = {}
  ) {
    return this.request(
      {
        ...message,
        type: "run"
      },
      callbacks
    );
  }

  getState() {
    return this.request({ type: "get-state" }, {});
  }

  restartEngine() {
    return this.request({ type: "restart-engine" }, {});
  }

  private request(
    partial: Omit<ClientToBrokerMessage, "id">,
    callbacks: Pick<RunRuntimeOptions, "onProgress" | "onStatus" | "timeoutMs">
  ) {
    const id = createId();
    const message = { ...partial, id } as ClientToBrokerMessage;

    return new Promise<unknown>((resolve, reject) => {
      const pending: PendingRequest = {
        resolve,
        reject,
        onProgress: callbacks.onProgress,
        onStatus: callbacks.onStatus,
        expectsStateResult: partial.type === "get-state" || partial.type === "restart-engine"
      };

      if (callbacks.timeoutMs && callbacks.timeoutMs > 0) {
        pending.timeoutId = window.setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`RewriteLLM request timed out after ${callbacks.timeoutMs}ms.`));
        }, callbacks.timeoutMs);
      }

      this.pending.set(id, pending);
      this.post(message);
    });
  }

  private post(message: ClientToBrokerMessage) {
    this.transport.postMessage(message);
  }

  private createTransport() {
    const workerUrl = resolveWorkerUrl(this.workerUrl);

    if (typeof SharedWorker !== "undefined") {
      const worker = new SharedWorker(workerUrl, {
        name: this.alias,
        type: "module"
      });
      worker.port.onmessage = (event: MessageEvent<BrokerToClientMessage>) => this.handleMessage(event.data);
      worker.port.start();
      return worker.port;
    }

    if (typeof Worker !== "undefined") {
      const worker = new Worker(workerUrl, {
        name: this.alias,
        type: "module"
      });
      worker.onmessage = (event: MessageEvent<BrokerToClientMessage>) => this.handleMessage(event.data);
      return worker;
    }

    throw new Error("RewriteLLM requires SharedWorker or Worker support.");
  }

  private handleMessage(message: BrokerToClientMessage) {
    if ("state" in message) {
      this.currentState = message.state;
    }

    if (message.type === "hello") {
      this.helloResolve(message.state);
      return;
    }

    const pending = message.id ? this.pending.get(message.id) : undefined;

    if (message.type === "state") {
      pending?.onStatus?.(message.state);
      if (pending?.expectsStateResult && message.id) {
        this.resolve(message.id, message.state);
      }
      return;
    }

    if (message.type === "progress") {
      pending?.onProgress?.(message.event);
      return;
    }

    if (message.type === "result") {
      this.resolve(message.id, message.result);
      return;
    }

    if (message.type === "error") {
      this.reject(message.id, toError(message));
    }
  }

  private resolve(id: string, value: unknown) {
    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }
    if (pending.timeoutId) {
      window.clearTimeout(pending.timeoutId);
    }
    this.pending.delete(id);
    pending.resolve(value);
  }

  private reject(id: string, error: unknown) {
    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }
    if (pending.timeoutId) {
      window.clearTimeout(pending.timeoutId);
    }
    this.pending.delete(id);
    pending.reject(error);
  }
}

const getRegistry = () => {
  const globalWindow = window as Window & {
    [registryKey]?: Map<string, BackendConnection>;
  };

  if (!globalWindow[registryKey]) {
    globalWindow[registryKey] = new Map();
  }

  return globalWindow[registryKey];
};

const getGlobalConfig = (): RewriteLLMGlobalConfig => {
  if (!isBrowser()) {
    return {};
  }

  return ((window as Window & { [globalConfigKey]?: RewriteLLMGlobalConfig })[globalConfigKey] ?? {});
};

const resolveWorkerUrl = (workerUrl?: string) => {
  const resolved = new URL(workerUrl || sharedWorkerUrl, window.location.href);
  if (resolved.origin !== window.location.origin) {
    throw new Error(
      `RewriteLLM workerUrl must be same-origin with the page. Received "${resolved.href}" for page origin "${window.location.origin}". Place dist/assets/rewrite-llm.shared-worker.js under the web app origin or expose it through a reverse proxy.`
    );
  }
  return resolved.href;
};

const registryId = (alias: string, workerUrl?: string) => `${alias}::${resolveWorkerUrl(workerUrl)}`;

const ensureBackend = (alias = DEFAULT_ALIAS, workerUrl?: string, modelSource?: ModelSourceConfig) => {
  if (!isBrowser()) {
    throw new Error("RewriteLLM can only start its browser backend in a browser context.");
  }

  const registry = getRegistry();
  const id = registryId(alias, workerUrl);
  const existing = registry.get(id);
  if (existing) {
    return existing;
  }

  const connection = new BackendConnection(alias, workerUrl || sharedWorkerUrl, modelSource);
  registry.set(id, connection);
  return connection;
};

const defaultPipelineOptions = (): PipelineOptions => ({
  device: "webgpu",
  dtype: "q2f16"
});

const extractGeneratedText = (result: unknown) => {
  if (Array.isArray(result)) {
    const first = result[0] as { generated_text?: unknown } | undefined;
    if (typeof first?.generated_text === "string") {
      return first.generated_text;
    }
  }
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
};

export interface RewriteLLM {
  (input: PipelineInput, options?: GenerationOptions, runtime?: RunRuntimeOptions): Promise<unknown>;
}

export class RewriteLLM {
  readonly alias: string;
  readonly task: PipelineTask;
  readonly model: string;
  readonly modelSource?: ModelSourceConfig;
  readonly workerUrl?: string;
  readonly pipelineOptions: PipelineOptions;
  readonly mock: boolean;
  readonly timeoutMs?: number;
  private readonly backend: BackendConnection;

  constructor(config: RewriteLLMConfig = {}) {
    const globalConfig = getGlobalConfig();

    this.alias = config.alias || globalConfig.alias || DEFAULT_ALIAS;
    this.task = config.task || DEFAULT_TASK;
    this.model = config.model || DEFAULT_MODEL;
    this.modelSource = config.modelSource || globalConfig.modelSource;
    this.workerUrl = config.workerUrl || globalConfig.workerUrl;
    this.pipelineOptions = {
      ...defaultPipelineOptions(),
      ...config.pipelineOptions
    };
    this.mock = config.mock ?? false;
    this.timeoutMs = config.timeoutMs;
    this.backend = ensureBackend(this.alias, this.workerUrl, this.modelSource);

    const callable = this.run.bind(this) as unknown as RewriteLLM;
    Object.setPrototypeOf(callable, new.target.prototype);
    Object.defineProperties(callable, Object.getOwnPropertyDescriptors(this));
    return callable;
  }

  static pipeline(task: PipelineTask = DEFAULT_TASK, model = DEFAULT_MODEL, config: Omit<RewriteLLMConfig, "task" | "model"> = {}) {
    return new RewriteLLM({
      ...config,
      task,
      model
    });
  }

  ready() {
    return this.backend.ready();
  }

  state() {
    return this.backend.getState() as Promise<BackendState>;
  }

  restartEngine() {
    return this.backend.restartEngine() as Promise<BackendState>;
  }

  run(input: PipelineInput, options: GenerationOptions = {}, runtime: RunRuntimeOptions = {}) {
    return this.backend.run(
      {
        task: runtime.task || this.task,
        model: runtime.model || this.model,
        modelSource: runtime.modelSource || this.modelSource,
        input,
        generationOptions: options,
        pipelineOptions: {
          ...this.pipelineOptions,
          ...runtime.pipelineOptions
        },
        mock: runtime.mock ?? this.mock
      },
      {
        onProgress: runtime.onProgress,
        onStatus: runtime.onStatus,
        timeoutMs: runtime.timeoutMs ?? this.timeoutMs
      }
    );
  }

  complete(prompt: string, options: GenerationOptions = {}, runtime: RunRuntimeOptions = {}) {
    return this.run(
      prompt,
      {
        max_new_tokens: 128,
        do_sample: false,
        return_full_text: false,
        ...options
      },
      runtime
    );
  }

  async summarize(text: string, options: SummarizeOptions = {}, runtime: RunRuntimeOptions = {}) {
    const language = options.language || "Japanese";
    const { language: _language, ...generationOptions } = options;
    const result = await this.run(
      [
        {
          role: "system",
          content: `You are a precise summarization engine. Answer in ${language}.`
        },
        {
          role: "user",
          content: `Summarize the following text concisely:\n\n${text}`
        }
      ],
      {
        max_new_tokens: 180,
        do_sample: false,
        return_full_text: false,
        ...generationOptions
      },
      runtime
    );
    return extractGeneratedText(result);
  }

  async translate(text: string, options: TranslateOptions = {}, runtime: RunRuntimeOptions = {}) {
    const sourceLanguage = options.sourceLanguage || "auto";
    const targetLanguage = options.targetLanguage || "English";
    const { sourceLanguage: _sourceLanguage, targetLanguage: _targetLanguage, ...generationOptions } = options;
    const result = await this.run(
      [
        {
          role: "system",
          content: "You are a translation engine. Return only the translated text."
        },
        {
          role: "user",
          content: `Translate from ${sourceLanguage} to ${targetLanguage}:\n\n${text}`
        }
      ],
      {
        max_new_tokens: 180,
        do_sample: false,
        return_full_text: false,
        ...generationOptions
      },
      runtime
    );
    return extractGeneratedText(result);
  }
}

if (isBrowser()) {
  const globalConfig = getGlobalConfig();
  if (globalConfig.autoStart !== false) {
    try {
      ensureBackend(globalConfig.alias || DEFAULT_ALIAS, globalConfig.workerUrl, globalConfig.modelSource);
    } catch (error) {
      console.warn(error);
    }
  }
  (window as Window & { RewriteLLM?: typeof RewriteLLM }).RewriteLLM = RewriteLLM;
}
