/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";

// helper to compute next stats
function nextStats(current, rating) {
  const base = current && typeof current === "object"
    ? {
        totalReviews: Number(current.totalReviews) || 0,
        positive: Number(current.positive) || 0,
        negative: Number(current.negative) || 0,
      }
    : { totalReviews: 0, positive: 0, negative: 0 };

  return {
    totalReviews: base.totalReviews + 1,
    positive: base.positive + (rating === "positive" ? 1 : 0),
    negative: base.negative + (rating === "negative" ? 1 : 0),
  };
}

/**
 * submitReview
 * Input: {
 *   reviewer: 'venue'|'musician',
 *   musicianId?: string,
 *   venueId?: string,
 *   gigId: string,
 *   rating: 'positive' | 'negative',
 *   reviewText?: string | null
 * }
 */
export const submitReview = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const caller = req.auth.uid;
    const {
      reviewer,
      musicianId,
      venueId,
      gigId,
      rating,
      reviewText,
    } = req.data || {};

    // basic validation
    if (!gigId || (rating !== "positive" && rating !== "negative")) {
      const e = new Error("INVALID_ARGUMENT");
      e.code = "invalid-argument";
      throw e;
    }
    if (reviewer !== "venue" && reviewer !== "musician") {
      const e = new Error("INVALID_ARGUMENT: reviewer must be 'venue' or 'musician'");
      e.code = "invalid-argument";
      throw e;
    }
    if (reviewer === "venue" && (!venueId || !musicianId)) {
      const e = new Error("INVALID_ARGUMENT: venue review needs venueId & musicianId");
      e.code = "invalid-argument";
      throw e;
    }
    if (reviewer === "musician" && (!venueId || !musicianId)) {
      const e = new Error("INVALID_ARGUMENT: musician review needs venueId & musicianId");
      e.code = "invalid-argument";
      throw e;
    }

    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
    const gigRef = db.doc(`gigs/${gigId}`);
    const userRef = db.doc(`users/${caller}`);

    const reviewRef = db.collection("reviews").doc(); // we'll set ID in tx

    await db.runTransaction(async (tx) => {
      // load venue, musician, gig, caller user
      const [venueSnap, musicianSnap, gigSnap, userSnap] = await Promise.all([
        tx.get(venueRef),
        tx.get(musicianRef),
        tx.get(gigRef),
        tx.get(userRef),
      ]);

      if (!venueSnap.exists) { const e = new Error("NOT_FOUND: venue"); e.code = "not-found"; throw e; }
      if (!musicianSnap.exists) { const e = new Error("NOT_FOUND: musician"); e.code = "not-found"; throw e; }
      if (!gigSnap.exists) { const e = new Error("NOT_FOUND: gig"); e.code = "not-found"; throw e; }
      if (!userSnap.exists) { const e = new Error("NOT_FOUND: user"); e.code = "not-found"; throw e; }

      const venue = venueSnap.data() || {};
      const musician = musicianSnap.data() || {};
      const user = userSnap.data() || {};

      // minimal role verification
      if (reviewer === "venue") {
        const owner = venue.createdBy || venue.userId;
        if (owner !== caller) {
          const e = new Error("FORBIDDEN: only venue owner can write venue review");
          e.code = "permission-denied";
          throw e;
        }
      } else { // reviewer === 'musician'
        // verify the caller has this musician profile linked
        const mp = Array.isArray(user.musicianProfile)
          ? user.musicianProfile
          : (user.musicianProfile ? [user.musicianProfile] : []);
        if (!mp.includes(musicianId)) {
          const e = new Error("FORBIDDEN: musician review requires linked musician profile");
          e.code = "permission-denied";
          throw e;
        }
      }

      // build review doc
      const reviewDoc = {
        musicianId,
        venueId,
        gigId,
        reviewWrittenBy: reviewer,
        rating,
        reviewText: (reviewText?.trim?.() || null),
        timestamp: Timestamp.now(),
      };

      // write review
      tx.set(reviewRef, reviewDoc);

      // update aggregates + refs
      if (reviewer === "venue") {
        // update musician profile stats
        const next = nextStats(musician.avgReviews, rating);
        tx.update(musicianRef, {
          avgReviews: next,
          reviews: FieldValue.arrayUnion(reviewRef.id),
        });
        // mark gig flag
        tx.update(gigRef, { venueHasReviewed: true });
      } else {
        // reviewer = musician -> update venue profile stats
        const next = nextStats(venue.avgReviews, rating);
        tx.update(venueRef, {
          avgReviews: next,
          reviews: FieldValue.arrayUnion(reviewRef.id),
        });
        // mark gig flag
        tx.update(gigRef, { musicianHasReviewed: true });
      }
    });

    return { success: true, reviewId: reviewRef.id };
  }
);