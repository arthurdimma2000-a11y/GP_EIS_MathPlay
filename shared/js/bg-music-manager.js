// Background Music Manager
// Coordinates background music between index.html, ProgressReport.html and lesson pages

(function() {
  const BgMusicManager = {
    stopAllBgMusic: function() {
      if (window.__gpBgMusicManager) {
        window.__gpBgMusicManager.stop();
      }
      if (window.__gpReportBgMusicManager) {
        window.__gpReportBgMusicManager.stop();
      }
    },

    resumeBgMusic: function() {
      if (window.__gpBgMusicManager) {
        window.__gpBgMusicManager.start();
      }
      if (window.__gpReportBgMusicManager) {
        window.__gpReportBgMusicManager.start();
      }
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

  // Stop music on page hide and resume on page show
  window.addEventListener("pagehide", () => {
    BgMusicManager.stopAllBgMusic();
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted && !BgMusicManager.isLessonPage()) {
      BgMusicManager.resumeBgMusic();
    }
  });

  // Handle back button navigation
  window.addEventListener("popstate", () => {
    setTimeout(() => {
      if (!BgMusicManager.isLessonPage()) {
        BgMusicManager.resumeBgMusic();
      }
    }, 100);
  });
})();
