import {
  DEFAULT_MODEL,
  DEFAULT_TASK,
  type EngineRunMessage,
  type EngineToBrokerMessage,
  type PipelineOptions
} from "./types";

type ProgressPost = (message: EngineToBrokerMessage) => void;
type Generator = {
  tokenizer?: any;
  dispose?: () => Promise<void> | void;
  (input: never, options: Record<string, unknown>): Promise<unknown>;
};

let cachedGenerator: Generator | null = null;
let cachedKey: string | null = null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createMockResult = async (message: EngineRunMessage, post: ProgressPost) => {
  await wait(180);
  const inputText = Array.isArray(message.input)
    ? JSON.stringify(message.input)
    : String(message.input);
  const lower = inputText.toLowerCase();

  let generated = "Mock response from the singleton Bonsai backend.";
  if (lower.includes("function-style tool call") || lower.includes('"keyword"')) {
    generated = JSON.stringify({
      name: "searchArticles",
      arguments: {
        keyword: "祭り",
        "ins-from": "2026-01-01",
        "ins-to": "2026-03-03",
        tags: ["記事"]
      }
    });
  } else if (lower.includes("推論してください") || lower.includes("infer the following")) {
    generated = "推論: 与えられた条件から、最も自然な次の一手を選びます。";
  } else if (lower.includes("summarization engine") || lower.includes("summarize the following")) {
    generated = "要約: 入力文の主旨を短くまとめ、重要な点だけを残しました。";
  } else if (lower.includes("translation engine") || lower.includes("translate from")) {
    generated = "翻訳: This text was translated by the mock backend.";
  } else if (lower.includes("infer") || lower.includes("推論")) {
    generated = "推論: 与えられた条件から、最も自然な次の一手を選びます。";
  } else if (lower.includes("translate") || lower.includes("翻訳")) {
    generated = "翻訳: This text was translated by the mock backend.";
  } else if (lower.includes("summarize") || lower.includes("要約")) {
    generated = "要約: 入力文の主旨を短くまとめ、重要な点だけを残しました。";
  }

  post({
    type: "progress",
    id: message.id,
    event: {
      status: "mock-token",
      text: generated
    }
  });

  return [
    {
      generated_text: generated
    }
  ];
};

export const runEngineJob = async (message: EngineRunMessage, post: ProgressPost) => {
  if (message.mock) {
    return createMockResult(message, post);
  }

  const { env, pipeline, TextStreamer } = await import("@huggingface/transformers");

  const modelSource = message.modelSource;
  env.allowRemoteModels = modelSource?.allowRemoteModels ?? true;
  env.allowLocalModels = modelSource?.allowLocalModels ?? false;
  env.useBrowserCache = modelSource?.useBrowserCache ?? true;
  env.useWasmCache = modelSource?.useWasmCache ?? true;

  if (modelSource?.remoteHost) {
    env.remoteHost = modelSource.remoteHost;
  }
  if (modelSource?.remotePathTemplate) {
    env.remotePathTemplate = modelSource.remotePathTemplate;
  }
  if (modelSource?.localModelPath) {
    env.localModelPath = modelSource.localModelPath;
  }
  if (modelSource?.cacheKey) {
    env.cacheKey = modelSource.cacheKey;
  }

  if (!navigator.gpu && message.pipelineOptions?.device !== "wasm") {
    throw new Error(
      "WebGPU is not available in this browser. Use a WebGPU-capable Chromium browser, or pass pipelineOptions.device = 'wasm' for diagnostics."
    );
  }

  const pipelineOptions = {
    device: "webgpu",
    dtype: "q2f16",
    ...message.pipelineOptions,
    progress_callback: (progress: unknown) => {
      post({
        type: "progress",
        id: message.id,
        event: {
          status: "download",
          detail: progress
        }
      });
    }
  };
  const cacheKey = JSON.stringify({
    task: message.task || DEFAULT_TASK,
    model: message.model || DEFAULT_MODEL,
    modelSource,
    pipelineOptions: sanitizePipelineOptions(pipelineOptions)
  });
  const persistent = Boolean(message.persistence?.enabled);

  if (!persistent || cachedKey !== cacheKey || !cachedGenerator) {
    await disposeEngineRuntime();
    cachedGenerator = (await pipeline(
      (message.task || DEFAULT_TASK) as never,
      message.model || DEFAULT_MODEL,
      pipelineOptions as never
    )) as Generator;
    cachedKey = cacheKey;
  }

  const generator = cachedGenerator;

  try {
    const generationOptions = { ...message.generationOptions };
    if (generationOptions.stream === true && !generationOptions.streamer && "tokenizer" in generator) {
      generationOptions.streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => {
          post({
            type: "progress",
            id: message.id,
            event: {
              status: "token",
              text
            }
          });
        },
        token_callback_function: (tokenIds) => {
          post({
            type: "progress",
            id: message.id,
            event: {
              status: "token-ids",
              tokenIds: tokenIds.map((token) => token.toString())
            }
          });
        }
      });
    }

    return await generator(message.input as never, generationOptions);
  } finally {
    if (!persistent) {
      await disposeEngineRuntime();
    }
  }
};

const sanitizePipelineOptions = (options: PipelineOptions & Record<string, unknown>) => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (typeof value !== "function") {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export const disposeEngineRuntime = async () => {
  if (cachedGenerator) {
    await cachedGenerator.dispose?.();
  }
  cachedGenerator = null;
  cachedKey = null;
};
