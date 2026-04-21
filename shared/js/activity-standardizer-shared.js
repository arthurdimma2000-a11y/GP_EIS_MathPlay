(function () {
  "use strict";

  if (window.__GP_ACTIVITY_STANDARDIZER_SHARED__) return;
  window.__GP_ACTIVITY_STANDARDIZER_SHARED__ = true;
  let savePromise = null;
  let localSpeechPatchInstalled = false;
  let speechCancelStamp = 0;
  const sharedScriptSrc = (document.currentScript && document.currentScript.src) || window.location.href;
  const instructionAudioSrc = new URL("../../assets/audio/chimes/InstructionAudio.mp3", sharedScriptSrc).href;
  let pageInstructionAudio = null;
  let pageInstructionAudioBound = false;
  let pageInstructionAudioStarted = false;
  let pageInstructionAudioFinished = false;
  let mediaPlaybackPatchInstalled = false;

  function isMobileSpeechDevice() {
    try {
      const ua = String((window.navigator && window.navigator.userAgent) || "");
      return /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(ua);
    } catch (_) {}
    return false;
  }

  function getSpeechDelayMs(afterCancel) {
    const minDelay = isMobileSpeechDevice() ? 280 : 180;
    if (!afterCancel) return minDelay;
    return Math.max(minDelay, minDelay - (Date.now() - speechCancelStamp));
  }

  function pickPreferredFemaleVoice(voices) {
    const list = Array.isArray(voices) ? voices : [];
    if (!list.length) return null;
    const femaleName = /(jenny|aria|ava|samantha|sonia|natasha|sara|hazel|female|zira|allison|ellie|libby|olivia|serena|emma|karen|moira|veena|jessa|michelle|jane|lisa|nancy|joanna|ivy|ruth|kendra|kimberly|salli|cora|luna|nova|stella|grace|amy)/i;
    const childFriendlyName = /(jenny|aria|ava|allison|ellie|libby|olivia|serena|emma|ivy|nova|stella|grace|kids?|child|junior|young)/i;
    const maleName = /(davis|david|guy|man|male|boy|john|matthew|matt|michael|james|daniel|george|thomas|alex|arthur|fred|richard|jason|ryan|andrew|mark|paul|brian|steve|kevin|eric|christopher|roger)/i;
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
      null
    );
  }

  function installSpeechVoicePreference() {
    if (window.GPTracing && typeof window.GPTracing.installSpeechSynthesisPatch === "function") {
      try {
        window.GPTracing.installSpeechSynthesisPatch();
        return;
      } catch (_) {}
    }
    if (localSpeechPatchInstalled || !("speechSynthesis" in window)) return;
    localSpeechPatchInstalled = true;
    try {
      const synth = window.speechSynthesis;
      if (typeof synth.getVoices === "function") synth.getVoices();
      const originalSpeak = synth.speak.bind(synth);
      synth.speak = function patchedSpeak(utterance) {
        try {
          if (utterance) {
            const preferred = pickPreferredFemaleVoice(
              typeof synth.getVoices === "function" ? synth.getVoices() : []
            );
            if (preferred) {
              utterance.voice = preferred;
            } else {
              utterance.voice = null;
            }
            utterance.lang = "en-US";
            if (typeof utterance.rate !== "number" || utterance.rate > 0.94 || utterance.rate < 0.86) utterance.rate = 0.9;
            if (typeof utterance.pitch !== "number" || utterance.pitch > 1.28 || utterance.pitch <= 1.08) utterance.pitch = 1.18;
            utterance.volume = 1;
          }
        } catch (_) {}
        const speakNow = function () {
          try {
            if (typeof synth.resume === "function") synth.resume();
            return originalSpeak(utterance);
          } catch (_) {
            return undefined;
          }
        };
        const delay = getSpeechDelayMs(true);
        if (delay > 0) {
          window.setTimeout(speakNow, delay);
          return;
        }
        return speakNow();
      };
      const originalCancel = typeof synth.cancel === "function" ? synth.cancel.bind(synth) : null;
      if (originalCancel) {
        synth.cancel = function patchedCancel() {
          speechCancelStamp = Date.now();
          return originalCancel();
        };
      }
      if ("onvoiceschanged" in synth) {
        const previous = synth.onvoiceschanged;
        synth.onvoiceschanged = function patchedVoicesChanged(event) {
          try { synth.getVoices(); } catch (_) {}
          if (typeof previous === "function") previous.call(this, event);
        };
      }
    } catch (_) {}
  }

  function stopIntroMedia() {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}
    document.querySelectorAll("video, audio").forEach((media) => {
      try {
        const el = media;
        const isIntro = el.id === "introVideo" || !!el.closest("#introVideoWrap, .intro-video-wrap, #lbIntroVideoOverlay, #gpAutoIntroOverlay");
        if (!isIntro) return;
        el.pause();
        el.muted = true;
        el.volume = 0;
        try { el.currentTime = 0; } catch (_) {}
      } catch (_) {}
    });
  }

  window.__GP_STOP_INTRO_MEDIA = stopIntroMedia;

  function hasPageManagedInstructionAudio() {
    if (document.querySelector("#instructionAudio, audio[src*='InstructionAudio.mp3' i], source[src*='InstructionAudio.mp3' i]")) {
      return true;
    }
    return Array.from(document.scripts || []).some((script) => {
      const src = String((script && script.getAttribute && script.getAttribute("src")) || "");
      if (/activity-standardizer(?:-shared)?\.js/i.test(src)) return false;
      const text = String((script && script.textContent) || "");
      return /InstructionAudio\.mp3|playInstructionBed|instructionAudio\s*=/.test(text);
    });
  }

  function stopPageInstructionAudio() {
    if (!pageInstructionAudio) return;
    try { pageInstructionAudio.pause(); } catch (_) {}
    try { pageInstructionAudio.currentTime = 0; } catch (_) {}
  }

  function installMediaPlaybackPatch() {
    if (mediaPlaybackPatchInstalled || typeof HTMLMediaElement === "undefined") return;
    mediaPlaybackPatchInstalled = true;
    try {
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function patchedPlay() {
        try {
          const media = this;
          const src = String(media.currentSrc || media.src || "");
          const tag = String(media.tagName || "").toUpperCase();
          const isInstructionAudio = tag === "AUDIO" && /InstructionAudio\.mp3/i.test(src);
          const isVideo = tag === "VIDEO";
          const isRecordingPlayback = /recordingPlayback/i.test(String(media.id || ""));

          if (isInstructionAudio) {
            media.muted = false;
            media.volume = 1;
            if (media.dataset && media.dataset.gpInstructionRepeatBound !== "1") {
              media.dataset.gpInstructionRepeatBound = "1";
              media.dataset.gpInstructionRepeatCount = "0";
              media.addEventListener("ended", function repeatInstructionOnce() {
                const count = Number(media.dataset.gpInstructionRepeatCount || "0");
                if (count >= 1) return;
                media.dataset.gpInstructionRepeatCount = String(count + 1);
                window.setTimeout(() => {
                  try {
                    media.currentTime = 0;
                    media.muted = false;
                    media.volume = 1;
                    const replay = originalPlay.call(media);
                    if (replay && typeof replay.catch === "function") replay.catch(() => {});
                  } catch (_) {}
                }, 420);
              });
            }
          } else if (isVideo && !isRecordingPlayback) {
            media.volume = Math.min(Number.isFinite(media.volume) ? media.volume : 1, 0.3);
          }
        } catch (_) {}
        return originalPlay.apply(this, arguments);
      };
    } catch (_) {}
  }

  function shouldAutoPlayPageInstructionAudio() {
    if (!isLevelLessonPage()) return false;
    if (window.__GP_AUTO_PAGE_INSTRUCTION_AUDIO__ === false) return false;
    if (hasPageManagedInstructionAudio()) return false;
    const pageFile = ((location.pathname || "").split("/").pop() || "").replace(/\.html$/i, "");
    if (/quiz|game|revision|finalquiz/i.test(pageFile)) {
      const introCandidates = [];
      collectExistingIntroSources().forEach((src) => pushUniqueCandidate(introCandidates, src));
      getAutoIntroCandidates(pageFile).forEach((src) => pushUniqueCandidate(introCandidates, src));
      if (introCandidates.length) return false;
    }
    return true;
  }

  function initPageInstructionAudio() {
    if (pageInstructionAudioBound) return;
    if (!shouldAutoPlayPageInstructionAudio()) return;
    pageInstructionAudioBound = true;
    pageInstructionAudio = new Audio(instructionAudioSrc);
    pageInstructionAudio.preload = "auto";
    pageInstructionAudio.volume = 0.28;

    const markFinished = function () {
      pageInstructionAudioFinished = true;
    };
    pageInstructionAudio.addEventListener("error", markFinished, { once: true });
    pageInstructionAudio.addEventListener("ended", function () {
      const replayCount = Number(pageInstructionAudio.dataset.gpInstructionRepeatCount || "0");
      if (replayCount >= 1) {
        markFinished();
        return;
      }
      pageInstructionAudio.dataset.gpInstructionRepeatCount = String(replayCount + 1);
      window.setTimeout(() => {
        try {
          pageInstructionAudio.currentTime = 0;
            pageInstructionAudio.volume = 0.28;
          const replay = pageInstructionAudio.play();
          if (replay && typeof replay.catch === "function") {
            replay.catch(() => {
              markFinished();
            });
          }
        } catch (_) {
          markFinished();
        }
      }, 420);
    });

    function tryPlayInstructionAudio() {
      if (!pageInstructionAudio || pageInstructionAudioFinished || pageInstructionAudioStarted) return;
      try { pageInstructionAudio.currentTime = 0; } catch (_) {}
        pageInstructionAudio.volume = 0.28;
      const playAttempt = pageInstructionAudio.play();
      if (playAttempt && typeof playAttempt.then === "function") {
        playAttempt.then(function () {
          pageInstructionAudioStarted = true;
        }).catch(function () {});
      } else {
        pageInstructionAudioStarted = true;
      }
    }

    tryPlayInstructionAudio();
    window.addEventListener("load", tryPlayInstructionAudio, { once: true });
    ["pointerdown", "touchstart", "click", "keydown"].forEach(function (eventName) {
      document.addEventListener(eventName, tryPlayInstructionAudio, {
        once: true,
        capture: true,
        passive: eventName !== "keydown"
      });
    });
  }

  function suppressWeek2LessonIntroVideos() {
    if (!isLevelLessonPage()) return;
    if (inferWeekFromPage() !== 2) return;

    stopIntroMedia();

    const html = document.documentElement;
    const body = document.body;
    if (html) html.classList.remove("lesson-intro-video-pending");
    if (body) body.classList.remove("intro-active");

    [
      "#gpAutoIntroOverlay",
      "#introVideoWrap",
      ".intro-video-wrap",
      "#lbIntroVideoOverlay",
      "#gpIntroVideoOverlay"
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        try { node.classList.remove("active"); } catch (_) {}
        try { node.style.display = "none"; } catch (_) {}
        try { node.style.visibility = "hidden"; } catch (_) {}
        try { node.style.opacity = "0"; } catch (_) {}
        try { node.style.pointerEvents = "none"; } catch (_) {}
        try { node.remove(); } catch (_) {}
      });
    });
  }

  function looksLikeTrackedNav(el) {
    const label = [
      el.id || "",
      el.className || "",
      el.getAttribute("name") || "",
      el.getAttribute("data-action") || "",
      el.getAttribute("data-nav") || "",
      el.getAttribute("aria-label") || "",
      el.getAttribute("title") || "",
      el.getAttribute("value") || "",
      el.textContent || ""
    ].join(" ").toLowerCase();
    return /prev|previous|next|home|finish|submit|complete|quiz complete|game complete|done|continue|back/.test(label);
  }

  function inferActivityType(pageId) {
    const name = String(pageId || "").toLowerCase();
    if (name.includes("quiz")) return "quiz";
    if (name.includes("game")) return "game";
    if (name.includes("revision")) return "revision";
    if (name.includes("trace")) return "tracing";
    return "lesson";
  }

  function saveBeforeNavigation() {
    if (typeof window.finishActivity !== "function") return;
    if (savePromise) return savePromise;
    const pageFile = ((location.pathname || "").split("/").pop() || document.title || "Activity").replace(/\.html$/i, "");
    const level = /^(LA|LevelA|Level_A)/i.test(pageFile)
      ? "A"
      : /^(LB|LevelB|Level_B)/i.test(pageFile)
        ? "B"
        : /^(LC|LevelC|Level_C)/i.test(pageFile)
          ? "C"
          : null;
    const payload = {
      pageId: pageFile,
      level,
      activityType: inferActivityType(pageFile)
    };
    const saveTask = Promise.resolve().then(() => window.finishActivity(payload)).catch(() => {});
    const failOpenTimeout = new Promise((resolve) => {
      window.setTimeout(resolve, 120);
    });
    savePromise = Promise.race([saveTask, failOpenTimeout]).finally(() => {
      savePromise = null;
    });
    return savePromise;
  }

  function getTrackedTarget(target) {
    if (!(target instanceof Element)) return null;
    const hit = target.closest("a, button, [role='button'], input[type='button'], input[type='submit']");
    if (!hit || !looksLikeTrackedNav(hit)) return null;
    return hit;
  }

  function getMicTarget(target) {
    if (!(target instanceof Element)) return null;
    return target.closest("#micIconBtn, #micBtn, .mic-icon-btn, .mic-btn, [data-mic], [aria-label*='Repeat conversation' i], [aria-label*='Repeat instruction' i], [aria-label*='Repeat after me' i], [aria-label*='speaking activity' i], [aria-label*='microphone' i]");
  }

  function prepareMicSupport() {
    installSpeechVoicePreference();
    try {
      if (window.GPTracing && typeof window.GPTracing.prepareMicSupport === "function") {
        window.GPTracing.prepareMicSupport();
        return;
      }
    } catch (_) {}
    try {
      if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
      ) {
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }).then((stream) => {
          try { stream.getTracks().forEach((track) => track.stop()); } catch (_) {}
        }).catch(() => {});
      }
    } catch (_) {}
  }

  function inferLevelFromPage(pageFile) {
    const path = String(location.pathname || "").replace(/\\/g, "/");
    if (/\/levels\/level-a\//i.test(path)) return "A";
    if (/\/levels\/level-b\//i.test(path)) return "B";
    if (/\/levels\/level-c\//i.test(path)) return "C";

    const file = String(pageFile || "");
    if (/^(LA|LevelA|Level_A)/i.test(file)) return "A";
    if (/^(LB|LevelB|Level_B)/i.test(file)) return "B";
    if (/^(LC|LevelC|Level_C)/i.test(file)) return "C";
    return "";
  }

  function isLevelLessonPage() {
    return /[\\\/]levels[\\\/]level-(a|b|c)[\\\/]/i.test((location.pathname || "") + " " + (location.href || ""));
  }

  function inferWeekFromPage() {
    const match = String(location.pathname || "").replace(/\\/g, "/").match(/\/week-(\d+)\//i);
    return match ? Number(match[1]) : 0;
  }

  function buildExpectedLessonChain(level) {
    const CHAINS = {
      A: [
        "week-1/monday/CircleArtClass.html",
        "week-1/tuesday/LA2.html",
        "week-1/wednesday/LA3.html",
        "week-1/wednesday/LA7.html",
        "week-1/thursday/CircleFairlyTale.html",
        "week-1/friday/LA_Game1.html",
        "week-1/friday/LA_Quiz1.html",
        "week-2/monday/GymClassWk2A.html",
        "week-2/tuesday/LA8.html",
        "week-2/wednesday/LA9.html",
        "week-2/wednesday/LA13.html",
        "week-2/thursday/FairlyTaleWk2A.html",
        "week-2/friday/LA_Game2.html",
        "week-2/friday/LA_Quiz2.html",
        "week-3/tuesday/LA14.html",
        "week-3/tuesday/LA15.html",
        "week-3/wednesday/LA16.html",
        "week-3/wednesday/LA17.html",
        "week-3/tuesday/LA18.html",
        "week-3/tuesday/LA19.html",
        "week-3/friday/LA_Revision3.html",
        "week-3/friday/LA_Game3.html",
        "week-3/friday/LA_Quiz3.html",
        "week-4/tuesday/LA20.html",
        "week-4/tuesday/LA21.html",
        "week-4/wednesday/LA22.html",
        "week-4/wednesday/LA23.html",
        "week-4/tuesday/LA24.html",
        "week-4/tuesday/LA25.html",
        "week-4/friday/LA_Revision4.html",
        "week-4/friday/LA_Game4.html",
        "week-4/friday/LA_FinalQuiz.html"
      ],
      B: [
        "week-1/monday/PentagonArtClass.html",
        "week-1/tuesday/LB2.html",
        "week-1/wednesday/LB3.html",
        "week-1/wednesday/LB7.html",
        "week-1/thursday/PentagonFairlyTale.html",
        "week-1/friday/LB_Game1.html",
        "week-1/friday/LB_Quiz1.html",
        "week-2/monday/GymClassWk2C.html",
        "week-2/tuesday/LB8.html",
        "week-2/wednesday/LB9.html",
        "week-2/wednesday/LB13.html",
        "week-2/thursday/FairlyTaleWk2C.html",
        "week-2/friday/LB_Game2.html",
        "week-2/friday/LB_Quiz2.html",
        "week-3/tuesday/LB14.html",
        "week-3/tuesday/LB15.html",
        "week-3/wednesday/LB16.html",
        "week-3/wednesday/LB17.html",
        "week-3/tuesday/LB18.html",
        "week-3/tuesday/LB19.html",
        "week-3/friday/LB_Revision3.html",
        "week-3/friday/LB_Game3.html",
        "week-3/friday/LB_Quiz3.html",
        "week-4/tuesday/LB20.html",
        "week-4/tuesday/LB21.html",
        "week-4/wednesday/LB22.html",
        "week-4/wednesday/LB23.html",
        "week-4/tuesday/LB24.html",
        "week-4/tuesday/LB25.html",
        "week-4/friday/LB_Revision4.html",
        "week-4/friday/LA_Quiz4.html",
        "week-4/friday/LB_FinalQuiz.html"
      ],
      C: [
        "week-1/monday/TangramArtClass.html",
        "week-1/tuesday/LevelC2.html",
        "week-1/wednesday/LevelC3.html",
        "week-1/wednesday/LevelC7.html",
        "week-1/thursday/TangramHorseFairlyTale.html",
        "week-1/friday/LevelC_Game1.html",
        "week-1/friday/LevelC_Quiz1.html",
        "week-2/monday/GymClassWk2C",
        "week-2/tuesday/LevelC8.html",
        "week-2/wednesday/LevelC9.html",
        "week-2/wednesday/LevelC13.html",
        "week-2/thursday/FairlyTaleWk2C.html",
        "week-2/friday/LevelC_Game2.html",
        "week-2/friday/LevelC_Quiz2.html",
        "week-3/tuesday/LevelC14.html",
        "week-3/tuesday/LevelC15.html",
        "week-3/wednesday/LevelC16.html",
        "week-3/wednesday/LevelC17.html",
        "week-3/tuesday/LevelC18.html",
        "week-3/tuesday/LevelC19.html",
        "week-3/friday/LevelC_Revision3.html",
        "week-3/friday/LevelC_Game3.html",
        "week-3/friday/LevelC_Quiz3.html",
        "week-4/tuesday/LevelC20.html",
        "week-4/tuesday/LevelC21.html",
        "week-4/wednesday/LevelC22.html",
        "week-4/wednesday/LevelC23.html",
        "week-4/tuesday/LevelC24.html",
        "week-4/tuesday/LevelC25.html",
        "week-4/friday/LevelC_Revision4.html",
        "week-4/friday/LevelC_Game4.html",
        "week-4/friday/LevelC_Quiz4.html"
      ]
    };
    return (CHAINS[level] || []).slice();
  }

  function toPosixRelative(from, to) {
    return pathPosix.relative(pathPosix.dirname(from), to) || pathPosix.basename(to);
  }

  const pathPosix = {
    normalize(value) {
      return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/");
    },
    dirname(value) {
      const normalized = this.normalize(value).replace(/\/$/, "");
      const idx = normalized.lastIndexOf("/");
      return idx === -1 ? "" : normalized.slice(0, idx);
    },
    basename(value) {
      const normalized = this.normalize(value).replace(/\/$/, "");
      const idx = normalized.lastIndexOf("/");
      return idx === -1 ? normalized : normalized.slice(idx + 1);
    },
    relative(from, to) {
      const fromParts = this.dirname(from).split("/").filter(Boolean);
      const toParts = this.normalize(to).split("/").filter(Boolean);
      while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
        fromParts.shift();
        toParts.shift();
      }
      return new Array(fromParts.length).fill("..").concat(toParts).join("/") || ".";
    }
  };

  function getLessonAppRelative(target) {
    const normalizedTarget = String(target || "").replace(/^\/+/, "");
    if (!normalizedTarget) return "";
    if (!isLevelLessonPage()) return normalizedTarget;
    return "../../../../" + normalizedTarget;
  }

  function getLessonAppAbsolute(target) {
    const normalizedTarget = String(target || "").replace(/^\/+/, "");
    if (!normalizedTarget) return "";
    try {
      const currentHref = String(window.location.href || "");
      if (/^file:/i.test(currentHref)) {
        const normalizedHref = currentHref.replace(/\\/g, "/");
        const levelMarker = "/levels/level-";
        const levelIndex = normalizedHref.indexOf(levelMarker);
        if (levelIndex >= 0) {
          const appRoot = normalizedHref.slice(0, levelIndex + 1);
          return new URL(normalizedTarget, appRoot).href;
        }
        const fileName = (window.location.pathname || "").split("/").pop() || "";
        const pageBase = normalizedHref.slice(0, normalizedHref.length - fileName.length);
        return new URL(normalizedTarget, pageBase).href;
      }
      return new URL("/" + normalizedTarget, window.location.origin).href;
    } catch (_) {
      return "/" + normalizedTarget;
    }
  }

  function getExpectedLessonTargets() {
    if (!isLevelLessonPage()) return null;
    const level = inferLevelFromPage();
    if (!level) return null;
    const normalizedPath = String(location.pathname || "").replace(/\\/g, "/");
    const levelRoot = "/levels/level-" + level.toLowerCase() + "/";
    const current = normalizedPath.split(levelRoot)[1];
    if (!current) return null;
    const chain = buildExpectedLessonChain(level);
    const index = chain.indexOf(current);
    if (index === -1) return null;
    const levelPrefix = "levels/level-" + level.toLowerCase() + "/";
    return {
      prev: index === 0
        ? getLessonAppAbsolute("index.html")
        : getLessonAppAbsolute(levelPrefix + chain[index - 1]),
      home: getLessonAppAbsolute("index.html"),
      next: index === chain.length - 1
        ? getLessonAppAbsolute("ProgressReport.html")
        : getLessonAppAbsolute(levelPrefix + chain[index + 1])
    };
  }

  function detectNavKind(hit) {
    if (!(hit instanceof Element)) return "";
    const label = [
      hit.id || "",
      hit.className || "",
      hit.getAttribute("aria-label") || "",
      hit.getAttribute("title") || "",
      hit.textContent || ""
    ].join(" ").toLowerCase();
    if (/prev|previous|back/.test(label)) return "prev";
    if (/next|continue|finish|done|complete/.test(label)) return "next";
    if (/home|menu|dashboard/.test(label)) return "home";
    return "";
  }

    function initExpectedLessonNavigation() {
      const targets = getExpectedLessonTargets();
      if (!targets) return;

    const navElements = Array.from(document.querySelectorAll(
      "#prevBtn,#nextBtn,#backBtn,a[href],button,[role='button'],input[type='button'],input[type='submit']"
    )).filter((el) => detectNavKind(el));

    async function navigateToTarget(target, ev) {
      if (!target) return;
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      }
      try {
        await saveBeforeNavigation();
      } catch (_) {}
      window.location.href = target;
    }

      function hardBindNavElements() {
        const currentNavElements = Array.from(document.querySelectorAll(
          "#prevBtn,#nextBtn,#backBtn,a[href],button,[role='button'],input[type='button'],input[type='submit']"
        )).filter((el) => detectNavKind(el));

        currentNavElements.forEach((el) => {
          const kind = detectNavKind(el);
          const target = kind === "prev" ? targets.prev : kind === "home" ? targets.home : targets.next;
          if (!target || !el.parentNode) return;
          el.dataset.gpExpectedNav = target;
          el.dataset.gpNavHardened = "1";
          if ("disabled" in el) el.disabled = false;
          if (el.tagName === "A") {
            el.setAttribute("href", target);
          }
          if (el.tagName === "BUTTON" && !el.getAttribute("type")) {
            el.setAttribute("type", "button");
          }
          if (el.hasAttribute("onclick")) {
            el.removeAttribute("onclick");
          }
        });
      }

    navElements.forEach((el) => {
      const kind = detectNavKind(el);
      const target = kind === "prev" ? targets.prev : kind === "home" ? targets.home : targets.next;
      if (!target) return;
      el.dataset.gpExpectedNav = target;
      if ("disabled" in el) el.disabled = false;
      if (el.tagName === "A") {
        el.setAttribute("href", target);
      }
    });

    document.addEventListener("click", async (ev) => {
      const hit = getTrackedTarget(ev.target);
      if (!hit) return;
      const kind = detectNavKind(hit);
      if (!kind) return;
      const target = hit.dataset.gpExpectedNav || (kind === "prev" ? targets.prev : kind === "home" ? targets.home : targets.next);
      await navigateToTarget(target, ev);
    }, { capture: true });

    hardBindNavElements();
    window.setTimeout(hardBindNavElements, 0);
    window.setTimeout(hardBindNavElements, 250);
    window.setTimeout(hardBindNavElements, 1000);
    window.addEventListener("load", hardBindNavElements, { once: true });
    if (window.MutationObserver && document.body) {
      const navObserver = new MutationObserver(() => {
        hardBindNavElements();
      });
      navObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  function getAutoIntroFileName(level, lessonNumber) {
    const num = Number(lessonNumber);
    if (!Number.isFinite(num) || num < 2 || num > 25) return "";

    if (level === "A") {
      return "LA" + num + "avideo.mp4";
    }

    if (level === "B") {
      if (num === 3) return "LB3bVideo.mp4";
      if (num === 6) return "LB6bVideo.mp4";
      if (num === 16) return "LB16b_video.mp4";
      return "LB" + num + "bvideo.mp4";
    }

    if (level === "C") {
      return "LC" + num + "cvideo.mp4";
    }

    return "";
  }

  function pushUniqueCandidate(list, src) {
    const value = String(src || "").trim();
    if (!value) return;
    const key = value.replace(/\\/g, "/").toLowerCase();
    if (list.some((entry) => entry.key === key)) return;
    list.push({ key, src: value });
  }

  function collectExistingIntroSources() {
    const candidates = [];
    const selectors = [
      "#introVideo[src]",
      ".intro-video[src]",
      "#introVideo source[src]",
      ".intro-video source[src]"
    ];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const src = node.getAttribute("src") || "";
        pushUniqueCandidate(candidates, src);
      });
    });
    return candidates.map((entry) => entry.src);
  }

  function getAutoIntroCandidates(pageFile) {
    const file = String(pageFile || "");
    const candidates = [];
    const level = inferLevelFromPage(file);

    const numericMatch =
      /^LA(\d{1,2})$/i.exec(file) ||
      /^LB(\d{1,2})$/i.exec(file) ||
      /^LevelC(\d{1,2})$/i.exec(file);

    if (numericMatch && level) {
      const fileName = getAutoIntroFileName(level, numericMatch[1]);
      if (fileName) pushUniqueCandidate(candidates, "../../../../assets/video/" + fileName);
    }

    if (!numericMatch && level && /revision|game|quiz|finalquiz/i.test(file)) {
      const week = inferWeekFromPage();
      const trailingLesson = week > 0 ? Math.min(25, (week * 6) + 1) : 0;
      const fileName = getAutoIntroFileName(level, trailingLesson);
      if (fileName) pushUniqueCandidate(candidates, "../../../../assets/video/" + fileName);
    }

    return candidates.map((entry) => entry.src);
  }

  function ensureAutoIntroStyles() {
      if (document.getElementById("gpAutoIntroStyles")) return;
      const style = document.createElement("style");
      style.id = "gpAutoIntroStyles";
      style.textContent =
        "html.lesson-intro-video-pending body > *:not(#gpAutoIntroOverlay):not(#introVideoWrap){visibility:hidden !important;}" +
        "#gpAutoIntroOverlay,.intro-video-wrap{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#000;z-index:2147483647;padding:0;margin:0;overflow:hidden;}" +
        "#gpAutoIntroOverlay.active,.intro-video-wrap.active,#introVideoWrap.active,#lbIntroVideoOverlay.active{display:flex !important;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;}" +
        "#gpAutoIntroOverlay video,.intro-video-wrap video{width:100vw;height:100vh;max-width:100vw;max-height:100vh;object-fit:contain;object-position:center center;border-radius:0;background:#000;box-shadow:none;display:block;}";
      document.head.appendChild(style);
    }

  function ensureUnifiedMicLessonStyles() {
    if (document.getElementById("gpUnifiedMicLessonStyles")) return;
    const style = document.createElement("style");
    style.id = "gpUnifiedMicLessonStyles";
    style.textContent =
      ".convo-line[hidden],.speech-line[hidden],.dialog-line[hidden],.bubble-line[hidden],.bubble-left[hidden],.bubble-right[hidden],#bubbleLeft[hidden],#bubbleRight[hidden],.headline-line[hidden],.sentence-line[hidden],.bubble[hidden],.speech-bubble[hidden],.dialog-bubble[hidden],.convo-bubble[hidden],.character-bubble[hidden],.fish-bubble[hidden]{display:none !important;}" +
      ".row.convo-line.show,.row.speech-line.show,.row.dialog-line.show,.row.bubble-line.show{display:flex !important;align-items:center !important;gap:12px !important;}" +
      ".convo-line.show:not(.row),.speech-line.show:not(.row),.dialog-line.show:not(.row),.bubble-line.show:not(.row),.bubble-left.show,.bubble-right.show,#bubbleLeft.show,#bubbleRight.show,.headline-line.show,.sentence-line.show,.bubble.show,.speech-bubble.show,.dialog-bubble.show,.convo-bubble.show,.character-bubble.show,.fish-bubble.show{display:block !important;}" +
      ".bubble,.speech-bubble,.dialog-bubble,.convo-bubble,.bubble-left,.bubble-right,#bubbleLeft,#bubbleRight,.headline-line,.sentence-line{font-size:clamp(18px,2.5vw,28px) !important;line-height:1.28 !important;max-width:min(70vw,620px) !important;white-space:normal !important;word-break:normal !important;overflow-wrap:anywhere !important;}" +
      ".bubble *,.speech-bubble *,.dialog-bubble *,.convo-bubble *,.bubble-left *,.bubble-right *,#bubbleLeft *,#bubbleRight *,.headline-line *,.sentence-line *{font-size:inherit !important;line-height:inherit !important;}" +
        ".row .bubble,.row .speech-bubble,.row .dialog-bubble,.row .convo-bubble,.row .bubble-left,.row .bubble-right,.row #bubbleLeft,.row #bubbleRight,.row .headline-line,.row .sentence-line{margin-left:8px !important;margin-right:8px !important;}" +
        ".convo-line .bubble-stack,.speech-line .bubble-stack,.dialog-line .bubble-stack,.bubble-line .bubble-stack{display:flex !important;flex-direction:column !important;gap:6px !important;}" +
        ".bubble.mic-highlight,.speech-bubble.mic-highlight,.dialog-bubble.mic-highlight,.convo-bubble.mic-highlight,.bubble-left.mic-highlight,.bubble-right.mic-highlight,#bubbleLeft.mic-highlight,#bubbleRight.mic-highlight,.headline-line.mic-highlight,.sentence-line.mic-highlight,.bubble.sparkle,.speech-bubble.sparkle,.dialog-bubble.sparkle,.convo-bubble.sparkle,.bubble-left.sparkle,.bubble-right.sparkle,#bubbleLeft.sparkle,#bubbleRight.sparkle,.headline-line.sparkle,.sentence-line.sparkle{background:linear-gradient(120deg,#fff2a8,#ffd1f0,#c7f1ff) !important;box-shadow:0 0 12px rgba(255,214,0,.6),0 0 18px rgba(255,105,180,.4) !important;animation:gpMicSparklePulse 1.2s ease-in-out infinite !important;}" +
        "@keyframes gpMicSparklePulse{0%,100%{filter:brightness(1);}50%{filter:brightness(1.12);}}" +
        ".star-row,.stars,.bubble-stars,[data-stars]{font-size:2.35rem !important;line-height:1 !important;}" +
        ".repeat-result,.bubble-result,[data-repeat-result]{font-size:2.1rem !important;line-height:1.1 !important;}" +
        ".girl-sentence,#girlSentence,.big-note,.belly-note,.prompt-line,.headline-line{font-size:clamp(28px,5vw,56px) !important;line-height:1.15 !important;font-weight:900 !important;text-align:center !important;}" +
        ".girl-sentence,#girlSentence{width:min(92%,900px) !important;margin:12px auto 0 !important;min-height:2.4em !important;transform:none !important;display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;}" +
        "body[data-gp-unified-mic-protocol='1'] #posterArea,body[data-gp-unified-mic-protocol='1'] .poster-area,body[data-gp-unified-mic-protocol='1'] .board.bubbles-below{display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:flex-start !important;gap:14px !important;}" +
        "body[data-gp-unified-mic-protocol='1'] .convo-line,body[data-gp-unified-mic-protocol='1'] .speech-line,body[data-gp-unified-mic-protocol='1'] .dialog-line,body[data-gp-unified-mic-protocol='1'] .bubble-line{position:relative !important;inset:auto !important;left:auto !important;right:auto !important;top:auto !important;bottom:auto !important;transform:none !important;overflow:visible !important;width:min(92%,920px) !important;max-width:920px !important;margin:0 auto !important;justify-content:center !important;}" +
        "body[data-gp-unified-mic-protocol='1'] .row.right.convo-line,body[data-gp-unified-mic-protocol='1'] .row.right.speech-line,body[data-gp-unified-mic-protocol='1'] .row.right.dialog-line,body[data-gp-unified-mic-protocol='1'] .row.right.bubble-line{justify-content:center !important;}" +
        "body[data-gp-unified-mic-protocol='1'] .convo-line .bubble-stack,body[data-gp-unified-mic-protocol='1'] .speech-line .bubble-stack,body[data-gp-unified-mic-protocol='1'] .dialog-line .bubble-stack,body[data-gp-unified-mic-protocol='1'] .bubble-line .bubble-stack{position:static !important;transform:none !important;align-items:center !important;width:100% !important;}" +
        "body[data-gp-unified-mic-protocol='1'] .bubble,body[data-gp-unified-mic-protocol='1'] .speech-bubble,body[data-gp-unified-mic-protocol='1'] .dialog-bubble,body[data-gp-unified-mic-protocol='1'] .convo-bubble,body[data-gp-unified-mic-protocol='1'] .bubble-left,body[data-gp-unified-mic-protocol='1'] .bubble-right,body[data-gp-unified-mic-protocol='1'] #bubbleLeft,body[data-gp-unified-mic-protocol='1'] #bubbleRight,body[data-gp-unified-mic-protocol='1'] .headline-line,body[data-gp-unified-mic-protocol='1'] .sentence-line{text-align:center !important;max-width:min(92vw,760px) !important;}" +
        "@media (max-width:780px){.bubble,.speech-bubble,.dialog-bubble,.convo-bubble,.bubble-left,.bubble-right,#bubbleLeft,#bubbleRight,.headline-line,.sentence-line{font-size:clamp(17px,4.8vw,24px) !important;max-width:min(84vw,420px) !important;line-height:1.22 !important;white-space:normal !important;word-break:normal !important;overflow-wrap:anywhere !important;}.girl-sentence,#girlSentence,.big-note,.belly-note,.prompt-line,.headline-line{font-size:clamp(22px,6vw,40px) !important;}}";
    document.head.appendChild(style);
  }

  function ensureLevelBLegacyHelperStyles() {
    if (document.getElementById("gpLevelBLegacyHelperStyles")) return;
    const style = document.createElement("style");
    style.id = "gpLevelBLegacyHelperStyles";
    style.textContent =
      "body[data-gp-level-b-no-girl='1'] .girl-spot," +
      "body[data-gp-level-b-no-girl='1'] .girl-hint," +
      "body[data-gp-level-b-no-girl='1'] .tap-girl," +
      "body[data-gp-level-b-no-girl='1'] #girlBtn{" +
      "display:none !important;visibility:hidden !important;pointer-events:none !important;opacity:0 !important;}" +
      "body[data-gp-level-b-no-girl='1'] [data-gp-hide-tap-girl='1']{" +
      "display:none !important;visibility:hidden !important;pointer-events:none !important;opacity:0 !important;}";
    document.head.appendChild(style);
  }

  function suppressLegacyLevelBGirlHelper() {
    if (!isLevelLessonPage() || inferLevelFromPage() !== "B" || !document.body) return;
    ensureLevelBLegacyHelperStyles();
    document.body.dataset.gpLevelBNoGirl = "1";

    const helperNodes = Array.from(document.querySelectorAll(".girl-spot,.girl-hint,.tap-girl,#girlBtn"));
    helperNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.setAttribute("hidden", "hidden");
      node.setAttribute("aria-hidden", "true");
      node.style.display = "none";
      node.style.visibility = "hidden";
      node.style.pointerEvents = "none";
    });

    Array.from(document.querySelectorAll("p,div,span,strong,em,small")).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const text = String(node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!text) return;
      if (text === "tap the girl" || text === "tap the girl to start the lesson." || text === "tap the girl to hear the lesson. then write inside each empty box:") {
        node.dataset.gpHideTapGirl = "1";
      }
    });
  }

  function getConversationLineNodes() {
    const containerSelectors = [
      ".convo-line",
      ".speech-line",
      ".dialog-line",
      ".bubble-line",
      ".bubble-left",
      ".bubble-right",
      ".headline-line",
      ".sentence-line",
      "#bubbleLeft",
      "#bubbleRight"
    ];
    const bubbleSelectors = [
      ".bubble",
      ".speech-bubble",
      ".dialog-bubble",
      ".convo-bubble",
      ".character-bubble",
      ".fish-bubble"
    ];
    const seen = new Set();
    const nodes = [];
    containerSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (!node || seen.has(node)) return;
        seen.add(node);
        nodes.push(node);
      });
    });
    if (nodes.length) return nodes;
    bubbleSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (!node || seen.has(node)) return;
        if (node.closest(".convo-line,.speech-line,.dialog-line,.bubble-line,.bubble-left,.bubble-right,.headline-line,.sentence-line,#bubbleLeft,#bubbleRight")) return;
        seen.add(node);
        nodes.push(node);
      });
    });
    document.querySelectorAll("[data-line]").forEach((node) => {
      if (!node || seen.has(node)) return;
      const className = String(node.className || "");
      if (!/(line|bubble|speech|dialog|headline|sentence)/i.test(className)) return;
      if (/(repeat-result|star-row|stars|bubble-result)/i.test(className)) return;
      seen.add(node);
      nodes.push(node);
    });
    return nodes;
  }

  function hideConversationLine(line) {
    if (!line) return;
    line.classList.remove("show");
    line.hidden = true;
    line.setAttribute("aria-hidden", "true");
  }

  function revealConversationLine(line) {
    if (!line) return;
    line.hidden = false;
    line.removeAttribute("aria-hidden");
    line.classList.add("show");
  }

  function isConversationLineVisible(line) {
    if (!line) return false;
    if (line.classList.contains("show")) return true;
    if (line.hidden) return false;
    return !!(line.offsetParent || line.getClientRects().length);
  }

  function getConversationBubble(line) {
    if (!line) return null;
    if (line.matches(".bubble,.speech-bubble,.dialog-bubble,.convo-bubble,.bubble-left,.bubble-right,#bubbleLeft,#bubbleRight,.headline-line,.sentence-line")) return line;
    return line.querySelector(".bubble,.speech-bubble,.dialog-bubble,.convo-bubble,.bubble-left,.bubble-right,#bubbleLeft,#bubbleRight,.headline-line,.sentence-line");
  }

  function getConversationBubbleText(line) {
    const bubble = getConversationBubble(line);
    return bubble ? String(bubble.textContent || "").replace(/\s+/g, " ").trim() : "";
  }

  function ensureFallbackMicOutputs(lines) {
    const repeatOutputs = [];
    const starOutputs = [];

    lines.forEach((line, index) => {
      const bubble = getConversationBubble(line);
      const host = bubble && bubble.parentElement ? bubble.parentElement : line;
      if (!host) {
        repeatOutputs[index] = null;
        starOutputs[index] = null;
        return;
      }

      let repeatEl =
        host.querySelector(":scope > .repeat-result, :scope > .repeat-text, :scope > [data-repeat-result]") ||
        line.querySelector(".repeat-result, .repeat-text, [data-repeat-result]");
      if (!repeatEl) {
        repeatEl = document.createElement("div");
        repeatEl.className = "repeat-result gp-auto-repeat-result";
        repeatEl.setAttribute("data-gp-auto-repeat", String(index));
        host.appendChild(repeatEl);
      }

      let starsEl =
        host.querySelector(":scope > .star-row, :scope > .stars, :scope > [data-stars]") ||
        line.querySelector(".star-row, .stars, [data-stars]");
      if (!starsEl) {
        starsEl = document.createElement("div");
        starsEl.className = "star-row gp-auto-star-row";
        starsEl.setAttribute("data-gp-auto-stars", String(index));
        host.appendChild(starsEl);
      }

      repeatOutputs[index] = repeatEl;
      starOutputs[index] = starsEl;
    });

    return { repeatOutputs, starOutputs };
  }

  function speakConversationBubble(line) {
    const text = getConversationBubbleText(line);
    speakMicPrompt(text);
  }

  function speakMicPrompt(text, onDone) {
    const done = typeof onDone === "function" ? onDone : null;
    if (!text || !("speechSynthesis" in window)) {
      if (done) done();
      return;
    }
      try {
        if (window.GPTracing && typeof window.GPTracing.speakText === "function") {
          window.GPTracing.speakText(text, {
          rate: 0.82,
          pitch: 1.02,
            volume: 1,
            onEnd: done,
            onError: done
          });
          return;
        }
        const utter = new SpeechSynthesisUtterance(" " + String(text).replace(/\s+/g, " ").trim());
      utter.rate = 0.82;
      utter.pitch = 1.02;
      utter.volume = 1;
      utter.onend = () => { if (done) done(); };
      utter.onerror = () => { if (done) done(); };
      if (window.GPTracing && typeof window.GPTracing.applyPreferredVoice === "function") {
        window.GPTracing.applyPreferredVoice(utter);
      }
      window.setTimeout(() => {
        try {
          window.speechSynthesis.speak(utter);
        } catch (_) {
          if (done) done();
        }
      }, getSpeechDelayMs(false));
    } catch (_) {
      if (window.GPTracing && typeof window.GPTracing.speakText === "function") {
        window.GPTracing.speakText(text, { rate: 0.82, pitch: 1.02, volume: 1, onEnd: done, onError: done });
        return;
      }
      if (done) done();
    }
  }

  function initUnifiedMicProtocol() {
      const pageFile = ((location.pathname || "").split("/").pop() || "").replace(/\.html$/i, "");
      const forceLA2MicForLesson = !!(
        isLevelLessonPage() &&
        (
          window.__GP_FORCE_UNIFIED_MIC_PROTOCOL__ === true ||
          (document.body && document.body.dataset && document.body.dataset.gpForceUnifiedMic === "1")
        )
      );
      if (window.__GP_DISABLE_UNIFIED_MIC_PROTOCOL && !forceLA2MicForLesson) return;

    const micButton = document.querySelector("#micIconBtn, #micBtn, .mic-icon-btn, .mic-btn, [data-mic], [aria-label*='Repeat conversation' i], [aria-label*='Repeat instruction' i], [aria-label*='Repeat after me' i], [aria-label*='speaking activity' i], [aria-label*='microphone' i]");
    if (!micButton) return;

    const lines = getConversationLineNodes();
    if (!lines.length) return;

    ensureUnifiedMicLessonStyles();
    lines.forEach(hideConversationLine);
    const hasCustomMicFlow = !!document.querySelector(".repeat-result,.star-row,.conversation-status,.recording-status");

      if (document.body) {
        document.body.dataset.gpUnifiedMicProtocol = "1";
      }

      const fallbackOutputs = ensureFallbackMicOutputs(lines);
      const repeatOutputs = fallbackOutputs.repeatOutputs;
      const starOutputs = fallbackOutputs.starOutputs;
      const conversationStatus = document.getElementById("conversationStatus") || document.querySelector(".conversation-status");
      const attempts = new Array(lines.length).fill(0);
      const starsAwarded = new Array(lines.length).fill(0);
      const successRemarks = [
        "Wow! You are super smart!",
        "Amazing Job",
        "Great Try! keep it up!!!"
      ];
      const chime = new Audio("../../../../assets/audio/chimes/chime.mp3");
      chime.preload = "auto";
      const state = {
        fallbackActive: false,
        micStepIndex: 0,
        micPhase: "reveal",
        micBusy: false,
        micDone: false,
        lastVisibleIndex: -1,
        stalledClicks: 0
      };

      function visibleIndex() {
        return lines.findIndex(isConversationLineVisible);
      }

      function setFallbackRepeat(index, text, ok) {
        const el = repeatOutputs[index];
        if (!el) return;
        el.textContent = text || "";
        el.style.color = ok ? "#2f9f5f" : "#c62828";
      }

      function setConversationStatus(text) {
        if (!conversationStatus) return;
        conversationStatus.textContent = text || "";
      }

      function setFallbackStars(index, count) {
        const el = starOutputs[index];
        if (!el) return;
        el.innerHTML = new Array(Math.max(0, count || 0)).fill("&#9733;").join("");
      }

      function highlightFallbackLine(index, on) {
        const line = lines[index];
        if (!line) return;
        line.classList.toggle("mic-highlight", !!on);
        const bubble = getConversationBubble(line);
        if (bubble && bubble !== line) {
          bubble.classList.toggle("mic-highlight", !!on);
          bubble.classList.toggle("sparkle", !!on);
        } else if (bubble) {
          bubble.classList.toggle("sparkle", !!on);
        }
      }

      function resetFallbackState() {
        state.fallbackActive = false;
        state.micStepIndex = 0;
        state.micPhase = "reveal";
        state.micBusy = false;
        state.micDone = false;
        state.lastVisibleIndex = -1;
        state.stalledClicks = 0;
        attempts.fill(0);
        starsAwarded.fill(0);
        lines.forEach(hideConversationLine);
        repeatOutputs.forEach((el) => { if (el) el.textContent = ""; });
        starOutputs.forEach((el) => { if (el) el.innerHTML = ""; });
        setConversationStatus("");
      }

      function completeFallbackFlow() {
        if (state.micDone) return;
        state.micDone = true;
        state.micBusy = false;
        highlightFallbackLine(state.micStepIndex, false);
        const totalStars = starsAwarded.reduce((sum, value) => sum + value, 0);
        try {
          if (window.GPTracing && typeof window.GPTracing.playTraceCelebration === "function") {
            window.GPTracing.playTraceCelebration();
          }
          if (totalStars > 0) {
            const remark = successRemarks[Math.floor(Math.random() * successRemarks.length)];
            try {
              chime.currentTime = 0;
              chime.play().catch(() => {});
            } catch (_) {}
            setConversationStatus(remark);
            if (window.GPTracing && typeof window.GPTracing.speakText === "function") {
              window.GPTracing.speakText(remark, { rate: 0.94, pitch: 1.08 });
            }
          } else {
            setConversationStatus("");
          }
        } catch (_) {}
        window.dispatchEvent(new CustomEvent("gp:mic-complete"));
      }

      function showAndSpeakFallbackLine(index) {
        if (index < 0 || index >= lines.length) return;
        revealConversationLine(lines[index]);
        highlightFallbackLine(index, false);
        state.fallbackActive = true;
        state.micStepIndex = index;
        state.micPhase = "repeat";
        setConversationStatus(getConversationBubbleText(lines[index]));
        speakConversationBubble(lines[index]);
      }

      function moveFallbackToNextStep() {
        highlightFallbackLine(state.micStepIndex, false);
        state.micBusy = false;
        state.micStepIndex += 1;
        state.micPhase = "reveal";
        if (state.micStepIndex >= lines.length) {
          completeFallbackFlow();
          return;
        }
        showAndSpeakFallbackLine(state.micStepIndex);
      }

        function runFallbackFlow() {
          if (window.__GP_DISABLE_UNIFIED_MIC_PROTOCOL && !forceLA2MicForLesson) return;
          if (state.micDone || state.micBusy) return;

        if (!state.fallbackActive) {
          resetFallbackState();
          state.fallbackActive = true;
          lines.forEach(hideConversationLine);
          state.micStepIndex = forceLA2MicForLesson ? 0 : Math.max(0, visibleIndex());
          state.micPhase = "reveal";
          showAndSpeakFallbackLine(state.micStepIndex);
          return;
        }

        if (state.micPhase === "reveal") {
          showAndSpeakFallbackLine(state.micStepIndex);
          return;
        }

        const expected = getConversationBubbleText(lines[state.micStepIndex]);
        if (!expected) {
          moveFallbackToNextStep();
          return;
        }

        state.micBusy = true;
        highlightFallbackLine(state.micStepIndex, true);
        setConversationStatus("Repeat after me.");

        speakMicPrompt("Repeat after me.", () => {
          if (!window.GPTracing || typeof window.GPTracing.listenForRepeat !== "function") {
            setFallbackRepeat(state.micStepIndex, expected, true);
            starsAwarded[state.micStepIndex] = 3;
            setFallbackStars(state.micStepIndex, 3);
              setConversationStatus("Great speaking. Get ready for the next bubble.");
              window.setTimeout(moveFallbackToNextStep, 900);
            return;
          }

          window.GPTracing.listenForRepeat(expected, (pct, said) => {
            const tryNo = ++attempts[state.micStepIndex];
            if (pct >= 50) {
              setFallbackRepeat(state.micStepIndex, (said || expected).trim(), true);
              starsAwarded[state.micStepIndex] = window.GPTracing.rewardStars(tryNo);
              setFallbackStars(state.micStepIndex, starsAwarded[state.micStepIndex]);
                    window.setTimeout(moveFallbackToNextStep, 900);
              return;
            }

            if (tryNo >= 3) {
              setFallbackRepeat(state.micStepIndex, "You did a good Job. Nice try!", false);
              setConversationStatus("You did a good Job. Nice try!");
              starsAwarded[state.micStepIndex] = 0;
              setFallbackStars(state.micStepIndex, 0);
              window.setTimeout(() => {
                speakMicPrompt("You did a good Job. Nice try!", () => {
                  window.setTimeout(moveFallbackToNextStep, 900);
                });
              }, 420);
              return;
            }

            state.micBusy = false;
            state.micPhase = "repeat";
            highlightFallbackLine(state.micStepIndex, false);
            setFallbackRepeat(state.micStepIndex, "Sorry, try again!", false);
            setConversationStatus("Sorry, try again!");
            window.setTimeout(() => {
              speakMicPrompt("Sorry, try again!");
            }, 320);
          }, {
              timeoutMs: 6500,
              settleMs: 1400,
              startDelayMs: 700
            });
        });
      }

      ["#clearBtn", ".btn.stop", "[data-action='clear']"].forEach((selector) => {
        document.querySelectorAll(selector).forEach((button) => {
          button.addEventListener("click", resetFallbackState, { capture: true });
        });
      });

      function handleForcedMicClick(ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (typeof ev.stopImmediatePropagation === "function") {
            ev.stopImmediatePropagation();
          }
        }
        prepareMicSupport();
        if (state.micDone) {
          resetFallbackState();
        }
        if (forceLA2MicForLesson && !state.fallbackActive) {
          resetFallbackState();
        }
        runFallbackFlow();
      }

      function interceptForcedMicEvent(ev) {
        const target = ev && getMicTarget(ev.target);
        if (!target) return;
        handleForcedMicClick(ev);
      }

        function forceOwnMicButton() {
          const liveMicButton = document.querySelector("#micIconBtn, #micBtn, .mic-icon-btn, .mic-btn, [data-mic], [aria-label*='Repeat conversation' i], [aria-label*='Repeat instruction' i], [aria-label*='Repeat after me' i], [aria-label*='speaking activity' i], [aria-label*='microphone' i]");
          if (!liveMicButton || liveMicButton.dataset.gpStrictLa2MicBound === "1") return;
          liveMicButton.dataset.gpStrictLa2MicBound = "1";
          if (liveMicButton.hasAttribute("onclick")) {
            liveMicButton.removeAttribute("onclick");
          }
          liveMicButton.addEventListener("click", handleForcedMicClick, true);
        }

      if (forceLA2MicForLesson) {
        document.body.dataset.gpUnifiedMicProtocol = "1";
        document.body.dataset.gpForceLa2Mic = "1";
        forceOwnMicButton();
        window.setTimeout(forceOwnMicButton, 0);
        window.setTimeout(forceOwnMicButton, 150);
        window.setTimeout(forceOwnMicButton, 600);
        window.addEventListener("load", forceOwnMicButton, { once: true });
        document.addEventListener("click", interceptForcedMicEvent, true);
        if (window.MutationObserver) {
          const observer = new MutationObserver(() => {
            forceOwnMicButton();
          });
          observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
          window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
        }
        return;
      }

      document.addEventListener("click", (ev) => {
          if (window.__GP_DISABLE_UNIFIED_MIC_PROTOCOL && !forceLA2MicForLesson) return;
          if (!getMicTarget(ev.target)) return;
          prepareMicSupport();
          const hadVisibleLine = lines.some(isConversationLineVisible);
          window.setTimeout(() => {
            if (window.__GP_DISABLE_UNIFIED_MIC_PROTOCOL && !forceLA2MicForLesson) return;
            const hasVisibleLine = lines.some(isConversationLineVisible);
          if (state.fallbackActive) {
            runFallbackFlow();
            return;
          }
          const currentVisible = visibleIndex();
          const hasFeedback = repeatOutputs.some((el) => !!String(el && el.textContent || "").trim());
          if (!hadVisibleLine && !hasVisibleLine) {
            runFallbackFlow();
            return;
          }
          if (hasVisibleLine && currentVisible === state.lastVisibleIndex && !hasFeedback) {
            state.stalledClicks += 1;
          } else {
            state.stalledClicks = 0;
          }
          state.lastVisibleIndex = currentVisible;
          if (state.stalledClicks >= 1) {
            state.fallbackActive = true;
            state.micStepIndex = Math.max(0, currentVisible);
            state.micPhase = "repeat";
            runFallbackFlow();
          }
        }, hasCustomMicFlow ? 180 : 80);
      }, { capture: true, passive: true });
    }

  function initGenericTraceCanvasAudio() {
    const canvases = [];
    const seen = new Set();
    document.querySelectorAll("#traceCanvas, .trace-canvas").forEach((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement) || seen.has(canvas)) return;
      seen.add(canvas);
      canvases.push(canvas);
    });

    canvases.forEach((canvas) => {
      if (canvas.dataset.gpTraceAudioBound === "true") return;
      if (canvas.dataset.gpSharedTracePad === "true") return;
      canvas.dataset.gpTraceAudioBound = "true";
      let drawing = false;

      function endDraw() {
        drawing = false;
      }

      canvas.addEventListener("pointerdown", () => {
        drawing = true;
      }, { passive: true });

      canvas.addEventListener("pointermove", () => {
        if (!drawing) return;
        try {
          if (window.GPTracing && typeof window.GPTracing.playTraceTick === "function") {
            window.GPTracing.playTraceTick();
          }
        } catch (_) {}
      }, { passive: true });

      ["pointerup", "pointerleave", "pointercancel", "lostpointercapture"].forEach((eventName) => {
        canvas.addEventListener(eventName, endDraw, { passive: true });
      });
    });
  }

  function initHomeButtonRouting() {
    const candidates = Array.from(document.querySelectorAll(
      ".home-btn,#homeBtn,.btn-home,a[aria-label*='home' i],button[aria-label*='home' i],[data-home],[title*='home' i]"
    )).filter((el) => {
      if (!el) return false;
      const text = String(el.textContent || "").trim();
      const label = String(el.getAttribute("aria-label") || el.getAttribute("title") || "");
      return /home/i.test(text) || /home/i.test(label) || el.classList.contains("home-btn") || el.id === "homeBtn" || el.hasAttribute("data-home");
    });

    candidates.forEach((button) => {
      if (button.dataset.gpHomeBound === "1") return;
      button.dataset.gpHomeBound = "1";
      const homeTarget = getLessonAppAbsolute("index.html");

      if (button.tagName === "A") {
        button.setAttribute("href", homeTarget);
      } else {
        button.setAttribute("data-home-target", homeTarget);
      }

      button.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") {
          ev.stopImmediatePropagation();
        }
        window.location.assign(homeTarget);
      }, true);
    });
  }

  function initAutoIntroVideo() {
    if (isLevelLessonPage()) return;
    const pageFile = ((location.pathname || "").split("/").pop() || "").replace(/\.html$/i, "");
    const candidates = [];
    collectExistingIntroSources().forEach((src) => pushUniqueCandidate(candidates, src));
    getAutoIntroCandidates(pageFile).forEach((src) => pushUniqueCandidate(candidates, src));
    if (!candidates.length) return;

    const existingIntro = document.getElementById("introVideo");
    if (existingIntro && existingIntro.dataset.gpBoundIntro === "true") return;

        ensureAutoIntroStyles();
        const html = document.documentElement;
        const body = document.body;
        if (!body) return;
        const isLevelBPage = /[\\\/]level-b[\\\/]/i.test((location.pathname || "") + " " + (location.href || ""));

        if (isLevelBPage) {
          window.__lbIntroVideoOverlayInit = true;
        }

      [
        "#lbIntroVideoOverlay",
        "#lb3IntroOverlay",
        "#lbIntroVideoControls",
        "#lbIntroVideoPlay",
        "#lbIntroVideoSkip",
        "#introPlayBtn",
        "#introSkipBtn",
        "#lbIntroStartBtn",
        "#lbIntroHelp"
        ].forEach(function (selector) {
          document.querySelectorAll(selector).forEach(function (el) {
            try {
              el.style.display = "none";
            el.style.visibility = "hidden";
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
            } catch (_) {}
          });
        });

        ["#lbIntroVideoOverlay", "#lb3IntroOverlay"].forEach(function (selector) {
          document.querySelectorAll(selector).forEach(function (el) {
            try { el.remove(); } catch (_) {}
          });
        });

      const prehide = document.getElementById("gpUnifiedIntroPrehide");
      if (prehide) prehide.remove();

    let wrap = document.getElementById("introVideoWrap");
    let video = document.getElementById("introVideo");
    let createdWrap = false;

    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "gpAutoIntroOverlay";
      wrap.className = "intro-video-wrap";
      video = document.createElement("video");
      video.id = "introVideo";
      wrap.appendChild(video);
      body.appendChild(wrap);
      createdWrap = true;
    }

      if (!video) {
        video = document.createElement("video");
        video.id = "introVideo";
        wrap.appendChild(video);
      }

      video.style.objectFit = "contain";
      video.style.objectPosition = "center center";
      video.style.background = "#000";

      video.dataset.gpBoundIntro = "true";
      video.preload = "auto";
      video.autoplay = true;
      video.controls = false;
      video.loop = false;
      video.playsInline = true;
      video.style.width = "100vw";
      video.style.height = "100vh";
      video.style.maxWidth = "100vw";
      video.style.maxHeight = "100vh";
      video.style.objectFit = "contain";
      video.style.objectPosition = "center center";
      video.style.background = "#000";
      video.style.borderRadius = "0";
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      let candidateIndex = 0;
      function applyCandidate(index) {
        const candidate = candidates[index];
        if (!candidate) return false;
        try { video.pause(); } catch (_) {}
        try { video.currentTime = 0; } catch (_) {}
        video.src = candidate.src;
        try { video.load(); } catch (_) {}
        return true;
      }
      applyCandidate(candidateIndex);

      let done = false;
      let hardTimeout = null;

    function clearHardTimeout() {
      if (!hardTimeout) return;
      window.clearTimeout(hardTimeout);
      hardTimeout = null;
    }

    function revealLesson() {
      if (done) return;
      done = true;
      clearHardTimeout();
      try { video.pause(); } catch (_) {}
      wrap.classList.remove("active");
      wrap.style.display = "none";
      wrap.style.visibility = "hidden";
      wrap.style.opacity = "0";
      wrap.style.pointerEvents = "none";
        body.classList.remove("intro-active");
        html.classList.remove("lesson-intro-video-pending");
        if (createdWrap) wrap.remove();
        window.dispatchEvent(new Event("gp:intro-end"));
      }

      const requireAudio = window.__GP_REQUIRE_INTRO_AUDIO__ !== false;
      let audioFailureCount = 0;
      let playbackMode = "audio";

      function startPlayback(withAudio) {
        try { video.currentTime = 0; } catch (_) {}
        try {
          video.defaultMuted = !withAudio;
          video.muted = !withAudio;
          if (withAudio) {
            video.removeAttribute("muted");
          } else {
            video.setAttribute("muted", "");
          }
        } catch (_) {}
        try { video.volume = withAudio ? 0.3 : 0; } catch (_) {}
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function () {
            if (done) return;
            if (withAudio) {
              audioFailureCount += 1;
              try { video.pause(); } catch (_) {}
              try { video.currentTime = 0; } catch (_) {}
              if (requireAudio && audioFailureCount < 3) {
                window.setTimeout(function () {
                  if (!done) startPlayback(true);
                }, 220);
                return;
              }
              playbackMode = "muted";
              startPlayback(false);
              return;
            }
            revealLesson();
          });
        }
      }

      function tryPromoteIntroAudio() {
        if (done) return;
        if (playbackMode !== "muted") return;
        try {
          video.defaultMuted = false;
          video.muted = false;
          video.removeAttribute("muted");
          video.volume = 0.3;
        } catch (_) {}
        const playPromise = video.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.then(function () {
            playbackMode = "audio";
          }).catch(function () {
            playbackMode = "muted";
            try { video.defaultMuted = true; } catch (_) {}
            try { video.muted = true; } catch (_) {}
            try { video.setAttribute("muted", ""); } catch (_) {}
          });
        }
      }

    function tryNextCandidate() {
      candidateIndex += 1;
      if (!applyCandidate(candidateIndex)) return false;
      clearHardTimeout();
      hardTimeout = window.setTimeout(revealLesson, 4000);
      startPlayback(true);
      return true;
    }

    wrap.classList.add("active");
    wrap.style.display = "flex";
    wrap.style.visibility = "visible";
    wrap.style.opacity = "1";
    wrap.style.pointerEvents = "auto";
    body.classList.add("intro-active");
    html.classList.add("lesson-intro-video-pending");

      video.addEventListener("ended", revealLesson, { once: true });
      video.addEventListener("error", function () {
        if (done) return;
        if (tryNextCandidate()) return;
        revealLesson();
      });
      video.addEventListener("loadeddata", function () {
        if (!done && video.currentTime === 0) startPlayback(true);
      }, { once: true });
      video.addEventListener("canplay", function () {
        if (!done && video.currentTime === 0) startPlayback(true);
      }, { once: true });
      video.addEventListener("loadedmetadata", function () {
        clearHardTimeout();
        const seconds = Number(video.duration) || 0;
        const timeoutMs = Math.max(6000, Math.min(90000, Math.round((seconds + 2) * 1000)));
        hardTimeout = window.setTimeout(revealLesson, timeoutMs);
      }, { once: true });
        video.addEventListener("play", function () {
          if (!video.muted) {
            playbackMode = "audio";
          } else {
            window.setTimeout(tryPromoteIntroAudio, 350);
            window.setTimeout(tryPromoteIntroAudio, 1400);
          }
        });
      hardTimeout = window.setTimeout(revealLesson, 4000);

        prepareMicSupport();
        startPlayback(true);
        window.addEventListener("load", function () {
          if (!done && video.currentTime === 0) startPlayback(true);
        }, { once: true });
        ["pointerdown", "touchstart", "click", "keydown"].forEach(function (eventName) {
          document.addEventListener(eventName, function () {
            tryPromoteIntroAudio();
          }, { capture: true, passive: eventName !== "keydown" });
        });
      }

  window.addEventListener("gp:intro-end", stopIntroMedia, true);
  window.addEventListener("pagehide", stopIntroMedia, true);
  window.addEventListener("pagehide", stopPageInstructionAudio, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stopIntroMedia();
  }, true);
  document.addEventListener("pointerdown", (ev) => {
    if (!getMicTarget(ev.target)) return;
    prepareMicSupport();
  }, { capture: true, passive: true });
  document.addEventListener("touchstart", (ev) => {
    if (!getMicTarget(ev.target)) return;
    prepareMicSupport();
  }, { capture: true, passive: true });
  document.addEventListener("click", (ev) => {
    if (!getMicTarget(ev.target)) return;
    prepareMicSupport();
  }, { capture: true, passive: true });
  document.addEventListener("pointerdown", (ev) => {
    const hit = getTrackedTarget(ev.target);
    if (!hit) return;
    saveBeforeNavigation();
  }, { capture: true, passive: true });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const hit = getTrackedTarget(ev.target);
    if (!hit) return;
    saveBeforeNavigation();
  }, { capture: true });
  document.addEventListener("click", (ev) => {
    const hit = getTrackedTarget(ev.target);
    if (!hit) return;
    saveBeforeNavigation();
  }, { capture: true, passive: true });
  document.addEventListener("submit", () => {
    saveBeforeNavigation();
  }, { capture: true });

  installSpeechVoicePreference();
  installMediaPlaybackPatch();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExpectedLessonNavigation, { once: true });
    document.addEventListener("DOMContentLoaded", suppressWeek2LessonIntroVideos, { once: true });
    document.addEventListener("DOMContentLoaded", initAutoIntroVideo, { once: true });
    document.addEventListener("DOMContentLoaded", initPageInstructionAudio, { once: true });
    document.addEventListener("DOMContentLoaded", initUnifiedMicProtocol, { once: true });
    document.addEventListener("DOMContentLoaded", initGenericTraceCanvasAudio, { once: true });
    document.addEventListener("DOMContentLoaded", initHomeButtonRouting, { once: true });
    document.addEventListener("DOMContentLoaded", suppressLegacyLevelBGirlHelper, { once: true });
  } else {
    initExpectedLessonNavigation();
    suppressWeek2LessonIntroVideos();
    initAutoIntroVideo();
    initPageInstructionAudio();
    initUnifiedMicProtocol();
    initGenericTraceCanvasAudio();
    initHomeButtonRouting();
    suppressLegacyLevelBGirlHelper();
  }
})();
