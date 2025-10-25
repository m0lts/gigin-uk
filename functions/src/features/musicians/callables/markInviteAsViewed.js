/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * markInviteAsViewed (CF)
 * -----------------------
 * Marks an applicant's gig invite as viewed.
 *
 * Input:
 *  {
 *    gigId: string,
 *    applicantId: string
 *  }
 *
 * Output:
 *  {
 *    success: boolean
 *  }
 */
export const markInviteAsViewed = callable(
  { 
    authRequired: true,
    enforceAppCheck: true,
  },
  async (req) => {
    const { gigId, applicantId } = req.data || {};

    if (!gigId || !applicantId) {
      const e = new Error("INVALID_ARGUMENT: gigId and applicantId are required.");
      e.code = "invalid-argument";
      throw e;
    }

    const gigRef = db.collection("gigs").doc(gigId);
    const gigSnap = await gigRef.get();

    if (!gigSnap.exists) {
      const e = new Error(`NOT_FOUND: Gig ${gigId} does not exist.`);
      e.code = "not-found";
      throw e;
    }

    const gigData = gigSnap.data() || {};
    const applicants = Array.isArray(gigData.applicants) ? gigData.applicants : [];

    const updatedApplicants = applicants.map((a) =>
      a?.id === applicantId ? { ...a, viewed: true } : a
    );

    await gigRef.update({ applicants: updatedApplicants });

    return { success: true };
  }
);