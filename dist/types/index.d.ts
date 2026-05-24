import { type BackendState, type GenerationOptions, type JsonValue, type MetricsOptions, type ModelSourceConfig, type PipelineInput, type PipelineOptions, type PipelineTask, type RewriteLLMConfig, type RewriteLLMMetrics, type RewriteLLMTool, type RunRuntimeOptions, type SummarizeOptions, type ToolCallOptions, type ToolCallResult, type TranslateOptions, type WorkerPersistenceConfig, type WorkerReloadStatus } from "./types";
export { DEFAULT_ALIAS, DEFAULT_MODEL, DEFAULT_TASK, type BackendState, type ChatMessage, type GenerationOptions, type JsonValue, type MemoryMetricSnapshot, type MetricsOptions, type ModelSourceConfig, type PipelineInput, type PipelineOptions, type PipelineTask, type ProgressEvent, type RewriteLLMConfig, type RewriteLLMGlobalConfig, type RewriteLLMMetrics, type RewriteLLMTool, type RunRuntimeOptions, type SummarizeOptions, type ToolCallOptions, type ToolCallResult, type ToolParameterSchema, type TranslateOptions, type WorkerPersistenceConfig, type WorkerReloadStatus } from "./types";
export declare class ToolCallParseError extends Error {
    readonly raw: string;
    readonly reason: string;
    constructor(reason: string, raw: string, cause?: unknown);
}
export interface RewriteLLM {
    (input: PipelineInput, options?: GenerationOptions, runtime?: RunRuntimeOptions): Promise<unknown>;
}
export declare class RewriteLLM {
    readonly alias: string;
    readonly task: PipelineTask;
    readonly model: string;
    readonly modelSource?: ModelSourceConfig;
    readonly persistence: WorkerPersistenceConfig;
    readonly workerUrl?: string;
    readonly pipelineOptions: PipelineOptions;
    readonly mock: boolean;
    readonly timeoutMs?: number;
    private readonly backend;
    constructor(config?: RewriteLLMConfig);
    static pipeline(task?: PipelineTask, model?: string, config?: Omit<RewriteLLMConfig, "task" | "model">): RewriteLLM;
    static parseToolCall(raw: string, tools: RewriteLLMTool | RewriteLLMTool[]): ToolCallResult;
    ready(): Promise<BackendState>;
    state(): Promise<BackendState>;
    metrics(options?: MetricsOptions): Promise<RewriteLLMMetrics>;
    reloadStatus(): Promise<WorkerReloadStatus>;
    restart(): Promise<BackendState>;
    restartEngine(): Promise<BackendState>;
    run(input: PipelineInput, options?: GenerationOptions, runtime?: RunRuntimeOptions): Promise<unknown>;
    complete(prompt: string, options?: GenerationOptions, runtime?: RunRuntimeOptions): Promise<unknown>;
    summarize(text: string, options?: SummarizeOptions, runtime?: RunRuntimeOptions): Promise<string>;
    translate(text: string, options?: TranslateOptions, runtime?: RunRuntimeOptions): Promise<string>;
    extractToolCall(input: string, tools: RewriteLLMTool | RewriteLLMTool[], options?: ToolCallOptions, runtime?: RunRuntimeOptions): Promise<ToolCallResult>;
    extractToolArguments(input: string, tool: RewriteLLMTool, options?: ToolCallOptions, runtime?: RunRuntimeOptions): Promise<Record<string, JsonValue>>;
}
//# sourceMappingURL=index.d.ts.map