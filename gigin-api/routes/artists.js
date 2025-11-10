/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db, FieldValue } from "../config/admin.js";
import { assertVenuePerm } from "../utils/permissions.js";

const router = express.Router();

// POST /api/musicians/cancelledGigMusicianProfileUpdate
router.post("/cancelledGigMusicianProfileUpdate", requireAuth, asyncHandler(async (req, res) => {
  const { musicianId, gigId } = req.body || {};
  if (!musicianId || !gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "musicianId and gigId are required" });
  const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
  const snapshot = await musicianRef.get();
  if (!snapshot.exists) return res.status(404).json({ error: "NOT_FOUND", message: "musician profile not found" });
  const data = snapshot.data() || {};
  const updatedGigApplications = Array.isArray(data.gigApplications) ? data.gigApplications.filter((app) => app?.gigId !== gigId) : [];
  await musicianRef.update({ gigApplications: updatedGigApplications, confirmedGigs: FieldValue.arrayRemove(gigId) });
  return res.json({ data: { success: true, musicianId, gigId } });
}));

// POST /api/musicians/findPendingFeeByGigId
router.post("/findPendingFeeByGigId", requireAuth, asyncHandler(async (req, res) => {
  const { musicianId, gigId } = req.body || {};
  if (!musicianId || !gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "musicianId and gigId are required" });
  const snap = await db.collection("musicianProfiles").doc(musicianId).collection("pendingFees").where("gigId", "==", gigId).limit(1).get();
  if (snap.empty) return res.json({ data: { found: false } });
  const d = snap.docs[0];
  return res.json({ data: { docId: d.id, data: d.data() || {} } });
}));

// POST /api/musicians/markPendingFeeInDispute
router.post("/markPendingFeeInDispute", requireAuth, asyncHandler(async (req, res) => {
  const callerUid = req.auth.uid;
  const { musicianId, docId, gigId, disputeReason, details, venueId } = req.body || {};
  if (!musicianId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "musicianId is required" });
  if (!docId && !gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "provide docId or gigId" });
  const safeExtras = {};
  if (typeof disputeReason === "string") safeExtras.disputeReason = disputeReason.trim().slice(0, 2000);
  if (typeof details === "string") safeExtras.details = details.trim().slice(0, 5000);

  // Authorization: either venue reviewer (venueId provided) or owner of musician profile
  if (venueId) {
    await assertVenuePerm(db, callerUid, venueId, 'reviews.create');
  } else {
    const userSnap = await db.doc(`users/${callerUid}`).get();
    const user = userSnap.data() || {};
    const callerMusicianIds = Array.isArray(user.musicianProfile) ? user.musicianProfile : (user.musicianProfile ? [user.musicianProfile] : []);
    const ownsMusician = callerMusicianIds.includes(musicianId);
    if (!ownsMusician) return res.status(403).json({ error: "PERMISSION_DENIED", message: "caller must own musician profile or provide venueId" });
  }

  const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
  const pendingCol = musicianRef.collection("pendingFees");
  const result = await db.runTransaction(async (tx) => {
    const musicianSnap = await tx.get(musicianRef);
    if (!musicianSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "musician profile" });
    let pfRef = null; let pfSnap = null;
    if (docId) {
      pfRef = pendingCol.doc(docId);
      pfSnap = await tx.get(pfRef);
      if (!pfSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "pending fee (docId)" });
    } else {
      const qSnap = await tx.get(pendingCol.where("gigId", "==", gigId).limit(1));
      if (qSnap.empty) return res.status(404).json({ error: "NOT_FOUND", message: "pending fee (gigId)" });
      pfSnap = qSnap.docs[0];
      pfRef = pfSnap.ref;
    }
    const before = pfSnap.data() || {};
    const currentStatus = String(before.status || "").toLowerCase();
    if (currentStatus === "in dispute") {
      return { alreadyInDispute: true, pendingFeeId: pfSnap.id, status: "in dispute" };
    }
    tx.update(pfRef, { disputeLogged: true, status: "in dispute", disputeClearingTime: null, updatedAt: FieldValue.serverTimestamp(), ...safeExtras });
    const disputeRef = db.collection("disputes").doc();
    tx.set(disputeRef, { type: "pendingFeeDispute", musicianId, pendingFeeId: pfSnap.id, gigId: before.gigId || null, raisedByUid: callerUid, disputeReason: safeExtras.disputeReason ?? null, details: safeExtras.details ?? null, createdAt: FieldValue.serverTimestamp() });
    return { alreadyInDispute: false, pendingFeeId: pfSnap.id, status: "in dispute", disputeDocId: disputeRef.id };
  });
  return res.json({ data: { success: true, ...result, message: result.alreadyInDispute ? 'This fee is already marked as "in dispute".' : 'Dispute submitted. We’ll review it and pause clearing.' } });
}));

// POST /api/musicians/markInviteAsViewed
router.post("/markInviteAsViewed", requireAuth, asyncHandler(async (req, res) => {
  const { gigId, applicantId } = req.body || {};
  if (!gigId || !applicantId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId and applicantId are required" });
  const gigRef = db.collection("gigs").doc(gigId);
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: `Gig ${gigId} does not exist.` });
  const gigData = gigSnap.data() || {};
  const applicants = Array.isArray(gigData.applicants) ? gigData.applicants : [];
  const updatedApplicants = applicants.map((a) => a?.id === applicantId ? { ...a, viewed: true } : a);
  await gigRef.update({ applicants: updatedApplicants });
  return res.json({ data: { success: true } });
}));

export default router;


