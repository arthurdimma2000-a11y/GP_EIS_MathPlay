(function(){
  var s = document.createElement("script");
  s.src = "../../../../shared/js/activity-standardizer-shared.js";
  s.defer = false;
  document.head.appendChild(s);
})();

(function(){
  function getPageFile(){
    return ((location.pathname || "").split("/").pop() || "").replace(/\.html$/i, "");
  }

  function getIntroSrc(pageFile){
    pageFile = pageFile || "";
    if (/^LA(?:[2-9]|1\d|2[0-5])$/i.test(pageFile)) {
      return "../../../../assets/video/" + pageFile + "avideo.mp4";
    }
    var lbMatch = /^LB(\d{1,2})$/i.exec(pageFile);
    if (lbMatch) {
      var lbNum = Number(lbMatch[1]);
      if (lbNum >= 2 && lbNum <= 25) return "../../../../assets/video/LB" + lbNum + "bvideo.mp4";
    }
    var lcMatch = /^LevelC(\d{1,2})$/i.exec(pageFile);
    if (lcMatch) {
      var lcNum = Number(lcMatch[1]);
      if (lcNum >= 2 && lcNum <= 25) return "../../../../assets/video/LC" + lcNum + "cvideo.mp4";
    }
    return "";
  }

  function ensureIntroStyles(){
    if (document.getElementById("gpAutoIntroStyles")) return;
    var style = document.createElement("style");
    style.id = "gpAutoIntroStyles";
    style.textContent =
      "html.lesson-intro-video-pending body > *:not(#gpAutoIntroOverlay):not(#introVideoWrap){visibility:hidden !important;}" +
      "#gpAutoIntroOverlay,.intro-video-wrap{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);z-index:2147483647;padding:16px;flex-direction:column;gap:12px;}" +
      "#gpAutoIntroOverlay.active,.intro-video-wrap.active{display:flex !important;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;}" +
      "#gpAutoIntroOverlay video,.intro-video-wrap video{width:min(92vw,980px);max-height:82vh;height:auto;border-radius:14px;background:#000;box-shadow:0 18px 48px rgba(0,0,0,.45);}" +
      "#gpAutoIntroOverlay .gp-intro-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}" +
      "#gpAutoIntroOverlay .gp-intro-btn{border:none;border-radius:999px;padding:12px 18px;font-size:1rem;font-weight:800;cursor:pointer;box-shadow:0 6px 0 rgba(0,0,0,.22);}" +
      "#gpAutoIntroOverlay .gp-intro-btn.sound{background:linear-gradient(180deg,#fffad7,#ffd86a);color:#8b5a00;}" +
      "#gpAutoIntroOverlay .gp-intro-btn.skip{background:#dfeaff;color:#1f3b6b;}" +
      "#gpAutoIntroOverlay .gp-intro-help{color:#fff;font-weight:800;font-size:1rem;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,.45);}";
    document.head.appendChild(style);
  }

  function initAutoIntro(){
    var pageFile = getPageFile();
    var src = getIntroSrc(pageFile);
    if (!src) {
      var existingIntroSource = document.querySelector('#introVideo source[src], #introVideo[src], .intro-video source[src], .intro-video[src]');
      src = existingIntroSource ? (existingIntroSource.getAttribute('src') || '') : '';
    }
    if (!src) return;

    ensureIntroStyles();

    var html = document.documentElement;
    var body = document.body;
    if (!body) return;
    var prehide = document.getElementById("gpUnifiedIntroPrehide");
    if (prehide) prehide.remove();

    var wrap = document.getElementById("gpAutoIntroOverlay");
    var video = document.getElementById("introVideo");
    var createdWrap = false;

    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "gpAutoIntroOverlay";
      wrap.className = "intro-video-wrap";
      wrap.innerHTML =
        '<video id="introVideo" playsinline webkit-playsinline preload="metadata"></video>' +
        '<div class="gp-intro-help" id="gpIntroHelp">Video is playing muted. Tap "Turn On Sound" if you want audio.</div>' +
        '<div class="gp-intro-actions">' +
          '<button class="gp-intro-btn sound" id="gpIntroSoundBtn" type="button">Turn On Sound</button>' +
          '<button class="gp-intro-btn skip" id="gpIntroSkipBtn" type="button">Skip Intro</button>' +
        '</div>';
      body.appendChild(wrap);
      createdWrap = true;
      video = wrap.querySelector("#introVideo");
    }

    if (!video) {
      video = document.createElement("video");
      video.id = "introVideo";
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("preload", "metadata");
      wrap.insertBefore(video, wrap.firstChild || null);
    }

    var help = wrap.querySelector("#gpIntroHelp");
    var soundBtn = wrap.querySelector("#gpIntroSoundBtn");
    var skipBtn = wrap.querySelector("#gpIntroSkipBtn");

    video.preload = "metadata";
    video.autoplay = true;
    video.controls = false;
    video.loop = false;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.defaultMuted = true;
    video.muted = true;
    video.setAttribute("muted", "");
    video.src = src;
    try { video.load(); } catch (_) {}

    var done = false;
    var hardTimeout = null;
    var stallTimeout = null;
    var lastTime = 0;

    function clearTimers(){
      if (hardTimeout) {
        window.clearTimeout(hardTimeout);
        hardTimeout = null;
      }
      if (stallTimeout) {
        window.clearTimeout(stallTimeout);
        stallTimeout = null;
      }
    }

    function revealLesson(){
      if (done) return;
      done = true;
      clearTimers();
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

    function scheduleStallGuard(){
      if (stallTimeout) window.clearTimeout(stallTimeout);
      stallTimeout = window.setTimeout(function(){
        if (done) return;
        var current = 0;
        try { current = Number(video.currentTime) || 0; } catch (_) {}
        if (current <= lastTime + 0.02) {
          revealLesson();
          return;
        }
        lastTime = current;
        scheduleStallGuard();
      }, 2500);
    }

    function startMutedPlayback(){
      if (done) return;
      try {
        video.defaultMuted = true;
        video.muted = true;
        video.setAttribute("muted", "");
        video.volume = 1;
      } catch (_) {}
      var playPromise = video.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(function(){
          if (help) help.textContent = 'Video is playing muted. Tap "Turn On Sound" if you want audio.';
          scheduleStallGuard();
        }).catch(function(){
          revealLesson();
        });
      } else {
        scheduleStallGuard();
      }
    }

    function turnOnSound(){
      if (done) return;
      try {
        video.defaultMuted = false;
        video.muted = false;
        video.removeAttribute("muted");
        video.volume = 1;
      } catch (_) {}
      var playPromise = video.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(function(){
          if (help) help.textContent = "Sound is on.";
        }).catch(function(){
          try {
            video.defaultMuted = true;
            video.muted = true;
            video.setAttribute("muted", "");
          } catch (_) {}
          if (help) help.textContent = 'Sound is blocked on this device. The intro will continue muted.';
        });
      }
    }

    wrap.classList.add("active");
    wrap.style.display = "flex";
    wrap.style.visibility = "visible";
    wrap.style.opacity = "1";
    wrap.style.pointerEvents = "auto";
    body.classList.add("intro-active");
    html.classList.add("lesson-intro-video-pending");

    if (soundBtn) soundBtn.onclick = turnOnSound;
    if (skipBtn) skipBtn.onclick = revealLesson;
    video.onclick = turnOnSound;

    video.addEventListener("ended", revealLesson, { once: true });
    video.addEventListener("error", revealLesson, { once: true });
    video.addEventListener("stalled", revealLesson, { once: true });
    video.addEventListener("abort", revealLesson, { once: true });
    video.addEventListener("suspend", function(){
      if (!done && !(Number(video.duration) > 0)) revealLesson();
    }, { once: true });
    video.addEventListener("timeupdate", function(){
      lastTime = Number(video.currentTime) || lastTime;
    });
    video.addEventListener("loadedmetadata", function(){
      clearTimers();
      var seconds = Number(video.duration) || 0;
      var timeoutMs = Math.max(6000, Math.min(90000, Math.round((seconds + 2) * 1000)));
      hardTimeout = window.setTimeout(revealLesson, timeoutMs);
      startMutedPlayback();
    }, { once: true });
    video.addEventListener("canplay", startMutedPlayback, { once: true });
    hardTimeout = window.setTimeout(revealLesson, 7000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAutoIntro, { once: true });
  } else {
    initAutoIntro();
  }
})();
