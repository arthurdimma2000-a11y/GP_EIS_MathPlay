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

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: statusCode === 204 ? "" : JSON.stringify(body)
  };
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

async function findStudentRecord(db, classId, studentId) {
  const normalizedClassId = normalizeClassId(classId);
  const normalizedStudentId = normalizeStudentId(studentId);
  const canonicalCls = canonicalClassId(classId);
  const canonicalStu = canonicalStudentId(studentId);
  const compositeKey = compositeStudentKey(classId, studentId);

  const collection = db.collection("studentAccounts");

  // 1) Primary lookup by current canonical document ID
  const directSnap = await collection.doc(compositeKey).get();
  if (directSnap.exists) {
    return { id: directSnap.id, data: directSnap.data() || {} };
  }

  // 2) Fallback lookup by compositeKey field
  try {
    const byCompositeKey = await collection.where("compositeKey", "==", compositeKey).limit(1).get();
    if (!byCompositeKey.empty) {
      const doc = byCompositeKey.docs[0];
      return { id: doc.id, data: doc.data() || {} };
    }
  } catch (_) {}

  // 3) Fallback lookup by canonical fields
  try {
    const byCanonical = await collection
      .where("canonicalClassId", "==", canonicalCls)
      .where("canonicalStudentId", "==", canonicalStu)
      .limit(1)
      .get();

    if (!byCanonical.empty) {
      const doc = byCanonical.docs[0];
      return { id: doc.id, data: doc.data() || {} };
    }
  } catch (_) {}

  // 4) Fallback lookup by normalized visible values
  try {
    const byVisibleValues = await collection
      .where("classId", "==", normalizedClassId)
      .where("studentId", "==", normalizedStudentId)
      .limit(1)
      .get();

    if (!byVisibleValues.empty) {
      const doc = byVisibleValues.docs[0];
      return { id: doc.id, data: doc.data() || {} };
    }
  } catch (_) {}

  // 5) Last fallback: loose scan by studentId only, then filter locally
  try {
    const byStudentId = await collection.where("studentId", "==", normalizedStudentId).limit(10).get();
    if (!byStudentId.empty) {
      const match = byStudentId.docs.find((doc) => {
        const data = doc.data() || {};
        return canonicalClassId(data.classId) === canonicalCls;
      });
      if (match) {
        return { id: match.id, data: match.data() || {} };
      }
    }
  } catch (_) {}

  return null;
}

function pinMatchesRecord(data, pin) {
  const normalizedInputPin = normalizePin(pin);
  const storedPin = normalizePin(data.pin);
  const storedPinHash = String(data.pinHash || "").trim();

  if (storedPinHash && storedPinHash === sha256(normalizedInputPin)) return true;
  if (storedPin && storedPin === normalizedInputPin) return true;

  return false;
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
      details: "Use POST for verify-student-login."
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
    const classId = normalizeClassId(body.classId);
    const studentId = normalizeStudentId(body.studentId);
    const pin = normalizePin(body.pin);

    if (!classId || !studentId || !pin) {
      return jsonResponse(400, {
        ok: false,
        success: false,
        error: "Class ID, Student ID, and PIN are required.",
        details: "Provide classId, studentId, and pin in the POST body."
      });
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const adminAuth = getAuth(app);

    const found = await findStudentRecord(db, classId, studentId);

    if (!found) {
      return jsonResponse(401, {
        ok: false,
        success: false,
        error: "Student account not found.",
        details: "No student record matched the provided Class ID and Student ID."
      });
    }

    const data = found.data || {};

    if (!pinMatchesRecord(data, pin)) {
      return jsonResponse(401, {
        ok: false,
        success: false,
        error: "PIN is incorrect.",
        details: "The provided PIN did not match the saved student record."
      });
    }

    if (canonicalClassId(data.classId) !== canonicalClassId(classId)) {
      return jsonResponse(401, {
        ok: false,
        success: false,
        error: "Class ID is incorrect.",
        details: "The student record exists, but not for the provided Class ID."
      });
    }

    const student = {
      classId: String(data.classId || classId).trim().toUpperCase(),
      studentId: String(data.studentId || studentId).trim().toUpperCase(),
      level: String(data.level || "").trim().toUpperCase(),
      teacherUid: String(data.teacherUid || ""),
      teacherEmail: String(data.teacherEmail || ""),
      teacherName: String(data.teacherName || ""),
      displayName: String(data.displayName || data.studentId || studentId).trim(),
      authUid: String(data.authUid || `student:${compositeStudentKey(classId, studentId)}`)
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

    return jsonResponse(200, {
      ok: true,
      success: true,
      student,
      token
    });
  } catch (error) {
    console.error("[verify-student-login] failure", {
      message: error && error.message ? error.message : "Unknown error",
      stack: error && error.stack ? error.stack : "",
      code: error && error.code ? error.code : ""
    });

    return jsonResponse(500, {
      ok: false,
      success: false,
      error: "Student verification failed.",
      details: error && error.message ? error.message : "Unknown server error."
    });
  }
};