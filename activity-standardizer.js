(function () {
  "use strict";

  if (window.__GP_ACTIVITY_STANDARDIZER_ROOT__) return;
  window.__GP_ACTIVITY_STANDARDIZER_ROOT__ = true;

  var baseSrc = (document.currentScript && document.currentScript.src) || window.location.href;
  var resolvedSrc = new URL("./shared/js/activity-standardizer-shared.js", baseSrc).href;
  var existing = document.querySelector('script[data-gp-activity-standardizer-root="true"]');
  if (existing) return;

  var script = document.createElement("script");
  script.src = resolvedSrc;
  script.defer = false;
  script.dataset.gpActivityStandardizerRoot = "true";
  (document.head || document.documentElement).appendChild(script);
})();
