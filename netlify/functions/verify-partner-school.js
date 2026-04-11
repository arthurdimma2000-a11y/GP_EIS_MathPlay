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

    initAdmin();
    const db = admin.firestore();

    const body = JSON.parse(event.body || "{}");
    const schoolName = String(body.schoolName || "").trim();
    const schoolIdInput = String(body.schoolId || "").trim();
    const inviteCode = String(body.inviteCode || "").trim().toUpperCase();

    if ((!schoolName && !schoolIdInput) || !inviteCode) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "School name and invite code are required."
        })
      };
    }

    let schoolDoc = null;

    const schoolId = slugifySchoolId(schoolIdInput || schoolName);
    if (schoolId) {
      const byId = await db.collection("partnerSchools").doc(schoolId).get();
      if (byId.exists) {
        schoolDoc = { id: byId.id, ...(byId.data() || {}) };
      }
    }

    if (!schoolDoc && schoolName) {
      const q = await db
        .collection("partnerSchools")
        .where("schoolNameLower", "==", schoolName.toLowerCase())
        .limit(1)
        .get();

      if (!q.empty) {
        const doc = q.docs[0];
        schoolDoc = { id: doc.id, ...(doc.data() || {}) };
      }
    }

    if (!schoolDoc) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "This school is not approved for GP EIS access."
        })
      };
    }

    if (!schoolDoc.approved) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "This school is not approved yet."
        })
      };
    }

    if (!schoolDoc.active) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "This school is currently inactive."
        })
      };
    }

    const savedCode = String(schoolDoc.inviteCode || "").trim().toUpperCase();
    if (savedCode !== inviteCode) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Invalid invite code."
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        school: {
          schoolId: schoolDoc.schoolId || schoolDoc.id,
          schoolName: schoolDoc.schoolName || ""
        }
      })
    };
  } catch (error) {
    console.error("verify-partner-school error:", error);
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