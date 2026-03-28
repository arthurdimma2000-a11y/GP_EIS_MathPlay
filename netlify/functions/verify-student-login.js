const crypto = require("crypto");
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function normalizeStudentId(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeClassId(value) {
  return String(value || "").trim();
}

function normalizePin(value) {
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

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function readServiceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON.");
  }
  const parsed = JSON.parse(raw);
  if (parsed.private_key && !parsed.privateKey) parsed.privateKey = parsed.private_key;
  if (parsed.client_email && !parsed.clientEmail) parsed.clientEmail = parsed.client_email;
  parsed.privateKey = String(parsed.privateKey || "").replace(/\\n/g, "\n");
  if (!parsed.projectId || !parsed.clientEmail || !parsed.privateKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is incomplete.");
  }
  return parsed;
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(readServiceAccount()) });
}

exports.handler = async function handler(event) {
  const headers = corsHeaders();
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, success: false, error: "Method not allowed." }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const classId = normalizeClassId(body.classId);
    const studentId = normalizeStudentId(body.studentId);
    const pin = normalizePin(body.pin);
    const compositeKey = compositeStudentKey(classId, studentId);

    if (!classId || !studentId || !pin) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, success: false, error: "Class ID, Student ID, and PIN are required." }) };
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const adminAuth = getAuth(app);
    const snap = await db.collection("studentAccounts").doc(compositeKey).get();

    if (!snap.exists) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, success: false, error: "Student account not found." }) };
    }

    const data = snap.data() || {};
    const pinMatches = String(data.pinHash || "") === sha256(pin) || String(data.pin || "") === pin;
    if (!pinMatches) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, success: false, error: "PIN is incorrect." }) };
    }

    if (canonicalClassId(data.classId) !== canonicalClassId(classId)) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, success: false, error: "Class ID is incorrect." }) };
    }

    const student = {
      classId: String(data.classId || classId),
      studentId: String(data.studentId || studentId),
      level: String(data.level || "").trim().toUpperCase(),
      teacherUid: String(data.teacherUid || ""),
      teacherEmail: String(data.teacherEmail || ""),
      teacherName: String(data.teacherName || ""),
      displayName: String(data.displayName || data.studentId || studentId),
      authUid: String(data.authUid || `student:${compositeKey}`)
    };

    let token = "";
    try {
      token = await adminAuth.createCustomToken(student.authUid, {
        role: "student",
        studentId: student.studentId,
        classId: student.classId,
        level: student.level,
        teacherUid: student.teacherUid,
        teacherEmail: student.teacherEmail,
        teacherName: student.teacherName,
        displayName: student.displayName
      });
    } catch (_) {}

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        success: true,
        student,
        token
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        success: false,
        error: error && error.message ? error.message : "Student verification failed."
      })
    };
  }
};
