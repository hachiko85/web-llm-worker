import { RewriteLLM, type BackendState, type MemoryMetricSnapshot, type ProgressEvent, type RewriteLLMMetrics, type RewriteLLMTool } from "../../src/index";
import "./test-app.css";

type Action = "summarize" | "translate" | "infer" | "filter";

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
        <span data-status="persistence">Persistence: checking</span>
      </div>
    </section>

    <section class="workspace">
      <div class="panel input-panel">
        <label>
          Input
          <textarea data-input rows="9">今年の一月から2026-03-03に掲載されたお祭りに関する記事を調べて</textarea>
        </label>
        <div class="controls">
          <button type="button" data-action="summarize">要約</button>
          <button type="button" data-action="translate">翻訳</button>
          <button type="button" data-action="infer">推論</button>
          <button type="button" data-action="filter">検索条件</button>
          <button type="button" data-action="state">状態更新</button>
          <button type="button" data-action="metrics">メトリクス更新</button>
          <button type="button" data-action="restart">ワーカー再起動</button>
        </div>
        <label class="toggle">
          <input data-mock type="checkbox" checked />
          <span>Mock mode</span>
        </label>
        <label class="toggle">
          <input data-auto-monitor type="checkbox" checked />
          <span>Auto monitor</span>
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
      <div>
        <span>reload</span>
        <strong data-reload>ok</strong>
      </div>
      <div>
        <span>jobs since restart</span>
        <strong data-jobs-since-restart>0</strong>
      </div>
      <div>
        <span>model host</span>
        <strong data-model-host>default</strong>
      </div>
      <div>
        <span>model template</span>
        <strong data-model-template>default</strong>
      </div>
    </section>

    <section class="metrics">
      <div class="metrics-header">
        <h2>Worker metrics</h2>
        <span data-metrics-time>not sampled</span>
      </div>
      <div class="metrics-grid">
        <div>
          <span>worker heap used</span>
          <strong data-worker-heap-used>n/a</strong>
        </div>
        <div>
          <span>worker heap limit</span>
          <strong data-worker-heap-limit>n/a</strong>
        </div>
        <div>
          <span>page heap used</span>
          <strong data-page-heap-used>n/a</strong>
        </div>
        <div>
          <span>page heap limit</span>
          <strong data-page-heap-limit>n/a</strong>
        </div>
        <div>
          <span>agent memory</span>
          <strong data-agent-memory>n/a</strong>
        </div>
        <div>
          <span>device memory</span>
          <strong data-device-memory>n/a</strong>
        </div>
        <div>
          <span>storage usage</span>
          <strong data-storage-usage>n/a</strong>
        </div>
        <div>
          <span>storage quota</span>
          <strong data-storage-quota>n/a</strong>
        </div>
        <div>
          <span>isolation</span>
          <strong data-isolation>n/a</strong>
        </div>
      </div>
      <div class="monitor-grid">
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
      </div>
      <pre data-metrics-notes>No metrics sampled yet.</pre>
    </section>
  </main>
