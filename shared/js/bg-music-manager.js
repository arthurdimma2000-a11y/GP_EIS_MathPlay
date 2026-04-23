// Background Music Manager
// Coordinates background music between index.html, ProgressReport.html and lesson pages

(function() {
  window.__GP_DISABLE_SHARED_BG_AUDIO__ = true;

  const BgMusicManager = {
    stopAllBgMusic: function() {
      if (window.__gpBgMusicManager) {
        window.__gpBgMusicManager.stop();
      }
      if (window.__gpReportBgMusicManager) {
        window.__gpReportBgMusicManager.stop();
      }
      if (window.GPAudio && typeof window.GPAudio.stopBg === "function") {
        try { window.GPAudio.stopBg(); } catch (_) {}
      }
      document.querySelectorAll("audio, video").forEach((media) => {
        try {
          const src = String(media.currentSrc || media.src || "");
          const isBackgroundTrack =
            /(?:^|\/)(?:bg-|Audio[1-4]\.(?:mp3|mp4|m4a))/i.test(src) ||
            media.dataset.gpBackground === "1" ||
            (!!media.loop && !/InstructionAudio\.mp3/i.test(src));
          if (isBackgroundTrack) {
            media.pause();
            media.currentTime = 0;
            media.muted = true;
            media.volume = 0;
          }
        } catch (_) {}
      });
    },

    resumeBgMusic: function() {
      return;
    },

    isLessonPage: function() {
      return /\/levels\//.test(window.location.pathname);
    }
  };

  window.__BgMusicManager = BgMusicManager;

  // Stop background music immediately on lesson pages
  if (BgMusicManager.isLessonPage()) {
    BgMusicManager.stopAllBgMusic();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (BgMusicManager.isLessonPage()) {
      BgMusicManager.stopAllBgMusic();
    }
  }, { once: true });

  // Stop music on page hide and resume on page show
  window.addEventListener("pagehide", () => {
    BgMusicManager.stopAllBgMusic();
  });

  document.addEventListener("visibilitychange", () => {
    if (BgMusicManager.isLessonPage()) {
      BgMusicManager.stopAllBgMusic();
    }
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted && !BgMusicManager.isLessonPage()) {
      BgMusicManager.resumeBgMusic();
    }
  });

  // Handle back button navigation
  window.addEventListener("popstate", () => {
    setTimeout(() => {
      BgMusicManager.stopAllBgMusic();
    }, 100);
  });
})();
