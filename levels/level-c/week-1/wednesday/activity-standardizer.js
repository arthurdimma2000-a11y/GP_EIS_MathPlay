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

  function getIntroCandidates(pageFile){
    pageFile = pageFile || "";
    var list = [];
    function add(src){
      src = String(src || "").trim();
      if (!src || list.indexOf(src) !== -1) return;
      list.push(src);
    }
    if (/^LA(?:[2-9]|1\d|2[0-5])$/i.test(pageFile)) {
      add("../../../../assets/video/" + pageFile + "avideo.mp4");
      return list;
    }
    var lbMatch = /^LB(\d{1,2})$/i.exec(pageFile);
    if (lbMatch) {
      var lbNum = Number(lbMatch[1]);
      if (lbNum >= 2 && lbNum <= 25) {
        add("../../../../assets/video/LB" + lbNum + "bvideo.mp4");
        add("../../../../assets/video/LB" + lbNum + "bbvideo.mp4");
        add("../../../../assets/video/LB" + lbNum + "bVideo.mp4");
      }
      return list;
    }
    var lcMatch = /^LevelC(\d{1,2})$/i.exec(pageFile);
    if (lcMatch) {
      var lcNum = Number(lcMatch[1]);
      if (lcNum >= 2 && lcNum <= 25) {
        add("../../../../assets/video/LevelC" + lcNum + "c.mp4");
        add("../../../../assets/video/LC" + lcNum + "cvideo.mp4");
        add("../../../../assets/video/LevelC" + lcNum + "cvideo.mp4");
      }
      return list;
    }
    return list;
  }

  function ensureIntroStyles(){
    if (document.getElementById("gpAutoIntroStyles")) return;
    var style = document.createElement("style");
    style.id = "gpAutoIntroStyles";
    style.textContent =
      "html.lesson-intro-video-pending body > *:not(#gpAutoIntroOverlay):not(#introVideoWrap){visibility:hidden !important;}" +
      "#gpAutoIntroOverlay,.intro-video-wrap{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);z-index:2147483647;padding:16px;}" +
      "#gpAutoIntroOverlay.active,.intro-video-wrap.active{display:flex !important;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;}" +
      "#gpAutoIntroOverlay video,.intro-video-wrap video{width:min(92vw,980px);max-height:92vh;height:auto;border-radius:14px;background:#000;box-shadow:0 18px 48px rgba(0,0,0,.45);}";
    document.head.appendChild(style);
  }

  function initAutoIntro(){
    var pageFile = getPageFile();
    var candidates = getIntroCandidates(pageFile);
    if (!candidates.length) {
      var existingIntroSource = document.querySelector('#introVideo source[src], #introVideo[src], .intro-video source[src], .intro-video[src]');
      var fallbackSrc = existingIntroSource ? (existingIntroSource.getAttribute('src') || '') : '';
      if (fallbackSrc) candidates.push(fallbackSrc);
    }
    if (!candidates.length) return;

    ensureIntroStyles();

    var html = document.documentElement;
    var body = document.body;
    var prehide = document.getElementById("gpUnifiedIntroPrehide");
    if (prehide) prehide.remove();

    var wrap = document.getElementById("introVideoWrap");
    var video = document.getElementById("introVideo");
    var createdWrap = false;

    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "gpAutoIntroOverlay";
      wrap.className = "intro-video-wrap";
      video = document.createElement("video");
      video.id = "introVideo";
      wrap.appendChild(video);
      document.body.appendChild(wrap);
      createdWrap = true;
    }

    if (!video) {
      video = document.createElement("video");
      video.id = "introVideo";
      wrap.appendChild(video);
    }

    video.preload = "auto";
    video.autoplay = true;
    video.controls = false;
    video.loop = false;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    var done = false;
    var hardTimeout = null;
    var candidateIndex = 0;

    function clearHardTimeout(){
      if (hardTimeout) {
        window.clearTimeout(hardTimeout);
        hardTimeout = null;
      }
    }

    function revealLesson(){
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

    function loadCandidate(index){
      var src = candidates[index] || "";
      if (!src) {
        revealLesson();
        return false;
      }
      try { video.pause(); } catch (_) {}
      try { video.removeAttribute("src"); } catch (_) {}
      video.src = src;
      try { video.load(); } catch (_) {}
      return true;
    }

    function tryNextCandidate(){
      candidateIndex += 1;
      if (!loadCandidate(candidateIndex)) return false;
      clearHardTimeout();
      hardTimeout = window.setTimeout(revealLesson, 4000);
      startPlayback(true);
      return true;
    }

    function startPlayback(withAudio){
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
      try { video.volume = 1; } catch (_) {}
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function(){
          if (withAudio) {
            try { video.pause(); } catch (_) {}
            try { video.currentTime = 0; } catch (_) {}
            startPlayback(false);
            return;
          }
          revealLesson();
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

    video.addEventListener("ended", revealLesson, { once: true });
    video.addEventListener("error", function(){
      if (done) return;
      if (tryNextCandidate()) return;
      revealLesson();
    });
    video.addEventListener("loadeddata", function(){
      if (!done && video.currentTime === 0) startPlayback(true);
    }, { once: true });
    video.addEventListener("canplay", function(){
      if (!done && video.currentTime === 0) startPlayback(true);
    }, { once: true });
    video.addEventListener("loadedmetadata", function(){
      clearHardTimeout();
      var seconds = Number(video.duration) || 0;
      var timeoutMs = Math.max(45000, Math.min(240000, Math.round((seconds + 8) * 1000)));
      hardTimeout = window.setTimeout(revealLesson, timeoutMs);
    }, { once: true });
    hardTimeout = window.setTimeout(revealLesson, 4000);

    loadCandidate(candidateIndex);
    startPlayback(true);
    window.addEventListener("load", function(){
      if (!done && video.currentTime === 0) startPlayback(true);
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAutoIntro, { once: true });
  } else {
    initAutoIntro();
  }
})();
