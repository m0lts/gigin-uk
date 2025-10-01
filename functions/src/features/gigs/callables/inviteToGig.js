/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

/**
 * inviteToGig (CF)
 * Server-side: read gig, append invited application, update applicants array.
 *
 * Input:
 *   {
 *     gigId: string,
 *     musicianProfile: { musicianId: string }
 *   }
 * Output:
 *   { applicants: Array<Object> } // updated applicants, or { applicants: null } if gig not found
 */
export const inviteToGig = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const caller = req.auth.uid;
    const { gigId, musicianProfile } = req.data || {};
    const musicianId = musicianProfile?.musicianId;
    const musicianName = musicianProfile?.name || null;

    if (!gigId || !musicianId) {
      const e = new Error('INVALID_ARGUMENT: gigId and musicianProfile.musicianId are required');
      // @ts-ignore
      e.code = 'invalid-argument';
      throw e;
    }

    const gigRef = db.doc(`gigs/${gigId}`);
    const gigSnap = await gigRef.get();
    if (!gigSnap.exists) return { applicants: null };

    const gig = gigSnap.data() || {};
    const venueId = gig.venueId;
    if (!venueId) {
      const e = new Error('FAILED_PRECONDITION: gig is missing venueId');
      // @ts-ignore
      e.code = 'failed-precondition';
      throw e;
    }

    // ---- Authorization: caller must be venue owner or active member
    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) {
      const e = new Error('NOT_FOUND: venue');
      // @ts-ignore
      e.code = 'not-found';
      throw e;
    }
    const venue = venueSnap.data() || {};
    const isOwner = venue.createdBy === caller || venue.userId === caller;

    let isActiveMember = false;
    if (!isOwner) {
      const memberSnap = await venueRef.collection('members').doc(caller).get();
      isActiveMember = memberSnap.exists && memberSnap.data()?.status === 'active';
    }
    if (!isOwner && !isActiveMember) {
      const e = new Error('PERMISSION_DENIED: only venue owner or active member can invite');
      // @ts-ignore
      e.code = 'permission-denied';
      throw e;
    }

    const now = new Date();

    // Build applicant entry
    const applicant = {
      id: musicianId,
      timestamp: now,
      fee: gig.budget || '£0',
      status: 'pending',
      invited: true,
    };

    // Avoid duplicate applicant entries
    const currentApplicants = Array.isArray(gig.applicants) ? gig.applicants : [];
    const alreadyIncluded = currentApplicants.some(a => a?.id === musicianId);
    const updatedApplicants = alreadyIncluded
      ? currentApplicants
      : currentApplicants.concat(applicant);

    // Build musician profile entry
    const musicianEntry = {
      gigId,
      profileId: musicianId,
      ...(musicianName ? { name: musicianName } : {}),
    };

    // Write both changes atomically
    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);

    await db.runTransaction(async (tx) => {
      // Re-read gig inside txn for safety
      const freshGig = (await tx.get(gigRef)).data() || {};
      const freshApplicants = Array.isArray(freshGig.applicants) ? freshGig.applicants : [];
      const dup = freshApplicants.some(a => a?.id === musicianId);
      const nextApplicants = dup ? freshApplicants : freshApplicants.concat(applicant);

      tx.update(gigRef, { applicants: nextApplicants });

      // Use arrayUnion to avoid read-modify-write & duplicates
      tx.update(musicianRef, {
        gigApplications: FieldValue.arrayUnion(musicianEntry),
      });
    });

    return { applicants: updatedApplicants };
  }
);