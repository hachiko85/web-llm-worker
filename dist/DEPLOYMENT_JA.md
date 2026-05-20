# RewriteLLM 配信・モデルミラー配置ガイド

このドキュメントは、`dist` の JavaScript を CDN のように配信し、Bonsai モデルのロード元を Hugging Face ではなく任意の Web サーバーへ変更するための手順です。

## 重要な前提

`rewrite-llm.js` 本体は CDN から `import` できます。ただし、ブラウザの Worker/SharedWorker には同一オリジン制約があります。MDN の [Worker constructor](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) と [SharedWorker constructor](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker/SharedWorker) の説明にもある通り、Worker として実行するスクリプトはページと同一オリジンである必要があります。

そのため、実運用では次のどちらかにしてください。

1. Web アプリと同じオリジンに `dist/assets/rewrite-llm.shared-worker.js` を置く
2. CDN 上の worker ファイルを、Web アプリ側のリバースプロキシで同一オリジン URL として公開する

つまり、`rewrite-llm.js` は CDN から読めますが、`workerUrl` は `https://your-app.example.com/...` のようにページと同じ origin にしてください。

## 配置するファイル

`npm run build` 後、最低限以下を配信します。

```text
dist/
  rewrite-llm.js
  assets/
    rewrite-llm.shared-worker.js
    rewrite-llm.engine-worker.js
    ort-wasm-simd-threaded.asyncify.wasm
```

`dist/types/` は TypeScript 利用者向けです。ブラウザ実行には不要ですが、ライブラリとして配る場合は残しておくと便利です。

## 推奨構成 A: JS も worker も同一オリジンに置く

一番簡単でトラブルが少ない構成です。

```text
https://app.example.com/
  index.html
  rewrite-llm/
    rewrite-llm.js
    assets/
      rewrite-llm.shared-worker.js
      rewrite-llm.engine-worker.js
      ort-wasm-simd-threaded.asyncify.wasm
```

読み込み例:

```html
<script type="module">
  import { RewriteLLM } from "/rewrite-llm/rewrite-llm.js";

  const llm = new RewriteLLM({
    workerUrl: "/rewrite-llm/assets/rewrite-llm.shared-worker.js"
  });

  await llm.ready();
</script>
```

## 推奨構成 B: JS は CDN、worker は同一オリジン

`rewrite-llm.js` は CDN から読み、worker だけアプリ側に置く構成です。

```text
https://cdn.example.net/rewrite-llm/
  rewrite-llm.js

https://app.example.com/rewrite-llm/
  assets/
    rewrite-llm.shared-worker.js
    rewrite-llm.engine-worker.js
    ort-wasm-simd-threaded.asyncify.wasm
```

読み込み例:

```html
<script type="module">
  import { RewriteLLM } from "https://cdn.example.net/rewrite-llm/rewrite-llm.js";

  const llm = new RewriteLLM({
    workerUrl: "/rewrite-llm/assets/rewrite-llm.shared-worker.js"
  });

  await llm.ready();
</script>
```

複数ページで同じ `workerUrl` と同じ `alias` を使えば、同一 origin 内で singleton になります。

## グローバル設定で先に指定する

HTML 側で `window.RewriteLLMConfig` を先に定義しておくと、CDN import 後の自動初期化にも同じ設定を使えます。

```html
<script>
  window.RewriteLLMConfig = {
    alias: "rewrite-llm-bonsai",
    workerUrl: "/rewrite-llm/assets/rewrite-llm.shared-worker.js",
    modelSource: {
      remoteHost: "https://models.example.com/",
      remotePathTemplate: "{model}/resolve/{revision}/"
    }
  };
</script>
<script type="module" src="https://cdn.example.net/rewrite-llm/rewrite-llm.js"></script>
```

自動初期化を止めたい場合:

```html
<script>
  window.RewriteLLMConfig = {
    autoStart: false
  };
</script>
```

## モデルを任意の Web サーバーへ置く

既定では Transformers.js は Hugging Face Hub から次のモデルを取得します。

```text
onnx-community/Ternary-Bonsai-4B-ONNX
```

独自サーバーに置く場合は、Hugging Face と同じパス構造でミラーするのが簡単です。

```text
https://models.example.com/
  onnx-community/
    Ternary-Bonsai-4B-ONNX/
      resolve/
        main/
          config.json
          generation_config.json
          tokenizer.json
          tokenizer_config.json
          special_tokens_map.json
          chat_template.jinja
          onnx/
            model_q2f16.onnx
            model_q2f16.onnx_data
            ...
```

