(function(){
  if (window.__GP_MIC_LESSON_HELPER__) return;
  window.__GP_MIC_LESSON_HELPER__ = true;

  const micBtn = document.querySelector('#micIconBtn, .mic-icon-btn, [aria-label*="Repeat conversation" i], [aria-label*="Repeat instruction" i], [aria-label*="Microphone" i]');
  if (!micBtn) return;

  const girlTarget = document.querySelector('#tapGirl, #girlBtn, .tap-girl, .girl-spot, .girl-inline, [aria-label="Tap the girl"]');
  const chimeAudio = new Audio("../../../../assets/audio/chimes/chime.mp3");
  chimeAudio.preload = "auto";

  let pointerTarget = micBtn;
  let micActivated = false;
  let micCompleted = false;
  let repeatPrompted = false;
  let introSpoken = false;
  let pointerEl = null;
  let mutationQueued = false;
  let pointerQueued = false;
  let completeCheckTimers = [];

  if (!document.getElementById("gpSharedLessonGuideStyle")) {
    const style = document.createElement("style");
    style.id = "gpSharedLessonGuideStyle";
    style.textContent = `
    .gp-shared-guide-pointer{
      position:fixed;
      z-index:999999;
      display:inline-flex;
      align-items:center;
      gap:8px;
      pointer-events:none;
      transform:translate(-8px,-10px);
    }
    .gp-shared-guide-pointer.is-girl{
      transform:translate(-18px,-4px);
    }
    .gp-shared-guide-finger{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:38px;
      height:38px;
      border-radius:999px;
      background:#fff6cc;
      color:#d97706;
      font-size:1.25rem;
      box-shadow:0 6px 14px rgba(0,0,0,.16);
      animation:gpMicGuideBounce 1.05s ease-in-out infinite;
    }
    .gp-shared-guide-label{
      padding:6px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.95);
      color:#7c2d12;
      font-size:.86rem;
      font-weight:900;
      box-shadow:0 6px 14px rgba(0,0,0,.12);
      white-space:nowrap;
    }
    @keyframes gpMicGuideBounce{
      0%,100%{ transform:translate(0,0); }
      50%{ transform:translate(-8px,-4px); }
    }
  `;
    document.head.appendChild(style);
  }

  function ensureSharedPointer(){
    if (window.__GP_SHARED_LESSON_POINTER__ && document.body.contains(window.__GP_SHARED_LESSON_POINTER__)) {
      return window.__GP_SHARED_LESSON_POINTER__;
    }
    const el = document.createElement("div");
    el.className = "gp-shared-guide-pointer";
    el.innerHTML = '<div class="gp-shared-guide-finger">👉</div><div class="gp-shared-guide-label">Click the Mic icon</div>';
    document.body.appendChild(el);
    window.__GP_SHARED_LESSON_POINTER__ = el;
    return el;
  }

  function getVoices(){
    try{
      return window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    }catch(_err){
      return [];
    }
  }

  function chooseKidVoice(){
    const voices = getVoices();
    if (!voices.length) return null;
    const lower = (s) => String(s || "").toLowerCase();
    const malePattern = /(male|david|mark|tom|daniel|alex|fred|guy|man|boy|aaron|james|matthew|george)/i;
    return voices.find(v => /en-us|en_us/.test(lower(v.lang)) && /ava|aria|samantha|jenny|zira|female|girl|kid|child|allison|emma|ivy|olivia|libby|ellie/i.test(lower(v.name)) && !malePattern.test(v.name || ""))
      || voices.find(v => /en-us|en_us/.test(lower(v.lang)) && !malePattern.test(v.name || ""))
      || voices.find(v => /en/.test(lower(v.lang)) && !malePattern.test(v.name || ""))
      || voices[0];
  }

  function speakFriendly(text){
    if (!("speechSynthesis" in window) || !text) return;
    try { window.speechSynthesis.cancel(); } catch(_err){}
    const utter = new SpeechSynthesisUtterance(text);
    const voice = chooseKidVoice();
    if (voice) utter.voice = voice;
    utter.lang = (voice && voice.lang) ? voice.lang : "en-US";
    utter.rate = 1.03;
    utter.pitch = 1.55;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  }

  if ("speechSynthesis" in window && !window.__GP_MIC_SPEAK_PATCHED__) {
    window.__GP_MIC_SPEAK_PATCHED__ = true;
    const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = function(utterance){
      if (window.__GP_MIC_ACTIVITY_ACTIVE && utterance && !utterance.__gpMicAdjusted) {
        const voice = chooseKidVoice();
        if (voice) utterance.voice = voice;
        utterance.lang = (voice && voice.lang) ? voice.lang : "en-US";
        utterance.rate = 1.03;
        utterance.pitch = 1.55;
        utterance.volume = 1;
        utterance.__gpMicAdjusted = true;
      }
      return originalSpeak(utterance);
    };
  }

  function ensurePointer(){
    if (pointerEl && document.body.contains(pointerEl)) return pointerEl;
    pointerEl = ensureSharedPointer();
    return pointerEl;
  }

  function updatePointerLabel(){
    const label = pointerEl && pointerEl.querySelector(".gp-shared-guide-label");
    if (!label) return;
    label.textContent = pointerTarget === micBtn ? "Click the Mic icon" : "Tap the girl";
  }

  function positionPointer(){
    if (!pointerTarget || !pointerTarget.getBoundingClientRect) return;
    const pointer = ensurePointer();
    const rect = pointerTarget.getBoundingClientRect();
    pointer.classList.toggle("is-girl", pointerTarget !== micBtn);
    pointer.style.left = Math.max(8, rect.left - 8) + "px";
    pointer.style.top = Math.max(8, rect.top - 18) + "px";
    updatePointerLabel();
  }

  function pointTo(target){
    if (!target) return;
    pointerTarget = target;
    positionPointer();
  }

  function queuePointerPosition(){
    if (pointerQueued) return;
    pointerQueued = true;
    requestAnimationFrame(() => {
      pointerQueued = false;
      positionPointer();
    });
  }

  function maybeAnnounceIntro(){
    if (introSpoken) return;
    introSpoken = true;
    const message = girlTarget
      ? "Click the Mic icon for the listening and speaking lesson activity. Then tap the girl."
      : "Click the Mic icon for the listening and speaking lesson activity.";
    window.setTimeout(() => speakFriendly(message), 1100);
  }

  function markMicComplete(){
    if (micCompleted) return;
    micCompleted = true;
    window.__GP_MIC_ACTIVITY_ACTIVE = false;
    observer.disconnect();
    completeCheckTimers.forEach((timerId) => window.clearTimeout(timerId));
    completeCheckTimers = [];
    try{
      chimeAudio.currentTime = 0;
      chimeAudio.play().catch(() => {});
    }catch(_err){}
    if (girlTarget) {
      pointTo(girlTarget);
      window.setTimeout(() => speakFriendly("Tap the girl."), 140);
    }
  }

  function maybeCompleteFromDom(){
    if (!micActivated || micCompleted) return;
    const hasStars = Array.from(document.querySelectorAll(".star-row")).some(el => (el.textContent || "").trim().length > 0);
    const hasRepeatResult = Array.from(document.querySelectorAll(".repeat-result"))
      .some((el) => {
        const text = (el.textContent || "").trim();
        return text && !/sorry|try again/i.test(text);
      });
    const statusTexts = Array.from(document.querySelectorAll(".conversation-status, .status, .feedback, .result, .recording-status, .mini-remark"))
      .map(el => (el.textContent || "").trim())
      .join(" ");
    if (
      hasStars ||
      (hasRepeatResult && /tap the girl|its a |it's a |reveal|show the shape/i.test(statusTexts)) ||
      /wow|amazing|great try|good job|super smart|nice try|excellent|completed|complete|finished|tap the girl/i.test(statusTexts)
    ) {
      markMicComplete();
    }
  }

  const observer = new MutationObserver(() => {
    if (mutationQueued) return;
    mutationQueued = true;
    requestAnimationFrame(() => {
      mutationQueued = false;
      queuePointerPosition();
      maybeCompleteFromDom();
    });
  });

  observer.observe(document.body, { childList:true, subtree:true });

  micBtn.addEventListener("click", () => {
    if (micCompleted) {
      if (girlTarget) pointTo(girlTarget);
      return;
    }
    micActivated = true;
    window.__GP_MIC_ACTIVITY_ACTIVE = true;
    pointTo(micBtn);
    if (!repeatPrompted) {
      repeatPrompted = true;
      window.setTimeout(() => speakFriendly("Repeat after me."), 80);
    }
    completeCheckTimers.forEach((timerId) => window.clearTimeout(timerId));
    completeCheckTimers = [
      window.setTimeout(maybeCompleteFromDom, 1200),
      window.setTimeout(maybeCompleteFromDom, 2500)
    ];
  }, true);

  if (girlTarget) {
    girlTarget.addEventListener("click", () => {
      pointTo(girlTarget);
    }, true);
  }

  function cleanup(){
    observer.disconnect();
    completeCheckTimers.forEach((timerId) => window.clearTimeout(timerId));
    completeCheckTimers = [];
    window.removeEventListener("resize", queuePointerPosition);
    window.removeEventListener("scroll", queuePointerPosition, true);
    window.removeEventListener("pagehide", cleanup);
    window.removeEventListener("beforeunload", cleanup);
  }

  window.addEventListener("resize", queuePointerPosition);
  window.addEventListener("scroll", queuePointerPosition, true);
  window.addEventListener("load", () => {
    pointTo(micBtn);
    maybeAnnounceIntro();
  }, { once:true });
  window.addEventListener("pagehide", cleanup, { once:true });
  window.addEventListener("beforeunload", cleanup, { once:true });

  pointTo(micBtn);
})();
