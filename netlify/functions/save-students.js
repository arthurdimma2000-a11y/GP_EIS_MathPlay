const crypto = require("crypto");
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: statusCode === 204 ? "" : JSON.stringify(body)
  };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStudentId(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeClassId(value) {
  return String(value || "").trim().toUpperCase();
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
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKeyRaw = String(process.env.FIREBASE_PRIVATE_KEY || "").trim();

  if (projectId && clientEmail && privateKeyRaw) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKeyRaw.replace(/\\n/g, "\n")
    };
  }

  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) {
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, or provide FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  const parsed = JSON.parse(raw);
  if (parsed.private_key && !parsed.privateKey) parsed.privateKey = parsed.private_key;
  if (parsed.client_email && !parsed.clientEmail) parsed.clientEmail = parsed.client_email;
  if (parsed.project_id && !parsed.projectId) parsed.projectId = parsed.project_id;

  parsed.privateKey = String(parsed.privateKey || "").replace(/\\n/g, "\n");

  if (!parsed.projectId || !parsed.clientEmail || !parsed.privateKey) {
    throw new Error(
      "Firebase Admin credentials are incomplete. Provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, or a complete FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  return {
    projectId: String(parsed.projectId).trim(),
    clientEmail: String(parsed.clientEmail).trim(),
    privateKey: parsed.privateKey
  };
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(readServiceAccount()) });
}

function safeParseJson(raw) {
  if (raw == null || raw === "") return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return {
      ok: false,
      error: "Invalid JSON request body.",
      details: String((error && error.message) || "JSON parse failed.")
    };
  }
}

function normalizeStudentRecord(student, teacherContext = {}) {
  const studentId = normalizeStudentId(student && student.studentId);
  const classId = normalizeClassId(student && student.classId);
  const pin = normalizePin(student && student.pin);
  const level = String((student && student.level) || "").trim().toUpperCase();

  if (!studentId || !classId || !pin || !level) return null;

  const classIdCanonical = canonicalClassId(classId);
  const studentIdCanonical = canonicalStudentId(studentId);
  const compositeKey = compositeStudentKey(classId, studentId);

  return {
    classId,
    classIdCanonical,
    canonicalClassId: classIdCanonical,
    studentId,
    studentIdCanonical,
    canonicalStudentId: studentIdCanonical,
    compositeKey,
    pin,
    pinHash: sha256(pin),
    level,
    teacherUid: String((student && student.teacherUid) || teacherContext.uid || "").trim(),
    teacherName: String((student && student.teacherName) || teacherContext.name || "").trim(),
    teacherEmail: normalizeEmail((student && student.teacherEmail) || teacherContext.email),
    displayName: String((student && (student.displayName || student.name)) || "").trim(),
    status: "active",
    authUid: `student:${compositeKey}`,
    createdAt: student && student.createdAt ? String(student.createdAt) : "",
    updatedAt: student && student.updatedAt ? String(student.updatedAt) : ""
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, "");
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      ok: false,
      success: false,
      error: "Method not allowed.",
      details: "Use POST for save-students."
    });
  }

  try {
    const parsedBody = safeParseJson(event.body);
    if (!parsedBody.ok) {
      return jsonResponse(400, {
        ok: false,
        success: false,
        error: parsedBody.error,
        details: parsedBody.details
      });
    }

    const body = parsedBody.value || {};
    const teacherContext =
      body && typeof body.teacherContext === "object" ? body.teacherContext : {};
    const rawStudents = Array.isArray(body && body.students) ? body.students : [];

    if (!rawStudents.length) {
      return jsonResponse(400, {
        ok: false,
        success: false,
        error: "students array is required.",
        details: "Provide at least one generated student record in body.students."
      });
    }

    const students = rawStudents
      .map((student) => normalizeStudentRecord(student, teacherContext))
      .filter(Boolean);

    if (!students.length) {
      return jsonResponse(400, {
        ok: false,
        success: false,
        error: "No valid student records were provided.",
        details: "Each student must include classId, studentId, pin, and level."
      });
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const batch = db.batch();
    const now = new Date().toISOString();
    const syncedStudentIds = [];

    students.forEach((student) => {
      const studentDoc = db.collection("studentAccounts").doc(student.compositeKey);
      const teacherKey = student.teacherUid || student.teacherEmail || "teacher";
      const teacherDoc = db
        .collection("teacherStudentCredentials")
        .doc(`${teacherKey}__${student.compositeKey}`);

      const createdAt = student.createdAt || now;
      const updatedAt = student.updatedAt || now;

      batch.set(
        studentDoc,
        {
          authUid: student.authUid,
          role: "student",
          compositeKey: student.compositeKey,

          classId: student.classId,
          classIdCanonical: student.classIdCanonical,
          canonicalClassId: student.canonicalClassId,

          studentId: student.studentId,
          studentIdCanonical: student.studentIdCanonical,
          canonicalStudentId: student.canonicalStudentId,

          pinHash: student.pinHash,
          level: student.level,

          teacherUid: student.teacherUid,
          teacherName: student.teacherName,
          teacherEmail: student.teacherEmail,
          displayName: student.displayName,

          status: student.status,
          updatedAt,
          updatedAtServer: FieldValue.serverTimestamp(),
          createdAt,
          createdAtServer: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      batch.set(
        teacherDoc,
        {
          teacherUid: student.teacherUid,
          teacherName: student.teacherName,
          teacherEmail: student.teacherEmail,
          compositeKey: student.compositeKey,

          classId: student.classId,
          classIdCanonical: student.classIdCanonical,
          canonicalClassId: student.canonicalClassId,

          studentId: student.studentId,
          studentIdCanonical: student.studentIdCanonical,
          canonicalStudentId: student.canonicalStudentId,

          pin: student.pin,
          pinHash: student.pinHash,
          level: student.level,
          displayName: student.displayName,
          status: student.status,
          updatedAt,
          updatedAtServer: FieldValue.serverTimestamp(),
          createdAt,
          createdAtServer: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      syncedStudentIds.push(student.studentId);
    });

    await batch.commit();

    return jsonResponse(200, {
      ok: true,
      success: true,
      message: "Student records saved successfully.",
      savedCount: students.length,
      syncedStudentIds
    });
  } catch (error) {
    console.error("[save-students] failure", {
      message: error && error.message ? error.message : "Unknown error",
      stack: error && error.stack ? error.stack : "",
      code: error && error.code ? error.code : ""
    });

    return jsonResponse(500, {
      ok: false,
      success: false,
      error: "Student save failed.",
      details: error && error.message ? error.message : "Unknown server error."
    });
  }
};