`;

const input = app.querySelector<HTMLTextAreaElement>("[data-input]")!;
const output = app.querySelector<HTMLElement>("[data-output]")!;
const mock = app.querySelector<HTMLInputElement>("[data-mock]")!;
const autoMonitor = app.querySelector<HTMLInputElement>("[data-auto-monitor]")!;
const running = app.querySelector<HTMLElement>("[data-running]")!;
const webgpu = app.querySelector<HTMLElement>('[data-status="webgpu"]')!;
const broker = app.querySelector<HTMLElement>('[data-status="broker"]')!;
const clients = app.querySelector<HTMLElement>('[data-status="clients"]')!;
const persistenceStatus = app.querySelector<HTMLElement>('[data-status="persistence"]')!;
const brokerId = app.querySelector<HTMLElement>("[data-broker-id]")!;
const engineId = app.querySelector<HTMLElement>("[data-engine-id]")!;
const completed = app.querySelector<HTMLElement>("[data-completed]")!;
const queue = app.querySelector<HTMLElement>("[data-queue]")!;
const reload = app.querySelector<HTMLElement>("[data-reload]")!;
const jobsSinceRestart = app.querySelector<HTMLElement>("[data-jobs-since-restart]")!;
const modelHost = app.querySelector<HTMLElement>("[data-model-host]")!;
const modelTemplate = app.querySelector<HTMLElement>("[data-model-template]")!;
const metricsTime = app.querySelector<HTMLElement>("[data-metrics-time]")!;
const workerHeapUsed = app.querySelector<HTMLElement>("[data-worker-heap-used]")!;
const workerHeapLimit = app.querySelector<HTMLElement>("[data-worker-heap-limit]")!;
const pageHeapUsed = app.querySelector<HTMLElement>("[data-page-heap-used]")!;
const pageHeapLimit = app.querySelector<HTMLElement>("[data-page-heap-limit]")!;
const agentMemory = app.querySelector<HTMLElement>("[data-agent-memory]")!;
const deviceMemory = app.querySelector<HTMLElement>("[data-device-memory]")!;
const storageUsage = app.querySelector<HTMLElement>("[data-storage-usage]")!;
const storageQuota = app.querySelector<HTMLElement>("[data-storage-quota]")!;
const isolation = app.querySelector<HTMLElement>("[data-isolation]")!;
const metricsNotes = app.querySelector<HTMLElement>("[data-metrics-notes]")!;
const meters = {
  workerHeap: app.querySelector<HTMLElement>('[data-meter="worker-heap"]')!,
  pageHeap: app.querySelector<HTMLElement>('[data-meter="page-heap"]')!,
  storage: app.querySelector<HTMLElement>('[data-meter="storage"]')!,
  jobs: app.querySelector<HTMLElement>('[data-meter="jobs"]')!
};

const llm = new RewriteLLM({
  mock: true,
  modelSource: {
    remoteHost: new URL("/models/", window.location.origin).href,
    remotePathTemplate: "{model}/resolve/{revision}/",
    cacheKey: "rewrite-llm-local-models"
  },
  persistence: {
    enabled: true,
    maxCompletedJobsBeforeReload: 2,
    usedHeapRatioThreshold: 0.82,
    storageUsageRatioThreshold: 0.9
  },
  timeoutMs: 10 * 60 * 1000
});

const articleSearchTool: RewriteLLMTool = {
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
};

const paintState = (state: BackendState) => {
  webgpu.textContent = `WebGPU: ${state.webgpu ? "available" : "unavailable"}`;
  broker.textContent = `Broker: ${state.running ? "running" : "idle"}`;
  clients.textContent = `Clients: ${state.clients}`;
  persistenceStatus.textContent = `Persistence: ${state.persistence.enabled ? "on" : "off"}`;
  brokerId.textContent = state.brokerId;
  engineId.textContent = state.engineId || "idle";
  completed.textContent = String(state.completedJobs);
  jobsSinceRestart.textContent = String(state.completedJobsSinceRestart);
  queue.textContent = String(state.queued);
  reload.textContent = state.reloadRecommended ? "recommended" : "ok";
  modelHost.textContent = state.modelSource?.remoteHost || "default";
  modelTemplate.textContent = state.modelSource?.remotePathTemplate || "default";
  running.textContent = state.running ? "running" : "idle";
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

const metricNotes = (label: string, snapshot?: MemoryMetricSnapshot) => {
  if (!snapshot) {
    return [`${label}: not available`];
  }

  const notes = snapshot.notes.length > 0 ? snapshot.notes : ["all exposed metrics are available"];
  return notes.map((note) => `${label}: ${note}`);
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

const paintMetrics = (metrics: RewriteLLMMetrics) => {
  const worker = metrics.worker;
  const page = metrics.page;
  const state = metrics.state;
  const workerHeapRatio = metricRatio(worker.usedJSHeapSize, worker.jsHeapSizeLimit);
  const pageHeapRatio = metricRatio(page?.usedJSHeapSize, page?.jsHeapSizeLimit);
  const storageRatio = metricRatio(worker.storageUsage ?? page?.storageUsage, worker.storageQuota ?? page?.storageQuota);
  const jobLimit = state.persistence.maxCompletedJobsBeforeReload || 0;
  const jobRatio = jobLimit > 0 ? state.completedJobsSinceRestart / jobLimit : undefined;

  paintState(metrics.state);
  metricsTime.textContent = new Date(worker.capturedAt).toLocaleTimeString();
  workerHeapUsed.textContent = formatBytes(worker.usedJSHeapSize);
  workerHeapLimit.textContent = formatBytes(worker.jsHeapSizeLimit);
  pageHeapUsed.textContent = formatBytes(page?.usedJSHeapSize);
  pageHeapLimit.textContent = formatBytes(page?.jsHeapSizeLimit);
  agentMemory.textContent = formatBytes(page?.userAgentSpecificMemory ?? worker.userAgentSpecificMemory);
  deviceMemory.textContent = worker.deviceMemoryGB ? `${worker.deviceMemoryGB} GB` : "n/a";
  storageUsage.textContent = formatBytes(worker.storageUsage ?? page?.storageUsage);
  storageQuota.textContent = formatBytes(worker.storageQuota ?? page?.storageQuota);
  isolation.textContent = `worker: ${worker.crossOriginIsolated ? "isolated" : "not isolated"} / page: ${page?.crossOriginIsolated ? "isolated" : "not isolated"}`;
  reload.textContent = metrics.reloadStatus.recommended ? `${metrics.reloadStatus.level}: ${metrics.reloadStatus.reasons.join(", ")}` : metrics.reloadStatus.level;
  paintMeter(
    meters.workerHeap,
    workerHeapRatio,
    workerHeapRatio === undefined
      ? "performance.memory is usually unavailable inside workers."
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
      ? "Storage estimate is not available in this context."
      : `${formatBytes(worker.storageUsage ?? page?.storageUsage)} / ${formatBytes(worker.storageQuota ?? page?.storageQuota)}`,
    state.persistence.storageUsageRatioThreshold ? state.persistence.storageUsageRatioThreshold * 0.85 : 0.75,
    state.persistence.storageUsageRatioThreshold || 0.9
  );
  paintMeter(
    meters.jobs,
    jobRatio,
    jobLimit > 0
      ? `${state.completedJobsSinceRestart} / ${jobLimit} jobs before reload recommendation`
      : "No job-count reload threshold configured.",
    0.7,
    1
  );
  metricsNotes.textContent = [
    `reload: ${metrics.reloadStatus.recommended ? metrics.reloadStatus.reasons.join("; ") : "not recommended"}`,
    "cpu/gpu utilization: not exposed by standard browser APIs; use reload pressure and memory/storage estimates as browser-side signals.",
    ...metricNotes("worker", worker),
    ...metricNotes("page", page)
  ].join("\n");
};

const refreshMetrics = async () => {
  try {
    const metrics = await llm.metrics();
    paintMetrics(metrics);
  } catch (error) {
    metricsTime.textContent = "metrics error";
    metricsNotes.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
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
    } else if (action === "filter") {
      result = await llm.extractToolCall(input.value, articleSearchTool, { currentDate: "2026-05-24" }, runtime);
    } else {
      result = await llm.complete(`推論してください:\n${input.value}`, { max_new_tokens: 96 }, runtime);
    }

    output.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  } catch (error) {
    output.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } finally {
    const state = await llm.state();
    paintState(state);
    await refreshMetrics();
  }
};

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const action = target.dataset.action;

  if (action === "state") {
    void llm.state().then(paintState);
    return;
  }

  if (action === "metrics") {
    void refreshMetrics();
    return;
  }

  if (action === "restart") {
    void llm.restart().then((state) => {
      paintState(state);
      void refreshMetrics();
    });
    return;
  }

  if (action === "summarize" || action === "translate" || action === "infer" || action === "filter") {
    void runAction(action);
  }
});

void llm.ready().then((state) => {
  paintState(state);
  void refreshMetrics();
});

window.setInterval(() => {
  if (autoMonitor.checked && document.visibilityState === "visible") {
    void refreshMetrics();
  }
}, 3000);
