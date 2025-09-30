/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * updateGigWithCounterOffer (CF)
 * Updates a musician’s fee proposal and status in the applicants array.
 *
 * Input:
 *   {
 *     gigData: { gigId: string, applicants: Array<{ id: string, fee?: string|number }> },
 *     musicianProfileId: string,
 *     newFee: string | number,
 *     sender: string
 *   }
 * Output:
 *   { applicants: Array<Object> } // updated applicants
 */
export const updateGigWithCounterOffer = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigData, musicianProfileId, newFee, sender } = req.data || {};
    const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];

    const now = new Date();
    const updatedApplicants = applicants.map((applicant) => {
      if (applicant.id === musicianProfileId) {
        return {
          ...applicant,
          fee: newFee,
          timestamp: now,
          status: "pending",
          sentBy: sender,
        };
      }
      return { ...applicant };
    });

    const gigRef = db.doc(`gigs/${gigData.gigId}`);
    await gigRef.update({ applicants: updatedApplicants });

    return { applicants: updatedApplicants };
  }
);