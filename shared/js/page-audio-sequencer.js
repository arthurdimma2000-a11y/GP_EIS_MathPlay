(() => {
  "use strict";

  function createAudioElement(src, volume) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = volume;
    return audio;
  }

  function createPageAudioSequencer(options = {}) {
    const tracks = Array.isArray(options.tracks) ? options.tracks.filter(Boolean) : [];
    const loopPlaylist = options.loopPlaylist !== false;
    const defaultVolume = Number.isFinite(options.volume) ? options.volume : 0.14;

    let currentIndex = 0;
    let currentAudio = null;
    let stopped = false;
    let started = false;

    function detachAudio(audio) {
      if (!audio) return;
      audio.onended = null;
      audio.onerror = null;
    }

    function stop() {
      stopped = true;
      started = false;
      if (currentAudio) {
        detachAudio(currentAudio);
        try { currentAudio.pause(); } catch (_) {}
        try { currentAudio.currentTime = 0; } catch (_) {}
      }
      currentAudio = null;
    }

    function setVolume(nextVolume) {
      const safeVolume = Math.max(0, Math.min(1, Number(nextVolume)));
      if (!Number.isFinite(safeVolume)) return;
      if (currentAudio) currentAudio.volume = safeVolume;
    }

    function playTrack(index) {
      if (stopped || !tracks.length) return;

      const safeIndex = ((index % tracks.length) + tracks.length) % tracks.length;
      currentIndex = safeIndex;

      if (currentAudio) {
        detachAudio(currentAudio);
        try { currentAudio.pause(); } catch (_) {}
        currentAudio = null;
      }

      const audio = createAudioElement(tracks[safeIndex], defaultVolume);
      currentAudio = audio;

      audio.onended = () => {
        if (stopped) return;
        const nextIndex = safeIndex + 1;
        if (nextIndex < tracks.length) {
          playTrack(nextIndex);
          return;
        }
        if (loopPlaylist) {
          playTrack(0);
        } else {
          stop();
        }
      };

      audio.onerror = () => {
        if (stopped) return;
        const nextIndex = safeIndex + 1;
        if (nextIndex < tracks.length) {
          playTrack(nextIndex);
          return;
        }
        if (loopPlaylist) {
          playTrack(0);
        } else {
          stop();
        }
      };

      const playAttempt = audio.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.then(() => {
          started = true;
        }).catch(() => {
          if (currentAudio === audio) {
            detachAudio(audio);
            currentAudio = null;
          }
          started = false;
        });
      } else {
        started = true;
      }
    }

    function start() {
      if (!tracks.length) return;
      stopped = false;
      playTrack(currentIndex);
    }

    return {
      start,
      stop,
      setVolume,
      isStarted() {
        return started;
      }
    };
  }

  window.GPPageAudioSequencer = {
    create: createPageAudioSequencer
  };
})();
