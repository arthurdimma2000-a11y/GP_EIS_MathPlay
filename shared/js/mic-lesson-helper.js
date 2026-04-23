(function(){
  if (window.__GP_MIC_LESSON_HELPER__) return;
  window.__GP_MIC_LESSON_HELPER__ = true;
  if (window.__GP_DISABLE_SHARED_MIC_GUIDE__) return;

  const micBtn = document.querySelector('#micIconBtn, #micBtn, .mic-icon-btn, .mic-btn, [data-mic], [aria-label*="Repeat conversation" i], [aria-label*="Repeat instruction" i], [aria-label*="Repeat after me" i], [aria-label*="speaking activity" i], [aria-label*="Microphone" i]');
  if (!micBtn) return;

  const girlTarget = document.querySelector('#tapGirl, #girlBtn, .tap-girl, .girl-spot, .girl-inline, [aria-label="Tap the girl"]');
  const statusEl = document.querySelector('#conversationStatus, .conversation-status, .status, .lesson-status, .footer-note, .note');
  const chimeAudio = new Audio("../../../../assets/audio/chimes/chime.mp3");
  const cheerAudio = new Audio("../../../../assets/audio/sfx-cheer.mp3");
  chimeAudio.preload = "auto";
  cheerAudio.preload = "auto";

  let pointerTarget = girlTarget || micBtn;
  let girlActivated = !girlTarget;
  let micActivated = false;
  let micCompleted = false;
  let repeatPrompted = false;
  let introSpoken = false;
  let pointerEl = null;
  let girlProxy = null;
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
    .gp-shared-guide-dock{
      display:inline-flex;
      align-items:center;
      gap:10px;
      padding:6px 10px;
      margin:4px 8px 4px 0;
      border-radius:999px;
      background:rgba(255,255,255,.94);
      box-shadow:0 8px 18px rgba(0,0,0,.12);
      border:2px solid rgba(245,158,11,.22);
    }
    .gp-shared-guide-girl{
      display:inline-flex;
      align-items:center;
      gap:8px;
      border:none;
      background:transparent;
      padding:0;
      cursor:pointer;
      font:inherit;
    }
    .gp-shared-guide-girl img{
      width:48px;
      height:48px;
      object-fit:contain;
    }
    .gp-shared-guide-girl-label{
      font-size:.88rem;
      font-weight:900;
      color:#7c2d12;
      white-space:nowrap;
    }
    .gp-shared-guide-girl-finger{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:30px;
      height:30px;
      border-radius:999px;
      background:#fff6cc;
      color:#d97706;
      box-shadow:0 6px 14px rgba(0,0,0,.12);
      animation:gpMicGuideBounce 1.05s ease-in-out infinite;
    }
    .gp-shared-guide-hidden-source{
      position:absolute !important;
      width:1px !important;
      height:1px !important;
      overflow:hidden !important;
      opacity:0 !important;
      pointer-events:none !important;
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
    if (window.GPTracing && typeof window.GPTracing.applyPreferredVoice === "function") {
      return null;
    }
    const voices = getVoices();
    if (!voices.length) return null;
    const lower = (s) => String(s || "").toLowerCase();
    const malePattern = /(male|david|mark|tom|daniel|alex|fred|guy|man|boy|aaron|james|matthew|george|john|michael|jason|ryan|andrew|paul|brian|kevin|eric|christopher|roger)/i;
    return voices.find(v => /en-us|en_us/.test(lower(v.lang)) && /ava|aria|samantha|jenny|zira|female|girl|kid|child|allison|emma|ivy|olivia|libby|ellie|grace|amy|serena|luna|nova|stella/i.test(lower(v.name)) && !malePattern.test(v.name || ""))
      || voices.find(v => /en-us|en_us/.test(lower(v.lang)) && !malePattern.test(v.name || ""))
      || voices.find(v => /en/.test(lower(v.lang)) && !malePattern.test(v.name || ""))
      || null;
  }

  function speakFriendly(text){
    if (!("speechSynthesis" in window) || !text) return;
    try { window.speechSynthesis.cancel(); } catch(_err){}
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.9;
    utter.pitch = 1.16;
    utter.volume = 1;
    if (window.GPTracing && typeof window.GPTracing.applyPreferredVoice === "function") {
      window.GPTracing.applyPreferredVoice(utter);
    } else {
      const voice = chooseKidVoice();
      if (voice) utter.voice = voice;
    }
    window.speechSynthesis.speak(utter);
  }

  function showHint(text){
    if (!statusEl || !text) return;
    statusEl.textContent = text;
  }

  if ("speechSynthesis" in window && !window.__GP_MIC_SPEAK_PATCHED__) {
    window.__GP_MIC_SPEAK_PATCHED__ = true;
    const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = function(utterance){
      if (window.__GP_MIC_ACTIVITY_ACTIVE && utterance && !utterance.__gpMicAdjusted) {
        const voice = chooseKidVoice();
        if (voice) utterance.voice = voice;
        utterance.lang = "en-US";
        utterance.rate = 0.9;
        utterance.pitch = 1.16;
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
    label.textContent = pointerTarget === micBtn ? "Tap the microphone" : "Tap the girl";
  }

  function resolveGirlTrigger() {
    if (!girlTarget) return null;
    if (girlTarget.matches("img,button")) return girlTarget;
    return girlTarget.querySelector("img,button") || girlTarget;
  }

  function findGuideDockHost() {
    const candidates = [
      ".controls",
      ".button-row",
      ".footerNav",
      ".top-actions",
      ".bottom-bar",
      ".top-nav-right",
      ".top",
      ".hud"
    ];
    for (const selector of candidates) {
      const host = document.querySelector(selector);
      if (host) return host;
    }
    return micBtn.parentElement || null;
  }

  function ensureGirlProxy() {
    if (!girlTarget) return null;
    if (girlProxy && document.body.contains(girlProxy)) return girlProxy;
    const dockHost = findGuideDockHost();
    if (!dockHost) return girlTarget;
    if (dockHost.contains(girlTarget)) return girlTarget;

    const trigger = resolveGirlTrigger();
    const img = trigger && trigger.tagName === "IMG" ? trigger : (girlTarget.querySelector("img") || null);
    const src = img ? img.getAttribute("src") || "" : "";
    if (!src) return girlTarget;

    const dock = document.createElement("div");
    dock.className = "gp-shared-guide-dock";
    dock.innerHTML = '<button type="button" class="gp-shared-guide-girl" aria-label="Tap the girl"><span class="gp-shared-guide-girl-finger" aria-hidden="true">👇</span><img alt="Tap the girl helper"><span class="gp-shared-guide-girl-label">Tap the girl</span></button>';
    const button = dock.querySelector(".gp-shared-guide-girl");
    const proxyImg = dock.querySelector("img");
    proxyImg.src = src;
    button.addEventListener("click", () => {
      girlActivated = true;
      pointTo(micBtn);
      showHint("Now tap the microphone.");
      window.setTimeout(() => speakFriendly("Now tap the microphone."), 120);
      if (trigger && typeof trigger.click === "function") {
        try { trigger.click(); } catch(_err){}
      }
      try {
        trigger && trigger.dispatchEvent(new MouseEvent("click", { bubbles:true, cancelable:true, view:window }));
      } catch(_err){}
    }, true);
    dockHost.insertBefore(dock, dockHost.firstChild);
    const hideTarget = girlTarget.closest(".girl-spot, .girl-inline, .tap-girl") || girlTarget;
    hideTarget.classList.add("gp-shared-guide-hidden-source");
    girlProxy = button;
    return girlProxy;
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
      ? "Tap the girl first. Then tap the microphone and follow the speaking lesson."
      : "Tap the microphone and follow the speaking lesson.";
    showHint(message);
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
    try{
      cheerAudio.currentTime = 0;
      cheerAudio.play().catch(() => {});
    }catch(_err){}
    pointTo(micBtn);
    showHint("Great job. You finished the microphone lesson.");
    window.setTimeout(() => speakFriendly("Great job. You finished the microphone lesson."), 140);
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

  micBtn.addEventListener("click", (ev) => {
    if (girlTarget && !girlActivated) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      pointTo(girlProxy || girlTarget);
      showHint("Tap the girl first.");
      window.setTimeout(() => speakFriendly("Tap the girl first."), 80);
      return;
    }
    if (micCompleted) {
      pointTo(micBtn);
      return;
    }
    micActivated = true;
    window.__GP_MIC_ACTIVITY_ACTIVE = true;
    pointTo(micBtn);
    if (!repeatPrompted) {
      repeatPrompted = true;
      showHint("Repeat after me.");
      window.setTimeout(() => speakFriendly("Repeat after me."), 80);
    }
    completeCheckTimers.forEach((timerId) => window.clearTimeout(timerId));
    completeCheckTimers = [
      window.setTimeout(maybeCompleteFromDom, 2200),
      window.setTimeout(maybeCompleteFromDom, 4800)
    ];
  }, true);

  if (girlTarget) {
    girlTarget.addEventListener("click", () => {
      girlActivated = true;
      pointTo(micBtn);
      showHint("Now tap the microphone.");
      window.setTimeout(() => speakFriendly("Now tap the microphone."), 120);
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
    ensureGirlProxy();
    pointTo(girlProxy || girlTarget || micBtn);
    maybeAnnounceIntro();
  }, { once:true });
  window.addEventListener("pagehide", cleanup, { once:true });
  window.addEventListener("beforeunload", cleanup, { once:true });

  ensureGirlProxy();
  pointTo(girlProxy || girlTarget || micBtn);
})();
