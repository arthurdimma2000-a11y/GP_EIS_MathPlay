(function(){
  if (window.__GP_NON_MIC_LESSON_HELPER__) return;
  window.__GP_NON_MIC_LESSON_HELPER__ = true;

  const micBtn = document.querySelector('#micIconBtn, .mic-icon-btn, [aria-label*="Repeat conversation" i], [aria-label*="Repeat instruction" i], [aria-label*="Microphone" i]');
  if (micBtn) return;

  const girlTarget = document.querySelector('#tapGirl, #girlBtn, .tap-girl, .girl-spot, .girl-inline, [aria-label="Tap the girl"]');
  if (!girlTarget) return;

  let pointerEl = null;
  let introSpoken = false;
  let pointerQueued = false;

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
    const voice = chooseFriendlyVoice();
    if (voice) utter.voice = voice;
    utter.lang = (voice && voice.lang) ? voice.lang : "en-US";
    utter.rate = 1.02;
    utter.pitch = 1.5;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  }

  function ensurePointer(){
    if (pointerEl && document.body.contains(pointerEl)) return pointerEl;
    pointerEl = ensureSharedPointer();
    return pointerEl;
  }

  function positionPointer(){
    const pointer = ensurePointer();
    const rect = girlTarget.getBoundingClientRect();
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
    window.setTimeout(() => speakFriendly(inferInstruction()), 900);
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
    positionPointer();
    speakIntro();
  }, { once:true });
  window.addEventListener('pagehide', cleanup, { once:true });
  window.addEventListener('beforeunload', cleanup, { once:true });

  positionPointer();
})();
