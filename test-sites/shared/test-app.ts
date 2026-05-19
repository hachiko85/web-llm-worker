import { RewriteLLM, type BackendState, type ProgressEvent } from "../../src/index";
import "./test-app.css";

type Action = "summarize" | "translate" | "infer";

const siteName = document.body.dataset.site || "Test Site";
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app element.");
}

app.innerHTML = `
  <main class="shell">
    <section class="topbar">
      <div>
        <p class="eyebrow">RewriteLLM singleton verification</p>
        <h1>${siteName}</h1>
      </div>
      <div class="status-strip" aria-live="polite">
        <span data-status="webgpu">WebGPU: checking</span>
        <span data-status="broker">Broker: connecting</span>
        <span data-status="clients">Clients: 0</span>
      </div>
    </section>

    <section class="workspace">
      <div class="panel input-panel">
        <label>
          Input
          <textarea data-input rows="9">日本語の文章を短く要約し、そのあと英語へ翻訳できるか確認します。SharedWorker の brokerId が Site A と Site B で同じなら、二つのページが同じバックエンドに接続できています。</textarea>
        </label>
        <div class="controls">
          <button type="button" data-action="summarize">要約</button>
          <button type="button" data-action="translate">翻訳</button>
          <button type="button" data-action="infer">推論</button>
          <button type="button" data-action="state">状態更新</button>
        </div>
        <label class="toggle">
          <input data-mock type="checkbox" checked />
          <span>Mock mode</span>
        </label>
      </div>

      <div class="panel output-panel">
        <div class="result-header">
          <h2>Output</h2>
          <span data-running>idle</span>
        </div>
        <pre data-output>Waiting for input.</pre>
      </div>
    </section>

    <section class="telemetry">
      <div>
        <span>brokerId</span>
        <strong data-broker-id>...</strong>
      </div>
      <div>
        <span>engineId</span>
        <strong data-engine-id>idle</strong>
      </div>
      <div>
        <span>completed</span>
        <strong data-completed>0</strong>
      </div>
      <div>
        <span>queue</span>
        <strong data-queue>0</strong>
      </div>
    </section>
  </main>
`;

const input = app.querySelector<HTMLTextAreaElement>("[data-input]")!;
const output = app.querySelector<HTMLElement>("[data-output]")!;
const mock = app.querySelector<HTMLInputElement>("[data-mock]")!;
const running = app.querySelector<HTMLElement>("[data-running]")!;
const webgpu = app.querySelector<HTMLElement>('[data-status="webgpu"]')!;
const broker = app.querySelector<HTMLElement>('[data-status="broker"]')!;
const clients = app.querySelector<HTMLElement>('[data-status="clients"]')!;
const brokerId = app.querySelector<HTMLElement>("[data-broker-id]")!;
const engineId = app.querySelector<HTMLElement>("[data-engine-id]")!;
const completed = app.querySelector<HTMLElement>("[data-completed]")!;
const queue = app.querySelector<HTMLElement>("[data-queue]")!;

const llm = new RewriteLLM({
  mock: true,
  timeoutMs: 10 * 60 * 1000
});

const paintState = (state: BackendState) => {
  webgpu.textContent = `WebGPU: ${state.webgpu ? "available" : "unavailable"}`;
  broker.textContent = `Broker: ${state.running ? "running" : "idle"}`;
  clients.textContent = `Clients: ${state.clients}`;
  brokerId.textContent = state.brokerId;
  engineId.textContent = state.engineId || "idle";
  completed.textContent = String(state.completedJobs);
  queue.textContent = String(state.queued);
  running.textContent = state.running ? "running" : "idle";
};

const appendProgress = (event: ProgressEvent) => {
  if (event.text) {
    output.textContent = `${output.textContent}\n${event.text}`.trim();
  }
};

const runAction = async (action: Action) => {
  const runtime = {
    mock: mock.checked,
    onProgress: appendProgress,
    onStatus: paintState
  };

  output.textContent = "";
  running.textContent = "running";

  try {
    let result: unknown;
    if (action === "summarize") {
      result = await llm.summarize(input.value, { language: "Japanese" }, runtime);
    } else if (action === "translate") {
      result = await llm.translate(input.value, { sourceLanguage: "Japanese", targetLanguage: "English" }, runtime);
    } else {
      result = await llm.complete(`推論してください:\n${input.value}`, { max_new_tokens: 96 }, runtime);
    }

    output.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  } catch (error) {
    output.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } finally {
    const state = await llm.state();
    paintState(state);
  }
};

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const action = target.dataset.action;

  if (action === "state") {
    void llm.state().then(paintState);
    return;
  }

  if (action === "summarize" || action === "translate" || action === "infer") {
    void runAction(action);
  }
});

void llm.ready().then(paintState);
