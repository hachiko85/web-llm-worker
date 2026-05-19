export const DEFAULT_ALIAS = "rewrite-llm-bonsai";
export const DEFAULT_MODEL = "onnx-community/Ternary-Bonsai-4B-ONNX";
export const DEFAULT_TASK = "text-generation";

export type PipelineInput =
  | string
  | string[]
  | ChatMessage[]
  | ChatMessage[][];

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type PipelineTask =
  | "text-generation"
  | "summarization"
  | "translation"
  | "text2text-generation"
  | string;

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
  clients: number;
  running: boolean;
  queued: number;
  completedJobs: number;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  webgpu: boolean;
  fallbackDedicatedWorker: boolean;
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

export type RewriteLLMConfig = {
  alias?: string;
  task?: PipelineTask;
  model?: string;
  pipelineOptions?: PipelineOptions;
  mock?: boolean;
  timeoutMs?: number;
};

export type RunRuntimeOptions = {
  task?: PipelineTask;
  model?: string;
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

export type ClientToBrokerMessage =
  | {
      type: "client-hello";
      id: string;
      alias: string;
    }
  | {
      type: "get-state";
      id: string;
    }
  | {
      type: "restart-engine";
      id: string;
    }
  | {
      type: "run";
      id: string;
      task: PipelineTask;
      model: string;
      input: PipelineInput;
      generationOptions?: GenerationOptions;
      pipelineOptions?: PipelineOptions;
      mock?: boolean;
    };

export type BrokerToClientMessage =
  | {
      type: "hello";
      id: string;
      state: BackendState;
    }
  | {
      type: "state";
      id?: string;
      state: BackendState;
    }
  | {
      type: "progress";
      id: string;
      event: ProgressEvent;
    }
  | {
      type: "result";
      id: string;
      result: unknown;
      state: BackendState;
    }
  | {
      type: "error";
      id: string;
      error: SerializedError;
      state: BackendState;
    };

export type EngineRunMessage = Extract<ClientToBrokerMessage, { type: "run" }> & {
  engineId: string;
};

export type EngineToBrokerMessage =
  | {
      type: "progress";
      id: string;
      event: ProgressEvent;
    }
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

export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
};

export const serializeError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    name: "Error",
    message: typeof error === "string" ? error : JSON.stringify(error)
  };
};
