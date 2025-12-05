/* eslint-disable */
import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { admin, db, FieldValue } from "../config/admin.js";

const router = express.Router();

// POST /api/users/getUserEmail
router.post("/getUserEmail", asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "email is required" });
  }
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (snap.empty) return res.json({ data: { found: false, user: null } });
  const doc = snap.docs[0];
  const user = { id: doc.id, ...(doc.data() || {}) };
  return res.json({ data: { found: true, user } });
}));

// POST /api/users/getUserEmailById (auth required)
// Returns only the email address for a given userId (for privacy)
router.post("/getUserEmailById", requireAuth, asyncHandler(async (req, res) => {
  const { userId } = req.body || {};
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "userId is required" });
  }
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
  }
  const userData = userSnap.data() || {};
  return res.json({ data: { email: userData.email || null } });
}));

// POST /api/users/getPhoneExistsBoolean
router.post("/getPhoneExistsBoolean", asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body || {};
  if (!phoneNumber) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "phoneNumber is required" });
  }
  const snap = await db.collection("users").where("phoneNumber", "==", phoneNumber).limit(1).get();
  return res.json({ data: !snap.empty });
}));

// POST /api/users/sendVerificationEmail (auth required)
router.post("/sendVerificationEmail", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const actionUrl = (req.body?.actionUrl || "").toString();

  const userRecord = await admin.auth().getUser(uid);
  if (!userRecord.email) {
    return res.status(403).json({ error: "PERMISSION_DENIED", message: "no email on user" });
  }

  const link = await admin.auth().generateEmailVerificationLink(userRecord.email, {
    url: actionUrl,
    handleCodeInApp: false,
  });

  const subject = "Verify your email";
  const text = `Hi,\n\nPlease confirm your address to finish setting up your Gigin account.\n\n${link}\n\nIf you didn’t request this, you can safely ignore this email.`;

  const base = {
    bodyBg: "#f9f9f9",
    cardBg: "#ffffff",
    text: "#333333",
    muted: "#6b7280",
    accent: "#111827",
    border: "#e5e7eb",
    btnBg: "#111827",
    btnText: "#ffffff",
  };

  const iconPath =
    "M256 0c36.8 0 68.8 20.7 84.9 51.1C373.8 41 411 49 437 75s34 63.3 23.9 96.1C491.3 187.2 512 219.2 512 256s-20.7 68.8-51.1 84.9C471 373.8 463 411 437 437s-63.3 34-96.1 23.9C324.8 491.3 292.8 512 256 512s-68.8-20.7-84.9-51.1C138.2 471 101 463 75 437s-34-63.3-23.9-96.1C20.7 324.8 0 292.8 0 256s20.7-68.8 51.1-84.9C41 138.2 49 101 75 75s63.3-34 96.1-23.9C187.2 20.7 219.2 0 256 0zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z";
  const iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
           width="28" height="28" role="img" aria-label="Action" style="display:block;">
        <path d="${iconPath}" fill="${base.accent}"></path>
      </svg>
    `;
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";
  const htmlShell = (title, inner) => `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:${base.bodyBg};font-family:Inter,Segoe UI,Arial,sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:${base.bodyBg};padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${base.cardBg};border:1px solid ${base.border};border-radius:16px;">
                <tr>
                  <td style="padding:28px 28px 0 28px;" align="center">
                    <img src="${logoUrl}" width="120" height="36" alt="gigin."
                         style="display:block;border:0;max-width:100%;height:auto;">
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 28px 0 28px;" align="center">
                    <div style="font-size:28px;line-height:1.2;color:${base.accent}">${iconSvg}</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 28px 0 28px;" align="center">
                    <h1 style="margin:0;font-size:20px;line-height:28px;color:${base.accent};font-weight:700;">
                      ${"Verify your email"}
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 28px 0 28px;">
                    ${`
      <p style="margin:0 0 12px 0;font-size:14px;line-height:22px;color:${base.text}">
        Hi,
      </p>
      <p style=\"margin:0 0 16px 0;font-size:14px;line-height:22px;color:${base.text}\">
        Please confirm your address to finish setting up your Gigin account.
      </p>
    `}
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 28px 28px 28px;" align="center">
                    <a href="${link}"
                       style="display:inline-block;background:${base.btnBg};color:${base.btnText};text-decoration:none;font-size:14px;padding:12px 18px;border-radius:10px;font-weight:600">
                      Verify email
                    </a>
                    <div style="font-size:12px;color:${base.muted};margin-top:10px;word-break:break-all;">
                      Or paste this into your browser: ${link}
                    </div>
                  </td>
                </tr>
              </table>

              <div style="max-width:600px;margin-top:16px;font-size:12px;color:${base.muted};text-align:center;">
                If you didn’t request this, you can safely ignore this email.
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
    `;

  const html = htmlShell("Verify your email");

  await db.collection("mail").add({
    to: userRecord.email,
    message: { subject, text, html },
  });
  return res.json({ data: { success: true } });
}));

const ALLOWED_ARRAY_FIELDS = ["venueProfiles", "savedMusicians", "savedArtists", "bands", "artistProfiles"];

// POST /api/users/updateUserArrayField (auth required)
router.post("/updateUserArrayField", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { field, op, value } = req.body || {};
  if (!field || !ALLOWED_ARRAY_FIELDS.includes(field)) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "field not allowed" });
  }
  if (!value || typeof value !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "value required" });
  }
  const userRef = db.doc(`users/${uid}`);
  if (op === "add") {
    await userRef.update({ [field]: FieldValue.arrayUnion(value) });
  } else if (op === "remove") {
    await userRef.update({ [field]: FieldValue.arrayRemove(value) });
  } else {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "op must be 'add' or 'remove'" });
  }
  return res.json({ data: { success: true, field, op, value } });
}));

// POST /api/users/clearUserArrayField (auth required)
router.post("/clearUserArrayField", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { field } = req.body || {};
  if (!field || !ALLOWED_ARRAY_FIELDS.includes(field)) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "field not allowed" });
  }
  const userRef = db.doc(`users/${uid}`);
  await userRef.update({ [field]: FieldValue.delete() });
  return res.json({ data: { success: true, field, cleared: true } });
}));

// POST /api/users/setPrimaryArtistProfile (auth required)
// Sets a user's primary artist profile. Can only be set once.
router.post("/setPrimaryArtistProfile", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { artistProfileId } = req.body || {};
  
  if (!artistProfileId || typeof artistProfileId !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "artistProfileId is required" });
  }

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  
  if (!userSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
  }

  const userData = userSnap.data();
  const artistProfiles = userData.artistProfiles || [];

  // Check if user has more than one profile
  if (artistProfiles.length <= 1) {
    return res.status(400).json({ 
      error: "INVALID_ARGUMENT", 
      message: "You must have more than one artist profile to set a primary profile" 
    });
  }

  // Check if primary profile has already been set (can only change once)
  if (userData.primaryProfileSet === true) {
    return res.status(403).json({ 
      error: "FORBIDDEN", 
      message: "Primary profile has already been set and cannot be changed" 
    });
  }

  // Validate that the profileId belongs to the user
  // artistProfiles can be an array of strings (profile IDs) or objects with id/profileId
  const profileInArray = artistProfiles.find(
    (p) => (typeof p === 'string' && p === artistProfileId) ||
           (typeof p === 'object' && (p.id === artistProfileId || p.profileId === artistProfileId))
  );

  if (!profileInArray) {
    return res.status(403).json({ 
      error: "FORBIDDEN", 
      message: "This artist profile does not belong to you" 
    });
  }

  // Set primary profile
  await userRef.update({
    primaryArtistProfileId: artistProfileId,
    primaryProfileSet: true,
  });

  return res.json({ data: { success: true, primaryArtistProfileId: artistProfileId } });
}));

// DELETE /api/users/deleteUserDocument (auth required)
router.delete("/deleteUserDocument", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { confirm = false } = req.body || {};
  if (!confirm) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "confirm=true is required" });
  }
  const NOW_SECONDS = Math.floor(Date.now() / 1000);
  const AUTH_TIME = req.auth.auth_time || 0;
  const MAX_AGE = 5 * 60;
  if (NOW_SECONDS - AUTH_TIME > MAX_AGE) {
    return res.status(401).json({ error: "UNAUTHENTICATED", message: "Recent login required" });
  }
  const userRef = db.doc(`users/${uid}`);
  const batch = db.batch();
  batch.delete(userRef);
  await batch.commit();
  await admin.auth().revokeRefreshTokens(uid);
  return res.json({ data: { success: true, uid } });
}));

export default router;
