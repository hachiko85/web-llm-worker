import {
  RewriteLLM,
  type BackendState,
  type GenerationOptions,
  type MemoryMetricSnapshot,
  type ProgressEvent,
  type RewriteLLMMetrics,
  type RewriteLLMTool,
  type ToolCallAttemptResult
} from "../../src/index";
import "./tool-lab.css";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app element.");
}

const defaultSystemPrompt = [
  "You are configuring only the provided article search condition tool.",
  "Call the tool only when the user request can be converted into article search conditions.",
  "A valid request should provide or imply a search keyword, publication date range, and one of the available tag candidates.",
  "If the prompt is unrelated to article search conditions, do not call the tool.",
  "When you do not call the tool, return this exact Japanese message: 記事検索条件を設定するには、検索キーワード、掲載日の開始日と終了日、タグ候補を指定してください。"
].join("\n");

const defaultUserPrompt = "今年の一月から2026-03-03に掲載されたお祭りに関する記事を調べて";

const defaultTools: RewriteLLMTool[] = [
  {
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
            description: "検索キーワード。自然な日本語から名詞句だけを短く抽出する。「お祭り」は「祭り」に正規化する。"
          },
          "ins-from": {
            type: "string",
            description: "掲載日の開始日。YYYY-MM-DD。"
          },
          "ins-to": {
            type: "string",
            description: "掲載日の終了日。YYYY-MM-DD。"
          },
          tags: {
            type: "array",
            description: "タグ候補から選ぶ。",
            items: {
              type: "string",
              enum: ["報知", "記事", "お知らせ"]
            }
          }
        },
        required: ["keyword", "ins-from", "ins-to", "tags"]
      }
    }
  }
];

const defaultGenerationOptions: GenerationOptions = {
  currentDate: "2026-05-25",
  toolMode: "auto",
  max_new_tokens: 192,
  do_sample: false,
  return_full_text: false
};

