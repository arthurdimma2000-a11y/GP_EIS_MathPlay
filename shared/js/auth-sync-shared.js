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

function studentAuthUid(studentId) {
  return `student:${canonicalStudentId(studentId)}`;
}

function teacherProfileRef(uid) {
  return doc(db, "teacherProfiles", String(uid || "").trim());
}

function parentProfileRef(uid) {
  return doc(db, "parentProfiles", String(uid || "").trim());
}

function studentAccountRef(studentId) {
  return doc(db, "studentAccounts", canonicalStudentId(studentId));
}

function teacherStudentCredentialRef(teacherUid, studentId) {
  const uid = String(teacherUid || "").trim();
  const canonicalId = canonicalStudentId(studentId);
  return doc(db, "teacherStudentCredentials", `${uid}__${canonicalId}`);
}

function teacherStudentCredentialsQuery(teacherUid) {
  return query(
    collection(db, "teacherStudentCredentials"),
    where("teacherUid", "==", String(teacherUid || "").trim())
  );
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
  const list = Array.isArray(students) ? students : [];
  await Promise.all(
    list.map(async (student) => {
      const studentId = normalizeStudentId(student.studentId);
      if (!studentId) return;
      const canonicalId = canonicalStudentId(studentId);
      const payload = {
        authUid: studentAuthUid(studentId),
        role: "student",
        classId: normalizeClassId(student.classId),
        studentId,
        pinHash: await sha256(student.pin || ""),
        level: String(student.level || "").trim().toUpperCase(),
        teacherUid,
        teacherEmail,
        teacherName: String(student.teacherName || teacherName || "").trim(),
        displayName: String(student.displayName || student.name || "").trim(),
        createdAt: student.createdAt || new Date().toISOString(),
        updatedAt: serverTimestamp()
      };
      const teacherReadablePayload = {
        teacherUid,
        teacherEmail,
        teacherName: String(student.teacherName || teacherName || "").trim(),
        classId: normalizeClassId(student.classId),
        studentId,
        pin: normalizePin(student.pin),
        level: String(student.level || "").trim().toUpperCase(),
        displayName: String(student.displayName || student.name || "").trim(),
        createdAt: student.createdAt || new Date().toISOString(),
        updatedAt: serverTimestamp()
      };
      await setDoc(studentAccountRef(canonicalId), payload, { merge: true });
      await setDoc(teacherStudentCredentialRef(teacherUid, canonicalId), teacherReadablePayload, { merge: true });
    })
  );
  return { ok: true, count: list.length };
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
      displayName: String(student.displayName || student.name || "").trim(),
      name: String(student.displayName || student.name || "").trim(),
      createdAt: student.createdAt || null,
      updatedAt: student.updatedAt || null
    }))
    .filter((student) => student.studentId);
}

async function getStudentAccount(studentId) {
  if (!auth.currentUser) return null;
  const claims = await auth.currentUser.getIdTokenResult().then((result) => result.claims).catch(() => ({}));
  if (claims.role === "student" && canonicalStudentId(claims.studentId || claims.student_id) === canonicalStudentId(studentId)) {
    const snap = await getDoc(studentAccountRef(studentId));
    return snap.exists() ? snap.data() : null;
  }
  return null;
}

async function verifyStudentLogin(studentId, pin, classId = "") {
  const endpoint = new URL("/.netlify/functions/student-login", window.location.origin).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: normalizeStudentId(studentId),
      pin: normalizePin(pin),
      classId: normalizeClassId(classId)
    })
  }).catch(() => null);

  if (!response || !response.ok) return null;
  const payload = await response.json().catch(() => null);
  if (!payload || !payload.ok || !payload.token || !payload.student) return null;
  await signInWithCustomToken(auth, payload.token);
  return payload.student;
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
  listTeacherStudents,
  getStudentAccount,
  verifyStudentLogin,
  getCurrentAuthState,
  signOutCurrentUser
};

window.GPAuthSync = api;
window.GPAuthSyncReady = Promise.resolve(api);
