(function(global){
  "use strict";

  if (global.GPVertexEntry) return;

  const STYLE_ID = "gpVertexEntryStyles";

  function injectStyles(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .gp-vertex-entry{
        width:min(820px,94%);
        margin:10px auto 0;
        padding:12px 14px;
        border-radius:18px;
        background:rgba(255,255,255,.92);
        box-shadow:0 10px 20px rgba(0,0,0,.10);
        border:2px solid rgba(170,196,255,.55);
      }
      .gp-vertex-entry__title{
        margin:0 0 4px;
        text-align:center;
        font-size:1.12rem;
        font-weight:900;
        color:#234f96;
      }
      .gp-vertex-entry__prompt{
        margin:0 0 10px;
        text-align:center;
        font-size:.95rem;
        font-weight:700;
        color:#476186;
      }
      .gp-vertex-entry__grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
        gap:10px;
      }
      .gp-vertex-entry__card{
        display:flex;
        flex-direction:column;
        gap:6px;
        align-items:center;
        justify-content:center;
        min-height:108px;
        padding:10px 8px;
        border-radius:16px;
        background:linear-gradient(180deg,#ffffff,#eef5ff);
        border:2px solid #d5e3ff;
        transition:border-color .15s ease, transform .12s ease, box-shadow .15s ease;
      }
      .gp-vertex-entry__card.is-correct{
        border-color:#2fbf71;
        box-shadow:0 8px 16px rgba(47,191,113,.15);
      }
      .gp-vertex-entry__card.is-wrong{
        border-color:#ff9f5a;
      }
      .gp-vertex-entry__label{
        font-size:.92rem;
        font-weight:900;
        color:#2e3a55;
        text-align:center;
      }
      .gp-vertex-entry__input{
        width:min(76px,100%);
        min-height:54px;
        border-radius:16px;
        border:2px dashed #7ca7ff;
        background:#fff;
        text-align:center;
        font-size:1.5rem;
        font-weight:900;
        color:#1f3f75;
        outline:none;
        box-shadow:inset 0 2px 6px rgba(0,0,0,.08);
      }
      .gp-vertex-entry__input:focus{
        border-color:#4e79ff;
        box-shadow:0 0 0 4px rgba(78,121,255,.14), inset 0 2px 6px rgba(0,0,0,.08);
      }
      .gp-vertex-entry__hint{
        min-height:1.15em;
        font-size:.78rem;
        font-weight:800;
        color:#5771a6;
        text-align:center;
      }
      .gp-vertex-entry__card.is-correct .gp-vertex-entry__hint{
        color:#1d8b4f;
      }
      .gp-vertex-entry__card.is-wrong .gp-vertex-entry__hint{
        color:#d96a10;
      }
      .gp-vertex-entry__progress{
        display:flex;
        flex-direction:column;
        gap:6px;
        margin-top:10px;
      }
      .gp-vertex-entry__progress-text{
        display:flex;
        justify-content:center;
        gap:8px;
        flex-wrap:wrap;
        text-align:center;
        font-size:.96rem;
        font-weight:900;
        color:#204d8f;
      }
      .gp-vertex-entry__progress-bar{
        height:12px;
        border-radius:999px;
        overflow:hidden;
        background:#e8f0ff;
        box-shadow:inset 0 1px 3px rgba(0,0,0,.15);
      }
      .gp-vertex-entry__progress-fill{
        height:100%;
        width:0%;
        background:linear-gradient(90deg,#47c8ff 0%,#75ffb1 55%,#ffd36f 100%);
        transition:width .18s ease;
      }
      .gp-vertex-entry__status{
        min-height:1.2em;
        text-align:center;
        font-size:.88rem;
        font-weight:900;
        color:#2e9b2e;
      }
      @media (max-width:780px){
        .gp-vertex-entry{
          width:min(94vw,92%);
          padding:10px 12px;
        }
        .gp-vertex-entry__grid{
          grid-template-columns:repeat(auto-fit,minmax(96px,1fr));
        }
        .gp-vertex-entry__input{
          min-height:48px;
          font-size:1.3rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function clamp(value){
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function playTick(){
    if (global.GPTracing?.playTraceTick) {
      global.GPTracing.playTraceTick({ throttleMs: 70 });
      return;
    }
    try{
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if(!AudioCtx) return;
      const a = new AudioCtx();
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = "triangle";
      osc.frequency.value = 920;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(a.destination);
      osc.start();
      osc.stop(a.currentTime + 0.04);
      osc.onended = () => a.close();
    }catch(_e){}
  }

  function playChime(){
    if (global.GPAudio?.playSfx) {
      global.GPAudio.playSfx("chime", 0.9);
    } else {
      try{
        new Audio("../../../../assets/audio/chimes/chime.mp3").play().catch(() => {});
      }catch(_e){}
    }
    global.GPTracing?.playTraceCelebration?.();
  }

  function playCheer(){
    if (global.GPTracing?.playCheerAudio) {
      global.GPTracing.playCheerAudio();
      return;
    }
    if (global.GPAudio?.playSfx) {
      global.GPAudio.playSfx("cheer", 1);
      return;
    }
    try{
      new Audio("../../../../assets/audio/sfx-cheer.mp3").play().catch(() => {});
    }catch(_e){}
  }

  function speak(text){
    if (!("speechSynthesis" in global) || !text) return;
    try{
      if (global.GPTracing?.speakText) {
        global.GPTracing.speakText(String(text), { rate: 0.9, pitch: 1.16, volume: 1 });
        return;
      }
      global.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.rate = 0.9;
      u.pitch = 1.16;
      u.volume = 1;
      if (global.GPTracing?.applyPreferredVoice) {
        global.GPTracing.applyPreferredVoice(u);
      }
      global.speechSynthesis.speak(u);
    }catch(_e){}
  }

  function create(options){
    injectStyles();
    const mount = typeof options?.mount === "string" ? document.querySelector(options.mount) : options?.mount;
    if (!mount) return null;

    const items = (options?.items || []).map((item, index) => ({
      id: item.id || `vertex-${index + 1}`,
      label: item.label || `Shape ${index + 1}`,
      answer: String(item.answer ?? ""),
      placeholder: item.placeholder || "?",
      hint: item.hint || "Write the vertices",
      successSpeech: item.successSpeech || `Correct. ${item.label || `Shape ${index + 1}`} has ${item.answer} vertices.`,
      completeSpeech: item.completeSpeech || null
    }));
    if (!items.length) return null;

    let baseProgress = clamp(options.initialBaseProgress || 0);
    let celebrated = false;
    const correctSpoken = new Set();
    const progressMilestones = new Set();
    let firstRender = true;

    mount.classList.add("gp-vertex-entry");
    mount.innerHTML = `
      <div class="gp-vertex-entry__title">${options.title || "Write the number of vertices"}</div>
      <div class="gp-vertex-entry__prompt">${options.prompt || "Type the correct number for each shape."}</div>
      <div class="gp-vertex-entry__grid">
        ${items.map((item) => `
          <label class="gp-vertex-entry__card" data-item="${item.id}">
            <div class="gp-vertex-entry__label">${item.label}</div>
            <input class="gp-vertex-entry__input" data-input="${item.id}" type="text" inputmode="numeric" maxlength="2" placeholder="${item.placeholder}" aria-label="${item.label} vertices">
            <div class="gp-vertex-entry__hint" data-hint="${item.id}">${item.hint}</div>
          </label>
        `).join("")}
      </div>
      ${(options.showProgress === false) ? "" : `
        <div class="gp-vertex-entry__progress">
          <div class="gp-vertex-entry__progress-text">
            <span>${options.progressLabel || "Vertices progress"}:</span>
            <span data-vertex-progress>0%</span>
            <span>•</span>
            <span>Combined:</span>
            <span data-total-progress>0%</span>
          </div>
          <div class="gp-vertex-entry__progress-bar"><div class="gp-vertex-entry__progress-fill" data-total-fill></div></div>
          <div class="gp-vertex-entry__status" data-status>${options.statusText || "Touch, trace, and write the correct number of vertices."}</div>
        </div>
      `}
    `;

    const inputEls = Array.from(mount.querySelectorAll("[data-input]"));
    const hintEls = new Map(items.map((item) => [item.id, mount.querySelector(`[data-hint="${item.id}"]`)]));
    const cardEls = new Map(items.map((item) => [item.id, mount.querySelector(`[data-item="${item.id}"]`)]));
    const vertexProgressEl = mount.querySelector("[data-vertex-progress]");
    const totalProgressEl = mount.querySelector("[data-total-progress]");
    const totalFillEl = mount.querySelector("[data-total-fill]");
    const statusEl = mount.querySelector("[data-status]");

    function getValues(){
      const out = {};
      inputEls.forEach((input) => {
        out[input.dataset.input] = String(input.value || "").trim();
      });
      return out;
    }

    function getVertexProgress(){
      const values = getValues();
      const totalCount = items.length;
      const correctCount = items.filter((item) => values[item.id] === item.answer).length;
      return totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
    }

    function getState(){
      const values = getValues();
      const correctCount = items.filter((item) => values[item.id] === item.answer).length;
      const vertexProgress = items.length ? Math.round((correctCount / items.length) * 100) : 0;
      const totalProgress = clamp(typeof options.combineProgress === "function"
        ? options.combineProgress(baseProgress, vertexProgress, { values, correctCount, totalCount: items.length })
        : Math.round((baseProgress + vertexProgress) / 2));
      return {
        baseProgress,
        vertexProgress,
        totalProgress,
        correctCount,
        totalCount: items.length,
        completed: correctCount === items.length,
        values
      };
    }

    function statusMessage(state){
      if (state.completed) return options.completeText || "Excellent! You finished the vertices.";
      if (state.vertexProgress >= 75) return options.almostDoneText || "Great job. Finish the last box.";
      if (state.vertexProgress >= 35) return options.keepGoingText || "Nice work. Keep writing the vertices.";
      return options.statusText || "Touch, trace, and write the correct number of vertices.";
    }

    function maybeCelebrate(state){
      items.forEach((item) => {
        const value = state.values[item.id];
        if (value === item.answer && !correctSpoken.has(item.id)) {
          correctSpoken.add(item.id);
          playChime();
          speak(item.successSpeech);
        }
      });

      [50, 100].forEach((mark) => {
        if (state.totalProgress >= mark && !progressMilestones.has(mark)) {
          progressMilestones.add(mark);
          if (mark < 100) speak(options.milestoneSpeech || "Great work. Keep going.");
        }
      });

      if (state.completed && !celebrated) {
        celebrated = true;
        playChime();
        playCheer();
        speak(options.completeSpeech || "Excellent. You completed the tracing and vertex work.");
      }
      if (!state.completed) celebrated = false;
    }

    function renderState(){
      const state = getState();
      items.forEach((item) => {
        const value = state.values[item.id];
        const correct = value === item.answer;
        const filled = value.length > 0;
        const card = cardEls.get(item.id);
        const hint = hintEls.get(item.id);
        if (!card || !hint) return;
        card.classList.toggle("is-correct", correct);
        card.classList.toggle("is-wrong", filled && !correct);
        hint.textContent = correct
          ? `Correct: ${item.answer}`
          : filled
            ? "Try again"
            : item.hint;
      });

      if (vertexProgressEl) vertexProgressEl.textContent = `${state.vertexProgress}%`;
      if (totalProgressEl) totalProgressEl.textContent = `${state.totalProgress}%`;
      if (totalFillEl) totalFillEl.style.width = `${state.totalProgress}%`;
      if (statusEl) statusEl.textContent = statusMessage(state);

      maybeCelebrate(state);
      if (typeof options.onProgress === "function" && !firstRender) options.onProgress(state);
      firstRender = false;
      return state.totalProgress;
    }

    inputEls.forEach((input) => {
      ["pointerdown", "focus", "click"].forEach((eventName) => {
        input.addEventListener(eventName, () => playTick(), { passive: true });
      });
      input.addEventListener("input", () => {
        input.value = String(input.value || "").replace(/[^\d]/g, "").slice(0, 2);
        renderState();
      });
    });

    const api = {
      setBaseProgress(value){
        baseProgress = clamp(value);
        return renderState();
      },
      reset(){
        inputEls.forEach((input) => { input.value = ""; });
        correctSpoken.clear();
        progressMilestones.clear();
        celebrated = false;
        return renderState();
      },
      getState,
      getVertexProgress,
      getTotalProgress(){
        return getState().totalProgress;
      },
      getValues
    };

    renderState();
    return api;
  }

  global.GPVertexEntry = { create };
})(window);
