import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  where
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

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(() => null);
let lastStudentLoginError = null;
const PENDING_STUDENT_SYNC_KEY = "GP_EIS_PENDING_STUDENT_SYNC_QUEUE";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStudentId(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePin(value) {
  return String(value || "").trim();
}

function normalizeClassId(value) {
  return String(value || "").trim();
}

function canonicalStudentId(value) {
  return normalizeStudentId(value).replace(/[^A-Z0-9]/g, "");
}

function canonicalClassId(value) {
  return normalizeClassId(value).replace(/\s+/g, "").toUpperCase();
}

function compositeStudentKey(classId, studentId) {
  return `${canonicalClassId(classId)}__${canonicalStudentId(studentId)}`;
}

function studentAuthUid(classId, studentId) {
  if (studentId == null) {
    return `student:${canonicalStudentId(classId)}`;
  }
  return `student:${compositeStudentKey(classId, studentId)}`;
}

function teacherProfileRef(uid) {
  return doc(db, "teacherProfiles", String(uid || "").trim());
}

function parentProfileRef(uid) {
  return doc(db, "parentProfiles", String(uid || "").trim());
}

function studentAccountRef(studentId, classId = "") {
  return doc(db, "studentAccounts", compositeStudentKey(classId, studentId));
}

function teacherStudentCredentialRef(teacherUid, studentId, classId = "") {
  const uid = String(teacherUid || "").trim();
  const compositeKey = compositeStudentKey(classId, studentId);
  return doc(db, "teacherStudentCredentials", `${uid}__${compositeKey}`);
}

function teacherStudentCredentialsQuery(teacherUid) {
  return query(
    collection(db, "teacherStudentCredentials"),
    where("teacherUid", "==", String(teacherUid || "").trim())
  );
}

function readRuntimeEndpoint({ windowKey, metaName, storageKey }) {
  try {
    const winValue = String(window[windowKey] || "").trim();
    if (winValue) return winValue;
  } catch (_) {}

  try {
    const meta = document.querySelector(`meta[name="${metaName}"]`);
    const metaValue = String(meta?.content || "").trim();
    if (metaValue) return metaValue;
  } catch (_) {}

  try {
    const localValue = String(window.localStorage?.getItem(storageKey) || "").trim();
    if (localValue) return localValue;
  } catch (_) {}

  try {
    const sessionValue = String(window.sessionStorage?.getItem(storageKey) || "").trim();
    if (sessionValue) return sessionValue;
  } catch (_) {}

  return "";
}

function getEndpointCandidates(runtimeConfig, defaults = []) {
  const list = [];
  const runtimeEndpoint = readRuntimeEndpoint(runtimeConfig);
  const origin = String(window.location?.origin || "").trim();

  function pushCandidate(value) {
    const raw = String(value || "").trim();
    if (!raw) return;
    try {
      const resolved = /^https?:\/\//i.test(raw)
        ? new URL(raw).toString()
        : new URL(raw, origin || window.location.href).toString();
      if (!list.includes(resolved)) list.push(resolved);
    } catch (_) {}
  }

  pushCandidate(runtimeEndpoint);
  defaults.forEach(pushCandidate);
  return list;
}

function getSaveStudentsEndpointCandidates() {
  return getEndpointCandidates(
    {
      windowKey: "GP_SAVE_STUDENTS_ENDPOINT",
      metaName: "gp-save-students-endpoint",
      storageKey: "GP_EIS_SAVE_STUDENTS_ENDPOINT"
    },
    ["/.netlify/functions/save-students"]
  );
}

function getStudentLoginEndpointCandidates() {
  return getEndpointCandidates(
    {
      windowKey: "GP_VERIFY_STUDENT_LOGIN_ENDPOINT",
      metaName: "gp-verify-student-login-endpoint",
      storageKey: "GP_EIS_VERIFY_STUDENT_LOGIN_ENDPOINT"
    },
    ["/.netlify/functions/verify-student-login"]
  );
}

function studentLoginError(code, message, detail = {}) {
  const error = {
    code: String(code || "student-login-failed"),
    message: String(message || "Student cloud login failed."),
    ...detail
  };
  lastStudentLoginError = error;
  return error;
}

function readPendingStudentQueue() {
  try {
    const raw = window.localStorage?.getItem(PENDING_STUDENT_SYNC_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writePendingStudentQueue(queue) {
  try {
    window.localStorage?.setItem(PENDING_STUDENT_SYNC_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
  } catch (_) {}
}

function normalizeStudentPayload(student, teacherContext = {}) {
  const normalizedStudentId = normalizeStudentId(student?.studentId);
  if (!normalizedStudentId) return null;
  return {
    classId: normalizeClassId(student?.classId),
    studentId: normalizedStudentId,
    pin: normalizePin(student?.pin),
    level: String(student?.level || "").trim().toUpperCase(),
    displayName: String(student?.displayName || student?.name || "").trim(),
    teacherName: String(student?.teacherName || teacherContext?.name || teacherContext?.teacherName || "").trim(),
    teacherEmail: normalizeEmail(student?.teacherEmail || teacherContext?.email),
    teacherUid: String(student?.teacherUid || teacherContext?.uid || "").trim(),
    createdAt: student?.createdAt || new Date().toISOString(),
    updatedAt: student?.updatedAt || new Date().toISOString()
  };
}

function dedupePendingQueueItems(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const normalized = normalizeStudentPayload(entry, entry?.teacherContext || {});
    if (!normalized || !normalized.studentId) return;
    const key = `${canonicalClassId(normalized.classId)}::${canonicalStudentId(normalized.studentId)}`;
    const previous = map.get(key) || {};
    map.set(key, {
      ...previous,
      ...normalized,
      teacherContext: {
        email: normalizeEmail(entry?.teacherContext?.email || normalized.teacherEmail),
        name: String(entry?.teacherContext?.name || normalized.teacherName || "").trim(),
        uid: String(entry?.teacherContext?.uid || normalized.teacherUid || "").trim()
      },
      queuedAt: entry?.queuedAt || previous.queuedAt || new Date().toISOString()
    });
  });
  return Array.from(map.values());
}

async function postJsonWithTimeout(endpoint, body, timeoutMs = 7000) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: controller?.signal
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

async function sha256(value) {
  const text = String(value || "");
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureEmailUser(email, password, profileName = "") {
  const normalizedEmail = normalizeEmail(email);
  const secret = String(password || "");
  if (!normalizedEmail || !secret) {
    const error = new Error("Email and password are required.");
    error.code = "auth/missing-email-or-password";
    throw error;
  }

  if (auth.currentUser && normalizeEmail(auth.currentUser.email) === normalizedEmail) {
    if (profileName && auth.currentUser.displayName !== profileName) {
      try { await updateProfile(auth.currentUser, { displayName: profileName }); } catch (_) {}
    }
    return { user: auth.currentUser, mode: "existing" };
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, secret);
    if (profileName && credential.user.displayName !== profileName) {
      try { await updateProfile(credential.user, { displayName: profileName }); } catch (_) {}
    }
    return { user: credential.user, mode: "existing" };
  } catch (error) {
    const code = String(error && error.code || "").toLowerCase();
    const canCreate =
      code.includes("user-not-found") ||
      code.includes("invalid-login-credentials") ||
      code.includes("invalid-credential") ||
      code.includes("wrong-password") === false;
    if (!canCreate) throw error;
  }

  const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, secret);
  if (profileName) {
    try { await updateProfile(credential.user, { displayName: profileName }); } catch (_) {}
  }
  return { user: credential.user, mode: "created" };
}

async function loadProfile(ref, fallback) {
  const snap = await getDoc(ref);
  if (!snap.exists()) return fallback;
  return { ...fallback, ...snap.data() };
}

async function saveTeacherAccount(account) {
  const email = normalizeEmail(account.email);
  const name = String(account.name || account.teacherName || "").trim();
  const school = String(account.school || "").trim();
  const { user, mode } = await ensureEmailUser(email, account.password || "", name);
  const profile = {
    uid: user.uid,
    id: user.uid,
    role: "teacher",
    email,
    name: name || user.displayName || email.split("@")[0] || "Teacher",
    school,
    createdAt: account.createdAt || new Date().toISOString(),
    updatedAt: serverTimestamp()
  };
  await setDoc(teacherProfileRef(user.uid), profile, { merge: true });
  return await loadProfile(teacherProfileRef(user.uid), profile).then((data) => ({ ...data, mode }));
}

async function getTeacherAccount(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  if (auth.currentUser && normalizeEmail(auth.currentUser.email) === normalizedEmail) {
    return await loadProfile(teacherProfileRef(auth.currentUser.uid), {
      uid: auth.currentUser.uid,
      id: auth.currentUser.uid,
      role: "teacher",
      email: normalizedEmail,
      name: auth.currentUser.displayName || normalizedEmail.split("@")[0] || "Teacher",
      school: ""
    });
  }
  return null;
}

async function verifyTeacherLogin(email, password) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) return null;
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, String(password || ""));
  const fallback = {
    uid: credential.user.uid,
    id: credential.user.uid,
    role: "teacher",
    email: normalizedEmail,
    name: credential.user.displayName || normalizedEmail.split("@")[0] || "Teacher",
    school: ""
  };
  const profile = await loadProfile(teacherProfileRef(credential.user.uid), fallback);
  if (!profile.email || profile.email !== normalizedEmail) {
    await setDoc(teacherProfileRef(credential.user.uid), { ...fallback, updatedAt: serverTimestamp() }, { merge: true });
    return fallback;
  }
  return profile;
}

