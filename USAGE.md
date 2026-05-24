# RewriteLLM usage

RewriteLLM is a browser-side singleton backend for Transformers.js. It uses a `SharedWorker` broker so multiple pages on the same origin share one backend alias. When the browser permits nested workers, the broker starts a short-lived inference worker for each job and terminates it after the result is returned. In SharedWorker contexts that cannot spawn nested workers, the broker runs the job inline and disposes the Transformers.js pipeline after completion, so the large Bonsai model is not kept resident while idle.

## Build

```powershell
npm install
npm run build
```

The production bundle is emitted to `dist/`. The main browser entry is `dist/rewrite-llm.js`; the generated worker chunks are emitted under `dist/assets/`.

## Browser requirements

- A modern Chromium browser with WebGPU enabled.
- HTTPS or localhost. WebGPU and workers are restricted on insecure origins.
- Enough GPU/CPU memory to download and run `onnx-community/Ternary-Bonsai-4B-ONNX`.

The singleton guarantee is scoped by normal browser security rules: pages must load the same built script from the same origin and use the same alias. Different origins cannot share the same `SharedWorker`.

For CDN-style deployment and custom model hosting, see `DEPLOYMENT_JA.md`.
For a Japanese constructor and method reference, see `HOW_TO_USE_JA.md`.

## Basic use

```html
<script type="module">
  import { RewriteLLM } from "./dist/rewrite-llm.js";

  const llm = new RewriteLLM();
  await llm.ready();

  const result = await llm(
    [
      { role: "system", content: "You are a concise assistant." },
      { role: "user", content: "日本語で WebGPU を一文で説明してください。" }
    ],
    {
      max_new_tokens: 120,
      do_sample: false,
      return_full_text: false
    },
    {
      onProgress(event) {
        if (event.text) console.log(event.text);
      }
    }
  );

  console.log(result);
</script>
```

## Helpers

```ts
import { RewriteLLM } from "./dist/rewrite-llm.js";

const llm = new RewriteLLM();

const summary = await llm.summarize("長い文章...", {
  language: "Japanese"
});

const translation = await llm.translate("今日は良い天気です。", {
  sourceLanguage: "Japanese",
  targetLanguage: "English"
});

const completion = await llm.complete("Write a short product tagline:", {
  max_new_tokens: 64
});
```

## Pipeline options

The default model and task are:

```ts
model: "onnx-community/Ternary-Bonsai-4B-ONNX"
task: "text-generation"
pipelineOptions: { device: "webgpu", dtype: "q2f16" }
```

Override them when needed:

```ts
const llm = new RewriteLLM({
  alias: "rewrite-llm-bonsai",
  pipelineOptions: {
    device: "webgpu",
    dtype: "q2"
  },
  timeoutMs: 10 * 60 * 1000
});
```

## Local model mirror

To load model files from the same server as the app:

```ts
const llm = new RewriteLLM({
  modelSource: {
    remoteHost: new URL("/models/", location.origin).href,
    remotePathTemplate: "{model}/resolve/{revision}/"
  }
});
```

Place files under:

```text
dist/models/onnx-community/Ternary-Bonsai-4B-ONNX/resolve/main/
```

Download the default q2f16 mirror files locally:

```powershell
npm run download:model:q2f16
npm run build
npm run serve:test
npm run verify:model-serving
```

See `HOW_TO_USE_JA.md` for the full Japanese setup notes.

## Persistence mode

By default, the engine disposes its pipeline after each inference. To keep the loaded pipeline warm:

```ts
const llm = new RewriteLLM({
  persistence: {
    enabled: true,
    maxCompletedJobsBeforeReload: 20,
    usedHeapRatioThreshold: 0.82
  }
});
```

Check whether the worker should be restarted:

```ts
const status = await llm.reloadStatus();
if (status.recommended) {
  await llm.restart();
}
```

## Testing A/B singleton behavior

Run the dev server:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173/test-sites/
```

The page loads Test Site A and Test Site B side by side. Both should show the same `brokerId` and the client count should increase as both frames connect. The default test UI uses Mock mode so you can verify Worker singleton behavior without downloading the 2.25 GB model. Turn Mock mode off in a WebGPU-capable browser to run the real Bonsai model.

You can also run the built `dist` project with the standalone Node test server:

```powershell
npm run build
npm run serve:test
```

Then open:

```text
http://127.0.0.1:8787/test-sites/
```

This server serves `dist` directly and adds COOP/COEP headers for browser-side worker and WebGPU diagnostics.

## Metrics

`RewriteLLM` exposes worker/page metrics:

```ts
const metrics = await llm.metrics();
console.log(metrics.worker.usedJSHeapSize);
console.log(metrics.worker.jsHeapSizeLimit);
console.log(metrics.page?.userAgentSpecificMemory);
console.log(metrics.worker.deviceMemoryGB);
```

Browser memory APIs are intentionally limited. In Chromium, `performance.memory` may expose JS heap usage and heap limit. When available, `performance.measureUserAgentSpecificMemory()` is also sampled from the page context. Other browsers may return `n/a`, in which case the metrics object includes explanatory notes. GPU memory used by WebGPU is not directly exposed by standard browser APIs.

## Runtime behavior

1. Loading `rewrite-llm.js` starts a backend connection for the default alias.
2. `new RewriteLLM()` reuses the existing backend connection when the alias matches.
3. The `SharedWorker` broker queues requests from every connected page.
4. For each request, the broker starts an inference worker when nested workers are available.
5. If nested workers are unavailable inside `SharedWorker`, the broker runs the same engine path inline.
6. The engine loads Transformers.js with WebGPU and runs the Bonsai text-generation pipeline.
7. After the result or error is posted, the engine disposes the pipeline, terminates any short-lived worker, and returns to idle.

## Notes for Windows

All project files are UTF-8. When viewing or editing Japanese text in PowerShell, use UTF-8 aware commands such as:

```powershell
Get-Content .\USAGE.md -Encoding UTF8
```