実際に必要なファイル名は Transformers.js の進捗ログに表示されます。初回は Hugging Face から通常ロードし、ブラウザの Network タブで `Ternary-Bonsai-4B-ONNX/resolve/main/...` にアクセスしているファイルを確認してから、同じ相対パスでミラーしてください。

設定例:

```ts
import { RewriteLLM } from "https://cdn.example.net/rewrite-llm/rewrite-llm.js";

const llm = new RewriteLLM({
  workerUrl: "/rewrite-llm/assets/rewrite-llm.shared-worker.js",
  modelSource: {
    remoteHost: "https://models.example.com/",
    remotePathTemplate: "{model}/resolve/{revision}/",
    allowRemoteModels: true,
    allowLocalModels: false,
    useBrowserCache: true,
    useWasmCache: true,
    cacheKey: "rewrite-llm-bonsai-cache"
  },
  pipelineOptions: {
    device: "webgpu",
    dtype: "q2f16"
  }
});
```

`remoteHost` と `remotePathTemplate` は Transformers.js の `env` に渡されます。上記の設定では、例えば `config.json` は次の URL から読まれます。

```text
https://models.example.com/onnx-community/Ternary-Bonsai-4B-ONNX/resolve/main/config.json
```

## サーバーヘッダー

モデル配信サーバーには CORS が必要です。

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Range, Content-Type
Accept-Ranges: bytes
```

複数の Web アプリから読む場合は、許可する origin をサーバー側で切り替えて返してください。検証用途なら `Access-Control-Allow-Origin: *` でも動作確認はできますが、本番では公開範囲を絞ることを推奨します。

WebGPU と ONNX Runtime の worker/wasm で SharedArrayBuffer が必要になる構成では、アプリ側 HTML に次のヘッダーを付けることを推奨します。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

COEP を有効にした場合、CDN とモデルサーバー側にも次のどちらかが必要です。

```http
Cross-Origin-Resource-Policy: cross-origin
```

または CORS で明示許可してください。

## Nginx 設定例

アプリと同一オリジンで worker を配る例です。

```nginx
location /rewrite-llm/ {
  alias /var/www/rewrite-llm/dist/;
  add_header Cross-Origin-Resource-Policy same-origin always;
}

location /models/ {
  alias /var/www/models/;
  add_header Access-Control-Allow-Origin https://app.example.com always;
  add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
  add_header Access-Control-Allow-Headers "Range, Content-Type" always;
  add_header Accept-Ranges bytes always;

  if ($request_method = OPTIONS) {
    return 204;
  }
}
```

`remoteHost` はこの場合 `https://app.example.com/models/` にできます。

## Apache 設定例

```apache
Alias "/rewrite-llm/" "/var/www/rewrite-llm/dist/"
<Directory "/var/www/rewrite-llm/dist/">
  Require all granted
  Header always set Cross-Origin-Resource-Policy "same-origin"
</Directory>

Alias "/models/" "/var/www/models/"
<Directory "/var/www/models/">
  Require all granted
  Header always set Access-Control-Allow-Origin "https://app.example.com"
  Header always set Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
  Header always set Access-Control-Allow-Headers "Range, Content-Type"
  Header always set Accept-Ranges "bytes"
</Directory>
```

## 動作確認

1. `rewrite-llm.js` が 200 で取得できる
2. `workerUrl` の `rewrite-llm.shared-worker.js` がページと同一 origin で 200 になる
3. `rewrite-llm.engine-worker.js` と `ort-wasm...wasm` が 200 になる
4. モデルサーバーの `config.json` が CORS エラーなしで 200 になる
5. Test Site A/B の `brokerId` が一致する
6. 推論後に `engineId` が `idle` に戻る

## よくあるエラー

### `workerUrl must be same-origin`

`workerUrl` が CDN など別 origin を指しています。worker ファイルをアプリと同一 origin に置くか、リバースプロキシしてください。

### CORS error

モデル配信サーバーに `Access-Control-Allow-Origin` がありません。モデルファイル、JSON、ONNX 外部データすべてに同じヘッダーを付けてください。

### 404 for `onnx/...`

ミラー先のディレクトリ構造が Hugging Face の `resolve/main/` 構造と一致していません。Network タブで失敗した URL を見て、同じ相対パスにファイルを置いてください。

### WebGPU unavailable

WebGPU 対応 Chromium、HTTPS または localhost、GPU ドライバの状態を確認してください。診断だけなら `pipelineOptions.device = "wasm"` に変更できます。
