import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBINtAMsH445X_btGDH_iX3RUwbztZTwCY",
  authDomain: "gp-eis-f4a2d.firebaseapp.com",
  projectId: "gp-eis-f4a2d",
  storageBucket: "gp-eis-f4a2d.appspot.com",
  messagingSenderId: "73391020351",
  appId: "1:73391020351:web:68b0c7c122e7518ac81b8a",
  measurementId: "G-01CJEDM9BD"
};

const STUDENT_SESSION_KEY = "GP_EIS_STUDENT_SESSION";
const STORAGE_RESULTS_KEY = "GP_EIS_ACTIVITY_RESULTS";
const STORAGE_LAST_FILE_KEY = "GP_EIS_LAST_FILE";
const LOCAL_RESULTS_KEY = "gp_eis_activity_results";
const LOCAL_LAST_RESULT_KEY = "gp_last_activity_result";
const LOCAL_LOGIN_PING_KEY = "gp_eis_login_ping";
const STARTED_PAGES = new Set();
const FINISH_CACHE = new Map();
const REALTIME_CACHE = new Map();
let realtimeSyncInstalled = false;

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

function nowIsoDate() {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readStudentSession() {
  try {
    return JSON.parse(localStorage.getItem(STUDENT_SESSION_KEY) || "null");
  } catch (_) {
    return null;
  }
}

function getStudentSession() {
  const session = readStudentSession();
  if (!session || typeof session !== "object") return null;
  return {
    ...session,
    studentName: session.studentName || session.displayName || session.name || session.fullName || session.studentId || ""
  };
}

function inferLevel(pageId) {
  if (/^(LA|LevelA|Level_A)/i.test(pageId || "")) return "A";
  if (/^(LB|LevelB|Level_B)/i.test(pageId || "")) return "B";
  if (/^(LC|LevelC|Level_C)/i.test(pageId || "")) return "C";
  return null;
}

function inferActivityType(pageId, payload = {}) {
  if (payload.activityType) return payload.activityType;
  const name = `${pageId || ""} ${payload.title || ""}`.toLowerCase();
  if (name.includes("quiz")) return "quiz";
  if (name.includes("game")) return "game";
  if (name.includes("revision")) return "revision";
  if (name.includes("trace") || name.includes("tracing") || name.includes("writing")) return "tracing";
  return "lesson";
}

function inferWeek(pathname) {
  const match = String(pathname || location.pathname || "").match(/week-(\d+)/i);
  return match ? `week-${match[1]}` : null;
}

function normalizeSkills(skills) {
  return {
    reading: Number(skills?.reading || 0),
    writing: Number(skills?.writing || 0),
    speaking: Number(skills?.speaking || 0),
    listening: Number(skills?.listening || 0)
  };
}

function defaultPayload(overrides = {}) {
  const pageFile = ((location.pathname || "").split("/").pop() || document.title || "Activity").replace(/\.html$/i, "");
  const normalizedSkills = overrides.skills
    ? normalizeSkills(overrides.skills)
    : {
        reading: 1,
        writing: 0,
        speaking: 1,
        listening: 1
      };
  return {
    pageId: pageFile,
    fileName: `${pageFile}.html`,
    level: inferLevel(pageFile) || "A",
    week: inferWeek(location.pathname),
    activityType: inferActivityType(pageFile, overrides),
    score: 100,
    stars: 1,
    skills: normalizedSkills,
    ...overrides
  };
}

function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function parsePercentFromText(value) {
  const match = String(value || "").match(/(\d{1,3})(?:\.\d+)?\s*%/);
  return match ? clampPercent(match[1]) : null;
}

function parseFractionPercent(value) {
  const match = String(value || "").match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  if (!match) return null;
  const part = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return clampPercent((part / total) * 100);
}

function collectRealtimeScore(documentRef = document) {
  const scores = [];
  const push = (value) => {
    const pct = clampPercent(value);
    if (pct !== null) scores.push(pct);
  };

  documentRef.querySelectorAll(
    [
      "#scoreText",
      "#meterText",
      "#progressText",
      "#progressPercent",
      "#correctCount",
      ".progress-text",
      ".progress-label",
      ".score-big",
      ".trace-progress",
      "[data-progress-percent]"
    ].join(",")
  ).forEach((node) => {
    const raw = node.textContent || node.getAttribute("data-progress-percent") || "";
    const pct = parsePercentFromText(raw);
    if (pct !== null) {
      push(pct);
      return;
    }
    const fractionPct = parseFractionPercent(raw);
    if (fractionPct !== null) push(fractionPct);
  });

  documentRef.querySelectorAll(
    [
      "#bar",
      "#progressFill",
      "#meterFill",
      ".progress-fill",
      ".meter-fill",
      ".meter > i",
      ".meter .bar",
      "[data-progress-fill]"
    ].join(",")
  ).forEach((node) => {
    const raw = (node.style && node.style.width) || node.getAttribute("data-progress-fill") || "";
    const pct = parsePercentFromText(raw);
    if (pct !== null) push(pct);
  });

  return scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
}

function installRealtimeActivitySync() {
  if (realtimeSyncInstalled || typeof MutationObserver !== "function" || !document || !document.body) return;
  realtimeSyncInstalled = true;

  const watchedSelector = [
    "#scoreText",
    "#meterText",
    "#progressText",
    "#progressPercent",
    "#correctCount",
    "#bar",
    "#progressFill",
    "#meterFill",
    ".progress-fill",
    ".meter-fill",
    ".meter > i",
    ".meter .bar",
    ".progress-text",
    ".progress-label",
    ".score-big",
    ".trace-progress",
    "[data-progress-percent]",
    "[data-progress-fill]"
  ].join(",");

  const scheduleRealtimeSync = (() => {
    let timer = 0;
    return function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        timer = 0;
        const score = collectRealtimeScore(document);
        if (score === null || !window.GPTrack || typeof window.GPTrack.realtime !== "function") return;
        try {
          await window.GPTrack.realtime({
            score,
            progress: score,
            tracing: score,
            completed: score >= 100
          });
        } catch (_) {}
      }, 180);
    };
  })();

  if (document.querySelector(watchedSelector)) {
    const observer = new MutationObserver(scheduleRealtimeSync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-progress-percent", "data-progress-fill"]
    });
    document.addEventListener("click", scheduleRealtimeSync, true);
    document.addEventListener("input", scheduleRealtimeSync, true);
    document.addEventListener("change", scheduleRealtimeSync, true);
    scheduleRealtimeSync();
  }
}

