import{RewriteLLM as e}from"../../../rewrite-llm.js";import"../../modulepreload-polyfill-CSRv37U6.js";var t=document.querySelector(`#app`);if(!t)throw Error(`Missing #app element.`);var n=[`You are configuring only the provided article search condition tool.`,`Call the tool only when the user request can be converted into article search conditions.`,`A valid request should provide or imply a search keyword, publication date range, and one of the available tag candidates.`,`If the prompt is unrelated to article search conditions, do not call the tool.`,`When you do not call the tool, return this exact Japanese message: 記事検索条件を設定するには、検索キーワード、掲載日の開始日と終了日、タグ候補を指定してください。`].join(`
`),r=`今年の一月から2026-03-03に掲載されたお祭りに関する記事を調べて`,i=[{type:`function`,function:{name:`searchArticles`,description:`記事検索フィルターを作成する`,parameters:{type:`object`,additionalProperties:!1,properties:{keyword:{type:`string`,description:`検索キーワード。自然な日本語から名詞句だけを短く抽出する。「お祭り」は「祭り」に正規化する。`},"ins-from":{type:`string`,description:`掲載日の開始日。YYYY-MM-DD。`},"ins-to":{type:`string`,description:`掲載日の終了日。YYYY-MM-DD。`},tags:{type:`array`,description:`タグ候補から選ぶ。`,items:{type:`string`,enum:[`報知`,`記事`,`お知らせ`]}}},required:[`keyword`,`ins-from`,`ins-to`,`tags`]}}}],a={currentDate:`2026-05-25`,toolMode:`auto`,max_new_tokens:192,do_sample:!1,return_full_text:!1};t.innerHTML=`
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
`;var o=t.querySelector(`[data-system-prompt]`),s=t.querySelector(`[data-user-prompt]`),c=t.querySelector(`[data-tools-json]`),l=t.querySelector(`[data-generation-json]`),u=t.querySelector(`[data-tools-valid]`),d=t.querySelector(`[data-generation-valid]`),f=t.querySelector(`[data-run]`),p=t.querySelector(`[data-refresh]`),m=t.querySelector(`[data-reset]`),h=t.querySelector(`[data-runtime]`),g=t.querySelector(`[data-poll-interval]`),_=t.querySelector(`[data-output]`),v=t.querySelector(`[data-progress]`),y=t.querySelector(`[data-metrics-notes]`),b=t.querySelector(`[data-status="webgpu"]`),x=t.querySelector(`[data-status="broker"]`),S=t.querySelector(`[data-status="clients"]`),C=t.querySelector(`[data-status="running"]`),w=t.querySelector(`[data-broker-id]`),T=t.querySelector(`[data-engine-id]`),E=t.querySelector(`[data-jobs-since-restart]`),D=t.querySelector(`[data-reload]`),O=t.querySelector(`[data-worker-heap]`),k=t.querySelector(`[data-page-heap]`),A=t.querySelector(`[data-storage]`),j=t.querySelector(`[data-metrics-time]`),M={workerHeap:t.querySelector(`[data-meter="worker-heap"]`),pageHeap:t.querySelector(`[data-meter="page-heap"]`),storage:t.querySelector(`[data-meter="storage"]`),jobs:t.querySelector(`[data-meter="jobs"]`)},N=new e({modelSource:{remoteHost:new URL(`/models/`,window.location.origin).href,remotePathTemplate:`{model}/resolve/{revision}/`,cacheKey:`rewrite-llm-local-models`},persistence:{enabled:!0,maxCompletedJobsBeforeReload:20,usedHeapRatioThreshold:.82,storageUsageRatioThreshold:.9},timeoutMs:1200*1e3}),P=()=>{o.value=n,s.value=r,c.value=JSON.stringify(i,null,2),l.value=JSON.stringify(a,null,2)},F=e=>typeof e==`object`&&!!e&&!Array.isArray(e),I=e=>{if(!F(e))return!1;let t=e.function;return!F(t)||typeof t.name!=`string`||t.name.trim()===``||t.parameters!==void 0&&!F(t.parameters)?!1:e.type===void 0||typeof e.type==`string`},L=(e,t,n)=>{try{let r=JSON.parse(e);return t(r)?{ok:!0,value:r}:{ok:!1,message:`${n} JSON shape is invalid.`}}catch(e){return{ok:!1,message:e instanceof Error?e.message:String(e)}}},R=()=>L(c.value,e=>Array.isArray(e)&&e.length>0&&e.every(I),`Tools`),z=()=>L(l.value,e=>F(e),`Generation options`),B=()=>{let e=R(),t=z();u.dataset.valid=String(e.ok),u.textContent=e.ok?`tools: OK (${e.value.length})`:`tools: ${e.message}`,d.dataset.valid=String(t.ok),d.textContent=t.ok?`generation: OK`:`generation: ${t.message}`,f.disabled=!e.ok||!t.ok},V=e=>{if(!Number.isFinite(e))return`n/a`;let t=[`B`,`KB`,`MB`,`GB`],n=e||0,r=0;for(;n>=1024&&r<t.length-1;)n/=1024,r+=1;return`${n.toFixed(r===0?0:1)} ${t[r]}`},H=e=>Number.isFinite(e)?`${Math.round((e||0)*100)}%`:`n/a`,U=(e,t)=>e!==void 0&&t&&t>0?e/t:void 0,W=(e,t,n,r=.7,i=.85)=>{let a=e.querySelector(`[data-meter-value]`),o=e.querySelector(`[data-meter-bar]`),s=e.querySelector(`[data-meter-detail]`),c=Number.isFinite(t)?Math.min(Math.max(t||0,0),1):0;e.dataset.level=Number.isFinite(t)?c>=i?`danger`:c>=r?`warning`:`ok`:`unknown`,a.textContent=H(t),o.style.width=`${Math.round(c*100)}%`,s.textContent=n},G=(e,t)=>t?(t.notes.length>0?t.notes:[`all exposed metrics are available`]).map(t=>`${e}: ${t}`):[`${e}: not available`],K=e=>{b.textContent=`WebGPU: ${e.webgpu?`available`:`unavailable`}`,x.textContent=`Broker: ${e.running?`running`:`idle`}`,S.textContent=`Clients: ${e.clients}`,C.textContent=e.running?`running`:`idle`,w.textContent=e.brokerId,T.textContent=e.engineId||`idle`,E.textContent=String(e.completedJobsSinceRestart),D.textContent=e.reloadRecommended?`recommended: ${e.reloadReasons.join(`, `)}`:`ok`},q=e=>{let{state:t,worker:n,page:r}=e,i=U(n.usedJSHeapSize,n.jsHeapSizeLimit),a=U(r?.usedJSHeapSize,r?.jsHeapSizeLimit),o=U(n.storageUsage??r?.storageUsage,n.storageQuota??r?.storageQuota),s=t.persistence.maxCompletedJobsBeforeReload||0,c=s>0?t.completedJobsSinceRestart/s:void 0;K(t),O.textContent=`${V(n.usedJSHeapSize)} / ${V(n.jsHeapSizeLimit)}`,k.textContent=`${V(r?.usedJSHeapSize)} / ${V(r?.jsHeapSizeLimit)}`,A.textContent=`${V(n.storageUsage??r?.storageUsage)} / ${V(n.storageQuota??r?.storageQuota)}`,j.textContent=new Date(n.capturedAt).toLocaleTimeString(),D.textContent=e.reloadStatus.recommended?`${e.reloadStatus.level}: ${e.reloadStatus.reasons.join(`, `)}`:e.reloadStatus.level,W(M.workerHeap,i,i===void 0?`Worker heap is not exposed in this browser.`:`${V(n.usedJSHeapSize)} / ${V(n.jsHeapSizeLimit)}`,t.persistence.usedHeapRatioThreshold?t.persistence.usedHeapRatioThreshold*.85:.7,t.persistence.usedHeapRatioThreshold||.85),W(M.pageHeap,a,a===void 0?`Page heap metrics are browser-dependent.`:`${V(r?.usedJSHeapSize)} / ${V(r?.jsHeapSizeLimit)}`,.7,.85),W(M.storage,o,o===void 0?`Storage estimate is not available.`:`${V(n.storageUsage??r?.storageUsage)} / ${V(n.storageQuota??r?.storageQuota)}`,t.persistence.storageUsageRatioThreshold?t.persistence.storageUsageRatioThreshold*.85:.75,t.persistence.storageUsageRatioThreshold||.9),W(M.jobs,c,s>0?`${t.completedJobsSinceRestart} / ${s} jobs before reload recommendation`:`No job-count threshold configured.`,.7,1),y.textContent=[`reload: ${e.reloadStatus.recommended?e.reloadStatus.reasons.join(`; `):`not recommended`}`,`cpu/gpu utilization: not exposed by standard browser APIs; watch heap, storage, and reload pressure.`,...G(`worker`,n),...G(`page`,r)].join(`
`)},J=async()=>{try{q(await N.metrics())}catch(e){j.textContent=`metrics error`,y.textContent=e instanceof Error?`${e.name}: ${e.message}`:String(e)}},Y,X=()=>{Y!==void 0&&(window.clearInterval(Y),Y=void 0)},Z=()=>{X();let e=Number(g.value)||1e3;Y=window.setInterval(()=>{J()},e),J()},Q=e=>{let t=e.text||e.status||JSON.stringify(e.detail??e);v.textContent=`${v.textContent===`No progress yet.`?``:v.textContent+`
`}${t}`},$=e=>e.ok?{ok:!0,call:e.call,parsedArguments:e.call.arguments,raw:e.raw}:e,ee=async()=>{let e=R(),t=z();if(!e.ok||!t.ok){B();return}let{currentDate:n,toolMode:r,...i}=t.value;_.textContent=`Running...`,v.textContent=``,C.textContent=`running`,Z();try{let t=await N.tryExtractToolCall(s.value,e.value,{...i,currentDate:typeof n==`string`?n:void 0,toolMode:r===`required`||r===`auto`?r:`auto`,systemPrompt:o.value},{mock:h.value===`mock`,timeoutMs:1200*1e3,onProgress:Q,onStatus:K});_.textContent=JSON.stringify($(t),null,2)}catch(e){_.textContent=e instanceof Error?JSON.stringify({ok:!1,name:e.name,message:e.message},null,2):String(e)}finally{K(await N.state()),await J(),X()}};P(),B(),c.addEventListener(`input`,B),l.addEventListener(`input`,B),f.addEventListener(`click`,()=>void ee()),p.addEventListener(`click`,()=>void J()),m.addEventListener(`click`,()=>{P(),B()}),g.addEventListener(`change`,()=>{Y!==void 0&&Z()}),N.ready().then(e=>{K(e),J()});
//# sourceMappingURL=index-BtoUrwVm.js.map