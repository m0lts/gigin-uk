/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { FieldValue } from "firebase-admin/firestore";
import { sanitizePermissions } from "../../../lib/utils/permissions.js";

/**
 * acceptGigOffer (CF)
 * Direct port of client logic:
 * - Builds updated applicants list (accepted/declined based on nonPayableGig)
 * - Writes agreedFee, paid, status on gig
 * - If nonPayableGig, adds gigId to musicianProfiles/{musicianProfileId}.confirmedGigs
 *
 * Input:
 *   {
 *     gigData: {
 *       gigId: string,
 *       kind?: string,
 *       applicants: Array<{ id: string, fee: string|number, status?: string }>
 *     },
 *     musicianProfileId: string,
 *     nonPayableGig?: boolean
 *   }
 * Output:
 *   { updatedApplicants: Array<Object>, agreedFee: string|number|null }
 */
export const acceptGigOffer = callable(
  { 
    authRequired: true,
    enforceAppCheck: true,
    // concurrency: 80,
    // minInstances: 1,
    // maxInstances: 20,
    // memory: '256MiB',
    // cpu: 1,
  },
  async (req) => {
    const { gigData, musicianProfileId, nonPayableGig = false, role } = req.data || {};
    const caller = req.auth.uid;

    if (!gigData || !musicianProfileId) {
      const e = new Error('INVALID_ARGUMENT: gigData and musicianProfileId are required');
      // @ts-ignore
      e.code = 'invalid-argument';
      throw e;
    }

    if (!caller) {
      const e = new Error('PERMISSION_DENIED: must be authenticated');
      // @ts-ignore
      e.code = 'permission-denied';
      throw e;
    }

    if (role === 'venue') {
      const venueId = gigData?.venueId;
      const venueRef = db.doc(`venueProfiles/${venueId}`);
      const venueSnap = await venueRef.get();
      if (!venueSnap.exists) {
        const e = new Error('NOT_FOUND: venue');
        // @ts-ignore
        e.code = 'not-found';
        throw e;
      }
      const venue = venueSnap.data() || {};
      const isOwner = venue?.createdBy === caller || venue?.userId === caller;
  
      let canInvite = isOwner;
      if (!canInvite) {
        const memberSnap = await venueRef.collection('members').doc(caller).get();
        const memberData = memberSnap.exists ? memberSnap.data() : null;
        const isActiveMember = !!memberData && memberData.status === 'active';
        const perms = sanitizePermissions(memberData?.permissions);
        const hasInvitePerm = !!perms['gigs.applications.manage'];
        canInvite = isActiveMember && hasInvitePerm;
      }
      
      if (!canInvite) {
        const e = new Error('PERMISSION_DENIED: requires venue owner or active member with gigs.applications.manage');
        // @ts-ignore
        e.code = 'permission-denied';
        throw e;
      }
    }

    const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
    let agreedFee = null;

    const updatedApplicants = applicants.map((applicant) => {
      if (applicant.id === musicianProfileId) {
        agreedFee = applicant.fee;
        return { ...applicant, status: nonPayableGig ? "confirmed" : "accepted" };
      }
      if (nonPayableGig) {
        return { ...applicant };
      } else {
        return { ...applicant, status: "declined" };
      }
    });

    const gigRef = db.doc(`gigs/${gigData.gigId}`);
    await gigRef.update({
      applicants: updatedApplicants,
      agreedFee: `${agreedFee}`,
      paid: !!nonPayableGig,
      status: nonPayableGig || gigData?.kind === "Ticketed Gig" ? "closed" : "open",
    });

    if (nonPayableGig) {
      const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);
      await musicianRef.update({
        confirmedGigs: FieldValue.arrayUnion(gigData.gigId),
      });
    }

    return { updatedApplicants, agreedFee };
  }
);