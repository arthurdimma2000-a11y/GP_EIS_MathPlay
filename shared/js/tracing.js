(function(global){
  "use strict";

  function normalizeTranscript(text){
    return (text || "")
      .toLowerCase()
      .replace(/[^\w\s]|_/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeWords(text){
    const normalized = normalizeTranscript(text);
    return normalized ? normalized.split(" ").filter(Boolean) : [];
  }

  function percentWordMatch(expectedText, saidText){
    const expected = normalizeWords(expectedText);
    const actual = normalizeWords(saidText);
    if (!expected.length) return 0;
    let hits = 0;
    expected.forEach((word) => {
      if (actual.includes(word)) hits += 1;
    });
    return Math.round((hits / expected.length) * 100);
  }

  function rewardStars(attempt){
    if (attempt === 1) return 3;
    if (attempt === 2) return 2;
    if (attempt === 3) return 1;
    return 0;
  }

  let micSupportPromise = null;
  let activeRecognition = null;
  let speechPatchInstalled = false;
  let speechCancelStamp = 0;
  let traceAudioContext = null;
  let lastTraceTickAt = 0;
  let lastTraceCelebrationAt = 0;

  function isMobileSpeechDevice(){
    try {
      const ua = String((global.navigator && global.navigator.userAgent) || "");
      return /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(ua);
    } catch (_err) {}
    return false;
  }

  function normalizeSpeechText(text){
    return String(text || "")
      .replace(/<br\s*\/?>/gi, ". ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSpeechDelayMs(afterCancel){
    const minDelay = isMobileSpeechDevice() ? 280 : 180;
    if (!afterCancel) return minDelay;
    return Math.max(minDelay, minDelay - (Date.now() - speechCancelStamp));
  }

  function speakPreparedUtterance(utterance, options){
    if (!utterance || !("speechSynthesis" in global)) return false;
    const opts = options || {};
    const synth = global.speechSynthesis;
    const speakNow = function(){
      try {
        if (typeof synth.resume === "function") synth.resume();
      } catch (_err) {}
      try {
        return synth.speak(applyPreferredVoice(utterance));
      } catch (_err) {
        if (typeof opts.onError === "function") opts.onError(_err);
        return undefined;
      }
    };
    const delay = getSpeechDelayMs(!!opts.afterCancel || !!opts.forceDelay);
    if (delay > 0) {
      global.setTimeout(speakNow, delay);
      return true;
    }
    speakNow();
    return true;
  }

  function pickPreferredFemaleVoice(voices){
    const list = Array.isArray(voices) ? voices : [];
    if (!list.length) return null;
    const femaleName = /(jenny|aria|ava|samantha|sonia|natasha|sara|hazel|female|zira|allison|ellie|libby|olivia|serena|emma|karen|moira|veena|jessa|michelle|jane|lisa|nancy|joanna|ivy|ruth|kendra|kimberly|salli|cora|luna|nova|stella|grace|amy)/i;
    const childFriendlyName = /(jenny|aria|ava|allison|ellie|libby|olivia|serena|emma|ivy|nova|stella|grace|kids?|child|junior|young)/i;
    const maleName = /(davis|david|guy|man|male|boy|john|matthew|matt|michael|james|daniel|george|thomas|alex|arthur|fred|richard|jason|ryan|andrew|mark|paul|brian|steve|kevin|eric|christopher|roger|guy?l?e? ?male)/i;
    const americanLang = /^en[-_]us/i;
    const englishLang = /^en[-_]/i;
    const notMale = (voice) => !maleName.test(String(voice && voice.name || ""));
    const matches = (langRe, nameRe) => list.find((voice) => langRe.test(voice.lang || "") && nameRe.test(voice.name || "") && notMale(voice));

    return (
      matches(americanLang, childFriendlyName) ||
      matches(americanLang, femaleName) ||
      matches(englishLang, childFriendlyName) ||
      matches(englishLang, femaleName) ||
      list.find((voice) => americanLang.test(voice.lang || "") && notMale(voice)) ||
      list.find((voice) => englishLang.test(voice.lang || "") && notMale(voice)) ||
      list.find((voice) => femaleName.test(voice.name || "") && notMale(voice)) ||
      null
    );
  }

  function applyPreferredVoice(utterance){
    if (!utterance || !("speechSynthesis" in global)) return utterance;
    try {
      const voices = global.speechSynthesis.getVoices ? global.speechSynthesis.getVoices() : [];
      const preferred = pickPreferredFemaleVoice(voices);
      const lang = String(utterance.lang || "");
      const shouldForceEnglish = !lang || /^en([-_]|$)/i.test(lang);
      if (preferred && shouldForceEnglish) {
        utterance.voice = preferred;
        utterance.lang = preferred.lang || "en-US";
      } else if (shouldForceEnglish && !utterance.lang) {
        utterance.lang = "en-US";
      }
      if (typeof utterance.rate !== "number" || utterance.rate >= 0.98 || utterance.rate < 0.88) {
        utterance.rate = 0.8;
      }
      if (typeof utterance.pitch !== "number" || utterance.pitch <= 1.1) {
        utterance.pitch = 1.5;
      }
      utterance.volume = 1;
    } catch (_err) {}
    return utterance;
  }

  function installSpeechSynthesisPatch(){
    if (speechPatchInstalled || !("speechSynthesis" in global)) return;
    speechPatchInstalled = true;
    try {
      const synth = global.speechSynthesis;
      if (typeof synth.getVoices === "function") synth.getVoices();
      const originalSpeak = synth.speak.bind(synth);
      const originalCancel = typeof synth.cancel === "function" ? synth.cancel.bind(synth) : null;
      synth.speak = function patchedSpeak(utterance){
        const speakNow = function () {
          try {
            if (typeof synth.resume === "function") synth.resume();
          } catch (_err) {}
          return originalSpeak(applyPreferredVoice(utterance));
        };
        const delay = getSpeechDelayMs(true);
        if (delay > 0) {
          global.setTimeout(speakNow, delay);
          return;
        }
        return speakNow();
      };
      if (originalCancel) {
        synth.cancel = function patchedCancel() {
          speechCancelStamp = Date.now();
          return originalCancel();
        };
      }
      if ("onvoiceschanged" in synth) {
        const previous = synth.onvoiceschanged;
        synth.onvoiceschanged = function patchedVoicesChanged(event){
          try { synth.getVoices(); } catch (_err) {}
          if (typeof previous === "function") previous.call(this, event);
        };
      }
    } catch (_err) {}
  }

  function prepareMicSupport(){
    if (micSupportPromise) return micSupportPromise;
    micSupportPromise = Promise.resolve().then(async () => {
      installSpeechSynthesisPatch();
      try {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (typeof ctx.resume === "function") {
            await ctx.resume().catch(() => {});
          }
          try { await ctx.close(); } catch (_err) {}
        }
      } catch (_err) {}

      try {
        if ("speechSynthesis" in global) {
          global.speechSynthesis.cancel();
          if (typeof global.speechSynthesis.getVoices === "function") {
            global.speechSynthesis.getVoices();
          }
        }
      } catch (_err) {}

      try {
        if (
          global.navigator &&
          global.navigator.mediaDevices &&
          typeof global.navigator.mediaDevices.getUserMedia === "function"
        ) {
          const stream = await global.navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          try {
            stream.getTracks().forEach((track) => track.stop());
          } catch (_err) {}
        }
      } catch (_err) {}

      try {
        if (global.navigator && global.navigator.permissions && typeof global.navigator.permissions.query === "function") {
          await global.navigator.permissions.query({ name: "microphone" }).catch(() => {});
        }
      } catch (_err) {}
    }).finally(() => {
      micSupportPromise = null;
    });
    return micSupportPromise;
  }

  function getTraceAudioContext(){
    const AudioCtx = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!traceAudioContext || traceAudioContext.state === "closed") {
      traceAudioContext = new AudioCtx();
    }
    if (traceAudioContext.state === "suspended" && typeof traceAudioContext.resume === "function") {
      traceAudioContext.resume().catch(() => {});
    }
    return traceAudioContext;
  }

  function playTraceTick(options){
    const opts = options || {};
    const now = Date.now();
    const throttleMs = typeof opts.throttleMs === "number" ? opts.throttleMs : 90;
    if (now - lastTraceTickAt < throttleMs) return;
    lastTraceTickAt = now;
    try {
      const ctx = getTraceAudioContext();
      if (!ctx) return;
      const duration = typeof opts.duration === "number" ? opts.duration : 0.05;
      const start = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type || "sine";
      osc.frequency.setValueAtTime(typeof opts.frequency === "number" ? opts.frequency : 920, start);
      osc.frequency.exponentialRampToValueAtTime(
        typeof opts.endFrequency === "number" ? opts.endFrequency : 640,
        start + duration
      );
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(typeof opts.volume === "number" ? opts.volume : 0.055, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    } catch (_err) {}
  }

  function playTraceCelebration(options){
    const opts = options || {};
    const now = Date.now();
    const throttleMs = typeof opts.throttleMs === "number" ? opts.throttleMs : 360;
    if (now - lastTraceCelebrationAt < throttleMs) return;
    lastTraceCelebrationAt = now;
    try {
      const ctx = getTraceAudioContext();
      if (!ctx) return;
      const notes = opts.notes || [784, 988, 1175];
      const duration = typeof opts.duration === "number" ? opts.duration : 0.16;
      notes.forEach((note, index) => {
        const start = ctx.currentTime + (index * 0.08);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(note, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(typeof opts.volume === "number" ? opts.volume : 0.07, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      });
    } catch (_err) {}
  }

  function speakText(text, options){
    const normalizedText = normalizeSpeechText(text);
    if (!normalizedText || !("speechSynthesis" in global)) return;
    try {
      const opts = options || {};
      const synth = global.speechSynthesis;
      const shouldCancelFirst = opts.cancelFirst !== false && !!(synth.speaking || synth.pending);
      if (shouldCancelFirst) {
        try { synth.cancel(); } catch (_err) {}
      }
      const utterance = new SpeechSynthesisUtterance(" " + normalizedText);
      if (typeof opts.rate === "number") utterance.rate = opts.rate;
      if (typeof opts.pitch === "number") utterance.pitch = opts.pitch;
      if (typeof opts.volume === "number") utterance.volume = opts.volume;
      if (typeof opts.lang === "string" && opts.lang) utterance.lang = opts.lang;
      if (typeof opts.onEnd === "function") utterance.onend = opts.onEnd;
      if (typeof opts.onError === "function") utterance.onerror = opts.onError;
      speakPreparedUtterance(utterance, {
        afterCancel: shouldCancelFirst,
        forceDelay: opts.forceDelay === true,
        onError: opts.onError
      });
    } catch (_err) {}
  }

  function ensureTraceProgressUiStyles(){
    const doc = global.document;
    if (!doc || doc.getElementById("gpTraceProgressUiStyles")) return;
    const style = doc.createElement("style");
    style.id = "gpTraceProgressUiStyles";
    style.textContent = [
      ".gp-trace-progress{display:flex;flex-direction:column;align-items:center;gap:6px;",
      "margin:12px auto 10px;padding:8px 14px;width:min(560px,92%);",
      "background:rgba(255,255,255,.94);border-radius:16px;",
      "box-shadow:0 8px 18px rgba(0,0,0,.12);}",
      ".gp-trace-progress__text{font-size:.95rem;font-weight:800;color:#31456b;text-align:center;}",
      ".gp-trace-progress__bar{width:100%;height:14px;border-radius:999px;background:#dfe9ff;",
      "overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,.12);}",
      ".gp-trace-progress__fill{width:0%;height:100%;border-radius:999px;",
      "background:linear-gradient(90deg,#33c8ff,#6ef4a7);transition:width .16s ease-out;}"
    ].join("");
    doc.head.appendChild(style);
  }

  function ensureTraceProgressUI(options){
    const doc = global.document;
    if (!doc) return null;
    ensureTraceProgressUiStyles();
    const opts = options || {};
    const container = opts.container || doc.body;
    const before = opts.before || null;
    let wrap = opts.id ? doc.getElementById(opts.id) : null;
    if (!wrap) {
      wrap = doc.createElement("div");
      if (opts.id) wrap.id = opts.id;
      wrap.className = "gp-trace-progress";
      const text = doc.createElement("div");
      text.className = "gp-trace-progress__text";
      text.innerHTML = (opts.label || "Trace progress") + ': <span data-role="percent">0%</span>';
      const bar = doc.createElement("div");
      bar.className = "gp-trace-progress__bar";
      const fill = doc.createElement("div");
      fill.className = "gp-trace-progress__fill";
      fill.setAttribute("data-role", "fill");
      bar.appendChild(fill);
      wrap.appendChild(text);
      wrap.appendChild(bar);
      if (before && before.parentNode === container) {
        container.insertBefore(wrap, before);
      } else if (before && before.parentNode) {
        before.parentNode.insertBefore(wrap, before);
      } else {
        container.appendChild(wrap);
      }
    }
    return {
      wrap,
      textEl: wrap.querySelector('[data-role="percent"]'),
      fillEl: wrap.querySelector('[data-role="fill"]')
    };
  }

  const DIGIT_STROKES = {
    "0": [
      [[0.5, 0.05], [0.72, 0.1], [0.86, 0.28], [0.86, 0.72], [0.72, 0.9], [0.5, 0.95], [0.28, 0.9], [0.14, 0.72], [0.14, 0.28], [0.28, 0.1], [0.5, 0.05]]
    ],
    "1": [
      [[0.32, 0.22], [0.5, 0.08], [0.5, 0.95]]
    ],
    "2": [
      [[0.18, 0.22], [0.34, 0.08], [0.66, 0.08], [0.82, 0.24], [0.78, 0.42], [0.2, 0.95], [0.84, 0.95]]
    ],
    "3": [
      [[0.18, 0.12], [0.7, 0.12], [0.54, 0.46], [0.74, 0.46], [0.84, 0.6], [0.76, 0.86], [0.22, 0.9]]
    ],
    "4": [
      [[0.72, 0.08], [0.72, 0.95]],
      [[0.2, 0.56], [0.84, 0.56]],
      [[0.2, 0.56], [0.58, 0.08]]
    ],
    "5": [
      [[0.8, 0.08], [0.25, 0.08], [0.22, 0.48], [0.62, 0.48], [0.82, 0.62], [0.74, 0.9], [0.22, 0.86]]
    ],
    "6": [
      [[0.74, 0.12], [0.36, 0.18], [0.18, 0.44], [0.26, 0.8], [0.6, 0.88], [0.82, 0.68], [0.7, 0.48], [0.26, 0.5], [0.26, 0.84]]
    ],
    "7": [
      [[0.18, 0.08], [0.84, 0.08], [0.36, 0.95]]
    ],
    "8": [
      [[0.5, 0.06], [0.72, 0.14], [0.76, 0.34], [0.5, 0.48], [0.24, 0.34], [0.28, 0.14], [0.5, 0.06]],
      [[0.5, 0.5], [0.74, 0.6], [0.78, 0.84], [0.5, 0.95], [0.22, 0.84], [0.26, 0.6], [0.5, 0.5]]
    ],
    "9": [
      [[0.7, 0.52], [0.62, 0.18], [0.3, 0.12], [0.16, 0.36], [0.26, 0.56], [0.72, 0.54], [0.62, 0.95]]
    ]
  };

  function getDigitTraceGroups(value){
    const digit = String(value == null ? "" : value).replace(/[^\d]/g, "").charAt(0);
    const groups = DIGIT_STROKES[digit] || [];
    return groups.map((segment) => segment.map((point) => [point[0], point[1]]));
  }

  function createDigitTraceGroups(value, box, options){
    const digits = String(value == null ? "" : value).replace(/[^\d]/g, "").split("").filter(Boolean);
    if (!digits.length || !box) return [];
    const opts = options || {};
    const gapRatio = typeof opts.gap === "number" ? opts.gap : 0.08;
    const insetXRatio = typeof opts.insetX === "number" ? opts.insetX : 0.1;
    const insetYRatio = typeof opts.insetY === "number" ? opts.insetY : 0.08;
    const gap = box.w * gapRatio;
    const totalGap = gap * Math.max(0, digits.length - 1);
    const digitWidth = (box.w - totalGap) / digits.length;
    const groups = [];

    digits.forEach((digit, index) => {
      const templates = getDigitTraceGroups(digit);
      const x = box.x + (index * (digitWidth + gap));
      const innerX = x + (digitWidth * insetXRatio);
      const innerY = box.y + (box.h * insetYRatio);
      const innerW = digitWidth * (1 - (insetXRatio * 2));
      const innerH = box.h * (1 - (insetYRatio * 2));
      templates.forEach((segment) => {
        groups.push(segment.map((point) => ([
          innerX + (point[0] * innerW),
          innerY + (point[1] * innerH)
        ])));
      });
    });

    return groups;
  }

  function normalizeTraceGroups(rawGroups){
    if (!Array.isArray(rawGroups) || !rawGroups.length) return [];
    if (Array.isArray(rawGroups[0]) && typeof rawGroups[0][0] === "number") {
      return [rawGroups];
    }
    return rawGroups.filter((group) => Array.isArray(group) && group.length >= 2);
  }

  function clamp01(value){
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num < 0) return 0;
    if (num > 1) return 1;
    return num;
  }

  function smoothTracePoints(points, segmentsPerSpan){
    const source = Array.isArray(points) ? points.filter((point) => Array.isArray(point) && point.length >= 2) : [];
    if (source.length < 3) return source;
    const segmentCount = Math.max(8, Math.round(segmentsPerSpan || 18));
    const smoothed = [];
    for (let i = 0; i < source.length - 1; i += 1) {
      const p0 = source[i - 1] || source[i];
      const p1 = source[i];
      const p2 = source[i + 1];
      const p3 = source[i + 2] || p2;
      for (let step = 0; step < segmentCount; step += 1) {
        const t = step / segmentCount;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * (
          (2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          ((2 * p0[0]) - (5 * p1[0]) + (4 * p2[0]) - p3[0]) * t2 +
          (-p0[0] + (3 * p1[0]) - (3 * p2[0]) + p3[0]) * t3
        );
        const y = 0.5 * (
          (2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          ((2 * p0[1]) - (5 * p1[1]) + (4 * p2[1]) - p3[1]) * t2 +
          (-p0[1] + (3 * p1[1]) - (3 * p2[1]) + p3[1]) * t3
        );
        smoothed.push([clamp01(x), clamp01(y)]);
      }
    }
    smoothed.push(source[source.length - 1]);
    return smoothed;
  }

  function shouldSuppressPromptRepeatFallback(options){
    const opts = options || {};
    if (opts.promptFallback === true) return false;
    if (opts.promptFallback === false) return true;
    if (global.__GP_DISABLE_REPEAT_PROMPT_FALLBACK) return true;
    const path = String((global.location && global.location.pathname) || "");
    if (/[\\\/]levels[\\\/]level-[abc][\\\/]/i.test(path)) return true;
    const body = global.document && global.document.body;
    if (body && body.dataset && (body.dataset.gpUnifiedMicProtocol === "1" || body.dataset.gpForceLa2Mic === "1")) {
      return true;
    }
    return false;
  }

  function promptRepeatFallback(expectedText, onDone, options){
    if (shouldSuppressPromptRepeatFallback(options)) {
      if (onDone) onDone(percentWordMatch(expectedText, ""), "");
      return;
    }
    let said = "";
    try {
      if (typeof global.prompt === "function") {
        said = global.prompt("Repeat what you heard:", "") || "";
      }
    } catch (_err) {}
    if (onDone) onDone(percentWordMatch(expectedText, said), said);
  }

  function listenForRepeat(expectedText, onDone, options){
    const SpeechRecognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    const opts = options || {};
    const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : 3000;
    const settleMs = typeof opts.settleMs === "number" ? opts.settleMs : 900;
    if (!SpeechRecognition) {
      promptRepeatFallback(expectedText, onDone, opts);
      return;
    }
    prepareMicSupport().catch(() => {});
    const recognition = new SpeechRecognition();
    try {
      if (activeRecognition && activeRecognition !== recognition) {
        activeRecognition.onresult = null;
        activeRecognition.onerror = null;
        activeRecognition.onnomatch = null;
        activeRecognition.onend = null;
        activeRecognition.stop();
      }
    } catch (_err) {}
    activeRecognition = recognition;
    let done = false;
    let heard = "";
    let fallbackTimer = null;
    let fallbackUsed = false;

    function finish(pct, said){
      if (done) return;
      done = true;
      if (fallbackTimer) {
        global.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      try { recognition.onresult = null; } catch (_) {}
      try { recognition.onerror = null; } catch (_) {}
      try { recognition.onnomatch = null; } catch (_) {}
      try { recognition.onend = null; } catch (_) {}
      try { recognition.stop(); } catch (_) {}
      if (activeRecognition === recognition) activeRecognition = null;
      if (onDone) onDone(pct, said);
    }

    function finishWithFallback(){
      if (fallbackUsed || done) return;
      fallbackUsed = true;
      promptRepeatFallback(expectedText, onDone, opts);
      done = true;
      if (fallbackTimer) {
        global.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      try { recognition.onresult = null; } catch (_) {}
      try { recognition.onerror = null; } catch (_) {}
      try { recognition.onnomatch = null; } catch (_) {}
      try { recognition.onend = null; } catch (_) {}
      try { recognition.stop(); } catch (_) {}
      if (activeRecognition === recognition) activeRecognition = null;
    }

    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;
    try {
      if ("speechSynthesis" in global) global.speechSynthesis.cancel();
    } catch (_err) {}
    recognition.onresult = (event) => {
      if (fallbackTimer) {
        global.clearTimeout(fallbackTimer);
        fallbackTimer = global.setTimeout(() => {
          finish(percentWordMatch(expectedText, heard), heard);
        }, settleMs);
      }
      const transcripts = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result || !result[0]) continue;
        transcripts.push(result[0].transcript || "");
        if (result.isFinal) {
          heard = transcripts.join(" ").trim();
        }
      }
      if (!heard) {
        heard = transcripts.join(" ").trim();
      }
      if (event.results[event.results.length - 1] && event.results[event.results.length - 1].isFinal) {
        finish(percentWordMatch(expectedText, heard), heard);
      }
    };
    recognition.onerror = (event) => {
      const code = event && event.error ? String(event.error) : "";
      if (code === "aborted" && done) return;
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture" || code === "network") {
        finishWithFallback();
        return;
      }
      finish(percentWordMatch(expectedText, heard), heard);
    };
    recognition.onnomatch = () => {
      finish(percentWordMatch(expectedText, heard), heard);
    };
    recognition.onend = () => {
      finish(percentWordMatch(expectedText, heard), heard);
    };

    fallbackTimer = global.setTimeout(() => {
      if (heard) {
        finish(percentWordMatch(expectedText, heard), heard);
        return;
      }
      finishWithFallback();
    }, timeoutMs);

    try {
      recognition.start();
    } catch (_err) {
      finishWithFallback();
    }
  }

  function fitElementToViewport(elementOrSelector, options){
    const opts = options || {};
    const element = typeof elementOrSelector === "string"
      ? global.document.querySelector(elementOrSelector)
      : elementOrSelector;

    if (!element) return;

    const isActive = typeof opts.isActive === "function" ? opts.isActive : (() => true);
    const minWidth = opts.minWidth || 320;
    const minHeight = opts.minHeight || 320;
    const padding = opts.padding || 8;
    const minScale = typeof opts.minScale === "number" ? opts.minScale : 0.58;
    const useScrollSize = !!opts.useScrollSize;

    element.style.transformOrigin = opts.transformOrigin || "top center";

    if (!isActive()) {
      element.style.transform = "none";
      return;
    }

    const vv = global.visualViewport;
    const vw = Math.max(minWidth, Math.floor(vv ? vv.width : global.innerWidth));
    const vh = Math.max(minHeight, Math.floor(vv ? vv.height : global.innerHeight));
    element.style.transform = "none";
    const rect = element.getBoundingClientRect();
    const targetWidth = useScrollSize
      ? Math.max(element.scrollWidth || 0, Math.ceil(rect.width))
      : rect.width;
    const targetHeight = useScrollSize
      ? Math.max(element.scrollHeight || 0, Math.ceil(rect.height))
      : rect.height;
    if (!targetWidth || !targetHeight) return;
    const scale = Math.min(1, (vw - padding) / targetWidth, (vh - padding) / targetHeight);
    element.style.transform = "scale(" + Math.max(minScale, scale).toFixed(3) + ")";
  }

  function createCircleTracePad(options){
    const opts = options || {};
    const canvas = typeof opts.canvas === "string"
      ? global.document.getElementById(opts.canvas)
      : (opts.canvas || (opts.canvasId ? global.document.getElementById(opts.canvasId) : null));
    if (!canvas) return null;
    canvas.dataset.gpSharedTracePad = "true";
    canvas.style.pointerEvents = "auto";
    canvas.style.touchAction = "none";

    const ctx = canvas.getContext("2d");
    const pctEl = opts.pctEl || (opts.pctId ? global.document.getElementById(opts.pctId) : null);
    const fillEl = opts.fillEl || (opts.fillId ? global.document.getElementById(opts.fillId) : null);
    const messageEl = opts.messageEl || (opts.msgId ? global.document.getElementById(opts.msgId) : null);
    const maxPercent = typeof opts.maxPercent === "number" ? opts.maxPercent : 25;
    const strokeStyle = opts.strokeStyle || "#ff4d4d";
    const lineWidth = opts.lineWidth || 7;
    const sampleCount = opts.sampleCount || 1800;
    const threshold = typeof opts.threshold === "number"
      ? opts.threshold
      : Math.max(9, Math.round(lineWidth * 1.2));
    const completionSnap = typeof opts.completionSnap === "number" ? opts.completionSnap : 96;
    const speak = typeof opts.speak === "function" ? opts.speak : null;
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    const onTick = typeof opts.onTick === "function" ? opts.onTick : null;
    const onComplete = typeof opts.onComplete === "function" ? opts.onComplete : null;
    const getMessage = typeof opts.getMessage === "function" ? opts.getMessage : null;

    let lastPercent = 0;
    let lastRawPercent = 0;
    let drawing = false;
    let lastPoint = null;
    let lastMid = null;
    let drawW = 0;
    let drawH = 0;
    let samplePoints = [];
    let visited = [];
    let visitedCount = 0;
    let completionNotified = false;
    let resizeObserver = null;

    function updateProgress(rawPercent){
      lastRawPercent = Math.max(0, Math.min(100, Math.round(rawPercent)));
      const scaled = Math.max(0, Math.min(maxPercent, Math.round(rawPercent * (maxPercent / 100))));
      lastPercent = scaled;
      if (pctEl) pctEl.textContent = scaled + "%";
      if (fillEl) fillEl.style.width = scaled + "%";
      if (onProgress) onProgress(scaled, rawPercent);
      if (lastRawPercent >= 100) {
        if (!completionNotified) {
          completionNotified = true;
          if (onComplete) onComplete(scaled, lastRawPercent);
        }
      } else {
        completionNotified = false;
      }
    }

    function buildSamples(){
      samplePoints = [];
      visited = new Array(sampleCount).fill(false);
      visitedCount = 0;
      const cx = drawW / 2;
      const cy = drawH / 2;
      const radius = Math.min(drawW, drawH) * 0.42;
      const totalSamples = Math.max(sampleCount, Math.round((2 * Math.PI * radius) * 3.1));
      for (let i = 0; i < totalSamples; i += 1) {
        const ang = (2 * Math.PI * i) / totalSamples;
        samplePoints.push({ x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) });
      }
    }

    function resize(){
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
      drawW = Math.max(1, rect.width);
      drawH = Math.max(1, rect.height);
      canvas.width = Math.round(drawW * dpr);
      canvas.height = Math.round(drawH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildSamples();
      ctx.clearRect(0, 0, drawW, drawH);
      updateProgress(0);
    }

    function updateVisitedSegment(x1, y1, x2, y2){
      const thr2 = threshold * threshold;
      const abx = x2 - x1;
      const aby = y2 - y1;
      const ab2 = (abx * abx) + (aby * aby) || 1;
      let changed = false;

      for (let i = 0; i < samplePoints.length; i += 1) {
        if (visited[i]) continue;
        const point = samplePoints[i];
        const apx = point.x - x1;
        const apy = point.y - y1;
        let t = (apx * abx + apy * aby) / ab2;
        t = Math.max(0, Math.min(1, t));
        const qx = x1 + t * abx;
        const qy = y1 + t * aby;
        const dx = point.x - qx;
        const dy = point.y - qy;
        if ((dx * dx) + (dy * dy) <= thr2) {
          visited[i] = true;
          visitedCount += 1;
          changed = true;
        }
      }

      if (changed) {
        let rawPercent = Math.round((visitedCount / samplePoints.length) * 100);
        if (rawPercent >= completionSnap) rawPercent = 100;
        updateProgress(rawPercent);
      }
    }

    function getPos(event){
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function endDraw(event){
      if (!drawing) return;
      if (event) event.preventDefault();
      drawing = false;
      try{
        if (event && typeof event.pointerId === "number") {
          canvas.releasePointerCapture(event.pointerId);
        }
      }catch(_err){}
      lastPoint = null;
      lastMid = null;

      if (getMessage) {
        const message = getMessage(lastPercent);
        if (messageEl) {
          messageEl.textContent = message;
          messageEl.classList.add("show");
        }
        if (speak && message) speak(message);
      }
    }

    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      drawing = true;
      try{
        canvas.setPointerCapture(event.pointerId);
      }catch(_err){}
      const point = getPos(event);
      lastPoint = point;
      lastMid = null;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      updateVisitedSegment(point.x, point.y, point.x, point.y);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drawing) return;
      event.preventDefault();
      const prev = lastPoint;
      const point = getPos(event);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = strokeStyle;

      if (prev) {
        const midX = (prev.x + point.x) / 2;
        const midY = (prev.y + point.y) / 2;
        if (!lastMid) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          lastMid = { x: prev.x, y: prev.y };
        }
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        ctx.stroke();
        lastMid = { x: midX, y: midY };
        updateVisitedSegment(prev.x, prev.y, point.x, point.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        updateVisitedSegment(point.x, point.y, point.x, point.y);
      }

      lastPoint = point;
      if (onTick) onTick(lastPercent, lastRawPercent);
      else playTraceTick();
    });

    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointerleave", endDraw);
    canvas.addEventListener("pointercancel", endDraw);
    canvas.addEventListener("lostpointercapture", endDraw);
    global.addEventListener("blur", endDraw);
    global.addEventListener("resize", resize);

    if ("ResizeObserver" in global && canvas.parentElement) {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(canvas.parentElement);
    }

    function teardown(){
      global.removeEventListener("blur", endDraw);
      global.removeEventListener("resize", resize);
      global.removeEventListener("pagehide", teardown);
      global.removeEventListener("beforeunload", teardown);
      if (resizeObserver) {
        try { resizeObserver.disconnect(); } catch (_err) {}
        resizeObserver = null;
      }
    }

    global.addEventListener("pagehide", teardown, { once:true });
    global.addEventListener("beforeunload", teardown, { once:true });

    resize();

    return function resetTracePad(){
      ctx.clearRect(0, 0, drawW, drawH);
      buildSamples();
      updateProgress(0);
      lastPoint = null;
      lastMid = null;
      lastRawPercent = 0;
      completionNotified = false;
      if (messageEl) {
        messageEl.textContent = "";
        messageEl.classList.remove("show");
      }
    };
  }

  function createPathTracePad(options){
    const opts = options || {};
    const canvas = typeof opts.canvas === "string"
      ? global.document.getElementById(opts.canvas)
      : (opts.canvas || (opts.canvasId ? global.document.getElementById(opts.canvasId) : null));
    if (!canvas) return null;
    canvas.dataset.gpSharedTracePad = "true";
    canvas.style.pointerEvents = "auto";
    canvas.style.touchAction = "none";

    const ctx = canvas.getContext("2d");
      const strokeStyle = opts.strokeStyle || "#ff4d4d";
      const lineWidth = opts.lineWidth || 12;
      const threshold = typeof opts.threshold === "number"
        ? opts.threshold
        : Math.max(18, Math.round(lineWidth * 2.4));
    const completionSnap = typeof opts.completionSnap === "number" ? opts.completionSnap : 94;
    const getMessage = typeof opts.getMessage === "function" ? opts.getMessage : null;
    const speak = typeof opts.speak === "function" ? opts.speak : null;
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    const pointGroups = typeof opts.getPoints === "function" ? opts.getPoints : (() => opts.points || []);
    const onTick = typeof opts.onTick === "function" ? opts.onTick : null;
    const onComplete = typeof opts.onComplete === "function" ? opts.onComplete : null;
      const smoothing = opts.smoothing !== false;
        const smoothness = typeof opts.smoothness === "number" ? opts.smoothness : 36;

    let drawing = false;
    let lastPoint = null;
    let lastMid = null;
    let visited = [];
    let samples = [];
    let visitedCount = 0;
    let lastRawPercent = 0;
    let completionNotified = false;
    let resizeObserver = null;

    function buildSamples(groups, width, height){
      const result = [];
      groups.forEach((points) => {
        const pathPoints = smoothing ? smoothTracePoints(points, smoothness) : points;
        for (let i = 0; i < pathPoints.length - 1; i += 1) {
          const a = pathPoints[i];
          const b = pathPoints[i + 1];
          const dx = (b[0] - a[0]) * width;
          const dy = (b[1] - a[1]) * height;
          const segmentLength = Math.hypot(dx, dy);
          const steps = Math.max(320, Math.round(segmentLength * 6.2));
          for (let s = 0; s < steps; s += 1) {
            const t = s / (steps - 1);
            result.push({
              x: (a[0] + (b[0] - a[0]) * t) * width,
              y: (a[1] + (b[1] - a[1]) * t) * height
            });
          }
        }
      });
      return result;
    }

    function resize(){
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, global.devicePixelRatio || 1));
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.miterLimit = 1;
      ctx.imageSmoothingEnabled = true;

      const points = normalizeTraceGroups(pointGroups());
      samples = buildSamples(points, rect.width, rect.height);
      visited = new Array(samples.length).fill(false);
      visitedCount = 0;
      lastRawPercent = 0;
      completionNotified = false;
      if (onProgress) onProgress(0);
    }

    function updateVisitedSegment(x1, y1, x2, y2){
      const thr2 = threshold * threshold;
      const abx = x2 - x1;
      const aby = y2 - y1;
      const ab2 = (abx * abx) + (aby * aby);
      let changed = false;

      for (let i = 0; i < samples.length; i += 1) {
        if (visited[i]) continue;
        const px = samples[i].x;
        const py = samples[i].y;
        let t = 0;
        if (ab2 > 0) {
          t = ((px - x1) * abx + (py - y1) * aby) / ab2;
          if (t < 0) t = 0;
          if (t > 1) t = 1;
        }
        const cx = x1 + abx * t;
        const cy = y1 + aby * t;
        const dx = px - cx;
        const dy = py - cy;
        if ((dx * dx) + (dy * dy) <= thr2) {
          visited[i] = true;
          visitedCount += 1;
          changed = true;
        }
      }

      if (changed) {
        let pct = Math.round((visitedCount / Math.max(1, samples.length)) * 100);
        if (pct >= completionSnap) pct = 100;
        lastRawPercent = Math.max(0, Math.min(100, pct));
        if (onProgress) onProgress(Math.max(0, Math.min(100, pct)));
        if (lastRawPercent >= 100) {
          if (!completionNotified) {
            completionNotified = true;
            if (onComplete) onComplete(lastRawPercent);
          }
        } else {
          completionNotified = false;
        }
      }
    }

    function getPos(event){
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
      };
    }

    function endDraw(event){
      if (!drawing) return;
      if (event) event.preventDefault();
      drawing = false;
      lastPoint = null;
      lastMid = null;
      if (canvas.releasePointerCapture && event) {
        try{
          canvas.releasePointerCapture(event.pointerId);
        }catch(_err){}
      }
      if (getMessage) {
        let pct = Math.round((visitedCount / Math.max(1, samples.length)) * 100);
        if (pct >= completionSnap) pct = 100;
        const message = getMessage(pct);
        if (speak && message) speak(message);
      }
    }

    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (canvas.setPointerCapture) {
        try{
          canvas.setPointerCapture(event.pointerId);
        }catch(_err){}
      }
      drawing = true;
      const point = getPos(event);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      lastPoint = point;
      lastMid = point;
      updateVisitedSegment(point.x, point.y, point.x, point.y);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drawing) return;
      event.preventDefault();
      const point = getPos(event);
      const prev = lastPoint;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = strokeStyle;

      if (!prev) {
        lastPoint = point;
        lastMid = point;
        updateVisitedSegment(point.x, point.y, point.x, point.y);
      } else {
        const midX = (prev.x + point.x) / 2;
        const midY = (prev.y + point.y) / 2;
        const start = lastMid || prev;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        ctx.stroke();
        lastMid = { x: midX, y: midY };
        updateVisitedSegment(prev.x, prev.y, point.x, point.y);
        lastPoint = point;
      }

      if (onTick) onTick(lastRawPercent);
      else playTraceTick();
    });

    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);

    if ("ResizeObserver" in global && canvas.parentElement) {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(canvas.parentElement);
    }
    global.addEventListener("resize", resize);

    function teardown(){
      global.removeEventListener("resize", resize);
      global.removeEventListener("pagehide", teardown);
      global.removeEventListener("beforeunload", teardown);
      if (resizeObserver) {
        try { resizeObserver.disconnect(); } catch (_err) {}
        resizeObserver = null;
      }
    }

    global.addEventListener("pagehide", teardown, { once:true });
    global.addEventListener("beforeunload", teardown, { once:true });

    resize();

    return function resetTracePad(){
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      visited = new Array(samples.length).fill(false);
      visitedCount = 0;
      if (onProgress) onProgress(0);
      lastPoint = null;
      lastMid = null;
      lastRawPercent = 0;
      completionNotified = false;
    };
  }

  function getPageInfo(){
    const pathname = String((global.location && global.location.pathname) || "");
    const file = pathname.split("/").pop() || "";
    const lessonMatch = file.match(/^(LA|LB|LevelC)(\d+)\.html$/i);
    return {
      pathname,
      file,
      isLevelApp: /\/levels\/level-(a|b|c)\//i.test(pathname),
      levelCode: lessonMatch ? lessonMatch[1] : null,
      lessonNumber: lessonMatch ? Number(lessonMatch[2]) : null
    };
  }

  function ensureLevelBOverlayStyles(){
    const doc = global.document;
    if (!doc || doc.getElementById("gpLevelBOverlayStyles")) return;
    const style = doc.createElement("style");
    style.id = "gpLevelBOverlayStyles";
    style.textContent = [
      "#lbIntroVideoOverlay{position:fixed;inset:0;display:none;visibility:hidden;opacity:0;pointer-events:none;align-items:center;justify-content:center;",
      "background:rgba(0,0,0,.82);z-index:2147483647;padding:16px;flex-direction:column;gap:14px;}",
      "#lbIntroVideoOverlay.active{display:flex !important;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;}",
      "#lbIntroVideoOverlay video{width:min(96vw,980px);max-height:92vh;height:auto;object-fit:contain;object-position:center center;border-radius:14px;",
      "background:#000;opacity:1;box-shadow:0 18px 48px rgba(0,0,0,.45);}",
      "#lbIntroVideoOverlay .gp-level-b-intro-note{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);",
      "padding:10px 16px;border-radius:999px;background:rgba(255,255,255,.92);color:#20304a;font-weight:800;",
      "font-size:clamp(13px,2vw,16px);text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.22);}",
      "#lbIntroVideoOverlay .gp-level-b-intro-note:empty{display:none;}",
      "#lbIntroVideoOverlay .gp-level-b-intro-skip{position:absolute;right:18px;top:18px;border:none;border-radius:999px;",
      "padding:10px 14px;background:#fff;color:#20304a;font-weight:800;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.22);}"
    ].join("");
    doc.head.appendChild(style);
  }

  function stopIntroMedia(){
    const doc = global.document;
    if (!doc) return;
    const media = doc.querySelectorAll(
      "#introVideoWrap video,.intro-video-wrap video,#lbIntroVideoOverlay video,video.autoplay-intro,.autoplay-intro"
    );
    media.forEach((node) => {
      try { node.pause(); } catch (_err) {}
      try { node.currentTime = 0; } catch (_err) {}
      try { node.autoplay = false; } catch (_err) {}
      try { node.removeAttribute("autoplay"); } catch (_err) {}
    });
  }

  function isWeek1LessonPage(page){
    const info = page || getPageInfo();
    return /\/levels\/level-(a|b|c)\/week-1\//i.test(String(info && info.pathname || ""));
  }

  function suppressLessonIntroVideos(){
    const doc = global.document;
    if (!doc) return;
    const html = doc.documentElement;
    const body = doc.body;

    stopIntroMedia();

    [
      "gp-intro-video-pending",
      "lb-intro-video-pending",
      "lesson-intro-video-pending"
    ].forEach((className) => {
      if (html) html.classList.remove(className);
    });

    if (body) body.classList.remove("intro-active");

    const overlays = doc.querySelectorAll(
      "#gpIntroVideoOverlay,#introVideoWrap,.intro-video-wrap,#lbIntroVideoOverlay"
    );

    overlays.forEach((node) => {
      try { node.classList.remove("active", "hidden"); } catch (_err) {}
      try { node.pause && node.pause(); } catch (_err) {}
      try { node.style.display = "none"; } catch (_err) {}
      try { node.style.visibility = "hidden"; } catch (_err) {}
      try { node.style.pointerEvents = "none"; } catch (_err) {}
      try {
        if (node.parentNode) node.parentNode.removeChild(node);
      } catch (_err) {}
    });
  }

  function suppressWeek1IntroVideos(){
    suppressLessonIntroVideos();
  }

  function installRealtimeTraceProgressSync(){
    const doc = global.document;
    if (!doc || !doc.body) return;
    if (doc.body.dataset.gpRealtimeTraceSyncInstalled === "1") return;

    const page = getPageInfo();
    if (!page.isLevelApp) return;

    const progressSelector = [
      '[id*="progressPercent"]',
      '[id*="progressFill"]',
      '.progress-fill',
      '.progress-text',
      '.trace-progress',
      '.trace-progress-bar'
    ].join(",");
    const traceSelector = 'canvas[id*="trace"], canvas[data-gp-shared-trace-pad="true"], .traceShape, .trace-hit, .trace-overlay';
    if (!doc.querySelector(progressSelector) && !doc.querySelector(traceSelector)) return;

    doc.body.dataset.gpRealtimeTraceSyncInstalled = "1";

    const observed = new WeakSet();
    const liveInputs = new WeakSet();
    let pendingTimer = 0;
    let rafPending = 0;
    let lastSavedScore = null;

    function parsePercent(value){
      const match = String(value || "").match(/(\d{1,3})(?:\.\d+)?\s*%?/);
      if (!match) return null;
      const pct = Number(match[1]);
      if (!Number.isFinite(pct)) return null;
      return Math.max(0, Math.min(100, Math.round(pct)));
    }

    function collectProgressScores(){
      const scores = new Set();
      const percentNodes = doc.querySelectorAll(
        '[id*="progressPercent"], .progress-text, .progress-label, .trace-progress, [data-progress-percent]'
      );
      percentNodes.forEach((node) => {
        const pct = parsePercent(node.textContent || node.getAttribute("data-progress-percent") || "");
        if (pct !== null) scores.add(pct);
      });

      const fillNodes = doc.querySelectorAll(
        '[id*="progressFill"], .progress-fill, .trace-progress-bar [style*="%"], [data-progress-fill]'
      );
      fillNodes.forEach((node) => {
        const pct = parsePercent(
          node.style && node.style.width
            ? node.style.width
            : ((node.getAttribute && node.getAttribute("data-progress-fill")) || "")
        );
        if (pct !== null) scores.add(pct);
      });

      return Array.from(scores).sort((a, b) => a - b);
    }

    function buildPayload(score){
      const pathname = String((global.location && global.location.pathname) || "");
      const fileName = page.file || ((pathname.split("/").pop() || "Activity.html"));
      const pageId = fileName.replace(/\.html$/i, "") || "Activity";
      const levelMatch = pathname.match(/\/levels\/level-([abc])\//i);
      const weekMatch = pathname.match(/\/week-(\d+)\//i);
      const hasTraceUi = !!doc.querySelector(traceSelector);
      return {
        pageId,
        fileName,
        level: levelMatch ? levelMatch[1].toUpperCase() : null,
        week: weekMatch ? "week-" + weekMatch[1] : null,
        activityType: hasTraceUi ? "tracing" : "activity",
        score,
        progress: score,
        tracing: score,
        completed: score >= 100
      };
    }

    function pushPayload(score){
      const payload = buildPayload(score);
      try {
        if (typeof global.finishAndSave === "function") {
          Promise.resolve(global.finishAndSave(payload)).catch(() => {});
          return;
        }
        if (typeof global.finishActivity === "function") {
          Promise.resolve(global.finishActivity(payload)).catch(() => {});
          return;
        }
        if (typeof global.saveActivityResult === "function") {
          Promise.resolve(global.saveActivityResult(payload)).catch(() => {});
          return;
        }
        if (global.GPTrack && typeof global.GPTrack.finish === "function") {
          Promise.resolve(global.GPTrack.finish(payload)).catch(() => {});
        }
      } catch (_err) {}
    }

    function flushProgress(){
      pendingTimer = 0;
      const scores = collectProgressScores();
      if (!scores.length) return;
      const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
      if (score === lastSavedScore) return;
      lastSavedScore = score;
      pushPayload(score);
    }

    function scheduleFlush(urgent){
      if (pendingTimer) global.clearTimeout(pendingTimer);
      if (urgent) {
        if (rafPending) return;
        const raf = global.requestAnimationFrame || function(callback){
          return global.setTimeout(callback, 32);
        };
        rafPending = raf(() => {
          rafPending = 0;
          flushProgress();
        });
        return;
      }
      pendingTimer = global.setTimeout(flushProgress, 90);
    }

    function observeNode(node){
      if (!node || observed.has(node)) return;
      observed.add(node);
      try {
        const observer = new MutationObserver(scheduleFlush);
        observer.observe(node, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["style", "class", "data-progress-percent", "data-progress-fill", "aria-valuenow"]
        });
      } catch (_err) {}
    }

    function bindLiveInput(node){
      if (!node || liveInputs.has(node)) return;
      liveInputs.add(node);
      const pulse = () => scheduleFlush(true);
      try { node.addEventListener("pointerdown", pulse, { passive: true }); } catch (_err) {}
      try { node.addEventListener("pointermove", pulse, { passive: true }); } catch (_err) {}
      try { node.addEventListener("pointerup", pulse, { passive: true }); } catch (_err) {}
      try { node.addEventListener("touchstart", pulse, { passive: true }); } catch (_err) {}
      try { node.addEventListener("touchmove", pulse, { passive: true }); } catch (_err) {}
      try { node.addEventListener("touchend", pulse, { passive: true }); } catch (_err) {}
      try { node.addEventListener("input", pulse, { passive: true }); } catch (_err) {}
    }

    function bindProgressWatchers(){
      doc.querySelectorAll(progressSelector).forEach(observeNode);
    }

    function bindLiveInputWatchers(){
      doc.querySelectorAll(
        [
          traceSelector,
          'canvas[id*="draw"]',
          'canvas[id*="poster"]',
          'svg[id*="trace"]',
          '[data-trace-canvas]',
          '[data-trace-layer]',
          '#drawLayer'
        ].join(",")
      ).forEach(bindLiveInput);
    }

    try {
      const rootObserver = new MutationObserver(() => {
        bindProgressWatchers();
        bindLiveInputWatchers();
        scheduleFlush();
      });
      rootObserver.observe(doc.body, { childList: true, subtree: true });
    } catch (_err) {}

    bindProgressWatchers();
    bindLiveInputWatchers();
    scheduleFlush(true);
    global.setTimeout(scheduleFlush, 700);
    global.setTimeout(scheduleFlush, 1800);
    global.addEventListener("beforeunload", flushProgress);
  }

  function buildIntroCandidateList(page, doc){
    const seen = new Set();
    const candidates = [];

    function add(src){
      const value = String(src || "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      candidates.push(value);
    }

    const declared = doc.querySelectorAll(
      "#introVideoWrap source,#introVideoWrap video,.intro-video-wrap source,.intro-video-wrap video,#lbIntroVideoOverlay source,#lbIntroVideoOverlay video,video.autoplay-intro,.autoplay-intro"
    );
    declared.forEach((node) => {
      add(node.getAttribute && node.getAttribute("src"));
      add(node.src);
    });

    const number = page.lessonNumber;
    if (!number) return candidates;

    if (/^LA$/i.test(page.levelCode || "")) {
      add("../../../../assets/video/LA" + number + "avideo.mp4");
      add("../../../../assets/video/LA" + number + "aavideo.mp4");
    } else if (/^LB$/i.test(page.levelCode || "")) {
      add("../../../../assets/video/LB" + number + "bvideo.mp4");
      add("../../../../assets/video/LB" + number + "bbvideo.mp4");
      add("../../../../assets/video/LB" + number + "bVideo.mp4");
      add("../../../../assets/video/LB" + number + "Bvideo.mp4");
      add("../../../../assets/video/LB" + number + "b_video.mp4");
      add("../../../../assets/video/LB" + number + "avideo.mp4");
    } else if (/^LevelC$/i.test(page.levelCode || "")) {
      add("../../../../assets/video/LevelC" + number + "c.mp4");
      add("../../../../assets/video/LC" + number + "cvideo.mp4");
      add("../../../../assets/video/LevelC" + number + "cvideo.mp4");
    }

    return candidates;
  }

  function installLevelBIntroAutoplayFix(){
    suppressLessonIntroVideos();
    return;
    const doc = global.document;
    if (!doc || doc.body.dataset.gpLevelBIntroFixed === "1") return;
    const page = getPageInfo();
    if (!page.isLevelApp) return;

    doc.body.dataset.gpLevelBIntroFixed = "1";
    ensureLevelBOverlayStyles();

    const html = doc.documentElement;
    const candidates = buildIntroCandidateList(page, doc);
    const hasDeclaredIntro = doc.querySelector(
      "#introVideoWrap,.intro-video-wrap,#lbIntroVideoOverlay,video.autoplay-intro,.autoplay-intro"
    );
    if (!candidates.length && !hasDeclaredIntro) return;

    html.classList.add("lb-intro-video-pending");

    const staleOverlays = doc.querySelectorAll("#lbIntroVideoOverlay,#introVideoWrap,.intro-video-wrap");
    staleOverlays.forEach((node) => {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });

    const overlay = doc.createElement("div");
    overlay.id = "lbIntroVideoOverlay";
    overlay.className = "active";
    overlay.setAttribute("aria-label", "Lesson intro video");

    const video = doc.createElement("video");
    video.preload = "auto";
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.autoplay = true;
    video.controls = false;

    const skipBtn = doc.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "gp-level-b-intro-skip";
    skipBtn.textContent = "Skip";

    const note = doc.createElement("div");
    note.className = "gp-level-b-intro-note";
    note.textContent = "";

    overlay.appendChild(video);
    overlay.appendChild(skipBtn);
    overlay.appendChild(note);
    doc.body.appendChild(overlay);

    let closed = false;
    let candidateIndex = 0;
    let fallbackTimer = null;

    function closeOverlay(){
      if (closed) return;
      closed = true;
      if (fallbackTimer) {
        global.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      stopIntroMedia();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      html.classList.remove("lb-intro-video-pending");
    }

    function tryMutedPlayback(){
      try {
        video.muted = true;
        video.defaultMuted = true;
        const mutedPlay = video.play();
        if (mutedPlay && typeof mutedPlay.catch === "function") {
          mutedPlay.catch(() => {});
        }
        note.textContent = "";
      } catch (_err) {}
    }

    function loadNextCandidate(){
      if (closed) return;
      if (candidateIndex >= candidates.length) {
        closeOverlay();
        return;
      }

      const src = candidates[candidateIndex++];
      video.src = src;
      video.load();
      note.textContent = "";
      fallbackTimer = global.setTimeout(() => {
        loadNextCandidate();
      }, 2200);
    }

    video.addEventListener("loadeddata", () => {
      if (closed) return;
      if (fallbackTimer) {
        global.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          tryMutedPlayback();
        });
      }
      note.textContent = "";
    });

    video.addEventListener("error", () => {
      if (fallbackTimer) {
        global.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      loadNextCandidate();
    });

    video.addEventListener("ended", closeOverlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === skipBtn) return;
      try {
        video.muted = false;
        video.defaultMuted = false;
        video.volume = 1;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
        note.textContent = "";
      } catch (_err) {}
    });
    skipBtn.addEventListener("click", closeOverlay);

    fallbackTimer = global.setTimeout(() => {
      loadNextCandidate();
    }, 80);
  }

  function installUnifiedLessonMicProtocol(){
    const doc = global.document;
    if (!doc) return;
    const page = getPageInfo();
    if (!page.isLevelApp) return;
    if (global.__GP_DISABLE_UNIFIED_MIC_PROTOCOL) return;

    const micIconBtn = doc.getElementById("micIconBtn");
    const lines = Array.from(doc.querySelectorAll(
      ".convo-line,.speech-line,.dialog-line,.bubble-line,.bubble-left,.bubble-right,#bubbleLeft,#bubbleRight"
    )).filter((line) => {
      return !!(
        line.querySelector(".bubble,.speech-bubble,.dialog-bubble,.convo-bubble") ||
        line.classList.contains("bubble-left") ||
        line.classList.contains("bubble-right") ||
        line.id === "bubbleLeft" ||
        line.id === "bubbleRight"
      );
    });
    if (!micIconBtn || !lines.length || micIconBtn.dataset.gpLa2ProtocolBound === "1") return;

    function getBubble(line){
      return line.querySelector(".bubble,.speech-bubble,.dialog-bubble,.convo-bubble") || line;
    }

    const bubbles = lines
      .map((line) => getBubble(line))
      .filter(Boolean);
    if (!bubbles.length) return;

    const repeatResults = Array.from(doc.querySelectorAll(".repeat-result"));
    const starRows = Array.from(doc.querySelectorAll(".star-row"));
    const conversationStatus = doc.getElementById("conversationStatus");
    const resetBtn = doc.getElementById("clearBtn") || doc.getElementById("traceClearBtn");
    const expectedLines = bubbles.map((bubble) => (bubble.textContent || "").trim()).filter(Boolean);
    const attempts = new Array(expectedLines.length).fill(0);
    const starsAwarded = new Array(expectedLines.length).fill(0);
    const maxAttempts = 3;
    const chime = new Audio("../../../../assets/audio/chimes/chime.mp3.mp3");
    chime.preload = "auto";

    let currentLineIndex = -1;
    let micStepIndex = 0;
    let micPhase = "reveal";
    let micBusy = false;
    let micDone = false;
    let micInitialized = false;

    function setConversationStatus(text){
      if (!conversationStatus) return;
      conversationStatus.textContent = text || "";
    }

    function hideAllLines(){
      lines.forEach((line) => {
        line.classList.remove("show");
        line.hidden = true;
        line.style.display = "none";
        const bubble = getBubble(line);
        if (bubble) bubble.classList.remove("sparkle");
      });
    }

    function showLine(index){
      const line = lines[index];
      if (!line) return;
      line.hidden = false;
      line.classList.add("show");
      line.style.display = line.classList.contains("row") ? "flex" : "block";
    }

    function speakLine(text, onend, options){
      const normalizedText = normalizeSpeechText(text);
      if (!normalizedText || !("speechSynthesis" in global)) {
        if (onend) onend();
        return;
      }
      const opts = options || {};
      speakText(normalizedText, {
        rate: typeof opts.rate === "number" ? opts.rate : 0.8,
        pitch: typeof opts.pitch === "number" ? opts.pitch : 1.5,
        volume: typeof opts.volume === "number" ? opts.volume : 1,
        onEnd: () => { if (onend) onend(); },
        onError: () => { if (onend) onend(); }
      });
    }

    function highlightLine(index, on){
      const bubble = lines[index] && getBubble(lines[index]);
      if (!bubble) return;
      bubble.classList.toggle("sparkle", !!on);
    }

    function setStars(index, count){
      const row = starRows[index];
      if (!row) return;
      row.innerHTML = new Array(count).fill("&#9733;").join("");
    }

    function resetMicConversation(){
      hideAllLines();
      currentLineIndex = -1;
      micStepIndex = 0;
      micPhase = "reveal";
      micBusy = false;
      micDone = false;
      micInitialized = false;
      expectedLines.forEach((_, index) => {
        attempts[index] = 0;
        starsAwarded[index] = 0;
      });
      repeatResults.forEach((el) => {
        if (el) {
          el.textContent = "";
          el.style.color = "";
        }
      });
      starRows.forEach((el) => {
        if (el) el.textContent = "";
      });
      setConversationStatus("");
    }

    function revealBubblesFromMic(){
      micIconBtn.dataset.gpMicSeqBound = "1";
      if (!micInitialized) {
        showLine(0);
        for (let i = 1; i < lines.length; i += 1) {
          lines[i].hidden = true;
          lines[i].classList.remove("show");
          lines[i].style.display = "none";
        }
        micInitialized = true;
      }
      currentLineIndex = micStepIndex;
    }

    function showAndSpeakLine(index){
      if (index < 0 || index >= expectedLines.length) return;
      currentLineIndex = index;
      showLine(index);
      speakLine(expectedLines[index]);
    }

    function finishMicFlow(){
      micDone = true;
      const totalStars = starsAwarded.reduce((sum, value) => sum + value, 0);
      if (totalStars > 0) {
        const remarks = [
          "Wow! You are super smart!",
          "Amazing Job",
          "Great Try! keep it up!!!"
        ];
        const remark = remarks[Math.floor(Math.random() * remarks.length)];
        try {
          chime.currentTime = 0;
          chime.play().catch(() => {});
        } catch (_err) {}
        setConversationStatus(remark);
        speakLine(remark);
      } else {
        setConversationStatus("");
      }
    }

    function moveToNextMicStep(){
      highlightLine(micStepIndex, false);
      micStepIndex += 1;
      micPhase = "reveal";
      micBusy = false;

      if (micStepIndex >= expectedLines.length) {
        finishMicFlow();
        return;
      }

      showAndSpeakLine(micStepIndex);
      setConversationStatus(expectedLines[micStepIndex]);
      micPhase = "repeat";
    }

    async function runMicStepFlow(){
      if (global.GPTracing && typeof global.GPTracing.prepareMicSupport === "function") {
        await global.GPTracing.prepareMicSupport().catch(() => {});
      }
      if (micDone || micBusy) return;
      if (!micInitialized) revealBubblesFromMic();

      if (micPhase === "reveal") {
        showAndSpeakLine(micStepIndex);
        setConversationStatus(expectedLines[micStepIndex]);
        micPhase = "repeat";
        return;
      }

      highlightLine(micStepIndex, true);
      micBusy = true;
      setConversationStatus("Repeat after me.");

      speakLine("Repeat after me.", () => {
        listenForRepeat(expectedLines[micStepIndex], (pct, said) => {
          const tryNo = ++attempts[micStepIndex];

          if (pct >= 50) {
            if (repeatResults[micStepIndex]) {
              repeatResults[micStepIndex].style.color = "#2f9f5f";
              repeatResults[micStepIndex].textContent = (said || expectedLines[micStepIndex]).trim();
            }
            starsAwarded[micStepIndex] = rewardStars(tryNo);
            setStars(micStepIndex, starsAwarded[micStepIndex]);
            global.setTimeout(() => { moveToNextMicStep(); }, 220);
            return;
          }

          if (tryNo >= maxAttempts) {
            if (repeatResults[micStepIndex]) {
              repeatResults[micStepIndex].style.color = "#c62828";
              repeatResults[micStepIndex].textContent = "You did a good Job. Nice try!";
            }
            starsAwarded[micStepIndex] = 0;
            setStars(micStepIndex, 0);
            speakLine("You did a good Job. Nice try!", () => {
              global.setTimeout(() => { moveToNextMicStep(); }, 200);
            });
            return;
          }

          micBusy = false;
          micPhase = "repeat";
          if (repeatResults[micStepIndex]) {
            repeatResults[micStepIndex].style.color = "#c62828";
            repeatResults[micStepIndex].textContent = "Sorry, try again!";
          }
          setConversationStatus("Sorry, try again!");
          speakLine("Sorry, try again!");
        }, {
          timeoutMs: 3000,
          settleMs: 900
        });
      }, {
          rate: 0.92,
          pitch: 1.34,
          volume: 1
        });
    }

    micIconBtn.dataset.gpLa2ProtocolBound = "1";
    hideAllLines();
    micIconBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      runMicStepFlow();
    }, true);
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        resetMicConversation();
      }, true);
    }
  }

  function installLevelBMicProtocol(){
    installUnifiedLessonMicProtocol();
  }

  function installLevelBFixes(){
    const page = getPageInfo();
    suppressLessonIntroVideos();
    installLevelBIntroAutoplayFix();
    installRealtimeTraceProgressSync();
    installUnifiedLessonMicProtocol();
  }

  global.GPTracing = {
    normalizeTranscript,
    normalizeWords,
    percentWordMatch,
    rewardStars,
    applyPreferredVoice,
    installSpeechSynthesisPatch,
    prepareMicSupport,
    playTraceTick,
    playTraceCelebration,
    speakText,
    listenForRepeat,
    fitElementToViewport,
    ensureTraceProgressUI,
    createDigitTraceGroups,
    getDigitTraceGroups,
    createCircleTracePad,
    createPathTracePad,
    stopIntroMedia,
    suppressWeek1IntroVideos,
    suppressLessonIntroVideos,
    installRealtimeTraceProgressSync,
    installLevelBFixes,
    installUnifiedLessonMicProtocol
  };

  installSpeechSynthesisPatch();
  global.__GP_STOP_INTRO_MEDIA = stopIntroMedia;
  if (global.document) {
    if (isWeek1LessonPage()) {
      if (global.__GP_ALLOW_WEEK1_INTRO !== true) {
        if (global.document.readyState === "loading") {
          global.document.addEventListener("DOMContentLoaded", suppressWeek1IntroVideos, { once: true });
        } else {
          suppressWeek1IntroVideos();
        }
      }
    }
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", installLevelBFixes, { once: true });
    } else {
      installLevelBFixes();
    }
  }
})(window);