async function sendTeacherPasswordReset(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    const error = new Error("Teacher email is required.");
    error.code = "auth/missing-email";
    throw error;
  }
  await sendPasswordResetEmail(auth, normalizedEmail);
  return { ok: true, email: normalizedEmail };
}

async function saveParentAccount(account) {
  const email = normalizeEmail(account.email);
  const name = String(account.name || "").trim();
  const childName = String(account.childName || "").trim();
  const childStudentId = normalizeStudentId(account.childStudentId);
  const { user, mode } = await ensureEmailUser(email, account.password || "", name);
  const profile = {
    uid: user.uid,
    id: user.uid,
    role: "parent",
    email,
    name: name || user.displayName || email.split("@")[0] || "Parent",
    childName,
    childStudentId,
    createdAt: account.createdAt || new Date().toISOString(),
    updatedAt: serverTimestamp()
  };
  await setDoc(parentProfileRef(user.uid), profile, { merge: true });
  return await loadProfile(parentProfileRef(user.uid), profile).then((data) => ({ ...data, mode }));
}

async function getParentAccount(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  if (auth.currentUser && normalizeEmail(auth.currentUser.email) === normalizedEmail) {
    return await loadProfile(parentProfileRef(auth.currentUser.uid), {
      uid: auth.currentUser.uid,
      id: auth.currentUser.uid,
      role: "parent",
      email: normalizedEmail,
      name: auth.currentUser.displayName || normalizedEmail.split("@")[0] || "Parent",
      childName: "",
      childStudentId: ""
    });
  }
  return null;
}

