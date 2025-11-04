/* eslint-disable */
import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { admin, db } from "../config/admin.js";

const router = express.Router();

// POST /api/conversations/getOrCreateConversation
router.post("/getOrCreateConversation", requireAuth, asyncHandler(async (req, res) => {
  const { musicianProfile, gigData, venueProfile, type = 'application' } = req.body || {};
  if (!gigData?.id || !musicianProfile?.musicianId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData.id and musicianProfile.musicianId required" });
  }

  const gigId = gigData.id;
  const musicianId = musicianProfile.musicianId;

  // Try find existing conversation by gigId + musicianId
  const q = await db.collection('conversations')
    .where('gigId', '==', gigId)
    .where('musicianId', '==', musicianId)
    .limit(1)
    .get();

  if (!q.empty) {
    return res.json({ data: q.docs[0].id });
  }

  const payload = {
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    type,
    gigId,
    venueId: venueProfile?.venueId || venueProfile?.id || null,
    musicianId,
    participants: [req.auth.uid, venueProfile?.ownerUid || null].filter(Boolean),
  };
  const ref = await db.collection('conversations').add(payload);
  return res.json({ data: ref.id });
}));

// POST /api/conversations/updateConversationDocument
router.post("/updateConversationDocument", requireAuth, asyncHandler(async (req, res) => {
  const { convId, updates } = req.body || {};
  if (!convId || !updates || typeof updates !== 'object') {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "convId and updates required" });
  }
  await db.doc(`conversations/${convId}`).set(updates, { merge: true });
  return res.json({ data: { success: true } });
}));

// POST /api/conversations/markGigApplicantAsViewed
router.post("/markGigApplicantAsViewed", requireAuth, asyncHandler(async (req, res) => {
  const { gigId, musicianId } = req.body || {};
  if (!gigId || !musicianId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId and musicianId required" });
  }
  const ref = db.doc(`gigs/${gigId}`);
  await ref.set({ applicantsViewed: admin.firestore.FieldValue.arrayUnion(musicianId) }, { merge: true });
  return res.json({ data: { success: true } });
}));

// POST /api/conversations/notifyOtherApplicantsGigConfirmed
router.post("/notifyOtherApplicantsGigConfirmed", requireAuth, asyncHandler(async (req, res) => {
  const { gigData, acceptedMusicianId } = req.body || {};
  if (!gigData?.id || !acceptedMusicianId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData.id and acceptedMusicianId required" });
  }
  // This is a placeholder; real implementation likely updates multiple docs and sends messages
  return res.json({ data: { newApplicants: [] } });
}));

// POST /api/conversations/deleteConversation
router.post("/deleteConversation", requireAuth, asyncHandler(async (req, res) => {
  const { conversationId } = req.body || {};
  if (!conversationId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "conversationId required" });
  }
  await db.doc(`conversations/${conversationId}`).delete();
  return res.json({ data: { success: true } });
}));

export default router;

// POST /api/conversations/addUserToVenueConversations
router.post("/addUserToVenueConversations", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, uid } = req.body || {};
  if (!venueId || !uid) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and uid required" });
  }
  // Basic guard: only the authenticated user can add themselves
  if (uid !== req.auth.uid) {
    return res.status(403).json({ error: "PERMISSION_DENIED", message: "uid must match authenticated user" });
  }

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? (userSnap.data() || {}) : {};
  const entry = {
    accountId: uid,
    accountName: user.name ?? null,
    role: "venue",
    participantId: venueId,
    accountImg: user.picture || null,
  };

  const convosRef = db.collection("conversations").where("participants", "array-contains", venueId);
  let updatedCount = 0;
  let lastDoc = null;
  while (true) {
    let q = convosRef.orderBy("__name__").limit(300);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    let batch = db.batch();
    let opsInBatch = 0;
    for (const doc of snap.docs) {
      lastDoc = doc;
      const data = doc.data() || {};
      const current = Array.isArray(data.accountNames) ? data.accountNames : [];
      const alreadyPresent = current.some(
        (a) => a && a.accountId === uid && a.role === "venue" && a.participantId === venueId
      );
      if (alreadyPresent) continue;
      batch.update(doc.ref, {
        accountNames: admin.firestore.FieldValue.arrayUnion(entry),
        authorizedUserIds: admin.firestore.FieldValue.arrayUnion(uid),
      });
      opsInBatch++;
      updatedCount++;
      if (opsInBatch >= 450) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) {
      await batch.commit();
    }
    if (snap.size < 300) break;
  }
  return res.json({ data: { updated: updatedCount } });
}));


