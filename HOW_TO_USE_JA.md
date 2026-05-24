# RewriteLLM How to use

このドキュメントは、現在利用できる constructor 設定とメソッドの簡易まとめです。

## 最小構成

```ts
import { RewriteLLM } from "/rewrite-llm/rewrite-llm.js";

const llm = new RewriteLLM();
await llm.ready();

const result = await llm.complete("日本語で短く説明してください。");
```

## Constructor options

```ts
const llm = new RewriteLLM({
  alias: "rewrite-llm-bonsai",
  model: "onnx-community/Ternary-Bonsai-4B-ONNX",
  task: "text-generation",
  workerUrl: "/assets/rewrite-llm.shared-worker.js",
  modelSource: {
    remoteHost: new URL("/models/", location.origin).href,
    remotePathTemplate: "{model}/resolve/{revision}/",
    allowRemoteModels: true,
    allowLocalModels: false,
    useBrowserCache: true,
    useWasmCache: true,
    cacheKey: "rewrite-llm-local-models"
  },
  persistence: {
    enabled: true,
    idleTimeoutMs: 0,
    maxCompletedJobsBeforeReload: 20,
    usedHeapRatioThreshold: 0.82,
    storageUsageRatioThreshold: 0.9
  },
  pipelineOptions: {
    device: "webgpu",
    dtype: "q2f16"
  },
  timeoutMs: 10 * 60 * 1000
});
```

## モデルファイルの取得元を変更する

既定では Hugging Face Hub の次を読みます。

```text
https://huggingface.co/onnx-community/Ternary-Bonsai-4B-ONNX/resolve/main/...
```

同じ Web サーバー上にモデルを置く場合は、次の構造にしてください。

```text
dist/
  rewrite-llm.js
  assets/
    rewrite-llm.shared-worker.js
    rewrite-llm.engine-worker.js
  models/
    onnx-community/
      Ternary-Bonsai-4B-ONNX/
        resolve/
          main/
            config.json
            tokenizer.json
            tokenizer_config.json
            generation_config.json
            special_tokens_map.json
            onnx/
              ...
```

設定例:

```ts
const llm = new RewriteLLM({
  modelSource: {
    remoteHost: new URL("/models/", location.origin).href,
    remotePathTemplate: "{model}/resolve/{revision}/"
  }
});
```

この場合、`config.json` は次から取得されます。

```text
https://your-site.example.com/models/onnx-community/Ternary-Bonsai-4B-ONNX/resolve/main/config.json
```

`public/models/onnx-community/Ternary-Bonsai-4B-ONNX/resolve/main/MIRROR_README.txt` は配置確認用のプレースホルダーです。実モデルをテストする場合は同じディレクトリに Hugging Face の実ファイルを配置してください。

デフォルトの `q2f16` に必要なファイルをダウンロードする場合:

```powershell
npm run download:model:q2f16
npm run build
npm run serve:test
npm run verify:model-serving
```

このスクリプトは以下を取得します。

```text
chat_template.jinja
config.json
generation_config.json
tokenizer.json
tokenizer_config.json
onnx/model_q2f16.onnx
onnx/model_q2f16.onnx_data
```

`model_q2f16.onnx_data` は約 1.09GB あります。GitHub には push しないよう `.gitignore` で除外しています。

## 永続化モード

既定では推論完了後に pipeline を破棄し、メモリ常駐を抑えます。

```ts
const llm = new RewriteLLM({
  persistence: false
});
```

永続化する場合:

```ts
const llm = new RewriteLLM({
  persistence: {
    enabled: true,
    maxCompletedJobsBeforeReload: 20,
    usedHeapRatioThreshold: 0.82,
    storageUsageRatioThreshold: 0.9
  }
});
```

永続化 ON では同じ model/task/pipelineOptions の pipeline を再利用します。起動コストは下がりますが、メモリを保持しやすくなるため `reloadStatus()` または `metrics()` を見て再起動してください。

## メソッド

### `ready()`

SharedWorker broker への接続完了を待ちます。

```ts
await llm.ready();
```

### `complete(prompt, options?, runtime?)`

テキスト生成を実行します。

```ts
const result = await llm.complete("Explain WebGPU briefly.", {
  max_new_tokens: 80
});
```

### `summarize(text, options?, runtime?)`

要約用プロンプトで生成します。

```ts
const summary = await llm.summarize("長い文章...", {
  language: "Japanese"
});
```

### `translate(text, options?, runtime?)`

