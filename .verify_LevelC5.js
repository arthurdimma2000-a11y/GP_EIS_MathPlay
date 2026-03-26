
    const clearBtn = document.getElementById("clearBtn");
    const micIconBtn = document.getElementById("micIconBtn");
    const recordBtn = document.getElementById("recordBtn");
    const recordingPlayback = document.getElementById("recordingPlayback");
    const recordingStatus = document.getElementById("recordingStatus");
    const conversationStatus = document.getElementById("conversationStatus");
    const tapGirl = document.getElementById("tapGirl");
    const instructionLine = document.getElementById("instructionLine");
    const externalInstruction = document.getElementById("externalInstruction");
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
    const matchLines = document.getElementById("matchLines");
    const matchHits = Array.from(document.querySelectorAll(".match-hit"));
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
    const expectedLines = ["Count the pieces.", "Match the names."];
    const attempts = [0, 0];
    const maxAttempts = 3;
    const matchMap = [1, 0, 4, 2, 3];
    let matchStart = null;
    const matchedIndices = new Set();

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

    function clearMatching(){
      matchStart = null;
      matchedIndices.clear();
      matchHits.forEach(hit => hit.classList.remove("active", "done"));
      if (matchLines) matchLines.innerHTML = "";
    }

    function drawMatchLine(startBtn, endBtn){
      if (!matchLines) return;
      const x1 = parseFloat(startBtn.style.left);
      const y1 = parseFloat(startBtn.style.top);
      const x2 = parseFloat(endBtn.style.left);
      const y2 = parseFloat(endBtn.style.top);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", "#2f9f5f");
      line.setAttribute("stroke-width", "1.15");
      line.setAttribute("stroke-linecap", "round");
      matchLines.appendChild(line);
    }

    function handleMatchSelection(hit){
      const side = hit.dataset.side;
      const index = Number(hit.dataset.index);
      if (side === "left") {
        if (matchedIndices.has(index)) return;
        matchHits.forEach((btn) => btn.classList.remove("active"));
        matchStart = index;
        hit.classList.add("active");
        return;
      }
      if (matchStart === null || matchedIndices.has(matchStart)) return;
      const leftBtn = matchHits.find((btn) => btn.dataset.side === "left" && Number(btn.dataset.index) === matchStart);
      if (!leftBtn) {
        matchStart = null;
        return;
      }
      if (matchMap[matchStart] === index) {
        drawMatchLine(leftBtn, hit);
        leftBtn.classList.remove("active");
        leftBtn.classList.add("done");
        hit.classList.add("done");
        matchedIndices.add(matchStart);
        speakLine("Correct!");
        setConversationStatus("Correct!");
        if (matchedIndices.size === matchMap.length) {
          completeMatching();
        }
      } else {
        speakLine("Try again!");
        setConversationStatus("Try again!");
        matchHits.forEach((btn) => btn.classList.remove("active"));
      }
      matchStart = null;
    }

    async function completeMatching(){
      try {
        const chime = new Audio("../../../../assets/audio/chimes/chime.mp3.mp3");
        chime.preload = "auto";
        chime.play().catch(() => {});
      } catch (_) {}
      speakLine("Amazing job!");
      setConversationStatus("Amazing job!");
      if (window.GPTrack?.realtime) {
        try {
          await window.GPTrack.realtime({
            pageId: "LevelC5",
            level: "C",
            activityType: "matching",
            score: 100,
            stars: 3,
            skills: { reading: 1, writing: 1, speaking: 0, listening: 1 }
          });
        } catch (_) {}
      }
      if (typeof finishActivity === "function") {
        window.finishAndSave({
          pageId: "LevelC5",
          level: "C",
          activityType: "matching",
          score: 100,
          stars: 3,
          skills: { reading: 1, writing: 1, speaking: 0, listening: 1 }
        });
      }
    }

    function clearConversation(){
      hideAllLines();
      clearMatching();
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
          setTimeout(tick, 18);
        } else if (onDone) {
          onDone();
        }
      };
      tick();
    }

    function showTapGirlMessage(){
      const firstText = "Count the total number of triangles, squares, and parallelograms\nin the following tangram puzzle shapes.";
      const secondText = "In Tangram, you must use all seven pieces. That’s the rule. Don’t forget!";
      if (externalInstruction) {
        externalInstruction.innerHTML = "";
        externalInstruction.classList.add("show");
      }
      if (bubbleLine1) {
        bubbleLine1.textContent = "";
        bubbleLine1.style.color = "#1d5fd6";
      }
      if (bubbleLine2) bubbleLine2.textContent = "";
      typeText(firstText, externalInstruction, () => {});
      speakLine(firstText, () => {
        if (line1El) line1El.classList.add("show");
        typeText(secondText, bubbleLine1, () => {});
        speakLine(secondText);
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

    matchHits.forEach((hit) => {
      ["click", "pointerup", "touchend"].forEach((eventName) => {
        hit.addEventListener(eventName, (event) => {
          event.preventDefault();
          handleMatchSelection(hit);
        }, { passive: false });
      });
    });


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
      window.location.href = "../wednesday/LevelC6.html";
    });
    prevBtn.addEventListener("click", () => {
      window.location.href = "LevelC4.html";
    });
  


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











  import { saveActivityResult, markLoginPing } from "../../../../progress-tracker.js";
  window.GPProgress.installTracker({
    saveActivityResult,
    markLoginPing,
    defaultPageId: "LevelC5",
    defaultLevel: "C",
    defaultActivityType: "lesson",
    defaultScore: 100,
    defaultStars: 1,
    defaultSkills: {
      reading: 1,
      writing: 0,
      speaking: 1,
      listening: 1
    }
  });

  function getStudentSession(){
    try{
      return JSON.parse(localStorage.getItem("GP_EIS_STUDENT_SESSION") || "null");
    }catch(e){
      return null;
    }
  }

  function inferProgressMeta(payload){
    const pageId = String((payload && payload.pageId) || ((location.pathname || "").split("/").pop() || "Activity").replace(/\.html$/i, ""));
    const file = (payload && (payload.file || payload.fileName)) || (pageId + ".html");
    const level = (payload && payload.level)
      || (/^(LA|LevelA|Level_A)/i.test(pageId) ? "A" : (/^(LB|LevelB|Level_B)/i.test(pageId) ? "B" : (/^(LC|LevelC|Level_C)/i.test(pageId) ? "C" : "A")));
    const weekMatch = String(location.pathname || "").match(/week-(\d+)/i);
    const inferredWeek = weekMatch ? Number(weekMatch[1]) : 1;
    const week = payload && payload.week != null ? Number(payload.week) : inferredWeek;
    const month = payload && payload.month != null ? Number(payload.month) : 1;
    return {
      pageId,
      file,
      level,
      week: Number.isFinite(week) && week > 0 ? week : 1,
      month: Number.isFinite(month) && month > 0 ? month : 1
    };
  }

  function getActivityStore(){
    try{
      return JSON.parse(localStorage.getItem("GP_EIS_ACTIVITY_RESULTS") || "{}");
    }catch(e){
      return {};
    }
  }

  function setActivityStore(store){
    try{
      localStorage.setItem("GP_EIS_ACTIVITY_RESULTS", JSON.stringify(store || {}));
    }catch(e){}
  }

  function saveLocalActivityFallback(payload){
    const session = getStudentSession() || {};
    const meta = inferProgressMeta(payload || {});
    const score = payload && typeof payload.score === "number" ? payload.score : 0;
    const stars = payload && typeof payload.stars === "number" ? payload.stars : 0;
    const tracing = payload && typeof payload.tracing === "number"
      ? payload.tracing
      : (payload && typeof payload.progress === "number" ? payload.progress : 0);
    const type = (payload && payload.type) || (payload && payload.activityType) || "lesson";
    const entry = {
      pageId: meta.pageId,
      file: meta.file,
      level: meta.level,
      type,
      activityType: (payload && payload.activityType) || type,
      score,
      stars,
      skills: payload && payload.skills ? payload.skills : {},
      completed: payload && typeof payload.completed === "boolean" ? payload.completed : true,
      tracing,
      week: meta.week,
      month: meta.month,
      classId: (payload && payload.classId) || session.classId || null,
      studentId: (payload && payload.studentId) || session.studentId || null,
      studentName: (payload && payload.studentName) || session.studentName || session.displayName || session.name || session.fullName || null,
      savedAt: new Date().toISOString(),
      ts: Date.now()
    };
    const store = getActivityStore();
    store[meta.pageId] = {
      ...(store[meta.pageId] || {}),
      ...entry
    };
    setActivityStore(store);
    try{
      localStorage.setItem("GP_EIS_LAST_FILE", meta.file);
    }catch(e){}
    return store[meta.pageId];
  }

  async function finishAndSave(payload){
    const session = getStudentSession() || {};
    const fullPayload = {
      ...(payload || {}),
      classId: (payload && payload.classId) || session.classId || null,
      studentId: (payload && payload.studentId) || session.studentId || null,
      studentName: (payload && payload.studentName) || session.studentName || session.displayName || session.name || session.fullName || null
    };
  
    saveLocalActivityFallback(fullPayload);
  
    if (typeof window.finishActivity === "function") {
      try{
        await window.finishActivity(fullPayload);
      }catch(err){
        console.warn("finishActivity failed, local fallback already saved:", err);
      }
    }
  
    return fullPayload;
  }

  window.finishAndSave = finishAndSave;
