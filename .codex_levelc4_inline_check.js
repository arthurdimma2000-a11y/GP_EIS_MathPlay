

    const clearBtn = document.getElementById("clearBtn");

    const micIconBtn = document.getElementById("micIconBtn");

    const recordBtn = document.getElementById("recordBtn");

    const recordingPlayback = document.getElementById("recordingPlayback");

    const recordingStatus = document.getElementById("recordingStatus");

    const conversationStatus = document.getElementById("conversationStatus");

    const tapGirl = document.getElementById("tapGirl");

    const instructionLine = document.getElementById("instructionLine");

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

    let currentLineIndex = -1;

    let repeatNext = false;

    let recorder = null;

    let recordedChunks = [];

    let micExpectingRepeat = false;

    let micActive = false;

    const expectedLines = ["What is this?", "This is a Tangram puzzle."];

    const attempts = [0, 0];
    const answerInputs = [document.getElementById("answerTriangles"), document.getElementById("answerSquare"), document.getElementById("answerParallelogram")];

    const maxAttempts = 3;



    function hideAllLines(){

      lines.forEach(line => {

        line.classList.remove("show");

        line.hidden = true;

      });

    }



    function speakLine(text, onend){

      if (!("speechSynthesis" in window)) { if (onend) onend(); return; }

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

          if (repeatResults[currentLineIndex]) repeatResults[currentLineIndex].textContent = expectedText;

          setConversationStatus("");



          if (!isLastLine && currentLineIndex + 1 < lines.length) {

            currentLineIndex += 1;

            showAndSpeakLine(currentLineIndex);

            micExpectingRepeat = true;

          }

          if (isLastLine) {

            const chime = new Audio("../../../../assets/audio/chimes/chime.mp3.mp3");
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



    function showAndSpeakLine(index){

      if (index < 0 || index >= lines.length) return;

      const line = lines[index];

      line.hidden = false;

      line.classList.add("show");

      currentLineIndex = index;

      const bubble = line.querySelector(".bubble");

      if (bubble) speakLine(bubble.textContent || "");

    }



    function revealSequence(){

      const linesToShow = [

        { el: instructionLine, speech: "Write the number of pieces in a Tangram puzzle." },

        { el: qaLines[0], speech: "How many triangles are there?" },

        { el: qaLines[1], speech: "There are 5 triangles." },

        { el: qaLines[2], speech: "How many squares are there?" },

        { el: qaLines[3], speech: "There is 1 square." },

        { el: qaLines[4], speech: "How many parallelograms are there?" },

        { el: qaLines[5], speech: "There is 1 parallelogram." }

      ];

      let index = 0;

      const step = () => {

        const item = linesToShow[index];

        if (!item) return;

        if (item.el) item.el.classList.add("show");
        if (item.el && item.el.id === "qa2" && answerInputs[0]) setTimeout(() => answerInputs[0].focus(), 150);
        if (item.el && item.el.id === "qa4" && answerInputs[1]) setTimeout(() => answerInputs[1].focus(), 150);
        if (item.el && item.el.id === "qa6" && answerInputs[2]) setTimeout(() => answerInputs[2].focus(), 150);

        speakLine(item.speech, () => {

          setTimeout(() => { index += 1; step(); }, 500);

        });

      };

      step();

    }



    // init hidden
    hideAllLines();


    function setRecordLabel(text){

      recordBtn.innerHTML =

        '<svg class="record-icon" viewBox="0 0 64 64" aria-hidden="true">' +

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

          audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true }

        });

        recordedChunks = [];

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")

          ? "audio/webm;codecs=opus"

          : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "");

        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };

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



    if (clearBtn) clearBtn.addEventListener("click", clearConversation);



      async function handleMicProtocolClick(){
        if (window.GPTracing?.prepareMicSupport) {
          try { await window.GPTracing.prepareMicSupport(); } catch (_e) {}
        }
        if (micActive) return;
        if (currentLineIndex === -1) {
          showAndSpeakLine(0);
          micExpectingRepeat = true;
          return;
        }
        if (micExpectingRepeat && currentLineIndex >= 0) {
          listenForRepeat(expectedLines[currentLineIndex] || "");
          return;
        }
        showAndSpeakLine(currentLineIndex);
        micExpectingRepeat = true;
      }

      if (tapGirl) tapGirl.addEventListener("click", revealSequence);

    recordBtn.addEventListener("click", toggleRecord);

    nextBtn.addEventListener("click", () => { window.location.href = "LevelC5.html"; });
    prevBtn.addEventListener("click", () => { window.location.href = "../monday/LevelC3.html"; });
  



    (function(){

      const homeBtn = document.querySelector('.home-btn');

      if(!homeBtn) return;

      const chime = new Audio("../../../../assets/audio/chimes/chime.mp3.mp3");
      chime.preload = "auto";

      homeBtn.addEventListener('click', () => {

        try{

          chime.currentTime = 0;

          const p = chime.play();

          if (p && typeof p.catch === "function") p.catch(() => {});

        }catch(e){}

      });

    })();

  