/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

function decStats(current, rating) {
  const base = current && typeof current === "object"
    ? {
        totalReviews: Math.max(0, Number(current.totalReviews) || 0),
        positive: Math.max(0, Number(current.positive) || 0),
        negative: Math.max(0, Number(current.negative) || 0),
      }
    : { totalReviews: 0, positive: 0, negative: 0 };

  const next = {
    totalReviews: Math.max(0, base.totalReviews - 1),
    positive: Math.max(0, base.positive - (rating === "positive" ? 1 : 0)),
    negative: Math.max(0, base.negative - (rating === "negative" ? 1 : 0)),
  };
  return next;
}

/**
 * deleteReview
 * Input: { reviewId: string }
 */
export const deleteReview = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const caller = req.auth.uid;
    const { reviewId } = req.data || {};
    if (!reviewId || typeof reviewId !== "string") {
      const e = new Error("INVALID_ARGUMENT: reviewId required");
      e.code = "invalid-argument";
      throw e;
    }

    const reviewRef = db.doc(`reviews/${reviewId}`);

    await db.runTransaction(async (tx) => {
      const reviewSnap = await tx.get(reviewRef);
      if (!reviewSnap.exists) {
        const e = new Error("NOT_FOUND: review");
        e.code = "not-found";
        throw e;
      }
      const review = reviewSnap.data() || {};
      const { reviewer = review.reviewWrittenBy, rating, venueId, musicianId, gigId } = review;

      const venueRef = db.doc(`venueProfiles/${venueId}`);
      const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
      const gigRef = db.doc(`gigs/${gigId}`);
      const userRef = db.doc(`users/${caller}`);

      const [venueSnap, musicianSnap, userSnap] = await Promise.all([
        tx.get(venueRef),
        tx.get(musicianRef),
        tx.get(userRef),
      ]);

      if (!venueSnap.exists || !musicianSnap.exists || !userSnap.exists) {
        const e = new Error("NOT_FOUND: linked docs");
        e.code = "not-found";
        throw e;
      }

      const venue = venueSnap.data() || {};
      const user = userSnap.data() || {};

      // authorisation: only the original side can delete
      if (reviewer === "venue") {
        const owner = venue.createdBy || venue.userId;
        if (owner !== caller) {
          const e = new Error("FORBIDDEN: only venue owner can delete this review");
          e.code = "permission-denied";
          throw e;
        }
        // decrement musician stats + pull review id
        const next = decStats(musicianSnap.data()?.avgReviews, rating);
        tx.update(musicianRef, {
          avgReviews: next,
          reviews: FieldValue.arrayRemove(reviewId),
        });
        // If you want, also flip gig flag back (optional)
        tx.update(gigRef, { venueHasReviewed: false });
      } else {
        // reviewer === 'musician'
        const mp = Array.isArray(user.musicianProfile)
          ? user.musicianProfile
          : (user.musicianProfile ? [user.musicianProfile] : []);
        if (!mp.includes(musicianId)) {
          const e = new Error("FORBIDDEN: only the musician can delete this review");
          e.code = "permission-denied";
          throw e;
        }
        const next = decStats(venueSnap.data()?.avgReviews, rating);
        tx.update(venueRef, {
          avgReviews: next,
          reviews: FieldValue.arrayRemove(reviewId),
        });
        tx.update(gigRef, { musicianHasReviewed: false });
      }

      tx.delete(reviewRef);
    });

    return { success: true, reviewId };
  }
);