app.innerHTML = `
  <main class="shell">
    <section class="topbar">
      <div>
        <p class="eyebrow">RewriteLLM tool calling lab</p>
        <h1>Tool Calling Demo Site C</h1>
      </div>
      <div class="status-strip" aria-live="polite">
        <span data-status="webgpu">WebGPU: checking</span>
        <span data-status="broker">Broker: connecting</span>
        <span data-status="clients">Clients: 0</span>
        <span data-status="running">idle</span>
      </div>
    </section>

    <section class="monitor-grid" aria-live="polite">
      <div class="meter" data-meter="worker-heap">
        <div class="meter-top">
          <span>worker heap pressure</span>
          <strong data-meter-value>n/a</strong>
        </div>
        <div class="meter-track"><span data-meter-bar></span></div>
        <small data-meter-detail>Waiting for worker metrics.</small>
      </div>
      <div class="meter" data-meter="page-heap">
        <div class="meter-top">
          <span>page heap pressure</span>
          <strong data-meter-value>n/a</strong>
        </div>
        <div class="meter-track"><span data-meter-bar></span></div>
        <small data-meter-detail>Waiting for page metrics.</small>
      </div>
      <div class="meter" data-meter="storage">
        <div class="meter-top">
          <span>storage pressure</span>
          <strong data-meter-value>n/a</strong>
        </div>
        <div class="meter-track"><span data-meter-bar></span></div>
        <small data-meter-detail>Waiting for storage estimate.</small>
      </div>
      <div class="meter" data-meter="jobs">
        <div class="meter-top">
          <span>reload pressure</span>
          <strong data-meter-value>n/a</strong>
        </div>
        <div class="meter-track"><span data-meter-bar></span></div>
        <small data-meter-detail>Waiting for job counters.</small>
      </div>
    </section>

    <section class="grid">
      <div class="panel">
        <h2>Prompts</h2>
        <label>
          System prompt
          <textarea data-system-prompt rows="8"></textarea>
        </label>
        <label>
          User prompt
          <textarea data-user-prompt rows="5"></textarea>
        </label>
        <div class="split">
          <label>
            Runtime
            <select data-runtime>
              <option value="mock" selected>Mock</option>
              <option value="real">Real Bonsai</option>
            </select>
          </label>
          <label>
            Metrics poll interval
            <select data-poll-interval>
              <option value="500">0.5 sec</option>
              <option value="1000" selected>1 sec</option>
              <option value="2000">2 sec</option>
            </select>
          </label>
        </div>
        <div class="controls">
          <button type="button" data-run>Run tool calling</button>
          <button type="button" class="secondary" data-refresh>Refresh metrics</button>
          <button type="button" class="secondary" data-reset>Reset defaults</button>
        </div>
      </div>

      <div class="panel">
        <h2>Tools and generation JSON</h2>
        <label>
          Tools JSON
          <textarea class="json-input" data-tools-json spellcheck="false"></textarea>
        </label>
        <div class="validation-row">
          <span class="pill validation" data-tools-valid="false">tools: unchecked</span>
        </div>
        <label>
          Generation options JSON
          <textarea data-generation-json rows="8" spellcheck="false"></textarea>
        </label>
        <div class="validation-row">
          <span class="pill validation" data-generation-valid="false">generation: unchecked</span>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>Runtime state</h2>
      <div class="telemetry">
        <div><span>broker</span><strong data-broker-id>...</strong></div>
        <div><span>engine</span><strong data-engine-id>idle</strong></div>
        <div><span>jobs since restart</span><strong data-jobs-since-restart>0</strong></div>
        <div><span>reload status</span><strong data-reload>unknown</strong></div>
        <div><span>worker heap</span><strong data-worker-heap>n/a</strong></div>
        <div><span>page heap</span><strong data-page-heap>n/a</strong></div>
        <div><span>storage</span><strong data-storage>n/a</strong></div>
        <div><span>last metrics</span><strong data-metrics-time>never</strong></div>
      </div>
    </section>

    <section class="output-grid">
      <div class="panel">
        <h2>Result</h2>
        <pre data-output>No result yet.</pre>
      </div>
      <div class="panel">
        <h2>Progress and notes</h2>
        <pre class="progress" data-progress>No progress yet.</pre>
        <pre data-metrics-notes>No metrics sampled yet.</pre>
      </div>
    </section>
  </main>
`;

const systemPrompt = app.querySelector<HTMLTextAreaElement>("[data-system-prompt]")!;
const userPrompt = app.querySelector<HTMLTextAreaElement>("[data-user-prompt]")!;
const toolsJson = app.querySelector<HTMLTextAreaElement>("[data-tools-json]")!;
const generationJson = app.querySelector<HTMLTextAreaElement>("[data-generation-json]")!;
const toolsValid = app.querySelector<HTMLElement>("[data-tools-valid]")!;
const generationValid = app.querySelector<HTMLElement>("[data-generation-valid]")!;
const runButton = app.querySelector<HTMLButtonElement>("[data-run]")!;
const refreshButton = app.querySelector<HTMLButtonElement>("[data-refresh]")!;
const resetButton = app.querySelector<HTMLButtonElement>("[data-reset]")!;
const runtimeMode = app.querySelector<HTMLSelectElement>("[data-runtime]")!;
const pollInterval = app.querySelector<HTMLSelectElement>("[data-poll-interval]")!;
const output = app.querySelector<HTMLElement>("[data-output]")!;
const progress = app.querySelector<HTMLElement>("[data-progress]")!;
const metricsNotes = app.querySelector<HTMLElement>("[data-metrics-notes]")!;
const webgpu = app.querySelector<HTMLElement>('[data-status="webgpu"]')!;
const broker = app.querySelector<HTMLElement>('[data-status="broker"]')!;
const clients = app.querySelector<HTMLElement>('[data-status="clients"]')!;
const running = app.querySelector<HTMLElement>('[data-status="running"]')!;
const brokerId = app.querySelector<HTMLElement>("[data-broker-id]")!;
const engineId = app.querySelector<HTMLElement>("[data-engine-id]")!;
const jobsSinceRestart = app.querySelector<HTMLElement>("[data-jobs-since-restart]")!;
const reload = app.querySelector<HTMLElement>("[data-reload]")!;
const workerHeap = app.querySelector<HTMLElement>("[data-worker-heap]")!;
const pageHeap = app.querySelector<HTMLElement>("[data-page-heap]")!;
const storage = app.querySelector<HTMLElement>("[data-storage]")!;
const metricsTime = app.querySelector<HTMLElement>("[data-metrics-time]")!;
const meters = {
  workerHeap: app.querySelector<HTMLElement>('[data-meter="worker-heap"]')!,
  pageHeap: app.querySelector<HTMLElement>('[data-meter="page-heap"]')!,
  storage: app.querySelector<HTMLElement>('[data-meter="storage"]')!,
  jobs: app.querySelector<HTMLElement>('[data-meter="jobs"]')!
};

