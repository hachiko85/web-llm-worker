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
`;var r=n.querySelector(`[data-input]`),i=n.querySelector(`[data-output]`),a=n.querySelector(`[data-mock]`),o=n.querySelector(`[data-running]`),s=n.querySelector(`[data-status="webgpu"]`),c=n.querySelector(`[data-status="broker"]`),l=n.querySelector(`[data-status="clients"]`),u=n.querySelector(`[data-broker-id]`),d=n.querySelector(`[data-engine-id]`),f=n.querySelector(`[data-completed]`),p=n.querySelector(`[data-queue]`),m=new e({mock:!0,timeoutMs:600*1e3}),h=e=>{s.textContent=`WebGPU: ${e.webgpu?`available`:`unavailable`}`,c.textContent=`Broker: ${e.running?`running`:`idle`}`,l.textContent=`Clients: ${e.clients}`,u.textContent=e.brokerId,d.textContent=e.engineId||`idle`,f.textContent=String(e.completedJobs),p.textContent=String(e.queued),o.textContent=e.running?`running`:`idle`},g=e=>{e.text&&(i.textContent=`${i.textContent}\n${e.text}`.trim())},_=async e=>{let t={mock:a.checked,onProgress:g,onStatus:h};i.textContent=``,o.textContent=`running`;try{let n;n=e===`summarize`?await m.summarize(r.value,{language:`Japanese`},t):e===`translate`?await m.translate(r.value,{sourceLanguage:`Japanese`,targetLanguage:`English`},t):await m.complete(`推論してください:\n${r.value}`,{max_new_tokens:96},t),i.textContent=typeof n==`string`?n:JSON.stringify(n,null,2)}catch(e){i.textContent=e instanceof Error?`${e.name}: ${e.message}`:String(e)}finally{h(await m.state())}};n.addEventListener(`click`,e=>{let t=e.target.dataset.action;if(t===`state`){m.state().then(h);return}(t===`summarize`||t===`translate`||t===`infer`)&&_(t)}),m.ready().then(h);
//# sourceMappingURL=test-app-CRHZz-OR.js.map