async function verifyParentLogin(email, password) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) return null;
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, String(password || ""));
  const fallback = {
    uid: credential.user.uid,
    id: credential.user.uid,
    role: "parent",
    email: normalizedEmail,
    name: credential.user.displayName || normalizedEmail.split("@")[0] || "Parent",
    childName: "",
    childStudentId: ""
  };
  const profile = await loadProfile(parentProfileRef(credential.user.uid), fallback);
  if (!profile.email || profile.email !== normalizedEmail) {
    await setDoc(parentProfileRef(credential.user.uid), { ...fallback, updatedAt: serverTimestamp() }, { merge: true });
    return fallback;
  }
  return profile;
}

async function sendParentPasswordReset(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    const error = new Error("Parent email is required.");
    error.code = "auth/missing-email";
    throw error;
  }
  await sendPasswordResetEmail(auth, normalizedEmail);
  return { ok: true, email: normalizedEmail };
}

async function saveStudents(students, teacherContext = {}) {
  if (!auth.currentUser) {
    const email = normalizeEmail(teacherContext.email);
    const password = String(teacherContext.password || "");
    const profileName = String(teacherContext.name || teacherContext.teacherName || "").trim();
    if (email && password) {
      await ensureEmailUser(email, password, profileName);
    }
  }
  if (!auth.currentUser) {
    const error = new Error("Teacher authentication is required.");
    error.code = "auth/login-required";
    throw error;
  }
  const teacherUid = auth.currentUser.uid;
  const teacherEmail = normalizeEmail(auth.currentUser.email || teacherContext.email);
  const teacherName = String(auth.currentUser.displayName || teacherContext.name || teacherContext.teacherName || "").trim();
  const list = dedupePendingQueueItems(
    (Array.isArray(students) ? students : []).map((student) => ({
      ...student,
      teacherContext: {
        email: teacherEmail,
        name: teacherName,
        uid: teacherUid
      }
    }))
  ).map((entry) => ({
    classId: entry.classId,
    studentId: entry.studentId,
    pin: entry.pin,
    level: entry.level,
    displayName: entry.displayName,
    teacherName: entry.teacherName || teacherName,
    teacherEmail: entry.teacherEmail || teacherEmail,
    teacherUid
  }));

  if (!list.length) {
    return { ok: false, code: "student-save-empty", message: "No student records were provided.", savedCount: 0, syncedStudentIds: [] };
  }

  const endpoints = getSaveStudentsEndpointCandidates();
  if (!endpoints.length) {
    return { ok: false, code: "student-save-endpoint-missing", message: "Save students endpoint is not configured.", savedCount: 0, syncedStudentIds: [] };
  }

  let lastFailure = null;
  for (const endpoint of endpoints) {
    try {
      const { response, payload } = await postJsonWithTimeout(endpoint, {
        teacherContext: {
          uid: teacherUid,
          email: teacherEmail,
          name: teacherName
        },
        students: list
      }, 9000);
      if (response.ok && payload && payload.ok) {
        return {
          ok: true,
          code: "student-save-success",
          message: String(payload.message || "Students saved successfully."),
          savedCount: Number(payload.savedCount || list.length),
          syncedStudentIds: Array.isArray(payload.syncedStudentIds) ? payload.syncedStudentIds.map(normalizeStudentId).filter(Boolean) : list.map((student) => student.studentId)
        };
      }
      lastFailure = {
        ok: false,
        code: response.status === 404 ? "student-save-endpoint-missing" : "student-save-failed",
        message: String(payload?.error || payload?.message || "Cloud student save failed."),
        status: response.status,
        savedCount: 0,
        syncedStudentIds: []
      };
    } catch (error) {
      lastFailure = {
        ok: false,
        code: "student-save-unreachable",
        message: String(error?.message || "Cloud student save is unreachable right now."),
        savedCount: 0,
        syncedStudentIds: []
      };
    }
  }
  return lastFailure || { ok: false, code: "student-save-failed", message: "Cloud student save failed.", savedCount: 0, syncedStudentIds: [] };
}

