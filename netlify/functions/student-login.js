const crypto = require("crypto");
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

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

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function readServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
  };
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert(readServiceAccount())
  });
}

exports.handler = async function handler(event) {
  const headers = corsHeaders();
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed." }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const studentId = normalizeStudentId(body.studentId);
    const pin = normalizePin(body.pin);
    const classId = normalizeClassId(body.classId);
    const canonicalId = canonicalStudentId(studentId);

    if (!canonicalId || !pin) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Student ID and PIN are required." }) };
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const adminAuth = getAuth(app);
    const snap = await db.collection("studentAccounts").doc(canonicalId).get();
    if (!snap.exists) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: "Student account not found." }) };
    }

    const data = snap.data() || {};
    if (String(data.pinHash || "") !== sha256(pin)) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: "PIN is incorrect." }) };
    }
    if (classId && canonicalClassId(data.classId) && canonicalClassId(data.classId) !== canonicalClassId(classId)) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: "Class ID is incorrect." }) };
    }

    const authUid = String(data.authUid || `student:${canonicalId}`);
    const student = {
      authUid,
      classId: String(data.classId || ""),
      studentId: String(data.studentId || studentId || canonicalId),
      level: String(data.level || "").trim().toUpperCase(),
      teacherUid: String(data.teacherUid || ""),
      teacherEmail: String(data.teacherEmail || ""),
      teacherName: String(data.teacherName || ""),
      displayName: String(data.displayName || data.studentId || studentId || canonicalId),
      createdAt: data.createdAt || null
    };

    const token = await adminAuth.createCustomToken(authUid, {
      role: "student",
      studentId: student.studentId,
      classId: student.classId,
      level: student.level,
      teacherUid: student.teacherUid,
      teacherEmail: student.teacherEmail,
      teacherName: student.teacherName,
      displayName: student.displayName
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, token, student })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: error && error.message ? error.message : "Student login failed."
      })
    };
  }
};

