import{RewriteLLM as e}from"../rewrite-llm.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var t=document.body.dataset.site||`Test Site`,n=document.querySelector(`#app`);if(!n)throw Error(`Missing #app element.`);n.innerHTML=`
  <main class="shell">
    <section class="topbar">
      <div>
        <p class="eyebrow">RewriteLLM singleton verification</p>
        <h1>${t}</h1>
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
`;var r=n.querySelector(`[data-input]`),i=n.querySelector(`[data-output]`),a=n.querySelector(`[data-mock]`),o=n.querySelector(`[data-auto-monitor]`),s=n.querySelector(`[data-running]`),c=n.querySelector(`[data-status="webgpu"]`),l=n.querySelector(`[data-status="broker"]`),u=n.querySelector(`[data-status="clients"]`),d=n.querySelector(`[data-status="persistence"]`),f=n.querySelector(`[data-broker-id]`),p=n.querySelector(`[data-engine-id]`),m=n.querySelector(`[data-completed]`),h=n.querySelector(`[data-queue]`),g=n.querySelector(`[data-reload]`),_=n.querySelector(`[data-jobs-since-restart]`),v=n.querySelector(`[data-model-host]`),y=n.querySelector(`[data-model-template]`),b=n.querySelector(`[data-metrics-time]`),x=n.querySelector(`[data-worker-heap-used]`),S=n.querySelector(`[data-worker-heap-limit]`),C=n.querySelector(`[data-page-heap-used]`),w=n.querySelector(`[data-page-heap-limit]`),T=n.querySelector(`[data-agent-memory]`),E=n.querySelector(`[data-device-memory]`),D=n.querySelector(`[data-storage-usage]`),O=n.querySelector(`[data-storage-quota]`),k=n.querySelector(`[data-isolation]`),A=n.querySelector(`[data-metrics-notes]`),j={workerHeap:n.querySelector(`[data-meter="worker-heap"]`),pageHeap:n.querySelector(`[data-meter="page-heap"]`),storage:n.querySelector(`[data-meter="storage"]`),jobs:n.querySelector(`[data-meter="jobs"]`)},M=new e({mock:!0,modelSource:{remoteHost:new URL(`/models/`,window.location.origin).href,remotePathTemplate:`{model}/resolve/{revision}/`,cacheKey:`rewrite-llm-local-models`},persistence:{enabled:!0,maxCompletedJobsBeforeReload:2,usedHeapRatioThreshold:.82,storageUsageRatioThreshold:.9},timeoutMs:600*1e3}),N={type:`function`,function:{name:`searchArticles`,description:`記事検索フィルターを作成する`,parameters:{type:`object`,additionalProperties:!1,properties:{keyword:{type:`string`,description:`検索キーワード。自然な日本語から名詞句だけを短く抽出する。「お祭り」は「祭り」に正規化する。`},"ins-from":{type:`string`,description:`掲載日の開始日。YYYY-MM-DD。`},"ins-to":{type:`string`,description:`掲載日の終了日。YYYY-MM-DD。`},tags:{type:`array`,description:`タグ候補から選ぶ。`,items:{type:`string`,enum:[`報知`,`記事`,`お知らせ`]}}},required:[`keyword`,`ins-from`,`ins-to`,`tags`]}}},P=e=>{c.textContent=`WebGPU: ${e.webgpu?`available`:`unavailable`}`,l.textContent=`Broker: ${e.running?`running`:`idle`}`,u.textContent=`Clients: ${e.clients}`,d.textContent=`Persistence: ${e.persistence.enabled?`on`:`off`}`,f.textContent=e.brokerId,p.textContent=e.engineId||`idle`,m.textContent=String(e.completedJobs),_.textContent=String(e.completedJobsSinceRestart),h.textContent=String(e.queued),g.textContent=e.reloadRecommended?`recommended`:`ok`,v.textContent=e.modelSource?.remoteHost||`default`,y.textContent=e.modelSource?.remotePathTemplate||`default`,s.textContent=e.running?`running`:`idle`},F=e=>{if(!Number.isFinite(e))return`n/a`;let t=[`B`,`KB`,`MB`,`GB`],n=e||0,r=0;for(;n>=1024&&r<t.length-1;)n/=1024,r+=1;return`${n.toFixed(r===0?0:1)} ${t[r]}`},I=(e,t)=>t?(t.notes.length>0?t.notes:[`all exposed metrics are available`]).map(t=>`${e}: ${t}`):[`${e}: not available`],L=e=>Number.isFinite(e)?`${Math.round((e||0)*100)}%`:`n/a`,R=(e,t)=>e!==void 0&&t&&t>0?e/t:void 0,z=(e,t,n,r=.7,i=.85)=>{let a=e.querySelector(`[data-meter-value]`),o=e.querySelector(`[data-meter-bar]`),s=e.querySelector(`[data-meter-detail]`),c=Number.isFinite(t)?Math.min(Math.max(t||0,0),1):0;e.dataset.level=Number.isFinite(t)?c>=i?`danger`:c>=r?`warning`:`ok`:`unknown`,a.textContent=L(t),o.style.width=`${Math.round(c*100)}%`,s.textContent=n},B=e=>{let t=e.worker,n=e.page,r=e.state,i=R(t.usedJSHeapSize,t.jsHeapSizeLimit),a=R(n?.usedJSHeapSize,n?.jsHeapSizeLimit),o=R(t.storageUsage??n?.storageUsage,t.storageQuota??n?.storageQuota),s=r.persistence.maxCompletedJobsBeforeReload||0,c=s>0?r.completedJobsSinceRestart/s:void 0;P(e.state),b.textContent=new Date(t.capturedAt).toLocaleTimeString(),x.textContent=F(t.usedJSHeapSize),S.textContent=F(t.jsHeapSizeLimit),C.textContent=F(n?.usedJSHeapSize),w.textContent=F(n?.jsHeapSizeLimit),T.textContent=F(n?.userAgentSpecificMemory??t.userAgentSpecificMemory),E.textContent=t.deviceMemoryGB?`${t.deviceMemoryGB} GB`:`n/a`,D.textContent=F(t.storageUsage??n?.storageUsage),O.textContent=F(t.storageQuota??n?.storageQuota),k.textContent=`worker: ${t.crossOriginIsolated?`isolated`:`not isolated`} / page: ${n?.crossOriginIsolated?`isolated`:`not isolated`}`,g.textContent=e.reloadStatus.recommended?`${e.reloadStatus.level}: ${e.reloadStatus.reasons.join(`, `)}`:e.reloadStatus.level,z(j.workerHeap,i,i===void 0?`performance.memory is usually unavailable inside workers.`:`${F(t.usedJSHeapSize)} / ${F(t.jsHeapSizeLimit)}`,r.persistence.usedHeapRatioThreshold?r.persistence.usedHeapRatioThreshold*.85:.7,r.persistence.usedHeapRatioThreshold||.85),z(j.pageHeap,a,a===void 0?`Page heap metrics are browser-dependent.`:`${F(n?.usedJSHeapSize)} / ${F(n?.jsHeapSizeLimit)}`,.7,.85),z(j.storage,o,o===void 0?`Storage estimate is not available in this context.`:`${F(t.storageUsage??n?.storageUsage)} / ${F(t.storageQuota??n?.storageQuota)}`,r.persistence.storageUsageRatioThreshold?r.persistence.storageUsageRatioThreshold*.85:.75,r.persistence.storageUsageRatioThreshold||.9),z(j.jobs,c,s>0?`${r.completedJobsSinceRestart} / ${s} jobs before reload recommendation`:`No job-count reload threshold configured.`,.7,1),A.textContent=[`reload: ${e.reloadStatus.recommended?e.reloadStatus.reasons.join(`; `):`not recommended`}`,`cpu/gpu utilization: not exposed by standard browser APIs; use reload pressure and memory/storage estimates as browser-side signals.`,...I(`worker`,t),...I(`page`,n)].join(`
`)},V=async()=>{try{B(await M.metrics())}catch(e){b.textContent=`metrics error`,A.textContent=e instanceof Error?`${e.name}: ${e.message}`:String(e)}},H=e=>{e.text&&(i.textContent=`${i.textContent}\n${e.text}`.trim())},U=async e=>{let t={mock:a.checked,onProgress:H,onStatus:P};i.textContent=``,s.textContent=`running`;try{let n;n=e===`summarize`?await M.summarize(r.value,{language:`Japanese`},t):e===`translate`?await M.translate(r.value,{sourceLanguage:`Japanese`,targetLanguage:`English`},t):e===`filter`?await M.extractToolCall(r.value,N,{currentDate:`2026-05-24`},t):await M.complete(`推論してください:\n${r.value}`,{max_new_tokens:96},t),i.textContent=typeof n==`string`?n:JSON.stringify(n,null,2)}catch(e){i.textContent=e instanceof Error?`${e.name}: ${e.message}`:String(e)}finally{P(await M.state()),await V()}};n.addEventListener(`click`,e=>{let t=e.target.dataset.action;if(t===`state`){M.state().then(P);return}if(t===`metrics`){V();return}if(t===`restart`){M.restart().then(e=>{P(e),V()});return}(t===`summarize`||t===`translate`||t===`infer`||t===`filter`)&&U(t)}),M.ready().then(e=>{P(e),V()}),window.setInterval(()=>{o.checked&&document.visibilityState===`visible`&&V()},3e3);
//# sourceMappingURL=test-app-ByWjT1i5.js.map