/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * markGigApplicantAsViewed (CF)
 * Marks a musician's gig application as viewed.
 *
 * Input:
 *   { gigId: string, musicianId: string }
 * Output:
 *   { success: true }
 */
export const markGigApplicantAsViewed = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigId, musicianId } = req.data || {};
    if (!gigId || !musicianId) throw new Error("gigId and musicianId required");

    const gigRef = db.doc(`gigs/${gigId}`);
    const snap = await gigRef.get();
    if (!snap.exists) return { success: false, reason: "Gig not found" };

    const data = snap.data() || {};
    const applicants = Array.isArray(data.applicants) ? data.applicants : [];

    const updatedApplicants = applicants.map((a) =>
      a?.id === musicianId ? { ...a, viewed: true } : a
    );

    await gigRef.update({ applicants: updatedApplicants });

    return { success: true };
  }
);