/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

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
    const { gigId, musicianProfile } = req.data || {};

    const gigRef = db.doc(`gigs/${gigId}`);
    const gigSnap = await gigRef.get();
    if (!gigSnap.exists) {
      return { applicants: null };
    }

    const gig = gigSnap.data() || {};
    const now = new Date();

    const newApplication = {
      id: musicianProfile?.musicianId,
      timestamp: now,
      fee: gig.budget || "£0",
      status: "pending",
      invited: true,
    };

    const updatedApplicants = [...(Array.isArray(gig.applicants) ? gig.applicants : []), newApplication];

    await gigRef.update({ applicants: updatedApplicants });

    return { applicants: updatedApplicants };
  }
);