function queuePendingStudents(students, teacherContext = {}) {
  const existing = readPendingStudentQueue();
  const next = dedupePendingQueueItems(
    existing.concat(
      (Array.isArray(students) ? students : []).map((student) => ({
        ...student,
        teacherContext: {
          email: normalizeEmail(student?.teacherEmail || teacherContext.email),
          name: String(student?.teacherName || teacherContext.name || "").trim(),
          uid: String(student?.teacherUid || teacherContext.uid || "").trim()
        },
        queuedAt: new Date().toISOString()
      }))
    )
  );
  writePendingStudentQueue(next);
  return { ok: true, queuedCount: next.length, queuedStudents: next };
}

function markStudentsCloudSynced(studentIds = []) {
  const syncedKeys = new Set((Array.isArray(studentIds) ? studentIds : []).map((studentId) => canonicalStudentId(studentId)));
  const remaining = readPendingStudentQueue().filter((entry) => !syncedKeys.has(canonicalStudentId(entry.studentId)));
  writePendingStudentQueue(remaining);
  return { ok: true, queuedCount: remaining.length };
}

async function processPendingStudentSync(teacherContext = {}) {
  const queue = readPendingStudentQueue();
  if (!queue.length) {
    return { ok: true, queuedCount: 0, savedCount: 0, syncedStudentIds: [] };
  }

  const teacherEmail = normalizeEmail(teacherContext.email || queue[0]?.teacherContext?.email);
  const teacherName = String(teacherContext.name || queue[0]?.teacherContext?.name || "").trim();
  const teacherUid = String(teacherContext.uid || queue[0]?.teacherContext?.uid || auth.currentUser?.uid || "").trim();
  const teacherPassword = String(teacherContext.password || "").trim();

  if (!teacherEmail || (!auth.currentUser && !teacherPassword)) {
    return {
      ok: false,
      code: "student-sync-teacher-auth-required",
      message: "Teacher login is required before pending student sync can run.",
      queuedCount: queue.length,
      savedCount: 0,
      syncedStudentIds: []
    };
  }

  const result = await saveStudents(queue, {
    email: teacherEmail,
    password: teacherPassword,
    name: teacherName,
    uid: teacherUid
  });

  if (result.ok) {
    markStudentsCloudSynced(result.syncedStudentIds);
  }

  return {
    ...result,
    queuedCount: readPendingStudentQueue().length
  };
}

