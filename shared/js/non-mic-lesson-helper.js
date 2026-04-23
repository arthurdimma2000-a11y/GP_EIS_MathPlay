(function(){
  if (window.__GP_NON_MIC_LESSON_HELPER__) return;
  window.__GP_NON_MIC_LESSON_HELPER__ = true;

  const micBtn = document.querySelector('#micIconBtn, .mic-icon-btn, [aria-label*="Repeat conversation" i], [aria-label*="Repeat instruction" i], [aria-label*="Microphone" i]');
  if (micBtn) return;

  const girlTarget = document.querySelector('#tapGirl, #girlBtn, .tap-girl, .girl-spot, .girl-inline, [aria-label="Tap the girl"]');
  if (!girlTarget) return;
  const statusEl = document.querySelector('#conversationStatus, .conversation-status, .status, .lesson-status, .footer-note, .note');

  let pointerEl = null;
  let introSpoken = false;
  let pointerQueued = false;
  let girlProxy = null;

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
      animation:gpNonMicGuideBounce 1.05s ease-in-out infinite;
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
      animation:gpNonMicGuideBounce 1.05s ease-in-out infinite;
    }
    .gp-shared-guide-hidden-source{
      position:absolute !important;
      width:1px !important;
      height:1px !important;
      overflow:hidden !important;
      opacity:0 !important;
      pointer-events:none !important;
    }
    @keyframes gpNonMicGuideBounce{
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
    el.className = "gp-shared-guide-pointer is-girl";
    el.innerHTML = '<div class="gp-shared-guide-finger">👉</div><div class="gp-shared-guide-label">Tap the girl</div>';
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

  function chooseFriendlyVoice(){
    if (window.GPTracing && typeof window.GPTracing.applyPreferredVoice === "function") {
      return null;
    }
    const voices = getVoices();
    if (!voices.length) return null;
    const lower = (s) => String(s || "").toLowerCase();
    const malePattern = /(male|david|mark|tom|daniel|alex|fred|guy|man|boy|aaron|james|matthew|george)/i;
    return voices.find(v => /en-us|en_us/.test(lower(v.lang)) && /ava|aria|samantha|jenny|zira|female|girl|kid|child|allison|emma|ivy|olivia|libby|ellie/i.test(lower(v.name)) && !malePattern.test(v.name || ""))
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
      const voice = chooseFriendlyVoice();
      if (voice) utter.voice = voice;
    }
    window.speechSynthesis.speak(utter);
  }

  function showHint(text){
    if (!statusEl || !text) return;
    statusEl.textContent = text;
  }

  function ensurePointer(){
    if (pointerEl && document.body.contains(pointerEl)) return pointerEl;
    pointerEl = ensureSharedPointer();
    return pointerEl;
  }

  function resolveGirlTrigger() {
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
    return girlTarget.parentElement || null;
  }

  function ensureGirlProxy() {
    if (girlProxy && document.body.contains(girlProxy)) return girlProxy;
    const dockHost = findGuideDockHost();
    if (!dockHost || dockHost.contains(girlTarget)) return girlTarget;

    const trigger = resolveGirlTrigger();
    const img = trigger && trigger.tagName === "IMG" ? trigger : (girlTarget.querySelector("img") || null);
    const src = img ? img.getAttribute("src") || "" : "";
    if (!src) return girlTarget;

    const dock = document.createElement("div");
    dock.className = "gp-shared-guide-dock";
    dock.innerHTML = '<button type="button" class="gp-shared-guide-girl" aria-label="Tap the girl"><span class="gp-shared-guide-girl-finger" aria-hidden="true">👇</span><img alt="Tap the girl helper"><span class="gp-shared-guide-girl-label">Tap the girl</span></button>';
    const button = dock.querySelector(".gp-shared-guide-girl");
    dock.querySelector("img").src = src;
    button.addEventListener("click", () => {
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
    const pointer = ensurePointer();
    const activeTarget = girlProxy || girlTarget;
    const rect = activeTarget.getBoundingClientRect();
    pointer.classList.add("is-girl");
    const label = pointer.querySelector(".gp-shared-guide-label");
    if (label) label.textContent = "Tap the girl";
    pointer.style.left = Math.max(8, rect.left - 8) + "px";
    pointer.style.top = Math.max(8, rect.top - 18) + "px";
  }

  function queuePointerPosition(){
    if (pointerQueued) return;
    pointerQueued = true;
    requestAnimationFrame(() => {
      pointerQueued = false;
      positionPointer();
    });
  }

  function inferInstruction(){
    const candidates = Array.from(document.querySelectorAll('.tap-label, .girl-hint, .footer-note, .hint-clear, .conversation-status, .status, p, .note, .lesson-note'))
      .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const tapLine = candidates.find(text => /tap the girl/i.test(text) && text.length <= 120);
    return tapLine || "Tap the girl to start the lesson.";
  }

  function speakIntro(){
    if (introSpoken) return;
    introSpoken = true;
    const message = inferInstruction();
    showHint(message);
    window.setTimeout(() => speakFriendly(message), 900);
  }

  function cleanup(){
    window.removeEventListener('resize', queuePointerPosition);
    window.removeEventListener('scroll', queuePointerPosition, true);
    window.removeEventListener('pagehide', cleanup);
    window.removeEventListener('beforeunload', cleanup);
  }

  girlTarget.addEventListener('click', queuePointerPosition, true);
  window.addEventListener('resize', queuePointerPosition);
  window.addEventListener('scroll', queuePointerPosition, true);
  window.addEventListener('load', () => {
    ensureGirlProxy();
    positionPointer();
    speakIntro();
  }, { once:true });
  window.addEventListener('pagehide', cleanup, { once:true });
  window.addEventListener('beforeunload', cleanup, { once:true });

  ensureGirlProxy();
  positionPointer();
})();
