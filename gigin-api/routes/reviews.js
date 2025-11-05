/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db, FieldValue, Timestamp } from "../config/admin.js";
import { assertVenuePerm, sanitizePermissions } from "../utils/permissions.js";

const router = express.Router();

// POST /api/reviews/submitReview
router.post("/submitReview", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { reviewer, musicianId, venueId, gigId, rating, reviewText } = req.body || {};
  if (!gigId || (rating !== "positive" && rating !== "negative")) return res.status(400).json({ error: "INVALID_ARGUMENT" });
  if (reviewer !== "venue" && reviewer !== "musician") return res.status(400).json({ error: "INVALID_ARGUMENT", message: "reviewer must be 'venue' or 'musician'" });
  if (!venueId || !musicianId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId & musicianId required" });

  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
  const gigRef = db.doc(`gigs/${gigId}`);
  const userRef = db.doc(`users/${caller}`);
  const reviewRef = db.collection("reviews").doc();

  await db.runTransaction(async (tx) => {
    const [venueSnap, musicianSnap, gigSnap, userSnap] = await Promise.all([
      tx.get(venueRef), tx.get(musicianRef), tx.get(gigRef), tx.get(userRef)
    ]);
    if (!venueSnap.exists || !musicianSnap.exists || !gigSnap.exists || !userSnap.exists) {
      return res.status(404).json({ error: "NOT_FOUND", message: "linked docs" });
    }
    const venue = venueSnap.data() || {}; const musician = musicianSnap.data() || {}; const user = userSnap.data() || {};
    if (reviewer === "venue") {
      const isOwner = venue?.createdBy === caller || venue?.userId === caller;
      let canReview = isOwner;
      if (!canReview) {
        const memberSnap = await venueRef.collection('members').doc(caller).get();
        const memberData = memberSnap.exists ? memberSnap.data() : null;
        const isActiveMember = !!memberData && memberData.status === 'active';
        const perms = sanitizePermissions(memberData?.permissions || {});
        canReview = isActiveMember && !!perms['reviews.create'];
      }
      if (!canReview) return res.status(403).json({ error: 'PERMISSION_DENIED', message: 'requires reviews.create' });
    } else {
      const mp = Array.isArray(user.musicianProfile) ? user.musicianProfile : (user.musicianProfile ? [user.musicianProfile] : []);
      if (!mp.includes(musicianId)) return res.status(403).json({ error: 'PERMISSION_DENIED', message: 'linked musician profile required' });
    }

    const reviewDoc = { musicianId, venueId, gigId, reviewWrittenBy: reviewer, rating, reviewText: (reviewText?.trim?.() || null), timestamp: Timestamp.now() };
    tx.set(reviewRef, reviewDoc);
    if (reviewer === 'venue') {
      const current = musician.avgReviews || {}; const next = {
        totalReviews: (Number(current.totalReviews) || 0) + 1,
        positive: (Number(current.positive) || 0) + (rating === 'positive' ? 1 : 0),
        negative: (Number(current.negative) || 0) + (rating === 'negative' ? 1 : 0),
      };
      tx.update(musicianRef, { avgReviews: next, reviews: FieldValue.arrayUnion(reviewRef.id) });
      tx.update(gigRef, { venueHasReviewed: true });
    } else {
      const current = venue.avgReviews || {}; const next = {
        totalReviews: (Number(current.totalReviews) || 0) + 1,
        positive: (Number(current.positive) || 0) + (rating === 'positive' ? 1 : 0),
        negative: (Number(current.negative) || 0) + (rating === 'negative' ? 1 : 0),
      };
      tx.update(venueRef, { avgReviews: next, reviews: FieldValue.arrayUnion(reviewRef.id) });
      tx.update(gigRef, { musicianHasReviewed: true });
    }
  });
  return res.json({ data: { success: true, reviewId: reviewRef.id } });
}));

