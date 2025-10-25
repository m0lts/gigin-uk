/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * removeGigApplicant (CF)
 * Reads gig, removes the specified musician from applicants, writes back.
 *
 * Input:
 *   {
 *     gigId: string,
 *     musicianId: string
 *   }
 * Output:
 *   { applicants: Array<Object> } // updated applicants (or empty array if none)
 */
export const removeGigApplicant = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigId, musicianId } = req.data || {};

    const gigRef = db.doc(`gigs/${gigId}`);
    const snap = await gigRef.get();
    if (!snap.exists) {
      return { applicants: [] };
    }

    const gig = snap.data() || {};
    const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
    const updatedApplicants = applicants.filter((a) => a?.id !== musicianId);

    await gigRef.update({ applicants: updatedApplicants });

    return { applicants: updatedApplicants };
  }
);