/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

/**
 * updateMusicianCancelledGig
 * ---------------------------
 * Removes a gig from a musician's profile:
 *  - Filters it out of musicianProfiles/{musicianId}.gigApplications
 *  - Removes it from musicianProfiles/{musicianId}.confirmedGigs
 *
 * @param {string} musicianId - ID of the musician profile
 * @param {string} gigId - ID of the gig to remove
 */
export const cancelledGigMusicianProfileUpdate = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { musicianId, gigId } = req.data || {};
    const uid = req.auth.uid;

    if (!musicianId || !gigId) {
      const e = new Error("INVALID_ARGUMENT: musicianId and gigId are required.");
      e.code = "invalid-argument";
      throw e;
    }

    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
    const snapshot = await musicianRef.get();

    if (!snapshot.exists) {
      const e = new Error("NOT_FOUND: musician profile not found.");
      e.code = "not-found";
      throw e;
    }

    const data = snapshot.data() || {};
    const updatedGigApplications = Array.isArray(data.gigApplications)
      ? data.gigApplications.filter((app) => app?.gigId !== gigId)
      : [];

    await musicianRef.update({
      gigApplications: updatedGigApplications,
      confirmedGigs: FieldValue.arrayRemove(gigId),
    });

    return {
      success: true,
      musicianId,
      gigId,
    };
  }
);