翻訳用プロンプトで生成します。

```ts
const translated = await llm.translate("今日は良い天気です。", {
  sourceLanguage: "Japanese",
  targetLanguage: "English"
});
```

### `extractToolCall(input, tools, options?, runtime?)`

function calling に近い形で、自然言語からツール名と引数 JSON を作ります。`tools` は Transformers.js の `text-generation` へ generation option として渡され、Bonsai/Qwen 系の `chat_template.jinja` に内蔵された `<tools>` / `<tool_call>` フォーマットが使われます。

```ts
const searchTool = {
  type: "function",
  function: {
    name: "searchArticles",
    description: "記事検索フィルターを作成する",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        keyword: {
          type: "string",
          description: "検索キーワード。「お祭り」は「祭り」に正規化する。"
        },
        "ins-from": {
          type: "string",
          description: "掲載日の開始日。YYYY-MM-DD"
        },
        "ins-to": {
          type: "string",
          description: "掲載日の終了日。YYYY-MM-DD"
        },
        tags: {
          type: "array",
          items: {
            type: "string",
            enum: ["報知", "記事", "お知らせ"]
          }
        }
      },
      required: ["keyword", "ins-from", "ins-to", "tags"]
    }
  }
};

const call = await llm.extractToolCall(
  "今年の一月から2026-03-03に掲載されたお祭りに関する記事を調べて",
  searchTool,
  {
    currentDate: "2026-05-24"
  }
);

console.log(call.name);
console.log(call.arguments);
```

期待される返り値の形:

```json
{
  "name": "searchArticles",
  "arguments": {
    "keyword": "祭り",
    "ins-from": "2026-01-01",
    "ins-to": "2026-03-03",
    "tags": ["記事"]
  },
  "raw": "{\"name\":\"searchArticles\",\"arguments\":...}"
}
```

単一ツールの引数だけ欲しい場合は `extractToolArguments()` を使えます。

```ts
const args = await llm.extractToolArguments(
  "今年の一月から2026-03-03に掲載されたお祭りに関する記事を調べて",
  searchTool,
  {
    currentDate: "2026-05-24"
  }
);
```

### tool call の失敗処理

`extractToolCall()` は、モデルが `<tool_call>` 形式または同等の JSON tool call を返し、かつ JSON パースとツール名検証に成功した場合だけ成功します。通常文、壊れた JSON、未定義のツール名は `ToolCallParseError` として失敗します。

```ts
try {
  const call = await llm.extractToolCall(question, searchTool, {
    currentDate: "2026-05-24"
  });
  runSearch(call.arguments);
} catch (error) {
  if (error instanceof ToolCallParseError) {
    console.error(error.reason);
    console.error(error.raw);
  }
}
```

モデルの raw 出力だけを後から確認したい場合は `RewriteLLM.parseToolCall(raw, tools)` を使えます。

注意点:

- クラウド API のネイティブ function calling ではありませんが、モデルの chat template が持つ tool-use 形式を利用します。
- モデル出力に `<tool_call>` タグ、前後の説明、または `json` code fence が混ざった場合でも、最初の JSON オブジェクトを抽出してパースします。
- enum や required はプロンプト上の制約です。厳密な業務バリデーションが必要な場合は、返却後にアプリ側でも検証してください。

### `state()`

broker/worker の状態を返します。

```ts
const state = await llm.state();
console.log(state.brokerId, state.clients, state.engineId);
```

### `metrics()`

ページと worker から取得可能なメモリ/環境メトリクスを返します。

```ts
const metrics = await llm.metrics();
console.log(metrics.page?.usedJSHeapSize);
console.log(metrics.worker.usedJSHeapSize);
console.log(metrics.reloadStatus);
```

Chrome でも worker 側の JS heap が公開されないことがあります。その場合は `n/a` 相当になり、`notes` に理由が入ります。WebGPU の GPU メモリ使用量は標準 Web API では直接取得できません。

### `reloadStatus()`

永続化 worker を再起動すべきかどうかを返します。

```ts
const status = await llm.reloadStatus();
if (status.recommended) {
  await llm.restart();
}
```

### `restart()` / `restartEngine()`

永続化済み pipeline/worker を破棄し、キューをクリアして idle に戻します。

```ts
await llm.restart();
```

## テストサーバー

```powershell
npm run build
npm run serve:test
```

開く URL:

```text
http://127.0.0.1:8787/test-sites/
```

ブラウザ自動検証:

```powershell
npm run verify:browser
```
