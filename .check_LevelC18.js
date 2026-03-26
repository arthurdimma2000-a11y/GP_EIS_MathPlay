
    const posterArea = document.getElementById('posterArea');
    const posterImg = posterArea.querySelector('.poster-img');
    const dotLayer = document.getElementById('dotLayer');
    const drawLayer = document.getElementById('drawLayer');
    const ctx = drawLayer.getContext('2d');
    const bubbleLeft = document.getElementById('bubbleLeft');
    const bubbleRight = document.getElementById('bubbleRight');
    const girlBtn = document.getElementById('girlBtn');
    const lineOne = document.getElementById('lineOne');
    const lineTwo = document.getElementById('lineTwo');
    const resetBtn = document.getElementById('resetBtn');
    const micIconBtn = document.getElementById('micIconBtn');
    const recordBtn = document.getElementById('recordBtn');
    const recordingPlayback = document.getElementById('recordingPlayback');
    const recordingStatus = document.getElementById('recordingStatus');
    const conversationStatus = document.getElementById('conversationStatus');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    let recorder = null;
    let recordedChunks = [];
    let isRecording = false;

    // Keep bubbles hidden until mic protocol reveals them.
    bubbleLeft.classList.remove('show');
    bubbleRight.classList.remove('show');

    const pairs = [
      { left:{x:0.378,y:0.332}, right:{x:0.676,y:0.332} },
      { left:{x:0.377,y:0.490}, right:{x:0.661,y:0.494} },
      { left:{x:0.374,y:0.645}, right:{x:0.666,y:0.645} },
      { left:{x:0.376,y:0.805}, right:{x:0.748,y:0.805} }
    ];

    const lines = [];
    const matchedPairIndexes = new Set();
    let matchCompleted = false;
    let drawing = null;

    function resize(){
      const imgRect = posterImg.getBoundingClientRect();
      const areaRect = posterArea.getBoundingClientRect();
      const width = imgRect.width || areaRect.width;
      const height = imgRect.height || areaRect.height;
      if(!width || !height){
        requestAnimationFrame(resize);
        return;
      }
      drawLayer.width = width;
      drawLayer.height = height;
      drawLayer.style.width = width + 'px';
      drawLayer.style.height = height + 'px';
      drawDots();
      redrawLines();
    }

    function drawDots(){
      dotLayer.innerHTML = '';
      const vbW = posterImg.naturalWidth || drawLayer.width || 1000;
      const vbH = posterImg.naturalHeight || drawLayer.height || 1400;
      dotLayer.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
      pairs.forEach(p => {
        const c1 = document.createElementNS('http://www.w3.org/2000/svg','circle');
        c1.setAttribute('cx', p.left.x * vbW);
        c1.setAttribute('cy', p.left.y * vbH);
          c1.setAttribute('r', 9);
        c1.setAttribute('fill', '#111');
        dotLayer.appendChild(c1);
        const c2 = document.createElementNS('http://www.w3.org/2000/svg','circle');
        c2.setAttribute('cx', p.right.x * vbW);
        c2.setAttribute('cy', p.right.y * vbH);
          c2.setAttribute('r', 9);
        c2.setAttribute('fill', '#111');
        dotLayer.appendChild(c2);
      });
    }

    function toCanvasPoint(pt){
      return { x: pt.x * drawLayer.width, y: pt.y * drawLayer.height };
    }

    function getNearDot(pos){
        const threshold = 46;
      for(let i=0;i<pairs.length;i++){
        const l = toCanvasPoint(pairs[i].left);
        const r = toCanvasPoint(pairs[i].right);
        if(Math.hypot(pos.x-l.x,pos.y-l.y) < threshold) return { side:'left', index:i, pt:l };
        if(Math.hypot(pos.x-r.x,pos.y-r.y) < threshold) return { side:'right', index:i, pt:r };
      }
      return null;
    }

    function redrawLines(){
      ctx.clearRect(0,0,drawLayer.width,drawLayer.height);
        ctx.lineWidth = 5;
      ctx.strokeStyle = '#2d2d2d';
      lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.a.x, line.a.y);
        ctx.lineTo(line.b.x, line.b.y);
        ctx.stroke();
      });
      if(drawing){
        ctx.beginPath();
        ctx.moveTo(drawing.a.x, drawing.a.y);
        ctx.lineTo(drawing.b.x, drawing.b.y);
        ctx.stroke();
      }
    }

    function speak(text){
      if(!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.05;
      u.volume = 1.0;
      window.speechSynthesis.speak(u);
    }

    async function reportMatchComplete(){
      if (matchCompleted) return;
      matchCompleted = true;
      try {
        const chime = new Audio("../../../../assets/audio/chimes/chime.mp3.mp3");
        chime.preload = "auto";
        chime.play().catch(() => {});
      } catch (_) {}
      speak("Amazing job!");
      if (typeof finishActivity === "function") {
        window.finishAndSave({
          pageId: "LevelC18",
          level: "C",
          activityType: "matching",
          score: 100,
          stars: 3,
          skills: { reading: 1, writing: 1, speaking: 0, listening: 1 }
        });
      }
    }

    function getEventPos(e){
      const rect = drawLayer.getBoundingClientRect();
      if(e.touches && e.touches[0]){
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function startDraw(e){
      e.preventDefault();
      const pos = getEventPos(e);
      const dot = getNearDot(pos);
      if(!dot) return;
      drawLayer.setPointerCapture?.(e.pointerId);
      drawing = { start: dot, a: dot.pt, b: dot.pt };
      redrawLines();
    }
    function moveDraw(e){
      if(!drawing) return;
      e.preventDefault();
      drawing.b = getEventPos(e);
      redrawLines();
    }
    function endDraw(e){
      if(!drawing) return;
      e.preventDefault();
      const pos = getEventPos(e);
      const dot = getNearDot(pos);
      if(dot && dot.side !== drawing.start.side && dot.index === drawing.start.index && !matchedPairIndexes.has(dot.index)){
        lines.push({ a: drawing.a, b: dot.pt });
        matchedPairIndexes.add(dot.index);
        if (typeof finishActivity === "function") {
          const score = Math.round((matchedPairIndexes.size / pairs.length) * 100);
          window.finishAndSave({
            pageId: "LevelC18",
            level: "C",
            activityType: "matching",
            score,
            stars: score >= 95 ? 3 : score >= 65 ? 2 : score > 0 ? 1 : 0,
            skills: { reading: 1, writing: 1, speaking: 0, listening: 1 }
          });
        }
          window.GPTracing?.playTraceTick?.({ force:true });
          speak('Correct!');
        if (matchedPairIndexes.size === pairs.length) {
          reportMatchComplete();
        }
      } else {
        speak('Oh no! try again.');
      }
      drawing = null;
      redrawLines();
    }

    const bindTarget = (el) => {
      el.addEventListener('pointerdown', startDraw);
      el.addEventListener('pointermove', moveDraw);
      el.addEventListener('pointerup', endDraw);
      el.addEventListener('pointerleave', endDraw);
      el.addEventListener('pointercancel', endDraw);
      el.addEventListener('mousedown', startDraw);
      el.addEventListener('mousemove', moveDraw);
      el.addEventListener('mouseup', endDraw);
      el.addEventListener('touchstart', startDraw, { passive:false });
      el.addEventListener('touchmove', moveDraw, { passive:false });
      el.addEventListener('touchend', endDraw, { passive:false });
    };
    bindTarget(drawLayer);
    bindTarget(posterArea);

    resetBtn.addEventListener('click', () => {
      lines.length = 0;
      matchedPairIndexes.clear();
      matchCompleted = false;
      drawing = null;
      redrawLines();
    });

    girlBtn.addEventListener('click', () => {
      typeLine(lineOne, "Making animals with a Tangram puzzle.", () => {});
      speak("Making animals with a Tangram puzzle.");
      setTimeout(() => {
        typeLine(lineTwo, "Connect the Tangram puzzle animal to the correct sentence.", () => {});
        speak("Connect the Tangram puzzle animal to the correct sentence.");
      }, 400);
    });

    function typeLine(el, text, done){
      el.textContent = '';
      let i = 0;
      el.classList.add('show');
      const step = () => {
        el.textContent = text.slice(0, i);
        i += 1;
        if(i <= text.length){
          setTimeout(step, 28);
        } else if (done) {
          done();
        }
      };
      step();
    }

    function showBubble(el, text){
        el.textContent = text;
        el.hidden = false;
        el.classList.add('show');
        speak(text);
      }

    function toggleRecord(){
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        recordingStatus.textContent = "Recording not supported in this browser.";
        return;
      }
      if(isRecording){
        recorder && recorder.stop();
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio:true })
        .then(stream => {
          recorder = new MediaRecorder(stream);
          recordedChunks = [];
          recorder.ondataavailable = e => {
            if(e.data && e.data.size > 0) recordedChunks.push(e.data);
          };
          recorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            recordingPlayback.src = URL.createObjectURL(blob);
            recordingStatus.textContent = "Recording ready.";
            stream.getTracks().forEach(t => t.stop());
            isRecording = false;
            recordBtn.textContent = "Practice Record";
          };
          recorder.start();
          isRecording = true;
          recordingStatus.textContent = "Recording...";
          recordBtn.textContent = "Stop Recording";
        })
        .catch(() => {
          recordingStatus.textContent = "Microphone permission denied.";
        });
    }

    // Mic click is handled by activity-standardizer unified protocol.

    recordBtn.addEventListener('click', toggleRecord);

    if(prevBtn) prevBtn.addEventListener('click', () => { window.location.href = '../tuesday/LevelC17.html'; });
    if(nextBtn) nextBtn.addEventListener('click', () => { window.location.href = 'LevelC19.html'; });

    resize();
    if(!posterImg.complete){
      posterImg.addEventListener('load', resize, { once:true });
    }
    window.addEventListener('load', resize);
    window.addEventListener('resize', resize);
  










  import { saveActivityResult, markLoginPing } from "../../../../progress-tracker.js";
  window.GPProgress.installTracker({
    saveActivityResult,
    markLoginPing,
    defaultPageId: "LevelC18",
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
