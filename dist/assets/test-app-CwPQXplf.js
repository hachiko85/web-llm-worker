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
          <textarea data-input rows="9">日本語の文章を短く要約し、そのあと英語へ翻訳できるか確認します。SharedWorker の brokerId が Site A と Site B で同じなら、二つのページが同じバックエンドに接続できています。</textarea>
        </label>
        <div class="controls">
          <button type="button" data-action="summarize">要約</button>
          <button type="button" data-action="translate">翻訳</button>
          <button type="button" data-action="infer">推論</button>
          <button type="button" data-action="state">状態更新</button>
          <button type="button" data-action="metrics">メトリクス更新</button>
          <button type="button" data-action="restart">ワーカー再起動</button>
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
      <pre data-metrics-notes>No metrics sampled yet.</pre>
    </section>
  </main>
`;var r=n.querySelector(`[data-input]`),i=n.querySelector(`[data-output]`),a=n.querySelector(`[data-mock]`),o=n.querySelector(`[data-running]`),s=n.querySelector(`[data-status="webgpu"]`),c=n.querySelector(`[data-status="broker"]`),l=n.querySelector(`[data-status="clients"]`),u=n.querySelector(`[data-status="persistence"]`),d=n.querySelector(`[data-broker-id]`),f=n.querySelector(`[data-engine-id]`),p=n.querySelector(`[data-completed]`),m=n.querySelector(`[data-queue]`),h=n.querySelector(`[data-reload]`),g=n.querySelector(`[data-jobs-since-restart]`),_=n.querySelector(`[data-model-host]`),v=n.querySelector(`[data-model-template]`),y=n.querySelector(`[data-metrics-time]`),b=n.querySelector(`[data-worker-heap-used]`),x=n.querySelector(`[data-worker-heap-limit]`),S=n.querySelector(`[data-page-heap-used]`),C=n.querySelector(`[data-page-heap-limit]`),w=n.querySelector(`[data-agent-memory]`),T=n.querySelector(`[data-device-memory]`),E=n.querySelector(`[data-storage-usage]`),D=n.querySelector(`[data-storage-quota]`),O=n.querySelector(`[data-isolation]`),k=n.querySelector(`[data-metrics-notes]`),A=new e({mock:!0,modelSource:{remoteHost:new URL(`/models/`,window.location.origin).href,remotePathTemplate:`{model}/resolve/{revision}/`,cacheKey:`rewrite-llm-local-models`},persistence:{enabled:!0,maxCompletedJobsBeforeReload:2,usedHeapRatioThreshold:.82,storageUsageRatioThreshold:.9},timeoutMs:600*1e3}),j=e=>{s.textContent=`WebGPU: ${e.webgpu?`available`:`unavailable`}`,c.textContent=`Broker: ${e.running?`running`:`idle`}`,l.textContent=`Clients: ${e.clients}`,u.textContent=`Persistence: ${e.persistence.enabled?`on`:`off`}`,d.textContent=e.brokerId,f.textContent=e.engineId||`idle`,p.textContent=String(e.completedJobs),g.textContent=String(e.completedJobsSinceRestart),m.textContent=String(e.queued),h.textContent=e.reloadRecommended?`recommended`:`ok`,_.textContent=e.modelSource?.remoteHost||`default`,v.textContent=e.modelSource?.remotePathTemplate||`default`,o.textContent=e.running?`running`:`idle`},M=e=>{if(!Number.isFinite(e))return`n/a`;let t=[`B`,`KB`,`MB`,`GB`],n=e||0,r=0;for(;n>=1024&&r<t.length-1;)n/=1024,r+=1;return`${n.toFixed(r===0?0:1)} ${t[r]}`},N=(e,t)=>t?(t.notes.length>0?t.notes:[`all exposed metrics are available`]).map(t=>`${e}: ${t}`):[`${e}: not available`],P=e=>{let t=e.worker,n=e.page;j(e.state),y.textContent=new Date(t.capturedAt).toLocaleTimeString(),b.textContent=M(t.usedJSHeapSize),x.textContent=M(t.jsHeapSizeLimit),S.textContent=M(n?.usedJSHeapSize),C.textContent=M(n?.jsHeapSizeLimit),w.textContent=M(n?.userAgentSpecificMemory??t.userAgentSpecificMemory),T.textContent=t.deviceMemoryGB?`${t.deviceMemoryGB} GB`:`n/a`,E.textContent=M(t.storageUsage??n?.storageUsage),D.textContent=M(t.storageQuota??n?.storageQuota),O.textContent=`worker: ${t.crossOriginIsolated?`isolated`:`not isolated`} / page: ${n?.crossOriginIsolated?`isolated`:`not isolated`}`,h.textContent=e.reloadStatus.recommended?`${e.reloadStatus.level}: ${e.reloadStatus.reasons.join(`, `)}`:e.reloadStatus.level,k.textContent=[`reload: ${e.reloadStatus.recommended?e.reloadStatus.reasons.join(`; `):`not recommended`}`,...N(`worker`,t),...N(`page`,n)].join(`
`)},F=async()=>{try{P(await A.metrics())}catch(e){y.textContent=`metrics error`,k.textContent=e instanceof Error?`${e.name}: ${e.message}`:String(e)}},I=e=>{e.text&&(i.textContent=`${i.textContent}\n${e.text}`.trim())},L=async e=>{let t={mock:a.checked,onProgress:I,onStatus:j};i.textContent=``,o.textContent=`running`;try{let n;n=e===`summarize`?await A.summarize(r.value,{language:`Japanese`},t):e===`translate`?await A.translate(r.value,{sourceLanguage:`Japanese`,targetLanguage:`English`},t):await A.complete(`推論してください:\n${r.value}`,{max_new_tokens:96},t),i.textContent=typeof n==`string`?n:JSON.stringify(n,null,2)}catch(e){i.textContent=e instanceof Error?`${e.name}: ${e.message}`:String(e)}finally{j(await A.state()),await F()}};n.addEventListener(`click`,e=>{let t=e.target.dataset.action;if(t===`state`){A.state().then(j);return}if(t===`metrics`){F();return}if(t===`restart`){A.restart().then(e=>{j(e),F()});return}(t===`summarize`||t===`translate`||t===`infer`)&&L(t)}),A.ready().then(e=>{j(e),F()});
//# sourceMappingURL=test-app-CwPQXplf.js.map