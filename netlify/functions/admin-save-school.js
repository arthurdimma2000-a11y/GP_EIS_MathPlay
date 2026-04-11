const admin = require("firebase-admin");

function slugifySchoolId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function initAdmin() {
  if (admin.apps.length) return admin.app();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin environment variables.");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Method not allowed." })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const adminKey =
      String(event.headers["x-admin-key"] || "") ||
      String(event.headers["X-Admin-Key"] || "") ||
      String(body.adminKey || "");

    if (!adminKey || adminKey !== process.env.ADMIN_PARTNER_KEY) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Unauthorized." })
      };
    }

    initAdmin();
    const db = admin.firestore();

    const schoolName = String(body.schoolName || "").trim();
    const schoolId = slugifySchoolId(body.schoolId || schoolName);
    const inviteCode = String(body.inviteCode || "").trim().toUpperCase();
    const approved = body.approved !== false;
    const active = body.active !== false;

    if (!schoolName || !schoolId || !inviteCode) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "schoolName and inviteCode are required."
        })
      };
    }

    await db.collection("partnerSchools").doc(schoolId).set(
      {
        schoolId,
        schoolName,
        schoolNameLower: schoolName.toLowerCase(),
        inviteCode,
        approved,
        active,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        message: "Partner school saved successfully."
      })
    };
  } catch (error) {
    console.error("admin-save-school error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: error.message || "Server error."
      })
    };
  }
};