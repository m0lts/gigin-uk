/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { FieldValue } from "firebase-admin/firestore";

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
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigData, musicianProfileId, nonPayableGig = false } = req.data || {};
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