function storeLocalResult(payload) {
  try {
    const oldData = JSON.parse(localStorage.getItem(LOCAL_RESULTS_KEY) || "[]");
    const idx = oldData.findIndex((item) => item.pageId === payload.pageId);
    if (idx >= 0) oldData[idx] = payload;
    else oldData.push(payload);
    localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(oldData));
    localStorage.setItem(LOCAL_LAST_RESULT_KEY, JSON.stringify(payload));
  } catch (_) {}
}

function storeStructuredResult(fileName, payload) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_RESULTS_KEY) || "{}");
    all[fileName] = payload;
    localStorage.setItem(STORAGE_RESULTS_KEY, JSON.stringify(all));
    localStorage.setItem(STORAGE_LAST_FILE_KEY, fileName);
  } catch (_) {}
}

async function saveDailySummary(payload, session) {
  if (!session?.classId || !session?.studentId) return;
  const date = nowIsoDate();
  const studentKey = `${session.classId}|${session.studentId}`;
  const summaryId = `${studentKey}|${date}`;
  const summaryRef = doc(db, "dailySummaries", summaryId);
  const existingSnap = await getDoc(summaryRef);
  const current = existingSnap.exists() ? existingSnap.data() : null;
  const skills = normalizeSkills(payload.skills);
  const attempts = Number(current?.attempts || 0) + 1;
  const prevScore = Number(current?.avgScore || 0);
  const nextScoreBase = typeof payload.score === "number" ? payload.score : 0;
  const avgScore = attempts > 0 ? Math.round(((prevScore * (attempts - 1)) + nextScoreBase) / attempts) : nextScoreBase;

  await setDoc(summaryRef, {
    classId: session.classId,
    studentId: session.studentId,
    studentKey,
    teacherUid: session.teacherUid || null,
    authUid: session.authUid || null,
    displayName: session.displayName || session.studentId,
    level: session.level || payload.level || null,
    date,
    avgScore,
    totalStars: increment(Number(payload.stars || 0)),
    attempts,
    skills: {
      reading: Number(current?.skills?.reading || 0) + skills.reading,
      writing: Number(current?.skills?.writing || 0) + skills.writing,
      speaking: Number(current?.skills?.speaking || 0) + skills.speaking,
      listening: Number(current?.skills?.listening || 0) + skills.listening
    },
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function markLoginPing() {
  try {
    const pageId = ((location.pathname || "").split("/").pop() || document.title || "Activity").replace(/\.html$/i, "");
    localStorage.setItem(LOCAL_LOGIN_PING_KEY, JSON.stringify({ ts: Date.now(), pageId }));
  } catch (_) {}
  return { ok: true };
}

export async function saveActivityResult(fileNameOrPayload = {}, payload = {}) {
  const resolvedPayload = (typeof fileNameOrPayload === "string")
    ? { ...payload, pageId: fileNameOrPayload.replace(/\.html$/i, "") }
    : (fileNameOrPayload || {});
  const normalized = defaultPayload(resolvedPayload);
  const session = getStudentSession();
  const fileName = (typeof fileNameOrPayload === "string" && fileNameOrPayload)
    ? fileNameOrPayload
    : (normalized.fileName || `${normalized.pageId}.html`);
  const studentName = session?.studentName || null;
  const updatedAt = new Date().toISOString();
  const tracingValue = typeof normalized.tracing === "number"
    ? normalized.tracing
    : typeof normalized.progress === "number"
      ? normalized.progress
      : inferActivityType(normalized.pageId, normalized) === "tracing" && typeof normalized.score === "number"
        ? normalized.score
        : 0;
  const stored = {
    ...normalized,
    fileName,
    ts: Date.now(),
    classId: session?.classId || null,
    studentId: session?.studentId || null,
    studentKey: session?.classId && session?.studentId ? `${session.classId}|${session.studentId}` : null,
    teacherUid: session?.teacherUid || null,
    authUid: session?.authUid || null,
    displayName: session?.displayName || studentName || null,
    studentName,
    week: normalized.week || inferWeek(location.pathname),
    completed: typeof normalized.completed === "boolean" ? normalized.completed : true,
    tracing: tracingValue,
    updatedAt
  };

  storeLocalResult(stored);
  storeStructuredResult(fileName, {
    classId: stored.classId,
    studentId: stored.studentId,
    studentName: stored.studentName,
    level: stored.level,
    week: stored.week,
    completed: stored.completed,
    score: stored.score,
    tracing: stored.tracing,
    updatedAt: stored.updatedAt,
    pageId: stored.pageId,
    fileName
  });

  if (!session?.classId || !session?.studentId) {
    return { ok: true, source: "local", payload: stored };
  }

  try {
    const resultId = `${stored.studentKey}|${stored.pageId}|${stored.activityType}`;
    await setDoc(doc(db, "results", resultId), {
      ...stored,
      ts: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    await saveDailySummary(stored, session);
    return { ok: true, source: "firestore", payload: stored };
  } catch (error) {
    console.warn("saveActivityResult firestore fallback:", error);
    return { ok: true, source: "local-fallback", payload: stored, error };
  }
}

function createGPTrack() {
  return {
    async start(pageId) {
      const safePageId = pageId || ((location.pathname || "").split("/").pop() || "Activity").replace(/\.html$/i, "");
      if (STARTED_PAGES.has(safePageId)) {
        return { ok: true, pageId: safePageId, cached: true };
      }
      try {
        await markLoginPing();
        STARTED_PAGES.add(safePageId);
        console.log("GPTrack start:", safePageId);
        return { ok: true, pageId: safePageId };
      } catch (err) {
        console.warn("GPTrack.start error:", err);
        return { ok: false, error: err };
      }
    },

    async finish(payload = {}) {
      const normalized = defaultPayload(payload);
      const finishKey = JSON.stringify({
        pageId: normalized.pageId,
        activityType: normalized.activityType,
        score: normalized.score,
        stars: normalized.stars,
        skills: normalized.skills
      });
      if (FINISH_CACHE.has(finishKey)) {
        return await FINISH_CACHE.get(finishKey);
      }

      const pending = (async () => {
        try {
          const result = await saveActivityResult(normalized);
          console.log("GPTrack finish:", result);
          // Play chime on completion of quiz or game
          if (normalized.activityType === "quiz" || normalized.activityType === "game") {
            try {
              const chimeAudio = new Audio("/assets/audio/chimes/chime.mp3");
              chimeAudio.volume = 0.7;
              chimeAudio.play().catch(() => {});
            } catch (_) {}
          }
          return result;
        } catch (err) {
          console.error("GPTrack.finish error:", err);
          return { ok: false, error: err };
        } finally {
          FINISH_CACHE.delete(finishKey);
        }
      })();

      FINISH_CACHE.set(finishKey, pending);
      try {
        return await pending;
      } catch (err) {
        return { ok: false, error: err };
      } 
    },

    async realtime(payload = {}) {
      const normalized = defaultPayload({
        completed: false,
        ...payload,
        realtime: true
      });
      const realtimeKey = JSON.stringify({
        pageId: normalized.pageId,
        activityType: normalized.activityType,
        score: normalized.score,
        stars: normalized.stars,
        completed: normalized.completed
      });
      if (REALTIME_CACHE.has(realtimeKey)) {
        return await REALTIME_CACHE.get(realtimeKey);
      }
      const pending = (async () => {
        try {
          const result = await saveActivityResult(normalized);
          return result;
        } catch (err) {
          return { ok: false, error: err };
        } finally {
          REALTIME_CACHE.delete(realtimeKey);
        }
      })();
      REALTIME_CACHE.set(realtimeKey, pending);
      return await pending;
    }
  };
}

if (!window.GPTrack || typeof window.GPTrack.finish !== "function") {
  window.GPTrack = createGPTrack();
}

window.saveActivityResult = saveActivityResult;
window.markLoginPing = markLoginPing;
window.getStudentSession = getStudentSession;
installRealtimeActivitySync();

if (typeof window.finishActivity !== "function") {
  window.finishActivity = async function(overrides = {}) {
    return await window.GPTrack.finish(defaultPayload(overrides));
  };
}

export { defaultPayload, inferLevel, inferActivityType, getStudentSession };
