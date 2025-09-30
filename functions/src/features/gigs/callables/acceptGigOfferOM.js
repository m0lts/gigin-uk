/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { FieldValue } from "firebase-admin/firestore";

/**
 * acceptGigOfferOM (CF)
 * Accepts a gig offer for an open mic.
 *
 * Input:
 *   {
 *     gigData: { gigId: string, applicants: Array<{ id: string, status?: string }> },
 *     musicianProfileId: string
 *   }
 * Output:
 *   { updatedApplicants: Array<Object> }
 */
export const acceptGigOfferOM = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigData, musicianProfileId } = req.data || {};
    const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];

    const updatedApplicants = applicants.map((applicant) => {
      if (applicant.id === musicianProfileId) {
        return { ...applicant, status: "confirmed" };
      }
      return { ...applicant };
    });

    const gigRef = db.doc(`gigs/${gigData.gigId}`);
    await gigRef.update({
      applicants: updatedApplicants,
      paid: true,
      status: "open",
    });

    const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);
    await musicianRef.update({
      confirmedGigs: FieldValue.arrayUnion(gigData.gigId),
    });

    return { updatedApplicants };
  }
);