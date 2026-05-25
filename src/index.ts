import {
  DEFAULT_ALIAS,
  DEFAULT_MODEL,
  DEFAULT_TASK,
  type BackendState,
  type BrokerToClientMessage,
  type ClientToBrokerMessage,
  type GenerationOptions,
  type JsonValue,
  type MemoryMetricSnapshot,
  type MetricsOptions,
  type ModelSourceConfig,
  type PipelineInput,
  type PipelineOptions,
  type PipelineTask,
  type ProgressEvent,
  type RewriteLLMConfig,
  type RewriteLLMGlobalConfig,
  type RewriteLLMMetrics,
  type RewriteLLMTool,
  type RunRuntimeOptions,
  type SummarizeOptions,
  type ToolCallAttemptResult,
  type ToolCallOptions,
  type ToolCallResult,
  type TranslateOptions,
  type WorkerPersistenceConfig,
  type WorkerReloadStatus
} from "./types";
import sharedWorkerUrl from "./rewrite-llm.shared-worker.ts?sharedworker&url";

export {
  DEFAULT_ALIAS,
  DEFAULT_MODEL,
  DEFAULT_TASK,
  type BackendState,
  type ChatMessage,
  type GenerationOptions,
  type JsonValue,
  type MemoryMetricSnapshot,
  type MetricsOptions,
  type ModelSourceConfig,
  type PipelineInput,
  type PipelineOptions,
  type PipelineTask,
  type ProgressEvent,
  type RewriteLLMConfig,
  type RewriteLLMGlobalConfig,
  type RewriteLLMMetrics,
  type RewriteLLMTool,
  type RunRuntimeOptions,
  type SummarizeOptions,
  type ToolCallAttemptResult,
  type ToolCallOptions,
  type ToolCallResult,
  type ToolParameterSchema,
  type TranslateOptions,
  type WorkerPersistenceConfig,
  type WorkerReloadStatus
} from "./types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  onProgress?: (event: ProgressEvent) => void;
  onStatus?: (state: BackendState) => void;
  expectsStateResult?: boolean;
  expectsMetricsResult?: boolean;
  expectsReloadStatusResult?: boolean;
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
  readonly persistence: WorkerPersistenceConfig;
  readonly workerUrl: string;
  readonly clientId = createId();
  private transport: BackendTransport;
  private pending = new Map<string, PendingRequest>();
  private currentState: BackendState | null = null;
  private helloPromise: Promise<BackendState>;
  private helloResolve!: (state: BackendState) => void;

  constructor(alias: string, workerUrl: string, modelSource: ModelSourceConfig | undefined, persistence: WorkerPersistenceConfig) {
    this.alias = alias;
    this.modelSource = modelSource;
    this.persistence = persistence;
    this.workerUrl = workerUrl;
    this.helloPromise = new Promise((resolve) => {
      this.helloResolve = resolve;
    });
    this.transport = this.createTransport();
    this.post({
      type: "client-hello",
      id: createId(),
      alias,
      modelSource,
      persistence
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

  getMetrics() {
    return this.request({ type: "get-metrics" }, {});
  }

  getReloadStatus() {
    return this.request({ type: "get-reload-status" }, {});
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
        expectsStateResult: partial.type === "get-state" || partial.type === "restart-engine",
        expectsMetricsResult: partial.type === "get-metrics",
        expectsReloadStatusResult: partial.type === "get-reload-status"
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

    if (message.type === "metrics") {
      this.resolve(message.id, message.metrics);
      return;
    }

    if (message.type === "reload-status") {
      this.resolve(message.id, message.status);
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

const ensureBackend = (
  alias = DEFAULT_ALIAS,
  workerUrl?: string,
  modelSource?: ModelSourceConfig,
  persistence = normalizePersistence()
) => {
  if (!isBrowser()) {
    throw new Error("RewriteLLM can only start its browser backend in a browser context.");
  }

  const registry = getRegistry();
  const id = registryId(alias, workerUrl);
  const existing = registry.get(id);
  if (existing) {
    return existing;
  }

  const connection = new BackendConnection(alias, workerUrl || sharedWorkerUrl, modelSource, persistence);
  registry.set(id, connection);
  return connection;
};

const defaultPipelineOptions = (): PipelineOptions => ({
  device: "webgpu",
  dtype: "q2f16"
});

const normalizePersistence = (value?: boolean | Partial<WorkerPersistenceConfig>): WorkerPersistenceConfig => {
  const defaults: WorkerPersistenceConfig = {
    enabled: false,
    idleTimeoutMs: 0,
    maxCompletedJobsBeforeReload: 20,
    usedHeapRatioThreshold: 0.82,
    storageUsageRatioThreshold: 0.9
  };

  if (typeof value === "boolean") {
    return {
      ...defaults,
      enabled: value
    };
  }

  return {
    ...defaults,
    ...value,
    enabled: value?.enabled ?? defaults.enabled
  };
};

const extractGeneratedText = (result: unknown) => {
  if (Array.isArray(result)) {
    const first = result[0] as { generated_text?: unknown } | undefined;
    if (typeof first?.generated_text === "string") {
      return first.generated_text;
    }
    if (Array.isArray(first?.generated_text)) {
      const messages = [...first.generated_text].reverse();
      const message = messages.find((item) => {
        return typeof item === "object" && item !== null && typeof (item as { content?: unknown }).content === "string";
      }) as { content: string } | undefined;
      if (message) {
        return message.content;
      }
    }
    if (typeof first?.generated_text === "object" && first.generated_text !== null) {
      const message = first.generated_text as { content?: unknown };
      if (typeof message.content === "string") {
        return message.content;
      }
    }
  }
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const normalizeTools = (tools: RewriteLLMTool | RewriteLLMTool[]) => {
  const list = Array.isArray(tools) ? tools : [tools];
  return list.map((tool) => {
    const source = tool.function ?? tool;
    if (!source.name) {
      throw new Error("RewriteLLM tool definitions require a function name.");
    }

    return {
      type: "function",
      function: {
        name: source.name,
        description: source.description || "",
        parameters: source.parameters || {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      }
    };
  });
};

const findJsonCandidate = (text: string) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() || text.trim();
  const start = source.search(/[\[{]/);
  if (start < 0) {
    return source;
  }

  const open = source[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return source.slice(start);
};

const parseJsonOutput = (raw: string) => JSON.parse(findJsonCandidate(raw)) as JsonValue;

const extractToolCallPayload = (raw: string) => {
  const match = raw.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i);
  return match?.[1]?.trim() || raw;
};

export class ToolCallParseError extends Error {
  readonly raw: string;
  readonly reason: string;

  constructor(reason: string, raw: string, cause?: unknown) {
    super(`RewriteLLM tool call parse failed: ${reason}`);
    this.name = "ToolCallParseError";
    this.raw = raw;
    this.reason = reason;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

const toArgumentsObject = (value: unknown): Record<string, JsonValue> => {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch (error) {
    throw new Error("Tool call arguments were a string, but not valid JSON.", { cause: error });
  }
  if (!isRecord(parsed)) {
    throw new Error("RewriteLLM tool call arguments must be a JSON object.");
  }
  return parsed as Record<string, JsonValue>;
};

const normalizeToolCallResult = (parsed: JsonValue, raw: string, expectedNames: Set<string>): ToolCallResult => {
  if (!isRecord(parsed)) {
    throw new Error("RewriteLLM tool call output must be a JSON object.");
  }

  let name: string | null = null;
  let args: Record<string, JsonValue> | null = null;

  if (typeof parsed.name === "string" && "arguments" in parsed) {
    name = parsed.name;
    args = toArgumentsObject(parsed.arguments);
  } else if (typeof parsed.tool === "string" && "arguments" in parsed) {
    name = parsed.tool;
    args = toArgumentsObject(parsed.arguments);
  } else if (Array.isArray(parsed.tool_calls) && parsed.tool_calls.length > 0) {
    const first = parsed.tool_calls[0];
    if (isRecord(first)) {
      const fn = isRecord(first.function) ? first.function : first;
      if (typeof fn.name === "string" && "arguments" in fn) {
        name = fn.name;
        args = toArgumentsObject(fn.arguments);
      }
    }
  }

  if (!name || !args) {
    throw new Error('RewriteLLM tool call output must contain {"name": "...", "arguments": {...}}.');
  }

  if (!expectedNames.has(name)) {
    throw new Error(`RewriteLLM tool call selected unknown tool "${name}".`);
  }

  return {
    name,
    arguments: args,
    raw
  };
};

const parseToolCallResult = (raw: string, expectedNames: Set<string>): ToolCallResult => {
  const payload = extractToolCallPayload(raw);
  let parsed: JsonValue;
  try {
    parsed = parseJsonOutput(payload);
  } catch (error) {
    throw new ToolCallParseError("model did not return a parseable JSON tool call", raw, error);
  }

  try {
    return normalizeToolCallResult(parsed, raw, expectedNames);
  } catch (error) {
    throw new ToolCallParseError(error instanceof Error ? error.message : "invalid tool call payload", raw, error);
  }
};

const parseAutoGateResult = (raw: string) => {
  try {
    const parsed = parseJsonOutput(raw);
    if (isRecord(parsed) && typeof parsed.useTool === "boolean") {
      return {
        useTool: parsed.useTool,
        message: typeof parsed.message === "string" ? parsed.message : raw
      };
    }
  } catch {
    // Fall through to treating the raw model text as a non-tool guidance message.
  }

  return {
    useTool: false,
    message: raw
  };
};

const currentLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const toolSystemPrompt = (mode: "required" | "auto") => {
  const common = [
    "Use the provided JSON schemas and enum values exactly.",
    "Field descriptions are binding constraints; apply any normalization examples exactly.",
    "When the request explicitly contains an enum value, select that exact enum value.",
    "Resolve relative dates against the provided current date and output dates as YYYY-MM-DD."
  ];

  if (mode === "auto") {
    return [
      "You help users configure search/filter conditions.",
      "Call a tool only when the user request clearly maps to the provided search/filter schema.",
      "If the request is unrelated to that schema or lacks required conditions, do not call any tool.",
      "When you do not call a tool, answer in Japanese and explain what condition is missing or how the user should specify it.",
      ...common
    ].join("\n");
  }

  return [
    "You choose exactly one available tool for the user request.",
    ...common,
    "Return only the tool call in the format required by the model chat template."
  ].join("\n");
};

const autoGateSystemPrompt = [
  "You decide whether a user request should configure article search/filter conditions.",
  "Return only valid JSON with this shape: {\"useTool\": boolean, \"message\": string}.",
  "Set useTool to true only if the user clearly asks to search, find, filter, or configure conditions for articles, news, announcements, or published content.",
  "Set useTool to false for cooking, weather, email, general chat, or any request unrelated to article search conditions.",
  "When useTool is false, set message exactly to: このツールでは記事検索条件のみ設定できます。検索したいキーワード、掲載日の開始日と終了日、タグ（報知・記事・お知らせ）を指定してください。"
].join("\n");

const collectPageMetrics = async (): Promise<MemoryMetricSnapshot> => {
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
    notes.push("performance.memory is not available in this browser context.");
  }
  if (navigatorWithMemory.deviceMemory === undefined) {
    notes.push("navigator.deviceMemory is not available in this browser context.");
  }
  if (!performanceWithMemory.measureUserAgentSpecificMemory) {
    notes.push("performance.measureUserAgentSpecificMemory is not available in this browser context.");
  } else if (userAgentMemory && "error" in userAgentMemory) {
    notes.push("performance.measureUserAgentSpecificMemory failed in this browser context.");
  }

  return {
    context: "page",
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
    crossOriginIsolated: window.crossOriginIsolated,
    notes
  };
};

export interface RewriteLLM {
  (input: PipelineInput, options?: GenerationOptions, runtime?: RunRuntimeOptions): Promise<unknown>;
}

export class RewriteLLM {
  readonly alias: string;
  readonly task: PipelineTask;
  readonly model: string;
  readonly modelSource?: ModelSourceConfig;
  readonly persistence: WorkerPersistenceConfig;
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
    this.persistence = normalizePersistence(config.persistence ?? globalConfig.persistence);
    this.workerUrl = config.workerUrl || globalConfig.workerUrl;
    this.pipelineOptions = {
      ...defaultPipelineOptions(),
      ...config.pipelineOptions
    };
    this.mock = config.mock ?? false;
    this.timeoutMs = config.timeoutMs;
    this.backend = ensureBackend(this.alias, this.workerUrl, this.modelSource, this.persistence);

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

  static parseToolCall(raw: string, tools: RewriteLLMTool | RewriteLLMTool[]) {
    const normalizedTools = normalizeTools(tools);
    const expectedNames = new Set(normalizedTools.map((tool) => tool.function.name));
    return parseToolCallResult(raw, expectedNames);
  }

  ready() {
    return this.backend.ready();
  }

  state() {
    return this.backend.getState() as Promise<BackendState>;
  }

  async metrics(options: MetricsOptions = {}) {
    const includePage = options.includePage ?? true;
    const metrics = (await this.backend.getMetrics()) as RewriteLLMMetrics;
    if (!includePage) {
      return metrics;
    }

    return {
      ...metrics,
      page: await collectPageMetrics()
    };
  }

  reloadStatus() {
    return this.backend.getReloadStatus() as Promise<WorkerReloadStatus>;
  }

  restart() {
    return this.restartEngine();
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
        persistence: normalizePersistence(runtime.persistence ?? this.persistence),
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

  async extractToolCall(
    input: string,
    tools: RewriteLLMTool | RewriteLLMTool[],
    options: ToolCallOptions = {},
    runtime: RunRuntimeOptions = {}
  ) {
    const attempt = await this.tryExtractToolCall(input, tools, options, runtime);
    if (attempt.ok) {
      return attempt.call;
    }
    throw new ToolCallParseError(attempt.reason, attempt.raw);
  }

  async tryExtractToolCall(
    input: string,
    tools: RewriteLLMTool | RewriteLLMTool[],
    options: ToolCallOptions = {},
    runtime: RunRuntimeOptions = {}
  ): Promise<ToolCallAttemptResult> {
    const normalizedTools = normalizeTools(tools);
    const expectedNames = new Set(normalizedTools.map((tool) => tool.function.name));
    const currentDate = options.currentDate || currentLocalDate();
    const {
      currentDate: _currentDate,
      systemPrompt,
      toolMode = "required",
      ...generationOptions
    } = options;

    if (toolMode === "auto") {
      const gateResult = await this.run(
        [
          {
            role: "system",
            content: autoGateSystemPrompt
          },
          {
            role: "user",
            content: [
              `Current date: ${currentDate}`,
              "Available search/filter tools:",
              JSON.stringify(normalizedTools, null, 2),
              "Request:",
              input
            ].join("\n\n")
          }
        ],
        {
          max_new_tokens: 192,
          do_sample: false,
          return_full_text: false
        },
        runtime
      );
      const rawGate = extractGeneratedText(gateResult);
      const gate = parseAutoGateResult(rawGate);
      if (!gate.useTool) {
        return {
          ok: false,
          message: gate.message,
          raw: rawGate,
          reason: "request did not match the provided search/filter tool"
        };
      }
    }

    const result = await this.run(
      [
        {
          role: "system",
          content: systemPrompt || toolSystemPrompt(toolMode)
        },
        {
          role: "user",
          content: [
            `Current date: ${currentDate}`,
            "Request:",
            input
          ].join("\n\n")
        }
      ],
      {
        max_new_tokens: 256,
        do_sample: false,
        return_full_text: false,
        tools: normalizedTools,
        ...generationOptions
      },
      runtime
    );
    const raw = extractGeneratedText(result);
    try {
      return {
        ok: true,
        call: parseToolCallResult(raw, expectedNames),
        raw
      };
    } catch (error) {
      if (toolMode === "auto" && error instanceof ToolCallParseError) {
        return {
          ok: false,
          message: raw,
          raw,
          reason: error.reason
        };
      }
      throw error;
    }
  }

  async extractToolArguments(
    input: string,
    tool: RewriteLLMTool,
    options: ToolCallOptions = {},
    runtime: RunRuntimeOptions = {}
  ) {
    const call = await this.extractToolCall(input, tool, options, runtime);
    return call.arguments;
  }
}

if (isBrowser()) {
  const globalConfig = getGlobalConfig();
  if (globalConfig.autoStart !== false) {
    try {
      ensureBackend(
        globalConfig.alias || DEFAULT_ALIAS,
        globalConfig.workerUrl,
        globalConfig.modelSource,
        normalizePersistence(globalConfig.persistence)
      );
    } catch (error) {
      console.warn(error);
    }
  }
  (window as Window & { RewriteLLM?: typeof RewriteLLM }).RewriteLLM = RewriteLLM;
}
