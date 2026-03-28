const crypto = require("crypto");
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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

function normalizeStudentRecord(student, teacherContext = {}) {
  const studentId = normalizeStudentId(student && student.studentId);
  const classId = normalizeClassId(student && student.classId);
  const pin = normalizePin(student && student.pin);
  const level = String(student && student.level || "").trim().toUpperCase();
  if (!studentId || !classId || !pin || !level) return null;
  return {
    classId,
    classIdCanonical: canonicalClassId(classId),
    studentId,
    studentIdCanonical: canonicalStudentId(studentId),
    compositeKey: compositeStudentKey(classId, studentId),
    pin,
    pinHash: sha256(pin),
    level,
    teacherUid: String(student && student.teacherUid || teacherContext.uid || "").trim(),
    teacherName: String(student && student.teacherName || teacherContext.name || "").trim(),
    teacherEmail: normalizeEmail(student && student.teacherEmail || teacherContext.email),
    displayName: String(student && student.displayName || student && student.name || "").trim(),
    status: "active",
    authUid: `student:${compositeStudentKey(classId, studentId)}`
  };
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
    const teacherContext = body && typeof body.teacherContext === "object" ? body.teacherContext : {};
    const rawStudents = Array.isArray(body && body.students) ? body.students : [];

    if (!rawStudents.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "students array is required." }) };
    }

    const students = rawStudents
      .map((student) => normalizeStudentRecord(student, teacherContext))
      .filter(Boolean);

    if (!students.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "No valid student records were provided." }) };
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const batch = db.batch();
    const now = new Date().toISOString();
    const syncedStudentIds = [];

    students.forEach((student) => {
      const studentDoc = db.collection("studentAccounts").doc(student.compositeKey);
      const teacherKey = student.teacherUid || student.teacherEmail || "teacher";
      const teacherDoc = db.collection("teacherStudentCredentials").doc(`${teacherKey}__${student.compositeKey}`);

      batch.set(studentDoc, {
        authUid: student.authUid,
        role: "student",
        compositeKey: student.compositeKey,
        classId: student.classId,
        classIdCanonical: student.classIdCanonical,
        studentId: student.studentId,
        studentIdCanonical: student.studentIdCanonical,
        pinHash: student.pinHash,
        level: student.level,
        teacherUid: student.teacherUid,
        teacherName: student.teacherName,
        teacherEmail: student.teacherEmail,
        displayName: student.displayName,
        status: student.status,
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
        createdAt: now,
        createdAtServer: FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(teacherDoc, {
        teacherUid: student.teacherUid,
        teacherName: student.teacherName,
        teacherEmail: student.teacherEmail,
        compositeKey: student.compositeKey,
        classId: student.classId,
        classIdCanonical: student.classIdCanonical,
        studentId: student.studentId,
        studentIdCanonical: student.studentIdCanonical,
        pin: student.pin,
        pinHash: student.pinHash,
        level: student.level,
        displayName: student.displayName,
        status: student.status,
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
        createdAt: now,
        createdAtServer: FieldValue.serverTimestamp()
      }, { merge: true });

      syncedStudentIds.push(student.studentId);
    });

    await batch.commit();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: "Student records saved successfully.",
        savedCount: students.length,
        syncedStudentIds
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: error && error.message ? error.message : "Student save failed."
      })
    };
  }
};
