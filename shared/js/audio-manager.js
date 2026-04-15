(function(){
  if (window.GPAudio) return;

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

  let currentBgmKey = null;
  let bgmAudio = null;

  function createAudio(src, { loop = false, volume = 1 } = {}){
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.loop = loop;
    audio.volume = volume;
    return audio;
  }

  function stopBgm(){
    if (!bgmAudio) return;
    try{
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
    }catch(_err){}
    bgmAudio = null;
    currentBgmKey = null;
  }

  async function playBgm(key, volume = 0.35){
    const src = AUDIO_PATHS[key];
    if (!src) return null;

    if (currentBgmKey === key && bgmAudio) {
      bgmAudio.volume = volume;
      return bgmAudio;
    }

    stopBgm();
    bgmAudio = createAudio(src, { loop:true, volume });
    currentBgmKey = key;

    try{
      await bgmAudio.play();
    }catch(_err){}

    return bgmAudio;
  }

  async function playSfx(key, volume = 0.7){
    const src = AUDIO_PATHS[key];
    if (!src) return null;
    const audio = createAudio(src, { volume });
    try{
      await audio.play();
    }catch(_err){}
    return audio;
  }

  function setBgmVolume(volume = 0.35){
    if (!bgmAudio) return;
    bgmAudio.volume = volume;
  }

  window.GPAudio = {
    paths: AUDIO_PATHS,
    playBgm,
    stopBgm,
    setBgmVolume,
    playSfx,
    getCurrentBgm(){
      return currentBgmKey;
    }
  };
})();
