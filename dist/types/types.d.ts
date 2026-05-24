export declare const DEFAULT_ALIAS = "rewrite-llm-bonsai";
export declare const DEFAULT_MODEL = "onnx-community/Ternary-Bonsai-4B-ONNX";
export declare const DEFAULT_TASK = "text-generation";
export type PipelineInput = string | string[] | ChatMessage[] | ChatMessage[][];
export type ChatRole = "system" | "user" | "assistant" | "tool";
export type ChatMessage = {
    role: ChatRole;
    content: string;
};
export type PipelineTask = "text-generation" | "summarization" | "translation" | "text2text-generation" | string;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export type ToolParameterSchema = {
    type?: string | string[];
    description?: string;
    enum?: JsonValue[];
    properties?: Record<string, ToolParameterSchema>;
    items?: ToolParameterSchema;
    required?: string[];
    additionalProperties?: boolean | ToolParameterSchema;
    [key: string]: unknown;
};
export type RewriteLLMTool = {
    type?: "function" | string;
    name?: string;
    description?: string;
    parameters?: ToolParameterSchema;
    function?: {
        name: string;
        description?: string;
        parameters?: ToolParameterSchema;
    };
};
export type ProgressEvent = {
    status?: string;
    name?: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
    text?: string;
    tokenIds?: string[];
    detail?: unknown;
};
export type BackendState = {
    alias: string;
    brokerId: string;
    engineId: string | null;
    modelSource: ModelSourceConfig | null;
    persistence: WorkerPersistenceConfig;
    reloadRecommended: boolean;
    reloadReasons: string[];
    clients: number;
    running: boolean;
    queued: number;
    completedJobs: number;
    completedJobsSinceRestart: number;
    lastStartedAt: number | null;
    lastFinishedAt: number | null;
    lastRestartedAt: number | null;
    webgpu: boolean;
    fallbackDedicatedWorker: boolean;
};
export type MemoryMetricSnapshot = {
    context: "page" | "broker-worker";
    capturedAt: number;
    supported: {
        performanceMemory: boolean;
        userAgentSpecificMemory: boolean;
        deviceMemory: boolean;
        storageEstimate: boolean;
    };
    jsHeapSizeLimit?: number;
    totalJSHeapSize?: number;
    usedJSHeapSize?: number;
    userAgentSpecificMemory?: number;
    deviceMemoryGB?: number;
    hardwareConcurrency?: number;
    storageQuota?: number;
    storageUsage?: number;
    crossOriginIsolated: boolean;
    notes: string[];
};
export type RewriteLLMMetrics = {
    state: BackendState;
    worker: MemoryMetricSnapshot;
    page?: MemoryMetricSnapshot;
    reloadStatus: WorkerReloadStatus;
};
export type MetricsOptions = {
    includePage?: boolean;
};
export type PipelineOptions = {
    device?: "webgpu" | "wasm" | "webnn" | "cpu" | string;
    dtype?: string | Record<string, string>;
    revision?: string;
    local_files_only?: boolean;
    cache_dir?: string;
    subfolder?: string;
    use_external_data_format?: boolean;
    model_file_name?: string;
    config?: Record<string, unknown>;
    session_options?: Record<string, unknown>;
};
export type GenerationOptions = Record<string, unknown>;
export type ToolCallOptions = GenerationOptions & {
    currentDate?: string;
    systemPrompt?: string;
};
export type ToolCallResult = {
    name: string;
    arguments: Record<string, JsonValue>;
    raw: string;
};
export type ModelSourceConfig = {
    remoteHost?: string;
    remotePathTemplate?: string;
    localModelPath?: string;
    allowRemoteModels?: boolean;
    allowLocalModels?: boolean;
    useBrowserCache?: boolean;
    useWasmCache?: boolean;
    cacheKey?: string;
};
export type WorkerPersistenceConfig = {
    enabled: boolean;
    idleTimeoutMs?: number;
    maxCompletedJobsBeforeReload?: number;
    usedHeapRatioThreshold?: number;
    usedHeapBytesThreshold?: number;
    userAgentMemoryBytesThreshold?: number;
    storageUsageRatioThreshold?: number;
};
export type WorkerReloadStatus = {
    checkedAt: number;
    recommended: boolean;
    level: "ok" | "watch" | "reload";
    reasons: string[];
    persistence: WorkerPersistenceConfig;
    completedJobsSinceRestart: number;
    engineId: string | null;
};
export type RewriteLLMConfig = {
    alias?: string;
    task?: PipelineTask;
    model?: string;
    modelSource?: ModelSourceConfig;
    persistence?: boolean | Partial<WorkerPersistenceConfig>;
    workerUrl?: string;
    pipelineOptions?: PipelineOptions;
    mock?: boolean;
    timeoutMs?: number;
};
export type RewriteLLMGlobalConfig = {
    alias?: string;
    autoStart?: boolean;
    modelSource?: ModelSourceConfig;
    persistence?: boolean | Partial<WorkerPersistenceConfig>;
    workerUrl?: string;
};
export type RunRuntimeOptions = {
    task?: PipelineTask;
    model?: string;
    modelSource?: ModelSourceConfig;
    persistence?: boolean | Partial<WorkerPersistenceConfig>;
    pipelineOptions?: PipelineOptions;
    mock?: boolean;
    timeoutMs?: number;
    onProgress?: (event: ProgressEvent) => void;
    onStatus?: (state: BackendState) => void;
};
export type SummarizeOptions = GenerationOptions & {
    language?: string;
};
export type TranslateOptions = GenerationOptions & {
    sourceLanguage?: string;
    targetLanguage?: string;
};
export type ClientToBrokerMessage = {
    type: "client-hello";
    id: string;
    alias: string;
    modelSource?: ModelSourceConfig;
    persistence?: WorkerPersistenceConfig;
} | {
    type: "get-state";
    id: string;
} | {
    type: "get-metrics";
    id: string;
} | {
    type: "get-reload-status";
    id: string;
} | {
    type: "restart-engine";
    id: string;
} | {
    type: "run";
    id: string;
    task: PipelineTask;
    model: string;
    modelSource?: ModelSourceConfig;
    persistence?: WorkerPersistenceConfig;
    input: PipelineInput;
    generationOptions?: GenerationOptions;
    pipelineOptions?: PipelineOptions;
    mock?: boolean;
};
export type BrokerToClientMessage = {
    type: "hello";
    id: string;
    state: BackendState;
} | {
    type: "state";
    id?: string;
    state: BackendState;
} | {
    type: "metrics";
    id: string;
    metrics: RewriteLLMMetrics;
} | {
    type: "reload-status";
    id: string;
    status: WorkerReloadStatus;
} | {
    type: "progress";
    id: string;
    event: ProgressEvent;
} | {
    type: "result";
    id: string;
    result: unknown;
    state: BackendState;
} | {
    type: "error";
    id: string;
    error: SerializedError;
    state: BackendState;
};
export type EngineRunMessage = Extract<ClientToBrokerMessage, {
    type: "run";
}> & {
    engineId: string;
};
export type EngineToBrokerMessage = {
    type: "progress";
    id: string;
    event: ProgressEvent;
} | {
    type: "result";
    id: string;
    result: unknown;
} | {
    type: "error";
    id: string;
    error: SerializedError;
};
export type SerializedError = {
    name: string;
    message: string;
    stack?: string;
};
export declare const serializeError: (error: unknown) => SerializedError;
//# sourceMappingURL=types.d.ts.map