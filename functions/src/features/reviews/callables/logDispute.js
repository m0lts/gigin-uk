/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";
import { sanitizePermissions } from "../../../lib/utils/permissions.js";

/**
 * logDispute
 * Input:
 * {
 *   gigId: string,
 *   venueId: string,
 *   musicianId: string,
 *   reason: string,             // short label, e.g. 'payment', 'cancellation'
 *   message?: string,           // free-form details
 *   attachments?: string[]      // optional storage URLs
 * }
 * Auth: required
 */
export const logDispute = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const caller = req.auth.uid;
    const {
      gigId, venueId, musicianId,
      reason, message = "", attachments = []
    } = req.data || {};

    // Basic input validation
    if (![gigId, venueId, musicianId, reason].every(v => typeof v === "string" && v.trim())) {
      const e = new Error("INVALID_ARGUMENT");
      e.code = "invalid-argument";
      throw e;
    }
    if (!Array.isArray(attachments)) {
      const e = new Error("INVALID_ARGUMENT: attachments must be an array");
      e.code = "invalid-argument";
      throw e;
    }

    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
    const gigRef = db.doc(`gigs/${gigId}`);
    const callerUserRef = db.doc(`users/${caller}`);

    const [venueSnap, musicianSnap, gigSnap, callerUserSnap] = await Promise.all([
      venueRef.get(),
      musicianRef.get(),
      gigRef.get(),
      callerUserRef.get(),
    ]);

    if (!venueSnap.exists) { const e = new Error("NOT_FOUND: venue"); e.code = "not-found"; throw e; }
    if (!musicianSnap.exists) { const e = new Error("NOT_FOUND: musician"); e.code = "not-found"; throw e; }
    if (!gigSnap.exists) { const e = new Error("NOT_FOUND: gig"); e.code = "not-found"; throw e; }
    if (!callerUserSnap.exists) { const e = new Error("NOT_FOUND: caller user"); e.code = "not-found"; throw e; }

    const venue = venueSnap.data() || {};
    const musician = musicianSnap.data() || {};
    const callerUser = callerUserSnap.data() || {};
    const ownerUid = (venue.createdBy || venue.userId) || null;

    const callerMusicianIds = Array.isArray(callerUser.musicianProfile)
    ? callerUser.musicianProfile
    : callerUser.musicianProfile
      ? [callerUser.musicianProfile]
      : [];
    const callerIsLinkedMusician = callerMusicianIds.includes(musicianId);
    
    let callerHasVenueReviewPerm = false;
    if (ownerUid === caller) {
      callerHasVenueReviewPerm = true;
    } else {
      const memberSnap = await venueRef.collection('members').doc(caller).get();
      const memberData = memberSnap.exists ? memberSnap.data() : null;
      const isActiveMember = !!memberData && memberData.status === 'active';
      const perms = sanitizePermissions(memberData?.permissions || {});
      callerHasVenueReviewPerm = isActiveMember && !!perms['reviews.create'];
    }
    
    if (!callerIsLinkedMusician && !callerHasVenueReviewPerm) {
      const e = new Error("FORBIDDEN: caller not authorised to log dispute");
      e.code = "permission-denied";
      throw e;
    }

    // Build participants (ensure both sides present, unique)
    const counterpartyUid = callerIsVenueOwner
      ? (musician.userId || null)
      : ownerUid;
    const participants = [caller, counterpartyUid].filter(Boolean);

    // Create dispute doc
    const disputeRef = db.collection("disputes").doc();
    const now = Timestamp.now();

    const disputeDoc = {
      disputeId: disputeRef.id,
      gigId,
      venueId,
      musicianId,
      participants,                // used by rules for read access
      openedBy: caller,
      reason: reason.trim(),
      message: (message || "").trim() || null,
      attachments: attachments.filter(x => typeof x === "string"),
      status: "open",              // 'open' | 'resolved' | 'closed'
      createdAt: now,
      updatedAt: now,
      // Handy denormalised fields for UI:
      venueName: venue.name || null,
      musicianName: musician.name || null,
    };

    await disputeRef.set(disputeDoc);

    return {
      success: true,
      disputeId: disputeRef.id,
      ui: { notice: "Dispute logged. Our team will review this shortly." }
    };
  }
);