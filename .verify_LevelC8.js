
  const posterArea = document.getElementById('posterArea');
  const posterImg = posterArea.querySelector('.poster-img');
  const dotLayer = document.getElementById('dotLayer');
  const drawLayer = document.getElementById('drawLayer');
  const statusLine = document.getElementById('statusLine');
  const ctx = drawLayer.getContext('2d');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const clearBtn = document.getElementById('clearBtn');
  const tapGirl = document.getElementById('tapGirl');
  const revealNote = document.getElementById('revealNote');
  const micIconBtn = document.getElementById('micIconBtn');
  const conversationStatus = document.getElementById('conversationStatus');
  const lines = Array.from(document.querySelectorAll('.convo-line'));
  const expectedLines = ["Let’s eat brownies together.", "Let’s eat muffins together."];

    const introLines = [
      "Let’s eat brownies together.",
      "Let’s eat muffins together."
    ];

  function speak(text){
    if(!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.05;
    u.volume = 1.0;
    window.speechSynthesis.speak(u);
  }

  function speakIntro(){
    let i = 0;
    const next = () => {
      if(i >= introLines.length) return;
      speak(introLines[i]);
      i += 1;
      setTimeout(next, 1200);
    };
    next();
  }

  if (tapGirl && revealNote) {
    tapGirl.addEventListener('click', () => {
      revealNote.classList.add('show');
      setTimeout(() => revealNote.classList.remove('show'), 2200);
    });
  }

  // Poster-aligned guide dots for three quadrangles and three pentagons.
    const quadrangles = [
      { id:'q1', row:0, points:[[0.14,0.24],[0.34,0.24],[0.38,0.38],[0.18,0.38]] },
      { id:'q2', row:1, points:[[0.14,0.48],[0.34,0.48],[0.38,0.62],[0.18,0.62]] },
      { id:'q3', row:2, points:[[0.14,0.72],[0.34,0.72],[0.38,0.86],[0.18,0.86]] }
    ];
    const pentagons = [
      { id:'p1', row:0, points:[[0.66,0.24],[0.80,0.24],[0.86,0.33],[0.73,0.42],[0.60,0.33]] },
      { id:'p2', row:1, points:[[0.66,0.48],[0.80,0.48],[0.86,0.57],[0.73,0.66],[0.60,0.57]] },
      { id:'p3', row:2, points:[[0.66,0.72],[0.80,0.72],[0.86,0.81],[0.73,0.90],[0.60,0.81]] }
    ];

  const shapes = [...quadrangles, ...pentagons];
  const samples = new Map();
  const visited = new Map();
  const completed = new Set();
  const rowCompleted = [false,false,false];
  const rowMessages = ["Amazing Job!","Thumps up!","Wow! you are super smart!"];
  let lastTraceSound = 0;

  function playTraceTick(){
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(!AudioCtx) return;
      const a = new AudioCtx();
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(a.destination);
      osc.start();
      osc.stop(a.currentTime + 0.05);
      osc.onended = () => a.close();
    }catch(e){}
  }

  function redrawDots(){
    dotLayer.innerHTML = '';
    shapes.forEach(shape => {
      const color = shape.id.startsWith('q') ? '#d62c2c' : '#1d76c9';
      const pts = shape.points.map(p => `${p[0]*1000},${p[1]*1400}`).join(' ');
      const poly = document.createElementNS('http://www.w3.org/2000/svg','polyline');
      poly.setAttribute('points', pts + ' ' + pts.split(' ')[0]);
      poly.setAttribute('fill','none');
      poly.setAttribute('stroke','rgba(200,200,200,0.7)');
      poly.setAttribute('stroke-width','3');
      poly.setAttribute('stroke-dasharray','10 8');
      dotLayer.appendChild(poly);
      shape.points.forEach(p => {
        const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
        c.setAttribute('cx', p[0]*1000);
        c.setAttribute('cy', p[1]*1400);
        c.setAttribute('r', 10);
        c.setAttribute('fill', color);
        dotLayer.appendChild(c);
      });
    });
  }

  function toCanvasPoint(pt){
    return { x: pt[0] * drawLayer.width, y: pt[1] * drawLayer.height };
  }

  function buildSamples(){
    samples.clear();
    visited.clear();
    completed.clear();
    shapes.forEach(shape => {
      const pts = shape.points.map(p => toCanvasPoint(p));
        const spacing = 10;
      const s = [];
      for(let i=0;i<pts.length;i++){
        const a = pts[i];
        const b = pts[(i+1)%pts.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx,dy);
        const steps = Math.max(1, Math.ceil(dist/spacing));
        for(let k=0;k<=steps;k++){
          s.push({ x: a.x + (dx*k/steps), y: a.y + (dy*k/steps) });
        }
      }
      samples.set(shape.id, s);
      visited.set(shape.id, new Array(s.length).fill(false));
    });
  }

  function updateVisited(pos){
      const threshold = 34;
      const thr2 = threshold * threshold;
    shapes.forEach(shape => {
      if(completed.has(shape.id)) return;
      const s = samples.get(shape.id) || [];
      const v = visited.get(shape.id) || [];
      let changed = false;
      for(let i=0;i<s.length;i++){
        if(v[i]) continue;
        const dx = pos.x - s[i].x;
        const dy = pos.y - s[i].y;
        if(dx*dx + dy*dy <= thr2){ v[i]=true; changed=true; }
      }
      if(changed){
        const pct = Math.round((v.filter(Boolean).length / s.length) * 100);
        if(pct >= 90){ completed.add(shape.id); }
      }
    });

    for(let row=0; row<3; row++){
      const qId = `q${row+1}`;
      const pId = `p${row+1}`;
      if(!rowCompleted[row] && completed.has(qId) && completed.has(pId)){
        rowCompleted[row] = true;
        const msg = rowMessages[row];
        statusLine.textContent = msg;
        speak(msg);
      }
      if (typeof window.finishAndSave === 'function') {
        const score = Math.round((completed.size / shapes.length) * 100);
        window.finishAndSave({
          pageId:'LevelC8',
          level:'C',
          activityType:'tracing',
          score,
          tracing:score,
          stars: score >= 95 ? 3 : score >= 65 ? 2 : score > 0 ? 1 : 0,
          skills:{ reading:1, writing:1, speaking:0, listening:1 }
        });
      }
    }
  }

  let drawing = false;
  function getEventPos(e){
    const rect = drawLayer.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function startDraw(e){
    e.preventDefault();
    drawing = true;
    const pos = getEventPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x,pos.y);
    updateVisited(pos);
  }
  function moveDraw(e){
    if(!drawing) return;
    e.preventDefault();
    const pos = getEventPos(e);
    ctx.lineTo(pos.x,pos.y);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff4d4d';
    ctx.stroke();
    updateVisited(pos);
    const now = performance.now();
    if(now - lastTraceSound > 120){ lastTraceSound = now; playTraceTick(); }
  }
  function endDraw(e){
    if(!drawing) return;
    e && e.preventDefault();
    drawing = false;
  }
  drawLayer.addEventListener('pointerdown', startDraw);
  drawLayer.addEventListener('pointermove', moveDraw);
  drawLayer.addEventListener('pointerup', endDraw);
  drawLayer.addEventListener('pointerleave', endDraw);
  drawLayer.addEventListener('pointercancel', endDraw);
  drawLayer.addEventListener('mousedown', startDraw);
  drawLayer.addEventListener('mousemove', moveDraw);
  drawLayer.addEventListener('mouseup', endDraw);
  drawLayer.addEventListener('touchstart', startDraw, { passive:false });
  drawLayer.addEventListener('touchmove', moveDraw, { passive:false });
  drawLayer.addEventListener('touchend', endDraw);

    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0,0,drawLayer.width,drawLayer.height);
      rowCompleted.fill(false);
      statusLine.textContent = '';
      buildSamples();
      if (typeof window.finishAndSave === 'function') {
        window.finishAndSave({
          pageId:'LevelC8',
          level:'C',
          activityType:'tracing',
          score:0,
          tracing:0,
          stars:0,
          skills:{ reading:1, writing:1, speaking:0, listening:1 }
        });
      }
    });
  if (prevBtn) prevBtn.addEventListener('click', () => { window.location.href = '../../week-1/friday/LevelC_Quiz1.html'; });
  if (nextBtn) nextBtn.addEventListener('click', () => { window.location.href = 'LevelC9.html'; });

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
    ctx.clearRect(0,0,drawLayer.width,drawLayer.height);
    redrawDots();
    buildSamples();
  }

  resize();
  if (posterImg && !posterImg.complete) {
    posterImg.addEventListener('load', resize, { once:true });
  }
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(resize);
    ro.observe(posterArea);
  }

  setTimeout(speakIntro, 150);











  import { saveActivityResult, markLoginPing } from "../../../../progress-tracker.js";
  window.GPProgress.installTracker({
    saveActivityResult,
    markLoginPing,
    defaultPageId: "LevelC8",
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