// POST /api/reviews/logDispute
router.post("/logDispute", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { gigId, venueId, musicianId, reason, message = "", attachments = [] } = req.body || {};
  if (![gigId, venueId, musicianId, reason].every(v => typeof v === 'string' && v.trim())) return res.status(400).json({ error: 'INVALID_ARGUMENT' });
  if (!Array.isArray(attachments)) return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'attachments must be array' });

  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
  const gigRef = db.doc(`gigs/${gigId}`);
  const callerUserRef = db.doc(`users/${caller}`);
  const [venueSnap, musicianSnap, gigSnap, callerUserSnap] = await Promise.all([venueRef.get(), musicianRef.get(), gigRef.get(), callerUserRef.get()]);
  if (!venueSnap.exists || !musicianSnap.exists || !gigSnap.exists || !callerUserSnap.exists) return res.status(404).json({ error: 'NOT_FOUND', message: 'linked docs' });
  const venue = venueSnap.data() || {}; const musician = musicianSnap.data() || {}; const callerUser = callerUserSnap.data() || {};
  const ownerUid = venue.createdBy || venue.userId || null;
  const callerMusicianIds = Array.isArray(callerUser.musicianProfile) ? callerUser.musicianProfile : (callerUser.musicianProfile ? [callerUser.musicianProfile] : []);
  const callerIsLinkedMusician = callerMusicianIds.includes(musicianId);
  let callerHasVenueReviewPerm = false;
  if (ownerUid === caller) callerHasVenueReviewPerm = true; else {
    const memberSnap = await venueRef.collection('members').doc(caller).get();
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const isActiveMember = !!memberData && memberData.status === 'active';
    const perms = sanitizePermissions(memberData?.permissions || {});
    callerHasVenueReviewPerm = isActiveMember && !!perms['reviews.create'];
  }
  if (!callerIsLinkedMusician && !callerHasVenueReviewPerm) return res.status(403).json({ error: 'PERMISSION_DENIED' });

  const disputeRef = db.collection('disputes').doc();
  const now = Timestamp.now();
  const participants = [caller, callerHasVenueReviewPerm ? (musician.userId || null) : ownerUid].filter(Boolean);
  const disputeDoc = { disputeId: disputeRef.id, gigId, venueId, musicianId, participants, openedBy: caller, reason: reason.trim(), message: (message || '').trim() || null, attachments: attachments.filter(x => typeof x === 'string'), status: 'open', createdAt: now, updatedAt: now, venueName: venue.name || null, musicianName: musician.name || null };
  await disputeRef.set(disputeDoc);
  return res.json({ data: { success: true, disputeId: disputeRef.id, ui: { notice: 'Dispute logged. Our team will review this shortly.' } } });
}));

// POST /api/reviews/deleteReview
router.post("/deleteReview", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { reviewId } = req.body || {};
  if (!reviewId || typeof reviewId !== 'string') return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'reviewId required' });
  const reviewRef = db.doc(`reviews/${reviewId}`);

  await db.runTransaction(async (tx) => {
    const reviewSnap = await tx.get(reviewRef);
    if (!reviewSnap.exists) return res.status(404).json({ error: 'NOT_FOUND', message: 'review' });
    const review = reviewSnap.data() || {};
    const { reviewer = review.reviewWrittenBy, rating, venueId, musicianId, gigId } = review;
    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
    const gigRef = db.doc(`gigs/${gigId}`);
    const userRef = db.doc(`users/${caller}`);
    const [venueSnap, musicianSnap, userSnap] = await Promise.all([tx.get(venueRef), tx.get(musicianRef), tx.get(userRef)]);
    if (!venueSnap.exists || !musicianSnap.exists || !userSnap.exists) return res.status(404).json({ error: 'NOT_FOUND', message: 'linked docs' });
    const venue = venueSnap.data() || {}; const user = userSnap.data() || {};
    if (reviewer === 'venue') {
      const owner = venue.createdBy || venue.userId;
      if (owner !== caller) return res.status(403).json({ error: 'FORBIDDEN', message: 'only venue owner can delete this review' });
      const current = musicianSnap.data()?.avgReviews || {}; const next = {
        totalReviews: Math.max(0, Number(current.totalReviews) || 0) - 1,
        positive: Math.max(0, Number(current.positive) || 0) - (rating === 'positive' ? 1 : 0),
        negative: Math.max(0, Number(current.negative) || 0) - (rating === 'negative' ? 1 : 0),
      };
      tx.update(musicianRef, { avgReviews: next, reviews: FieldValue.arrayRemove(reviewId) });
      tx.update(gigRef, { venueHasReviewed: false });
    } else {
      const mp = Array.isArray(user.musicianProfile) ? user.musicianProfile : (user.musicianProfile ? [user.musicianProfile] : []);
      if (!mp.includes(musicianId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'only the musician can delete this review' });
      const current = venueSnap.data()?.avgReviews || {}; const next = {
        totalReviews: Math.max(0, Number(current.totalReviews) || 0) - 1,
        positive: Math.max(0, Number(current.positive) || 0) - (rating === 'positive' ? 1 : 0),
        negative: Math.max(0, Number(current.negative) || 0) - (rating === 'negative' ? 1 : 0),
      };
      tx.update(venueRef, { avgReviews: next, reviews: FieldValue.arrayRemove(reviewId) });
      tx.update(gigRef, { musicianHasReviewed: false });
    }
    tx.delete(reviewRef);
  });
  return res.json({ data: { success: true, reviewId } });
}));

export default router;


