(() => {
  "use strict";

  const STORAGE_KEYS = {
    unlocked: "gp_audio_unlocked",
    muted: "gp_audio_muted",
    bgVolume: "gp_audio_bg_volume",
    sfxVolume: "gp_audio_sfx_volume"
  };

  const AUDIO_PATHS = {
    welcome: "/assets/audio/bg-welcome.mp3",
    login: "/assets/audio/bg-login.mp3",
    lesson: "/assets/audio/bg-lesson.mp3",
    activity: "/assets/audio/bg-activity.mp3",
    quiz: "/assets/audio/bg-quiz.mp3",
    tracing: "/assets/audio/bg-tracing.mp3",
    success: "/assets/audio/sfx-success.mp3",
    tryAgain: "/assets/audio/sfx-try-again.mp3",
    click: "/assets/audio/sfx-click.mp3",
    cheer: "/assets/audio/sfx-cheer.mp3"
  };

  const DEFAULTS = {
    bgVolume: 0.22,
    sfxVolume: 0.4
  };

  let currentBg = null;
  let currentBgKey = null;
  let audioUnlocked = false;
  let isMuted = false;
  let bgVolume = DEFAULTS.bgVolume;
  let sfxVolume = DEFAULTS.sfxVolume;
  let initialized = false;

  function isSharedBgAudioDisabled() {
    return window.__GP_DISABLE_SHARED_BG_AUDIO__ === true;
  }

  function safeLocalStorageGet(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function logError(...args) {
    console.warn("[GPAudio]", ...args);
  }

  function safeAudio(src) {
    try {
      return new Audio(src);
    } catch (error) {
      logError("Could not create audio:", src, error);
      return null;
    }
  }

  function getBodyPageType() {
    const body = document.body;
    if (!body) return "";
    return String(body.dataset.pageType || "").trim().toLowerCase();
  }

  function getFileName() {
    try {
      const path = window.location.pathname || "";
      const file = path.split("/").pop() || "";
      return file.toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function detectPageType() {
    const explicitType = getBodyPageType();
    if (explicitType) return explicitType;

    const file = getFileName();

    if (file === "index.html" || file === "" || file.includes("home")) return "welcome";

    if (
      file.includes("login") ||
      file.includes("signup") ||
      file.includes("register") ||
      file.includes("pin") ||
      file.includes("teacher") ||
      file.includes("student") ||
      file.includes("admin") ||
      file.includes("auth")
    ) {
      return "login";
    }

    if (file.includes("quiz")) return "quiz";
    if (file.includes("trace") || file.includes("tracing") || file.includes("write")) return "tracing";

    if (
      file.includes("game") ||
      file.includes("activity") ||
      file.includes("play") ||
      file.includes("revision")
    ) {
      return "activity";
    }

    if (
      file.includes("lesson") ||
      /^la\d+/i.test(file) ||
      /^lb\d+/i.test(file) ||
      /^lc\d+/i.test(file)
    ) {
      return "lesson";
    }

    return "lesson";
  }

  function getBgTrackForPageType(pageType) {
    switch (pageType) {
      case "welcome": return "welcome";
      case "login": return "login";
      case "lesson": return "lesson";
      case "activity": return "activity";
      case "quiz": return "quiz";
      case "tracing": return "tracing";
      default: return "lesson";
    }
  }

  function stopBg() {
    if (!currentBg) return;
    try {
      currentBg.pause();
      currentBg.currentTime = 0;
    } catch (_) {}
    currentBg = null;
    currentBgKey = null;
  }

  async function playBg(trackKey, options = {}) {
    const { forceRestart = false } = options;

    if (isMuted || !audioUnlocked) return;

    const src = AUDIO_PATHS[trackKey];
    if (!src) {
      logError("Unknown background track:", trackKey);
      return;
    }

    if (currentBg && currentBgKey === trackKey && !forceRestart) {
      currentBg.volume = bgVolume;
      return;
    }

    stopBg();

    const audio = safeAudio(src);
    if (!audio) return;

    audio.loop = true;
    audio.preload = "auto";
    audio.volume = bgVolume;

    currentBg = audio;
    currentBgKey = trackKey;

    try {
      await audio.play();
    } catch (error) {
      logError("Background music play failed:", trackKey, error);
    }
  }

  async function playPageMusic(options = {}) {
    if (isSharedBgAudioDisabled()) return;
    const pageType = detectPageType();
    const trackKey = getBgTrackForPageType(pageType);
    await playBg(trackKey, options);
  }

  async function playSfx(name, customVolume) {
    if (isMuted || !audioUnlocked) return;

    const src = AUDIO_PATHS[name];
    if (!src) {
      logError("Unknown SFX:", name);
      return;
    }

    const sfx = safeAudio(src);
    if (!sfx) return;

    sfx.preload = "auto";
    sfx.volume = Number.isFinite(customVolume) ? customVolume : sfxVolume;

    try {
      await sfx.play();
    } catch (error) {
      logError("SFX play failed:", name, error);
    }
  }

  function updateMuteButtons() {
    document.querySelectorAll("[data-audio-toggle]").forEach((button) => {
      const label = isMuted ? "🔇 Sound Off" : "🔊 Sound On";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(!isMuted));
      button.setAttribute("title", isMuted ? "Turn sound on" : "Turn sound off");
    });
  }

  function setMuted(value) {
    isMuted = Boolean(value);
    safeLocalStorageSet(STORAGE_KEYS.muted, String(isMuted));

    if (isMuted) {
      stopBg();
    } else if (audioUnlocked) {
      playPageMusic();
    }

    updateMuteButtons();
  }

  function toggleMute() {
    setMuted(!isMuted);
  }

  function setBgVolume(value) {
    const parsed = Math.max(0, Math.min(1, Number(value)));
    if (!Number.isFinite(parsed)) return;
    bgVolume = parsed;
    safeLocalStorageSet(STORAGE_KEYS.bgVolume, String(bgVolume));
    if (currentBg) currentBg.volume = bgVolume;
  }

  function setSfxVolume(value) {
    const parsed = Math.max(0, Math.min(1, Number(value)));
    if (!Number.isFinite(parsed)) return;
    sfxVolume = parsed;
    safeLocalStorageSet(STORAGE_KEYS.sfxVolume, String(sfxVolume));
  }

  async function unlockAudio() {
    if (audioUnlocked) return true;

    audioUnlocked = true;
    safeLocalStorageSet(STORAGE_KEYS.unlocked, "true");

    try {
      const testAudio = safeAudio(
        "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA"
      );
      if (testAudio) {
        testAudio.volume = 0;
        await testAudio.play().catch(() => {});
        testAudio.pause();
      }
    } catch (_) {}

    if (!isMuted) {
      await playPageMusic();
    }

    return true;
  }

  function bindMuteButtons() {
    document.querySelectorAll("[data-audio-toggle]").forEach((button) => {
      if (button.dataset.audioBound === "true") return;

      button.dataset.audioBound = "true";
      button.addEventListener("click", async (event) => {
        event.stopPropagation();

        if (!audioUnlocked) {
          await unlockAudio();
        }

        toggleMute();

        if (!isMuted) {
          playSfx("click", 0.35);
        }
      });
    });

    updateMuteButtons();
  }

  function bindClickSfx() {
    document.addEventListener("click", (event) => {
      const target = event.target.closest(
        "button, .btn, .tab, .side-link, .lesson-btn, .day-lesson-btn, .month-week-btn, .month-card.month-clickable, [data-play-click]"
      );
      if (!target) return;
      if (target.hasAttribute("data-no-click-sfx")) return;
      if (target.hasAttribute("data-audio-toggle")) return;
      playSfx("click", 0.35);
    });
  }

  function bindUnlockEvents() {
    const onceOptions = { once: true, passive: true };

    const handler = async () => {
      await unlockAudio();
    };

    window.addEventListener("pointerdown", handler, onceOptions);
    window.addEventListener("touchstart", handler, onceOptions);
    window.addEventListener("keydown", handler, onceOptions);
  }

  function handleVisibility() {
    if (document.hidden) {
      if (currentBg) {
        try { currentBg.pause(); } catch (_) {}
      }
    } else if (audioUnlocked && !isMuted && !isSharedBgAudioDisabled()) {
      if (currentBg) {
        currentBg.play().catch(() => {});
      } else {
        playPageMusic();
      }
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    audioUnlocked = safeLocalStorageGet(STORAGE_KEYS.unlocked, "false") === "true";
    isMuted = safeLocalStorageGet(STORAGE_KEYS.muted, "false") === "true";

    const storedBg = Number(safeLocalStorageGet(STORAGE_KEYS.bgVolume, DEFAULTS.bgVolume));
    const storedSfx = Number(safeLocalStorageGet(STORAGE_KEYS.sfxVolume, DEFAULTS.sfxVolume));

    if (Number.isFinite(storedBg)) bgVolume = storedBg;
    if (Number.isFinite(storedSfx)) sfxVolume = storedSfx;

    bindMuteButtons();
    bindClickSfx();
    bindUnlockEvents();
    document.addEventListener("visibilitychange", handleVisibility);

    window.addEventListener("pageshow", () => {
      bindMuteButtons();
      if (audioUnlocked && !isMuted) {
        playPageMusic();
      }
    });

    if (audioUnlocked && !isMuted && !isSharedBgAudioDisabled()) {
      playPageMusic();
    } else {
      updateMuteButtons();
    }
  }

  window.GPAudio = {
    init,
    unlockAudio,
    playPageMusic,
    playBg,
    stopBg,
    playSfx,
    toggleMute,
    setMuted,
    isMuted: () => isMuted,
    setBgVolume,
    setSfxVolume,
    detectPageType
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