async function listTeacherStudents() {
  if (!auth.currentUser) return [];
  const teacherUid = String(auth.currentUser.uid || "").trim();
  if (!teacherUid) return [];
  const snap = await getDocs(teacherStudentCredentialsQuery(teacherUid));
  return snap.docs
    .map((entry) => entry.data() || {})
    .map((student) => ({
      teacherUid,
      teacherEmail: normalizeEmail(student.teacherEmail),
      teacherName: String(student.teacherName || "").trim(),
      classId: normalizeClassId(student.classId),
      studentId: normalizeStudentId(student.studentId),
      pin: normalizePin(student.pin),
      level: String(student.level || "").trim().toUpperCase(),
      cloudSynced: true,
      displayName: String(student.displayName || student.name || "").trim(),
      name: String(student.displayName || student.name || "").trim(),
      createdAt: student.createdAt || null,
      updatedAt: student.updatedAt || null
    }))
    .filter((student) => student.studentId);
}

async function getStudentAccount(studentId, classId = "") {
  if (!auth.currentUser) return null;
  const claims = await auth.currentUser.getIdTokenResult().then((result) => result.claims).catch(() => ({}));
  const claimStudentId = claims.studentId || claims.student_id;
  const claimClassId = claims.classId || claims.class_id || classId;
  if (
    claims.role === "student" &&
    canonicalStudentId(claimStudentId) === canonicalStudentId(studentId) &&
    canonicalClassId(claimClassId) === canonicalClassId(classId || claimClassId)
  ) {
    const snap = await getDoc(studentAccountRef(studentId, claimClassId));
    return snap.exists() ? snap.data() : null;
  }
  return null;
}

