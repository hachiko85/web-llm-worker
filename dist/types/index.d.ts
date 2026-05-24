import { type BackendState, type GenerationOptions, type MetricsOptions, type ModelSourceConfig, type PipelineInput, type PipelineOptions, type PipelineTask, type RewriteLLMConfig, type RewriteLLMMetrics, type RunRuntimeOptions, type SummarizeOptions, type TranslateOptions } from "./types";
export { DEFAULT_ALIAS, DEFAULT_MODEL, DEFAULT_TASK, type BackendState, type ChatMessage, type GenerationOptions, type MemoryMetricSnapshot, type MetricsOptions, type ModelSourceConfig, type PipelineInput, type PipelineOptions, type PipelineTask, type ProgressEvent, type RewriteLLMConfig, type RewriteLLMGlobalConfig, type RewriteLLMMetrics, type RunRuntimeOptions, type SummarizeOptions, type TranslateOptions } from "./types";
export interface RewriteLLM {
    (input: PipelineInput, options?: GenerationOptions, runtime?: RunRuntimeOptions): Promise<unknown>;
}
export declare class RewriteLLM {
    readonly alias: string;
    readonly task: PipelineTask;
    readonly model: string;
    readonly modelSource?: ModelSourceConfig;
    readonly workerUrl?: string;
    readonly pipelineOptions: PipelineOptions;
    readonly mock: boolean;
    readonly timeoutMs?: number;
    private readonly backend;
    constructor(config?: RewriteLLMConfig);
    static pipeline(task?: PipelineTask, model?: string, config?: Omit<RewriteLLMConfig, "task" | "model">): RewriteLLM;
    ready(): Promise<BackendState>;
    state(): Promise<BackendState>;
    metrics(options?: MetricsOptions): Promise<RewriteLLMMetrics>;
    restartEngine(): Promise<BackendState>;
    run(input: PipelineInput, options?: GenerationOptions, runtime?: RunRuntimeOptions): Promise<unknown>;
    complete(prompt: string, options?: GenerationOptions, runtime?: RunRuntimeOptions): Promise<unknown>;
    summarize(text: string, options?: SummarizeOptions, runtime?: RunRuntimeOptions): Promise<string>;
    translate(text: string, options?: TranslateOptions, runtime?: RunRuntimeOptions): Promise<string>;
}
//# sourceMappingURL=index.d.ts.map