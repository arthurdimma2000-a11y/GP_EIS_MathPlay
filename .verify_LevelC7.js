
    const clearBtn = document.getElementById("clearBtn");
    const micIconBtn = document.getElementById("micIconBtn");
    const recordBtn = document.getElementById("recordBtn");
    const recordingPlayback = document.getElementById("recordingPlayback");
    const recordingStatus = document.getElementById("recordingStatus");
    const conversationStatus = document.getElementById("conversationStatus");
    const tapGirl = document.getElementById("tapGirl");
    const plateAnswer = document.getElementById("plateAnswer");
    const instructionLine = document.getElementById("instructionLine");
    const bubbleLine1 = document.getElementById("bubbleLine1");
    const bubbleLine2 = document.getElementById("bubbleLine2");
    const line1El = document.querySelector(".line1");
    const qaLines = [
      document.getElementById("qa1"),
      document.getElementById("qa2"),
      document.getElementById("qa3"),
      document.getElementById("qa4"),
      document.getElementById("qa5"),
      document.getElementById("qa6")
    ];
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");
    const lines = Array.from(document.querySelectorAll(".convo-line"));
    const repeatResults = Array.from(document.querySelectorAll(".repeat-result"));
    const starRows = Array.from(document.querySelectorAll(".star-row"));
    let readToken = 0;
    let currentLineIndex = -1;
    let repeatNext = false;
    let recorder = null;
    let recordedChunks = [];
    let micExpectingRepeat = false;
    let micActive = false;
    const expectedLines = ["Find the mistake and circle it."];
      const attempts = [0];
    const maxAttempts = 3;

    function hideAllLines(){
      lines.forEach(line => {
        line.classList.remove("show");
        line.hidden = true;
      });
    }

    function speakLine(text, onend){
      if (!("speechSynthesis" in window)) {
        if (onend) onend();
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 1.1;
      utter.onend = () => { if (onend) onend(); };
      utter.onerror = () => { if (onend) onend(); };
      window.speechSynthesis.speak(utter);
    }

    function highlightLine(index, on){
      const line = lines[index];
      if (!line) return;
      const bubble = line.querySelector(".bubble");
      if (!bubble) return;
      bubble.classList.toggle("sparkle", on);
    }

    function normalizeSpeech(text){
      return (text || "")
        .toLowerCase()
        .replace(/[^\w\s]|_/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function setStars(index, count){
      const row = starRows[index];
      if (!row) return;
      row.innerHTML = new Array(count).fill("&#9733;").join("");
    }

    function setConversationStatus(text){
      if (!conversationStatus) return;
      conversationStatus.textContent = text || "";
    }

    function clearConversation(){
      hideAllLines();
      currentLineIndex = -1;
      repeatNext = false;
      micExpectingRepeat = false;
      attempts[0] = 0;
      attempts[1] = 0;
      repeatResults.forEach(el => { if (el) el.textContent = ""; });
      starRows.forEach(el => { if (el) el.textContent = ""; });
      lines.forEach(line => {
        const bubble = line.querySelector(".bubble");
        if (bubble) bubble.classList.remove("sparkle");
      });
      setConversationStatus("");
    }

    function listenForRepeat(expectedText){
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        speakLine("Sorry, try again!");
        setConversationStatus("Sorry, try again!");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const said = event.results[0][0].transcript;
        const expected = normalizeSpeech(expectedText);
        const actual = normalizeSpeech(said);
        const isLastLine = currentLineIndex === lines.length - 1;
        attempts[currentLineIndex] += 1;
        if (actual === expected) {
          highlightLine(currentLineIndex, false);
          micExpectingRepeat = false;
          const attemptCount = attempts[currentLineIndex];
          const stars = attemptCount === 1 ? 3 : (attemptCount <= 3 ? 2 : 1);
          setStars(currentLineIndex, stars);
          if (repeatResults[currentLineIndex]) {
            repeatResults[currentLineIndex].textContent = expectedText;
          }
          setConversationStatus("");
          if (!isLastLine && currentLineIndex + 1 < lines.length) {
            currentLineIndex += 1;
            showAndSpeakLine(currentLineIndex);
            micExpectingRepeat = true;
          }
          if (isLastLine) {
            const chime = new Audio("chime.mp3.mp3");
            chime.preload = "auto";
            chime.play().catch(() => {});
            speakLine("Amazing Job!");
            setConversationStatus("Amazing Job!");
          }
        } else {
          if (attempts[currentLineIndex] >= maxAttempts) {
            speakLine("Sorry, Study hard!");
            setConversationStatus("Sorry, Study hard!");
            micExpectingRepeat = false;
            highlightLine(currentLineIndex, false);
            return;
          }
          speakLine("Sorry, try again!");
          setConversationStatus("Sorry, try again!");
        }
      };
      recognition.onerror = () => {
        speakLine("Sorry, try again!");
        setConversationStatus("Sorry, try again!");
      };
      recognition.start();
    }

    function stopSpeaking(){
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      readToken += 1;
      hideAllLines();
    }

    function showAndSpeakLine(index){
      if (index < 0 || index >= lines.length) return;
      const line = lines[index];
      line.hidden = false;
      line.classList.add("show");
      currentLineIndex = index;
      const bubble = line.querySelector(".bubble");
      if (bubble) speakLine(bubble.textContent || "");
    }

    function typeText(text, el, onDone){
      if (!el) return;
      let idx = 0;
      const tick = () => {
        const slice = text.slice(0, idx);
        el.innerHTML = slice.replace(/\n/g, "<br>");
        idx += 1;
        if (idx <= text.length) {
          setTimeout(tick, 45);
        } else if (onDone) {
          onDone();
        }
      };
      tick();
    }

    function showTapGirlMessage(){
      const plainText = "The brownies have 4 sides and the muffins have 5 sides.";
      if (plateAnswer) {
        plateAnswer.classList.add("show");
        plateAnswer.textContent = "";
      }
      const chime = new Audio("chime.mp3.mp3");
      chime.preload = "auto";
      chime.play().catch(() => {});
      speakLine(plainText);
      typeText(plainText, plateAnswer, () => {
        if (!plateAnswer) return;
        plateAnswer.innerHTML = plainText
          .replace("4 sides", '<span class="highlight-red-global">4 sides</span>')
          .replace("5 sides", '<span class="highlight-red-global">5 sides</span>');
      });
    }

    function readAllLines(){
      if (currentLineIndex === -1) {
        hideAllLines();
        readToken += 1;
        currentLineIndex = 0;
        repeatNext = true;
        showAndSpeakLine(currentLineIndex);
        return;
      }

      if (repeatNext) {
        showAndSpeakLine(currentLineIndex);
        repeatNext = false;
        return;
      }

      if (currentLineIndex + 1 < lines.length) {
        currentLineIndex += 1;
        repeatNext = true;
        showAndSpeakLine(currentLineIndex);
      }
    }

    // init hidden
    hideAllLines();


    function setRecordLabel(text){
      recordBtn.innerHTML = '<svg class="record-icon" viewBox="0 0 64 64" aria-hidden="true">' +
        '<path d="M32 40c6.6 0 12-5.4 12-12V18c0-6.6-5.4-12-12-12S20 11.4 20 18v10c0 6.6 5.4 12 12 12Z" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M14 28c0 9.9 8.1 18 18 18s18-8.1 18-18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M32 46v10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M24 56h16" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' +
        '</svg> ' + text;
    }

    async function toggleRecord(){
      if (recorder && recorder.state === "recording") {
        recorder.stop();
        setRecordLabel("Record");
        if (recordingStatus) recordingStatus.textContent = "Saved recording.";
        return;
      }
      try{
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (recordingStatus) recordingStatus.textContent = "Microphone not available in this browser.";
          return;
        }
        if (!window.MediaRecorder) {
          if (recordingStatus) recordingStatus.textContent = "Recording not supported on this device.";
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        recordedChunks = [];
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "");
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunks.push(e.data);
        };
        recorder.onstop = () => {
          const type = recorder.mimeType || "audio/webm";
          const blob = new Blob(recordedChunks, { type });
          recordingPlayback.src = URL.createObjectURL(blob);
          recordingPlayback.muted = false;
          recordingPlayback.volume = 1;
          recordingPlayback.load();
          stream.getTracks().forEach(t => t.stop());
        };
        recorder.start();
        setRecordLabel("Stop recording");
        if (recordingStatus) recordingStatus.textContent = "Recording... speak clearly.";
      }catch(e){
        setRecordLabel("Record");
        if (recordingStatus) recordingStatus.textContent = "Microphone permission denied.";
      }
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", clearConversation);
    }
    // Mic click is handled by activity-standardizer unified protocol.
    if (tapGirl) tapGirl.addEventListener("click", showTapGirlMessage);
    recordBtn.addEventListener("click", toggleRecord);
      nextBtn.addEventListener("click", () => {
      window.location.href = "../../week-2/monday/LevelC8.html";
      });
    prevBtn.addEventListener("click", () => {
      window.location.href = "LevelC6.html";
    });
  


  (function(){
    const homeBtn = document.querySelector('.home-btn');
    if(!homeBtn) return;
    const chime = new Audio("chime.mp3.mp3");
    chime.preload = "auto";
    homeBtn.addEventListener('click', () => {
      try{
        chime.currentTime = 0;
        const p = chime.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }catch(e){}
    });
  })();











  if (window.GPPageTools) {
    GPPageTools.initSelectable({
      targetsSelector: ".mistake-hit",
      pageId: "LevelC7",
      level: "C",
      activityType: "selection",
      successMessage: "Amazing job! You found the mistake.",
      correctMessage: "Great job!",
      wrongMessage: "Try again!",
      selectedClass: "found",
      wrongClass: "wrong",
      skills: { reading: 1, writing: 0, speaking: 0, listening: 1 }
    });
  }

  window.addEventListener("load", () => {
    if (!window.GPTrack) return;
    const pageFile = ((location.pathname || "").split("/").pop() || "").replace(/\.html$/i, "");
    GPTrack.start(pageFile || document.title || "Activity");
  });

  async function finishActivity(overrides = {}){
    if (!window.GPTrack) return;
    const pageFile = ((location.pathname || "").split("/").pop() || "").replace(/\.html$/i, "");
    const inferredLevel = (/^(LA|LevelA|Level_A)/i.test(pageFile))
      ? "A"
      : (/^(LB|LevelB)/i.test(pageFile))
        ? "B"
        : (/^(LC|LevelC)/i.test(pageFile))
          ? "C"
          : null;

    await GPTrack.finish({
      pageId: pageFile || document.title || "Activity",
      level: inferredLevel,
      activityType: "activity",
      score: null,
      stars: 0,
      skills: { reading: 0, writing: 0, speaking: 0, listening: 0 },
      ...overrides
    });
  }