async function verifyStudentLogin(input, maybePin, maybeClassId = "") {
  lastStudentLoginError = null;
  const request = (input && typeof input === "object" && !Array.isArray(input))
    ? input
    : { studentId: input, pin: maybePin, classId: maybeClassId };
  const body = {
    studentId: normalizeStudentId(request.studentId),
    pin: normalizePin(request.pin),
    classId: normalizeClassId(request.classId)
  };
  const endpoints = getStudentLoginEndpointCandidates();

  if (!endpoints.length) {
    studentLoginError(
      "student-login-endpoint-missing",
      "Student cloud login endpoint is not configured."
    );
    return null;
  }

  let lastRecoverableError = null;

  for (const endpoint of endpoints) {
    const result = await postJsonWithTimeout(endpoint, body, 7000).catch((error) => {
      lastRecoverableError = studentLoginError(
        "student-login-unreachable",
        "Student cloud login service could not be reached.",
        { endpoint, detail: String(error?.message || "") }
      );
      return null;
    });

    if (!result || !result.response) continue;

    const { response, payload } = result;
    if (response.ok && payload && (payload.ok || payload.success) && payload.student) {
      if (payload.token) {
        try { await signInWithCustomToken(auth, payload.token); } catch (_) {}
      }
      lastStudentLoginError = null;
      return payload.student;
    }

    if (response.status === 404) {
      studentLoginError(
        "student-login-endpoint-missing",
        "Student cloud login service is not deployed on this site yet.",
        { endpoint, status: response.status }
      );
      return null;
    }

    if (response.status === 400 || response.status === 401) {
      studentLoginError(
        "student-login-invalid-credentials",
        String(payload?.error || "Student ID, PIN, or Class ID is incorrect."),
        { endpoint, status: response.status }
      );
      return null;
    }

    lastRecoverableError = studentLoginError(
      "student-login-service-error",
      String(payload?.error || "Student cloud login service is unavailable right now."),
      { endpoint, status: response.status }
    );
  }

  if (lastRecoverableError) return null;
  studentLoginError(
    "student-login-unreachable",
    "Student cloud login service could not be reached."
  );
  return null;
}

function getLastStudentLoginError() {
  return lastStudentLoginError;
}

async function getCurrentAuthState() {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult().catch(() => null);
  const claims = token?.claims || {};
  if (claims.role === "student") {
    return {
      role: "student",
      user,
      profile: {
        authUid: user.uid,
        studentId: claims.studentId || "",
        classId: claims.classId || "",
        level: claims.level || "",
        teacherUid: claims.teacherUid || "",
        teacherEmail: claims.teacherEmail || "",
        teacherName: claims.teacherName || "",
        displayName: claims.displayName || user.displayName || claims.studentId || ""
      }
    };
  }

  const teacherSnap = await getDoc(teacherProfileRef(user.uid)).catch(() => null);
  if (teacherSnap && teacherSnap.exists()) {
    return { role: "teacher", user, profile: { uid: user.uid, ...teacherSnap.data() } };
  }

  const parentSnap = await getDoc(parentProfileRef(user.uid)).catch(() => null);
  if (parentSnap && parentSnap.exists()) {
    return { role: "parent", user, profile: { uid: user.uid, ...parentSnap.data() } };
  }

  return { role: "user", user, profile: { uid: user.uid, email: normalizeEmail(user.email) } };
}

async function signOutCurrentUser() {
  await signOut(auth);
  return { ok: true };
}

const api = {
  saveTeacherAccount,
  getTeacherAccount,
  verifyTeacherLogin,
  sendTeacherPasswordReset,
  saveParentAccount,
  getParentAccount,
  verifyParentLogin,
  sendParentPasswordReset,
  saveStudents,
  queuePendingStudents,
  markStudentsCloudSynced,
  processPendingStudentSync,
  listTeacherStudents,
  getStudentAccount,
  verifyStudentLogin,
  getLastStudentLoginError,
  getCurrentAuthState,
  signOutCurrentUser
};

window.GPAuthSync = api;
window.GPAuthSyncReady = Promise.resolve(api);
