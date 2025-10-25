/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { PROD_RUNTIME_OPTIONS } from "../../../config/constants.js";

/**
 * applyToGig (CF)
 * Moves the client logic to server: read gig, append application, update applicants array.
 *
 * Input:
 *   {
 *     gigId: string,
 *     musicianProfile: { musicianId: string, bandProfile?: boolean }
 *   }
 * Output:
 *   { applicants: Array<Object> }  // updated applicants, or { applicants: null } if gig not found
 */
export const applyToGig = callable(
  { 
    authRequired: true,
    enforceAppCheck: true,
    ...PROD_RUNTIME_OPTIONS,
  },
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
      type: musicianProfile?.bandProfile ? "band" : "musician",
    };

    const updatedApplicants = [...(Array.isArray(gig.applicants) ? gig.applicants : []), newApplication];

    await gigRef.update({ applicants: updatedApplicants });

    return { applicants: updatedApplicants };
  }
);