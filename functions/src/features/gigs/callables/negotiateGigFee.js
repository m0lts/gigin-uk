/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * negotiateGigFee (CF)
 * Server-side: read gig, append a negotiation entry, update applicants array.
 *
 * Input:
 *   {
 *     gigId: string,
 *     musicianProfile: { musicianId: string, bandProfile?: boolean }, // bandProfile not used here, included for parity
 *     newFee: string | number,
 *     sender: string
 *   }
 * Output:
 *   { applicants: Array<Object> } // updated applicants, or { applicants: [] } if gig not found
 */
export const negotiateGigFee = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigId, musicianProfile, newFee, sender } = req.data || {};

    const gigRef = db.doc(`gigs/${gigId}`);
    const gigSnap = await gigRef.get();
    if (!gigSnap.exists) {
      return { applicants: [] };
    }

    const gig = gigSnap.data() || {};
    const now = new Date();

    const newApplication = {
      id: musicianProfile?.musicianId,
      timestamp: now,
      fee: newFee ?? "£0",
      status: "pending",
      sentBy: sender,
    };

    const updatedApplicants = [
      ...(Array.isArray(gig.applicants) ? gig.applicants : []),
      newApplication,
    ];

    await gigRef.update({ applicants: updatedApplicants });

    return { applicants: updatedApplicants };
  }
);