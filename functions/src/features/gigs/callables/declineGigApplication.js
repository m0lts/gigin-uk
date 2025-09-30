/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * declineGigApplication (CF)
 * Updates a musician’s applicant status to "declined".
 *
 * Input:
 *   {
 *     gigData: { gigId: string, applicants: Array<{ id: string, status?: string }> },
 *     musicianProfileId: string
 *   }
 * Output:
 *   { applicants: Array<Object> } // updated applicants
 */
export const declineGigApplication = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigData, musicianProfileId } = req.data || {};
    const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];

    const updatedApplicants = applicants.map((applicant) =>
      applicant.id === musicianProfileId
        ? { ...applicant, status: "declined" }
        : { ...applicant }
    );

    const gigRef = db.doc(`gigs/${gigData.gigId}`);
    await gigRef.update({ applicants: updatedApplicants });

    return { applicants: updatedApplicants };
  }
);