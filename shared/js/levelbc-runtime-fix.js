(function () {
  "use strict";

  if (window.__GP_LEVELBC_RUNTIME_FIX__) return;
  window.__GP_LEVELBC_RUNTIME_FIX__ = true;

  function ensureViewport() {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "viewport");
      (document.head || document.documentElement).appendChild(meta);
    }
    meta.setAttribute("content", "width=device-width, initial-scale=1.0, viewport-fit=cover");
  }

  function ensureStyles() {
    if (document.getElementById("gpLevelBCRuntimeFixStyles")) return;
    const style = document.createElement("style");
    style.id = "gpLevelBCRuntimeFixStyles";
    style.textContent =
      "html,body{max-width:100%;overflow-x:hidden !important;}" +
      "*,*::before,*::after{box-sizing:border-box;}" +
      "img,video,canvas,svg,iframe{max-width:100%;height:auto;display:block;}" +
      "body{padding:max(6px,env(safe-area-inset-top)) max(6px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));}" +
      ".app,.card,.page,.page-wrap,.board,.poster-area,.poster-wrap,.video-shell,.video-card,.stage,.lesson-stage,.tray-hero{position:relative;max-width:100% !important;}" +
      "button,[role='button'],.btn,.nav-btn,.mic-icon-btn,.ans,.choice{touch-action:manipulation;min-height:clamp(44px,7vw,60px);}" +
      ".mic-icon-btn{min-width:clamp(52px,10vw,76px) !important;min-height:clamp(52px,10vw,76px) !important;}" +
      ".mic-icon-btn img{width:clamp(32px,7vw,54px) !important;height:clamp(32px,7vw,54px) !important;}" +
      ".bubble,.speech-bubble,.dialog-bubble,.convo-bubble,.bubble-left,.bubble-right,#bubbleLeft,#bubbleRight{font-size:clamp(16px,2.8vw,24px) !important;line-height:1.28 !important;max-width:min(92vw,760px) !important;white-space:normal !important;overflow-wrap:anywhere !important;word-break:normal !important;}" +
      "canvas,.draw-layer,.trace-canvas{touch-action:none !important;}" +
      "@media (max-width:900px){.app,.card,.page,.page-wrap{width:min(100%,calc(100vw - 12px)) !important;max-width:100% !important;}}";
    (document.head || document.documentElement).appendChild(style);
  }

  ensureViewport();
  ensureStyles();
})();