const llm = new RewriteLLM({
  modelSource: {
    remoteHost: new URL("/models/", window.location.origin).href,
    remotePathTemplate: "{model}/resolve/{revision}/",
    cacheKey: "rewrite-llm-local-models"
  },
  persistence: {
    enabled: true,
    maxCompletedJobsBeforeReload: 20,
    usedHeapRatioThreshold: 0.82,
    storageUsageRatioThreshold: 0.9
  },
  timeoutMs: 20 * 60 * 1000
});

const setDefaults = () => {
  systemPrompt.value = defaultSystemPrompt;
  userPrompt.value = defaultUserPrompt;
  toolsJson.value = JSON.stringify(defaultTools, null, 2);
  generationJson.value = JSON.stringify(defaultGenerationOptions, null, 2);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const validateTool = (value: unknown): value is RewriteLLMTool => {
  if (!isRecord(value)) {
    return false;
  }
  const functionDef = value.function;
  if (!isRecord(functionDef) || typeof functionDef.name !== "string" || functionDef.name.trim() === "") {
    return false;
  }
  if (functionDef.parameters !== undefined && !isRecord(functionDef.parameters)) {
    return false;
  }
  return value.type === undefined || typeof value.type === "string";
};

const parseJson = <T>(text: string, validate: (value: unknown) => value is T, label: string): ValidationResult<T> => {
  try {
    const value: unknown = JSON.parse(text);
    if (!validate(value)) {
      return { ok: false, message: `${label} JSON shape is invalid.` };
    }
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
};

const parseTools = () => parseJson<RewriteLLMTool[]>(
  toolsJson.value,
  (value): value is RewriteLLMTool[] => Array.isArray(value) && value.length > 0 && value.every(validateTool),
  "Tools"
);

const parseGeneration = () => parseJson<GenerationOptions>(
  generationJson.value,
  (value): value is GenerationOptions => isRecord(value),
  "Generation options"
);

const paintValidation = () => {
  const tools = parseTools();
  const generation = parseGeneration();

  toolsValid.dataset.valid = String(tools.ok);
  toolsValid.textContent = tools.ok ? `tools: OK (${tools.value.length})` : `tools: ${tools.message}`;
  generationValid.dataset.valid = String(generation.ok);
  generationValid.textContent = generation.ok ? "generation: OK" : `generation: ${generation.message}`;
  runButton.disabled = !tools.ok || !generation.ok;
};

const formatBytes = (value?: number) => {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value || 0;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const ratioText = (ratio?: number) => (
  Number.isFinite(ratio) ? `${Math.round((ratio || 0) * 100)}%` : "n/a"
);

const metricRatio = (used?: number, limit?: number) => (
  used !== undefined && limit && limit > 0 ? used / limit : undefined
);

const paintMeter = (
  meter: HTMLElement,
  ratio: number | undefined,
  detail: string,
  warningAt = 0.7,
  dangerAt = 0.85
) => {
  const value = meter.querySelector<HTMLElement>("[data-meter-value]")!;
  const bar = meter.querySelector<HTMLElement>("[data-meter-bar]")!;
  const detailEl = meter.querySelector<HTMLElement>("[data-meter-detail]")!;
  const bounded = Number.isFinite(ratio) ? Math.min(Math.max(ratio || 0, 0), 1) : 0;

  meter.dataset.level = !Number.isFinite(ratio)
    ? "unknown"
    : bounded >= dangerAt
      ? "danger"
      : bounded >= warningAt
        ? "warning"
        : "ok";
  value.textContent = ratioText(ratio);
  bar.style.width = `${Math.round(bounded * 100)}%`;
  detailEl.textContent = detail;
};

const metricNotes = (label: string, snapshot?: MemoryMetricSnapshot) => {
  if (!snapshot) {
    return [`${label}: not available`];
  }
  const notes = snapshot.notes.length > 0 ? snapshot.notes : ["all exposed metrics are available"];
  return notes.map((note) => `${label}: ${note}`);
};

const paintState = (state: BackendState) => {
  webgpu.textContent = `WebGPU: ${state.webgpu ? "available" : "unavailable"}`;
  broker.textContent = `Broker: ${state.running ? "running" : "idle"}`;
  clients.textContent = `Clients: ${state.clients}`;
  running.textContent = state.running ? "running" : "idle";
  brokerId.textContent = state.brokerId;
  engineId.textContent = state.engineId || "idle";
  jobsSinceRestart.textContent = String(state.completedJobsSinceRestart);
  reload.textContent = state.reloadRecommended ? `recommended: ${state.reloadReasons.join(", ")}` : "ok";
};

const paintMetrics = (metrics: RewriteLLMMetrics) => {
  const { state, worker, page } = metrics;
  const workerHeapRatio = metricRatio(worker.usedJSHeapSize, worker.jsHeapSizeLimit);
  const pageHeapRatio = metricRatio(page?.usedJSHeapSize, page?.jsHeapSizeLimit);
  const storageRatio = metricRatio(worker.storageUsage ?? page?.storageUsage, worker.storageQuota ?? page?.storageQuota);
  const jobLimit = state.persistence.maxCompletedJobsBeforeReload || 0;
  const jobRatio = jobLimit > 0 ? state.completedJobsSinceRestart / jobLimit : undefined;

  paintState(state);
  workerHeap.textContent = `${formatBytes(worker.usedJSHeapSize)} / ${formatBytes(worker.jsHeapSizeLimit)}`;
  pageHeap.textContent = `${formatBytes(page?.usedJSHeapSize)} / ${formatBytes(page?.jsHeapSizeLimit)}`;
  storage.textContent = `${formatBytes(worker.storageUsage ?? page?.storageUsage)} / ${formatBytes(worker.storageQuota ?? page?.storageQuota)}`;
  metricsTime.textContent = new Date(worker.capturedAt).toLocaleTimeString();
  reload.textContent = metrics.reloadStatus.recommended
    ? `${metrics.reloadStatus.level}: ${metrics.reloadStatus.reasons.join(", ")}`
    : metrics.reloadStatus.level;

  paintMeter(
    meters.workerHeap,
    workerHeapRatio,
    workerHeapRatio === undefined
      ? "Worker heap is not exposed in this browser."
      : `${formatBytes(worker.usedJSHeapSize)} / ${formatBytes(worker.jsHeapSizeLimit)}`,
    state.persistence.usedHeapRatioThreshold ? state.persistence.usedHeapRatioThreshold * 0.85 : 0.7,
    state.persistence.usedHeapRatioThreshold || 0.85
  );
  paintMeter(
    meters.pageHeap,
    pageHeapRatio,
    pageHeapRatio === undefined
      ? "Page heap metrics are browser-dependent."
      : `${formatBytes(page?.usedJSHeapSize)} / ${formatBytes(page?.jsHeapSizeLimit)}`,
    0.7,
    0.85
  );
  paintMeter(
    meters.storage,
    storageRatio,
    storageRatio === undefined
      ? "Storage estimate is not available."
      : `${formatBytes(worker.storageUsage ?? page?.storageUsage)} / ${formatBytes(worker.storageQuota ?? page?.storageQuota)}`,
    state.persistence.storageUsageRatioThreshold ? state.persistence.storageUsageRatioThreshold * 0.85 : 0.75,
    state.persistence.storageUsageRatioThreshold || 0.9
  );
  paintMeter(
    meters.jobs,
    jobRatio,
    jobLimit > 0
      ? `${state.completedJobsSinceRestart} / ${jobLimit} jobs before reload recommendation`
      : "No job-count threshold configured.",
    0.7,
    1
  );

  metricsNotes.textContent = [
    `reload: ${metrics.reloadStatus.recommended ? metrics.reloadStatus.reasons.join("; ") : "not recommended"}`,
    "cpu/gpu utilization: not exposed by standard browser APIs; watch heap, storage, and reload pressure.",
    ...metricNotes("worker", worker),
    ...metricNotes("page", page)
  ].join("\n");
};

const refreshMetrics = async () => {
  try {
    paintMetrics(await llm.metrics());
  } catch (error) {
    metricsTime.textContent = "metrics error";
    metricsNotes.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
};

let monitorTimer: number | undefined;

const stopMonitor = () => {
  if (monitorTimer !== undefined) {
    window.clearInterval(monitorTimer);
    monitorTimer = undefined;
  }
};

const startMonitor = () => {
  stopMonitor();
  const interval = Number(pollInterval.value) || 1000;
  monitorTimer = window.setInterval(() => {
    void refreshMetrics();
  }, interval);
  void refreshMetrics();
};

const appendProgress = (event: ProgressEvent) => {
  const line = event.text || event.status || JSON.stringify(event.detail ?? event);
  progress.textContent = `${progress.textContent === "No progress yet." ? "" : progress.textContent + "\n"}${line}`;
};

const formatResult = (result: ToolCallAttemptResult) => {
  if (result.ok) {
    return {
      ok: true,
      call: result.call,
      parsedArguments: result.call.arguments,
      raw: result.raw
    };
  }
  return result;
};

const runToolCall = async () => {
  const tools = parseTools();
  const generation = parseGeneration();
  if (!tools.ok || !generation.ok) {
    paintValidation();
    return;
  }

  const {
    currentDate,
    toolMode,
    ...generationOptions
  } = generation.value;

  output.textContent = "Running...";
  progress.textContent = "";
  running.textContent = "running";
  startMonitor();

  try {
    const result = await llm.tryExtractToolCall(
      userPrompt.value,
      tools.value,
      {
        ...generationOptions,
        currentDate: typeof currentDate === "string" ? currentDate : undefined,
        toolMode: toolMode === "required" || toolMode === "auto" ? toolMode : "auto",
        systemPrompt: systemPrompt.value
      },
      {
        mock: runtimeMode.value === "mock",
        timeoutMs: 20 * 60 * 1000,
        onProgress: appendProgress,
        onStatus: paintState
      }
    );

    output.textContent = JSON.stringify(formatResult(result), null, 2);
  } catch (error) {
    output.textContent = error instanceof Error
      ? JSON.stringify({ ok: false, name: error.name, message: error.message }, null, 2)
      : String(error);
  } finally {
    paintState(await llm.state());
    await refreshMetrics();
    stopMonitor();
  }
};

setDefaults();
paintValidation();

toolsJson.addEventListener("input", paintValidation);
generationJson.addEventListener("input", paintValidation);
runButton.addEventListener("click", () => void runToolCall());
refreshButton.addEventListener("click", () => void refreshMetrics());
resetButton.addEventListener("click", () => {
  setDefaults();
  paintValidation();
});
pollInterval.addEventListener("change", () => {
  if (monitorTimer !== undefined) {
    startMonitor();
  }
});

void llm.ready().then((state) => {
  paintState(state);
  void refreshMetrics();
});
