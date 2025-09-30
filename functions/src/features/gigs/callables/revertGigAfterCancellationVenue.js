/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { FieldValue } from "firebase-admin/firestore";

/**
 * revertGigAfterCancellationVenue (CF)
 * Server-side: remove cancelling musician, reset fields, set status "closed".
 *
 * Input:
 *   {
 *     gigData: { gigId: string, applicants: Array<{ id: string }> },
 *     musicianId: string,
 *     cancellationReason: string
 *   }
 * Output:
 *   { applicants: Array<Object> }
 */
export const revertGigAfterCancellationVenue = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigData, musicianId, cancellationReason } = req.data || {};
    const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
    const updatedApplicants = applicants.filter((a) => a?.id !== musicianId);

    const gigRef = db.doc(`gigs/${gigData.gigId}`);
    await gigRef.update({
      applicants: updatedApplicants,
      agreedFee: FieldValue.delete(),
      disputeClearingTime: FieldValue.delete(),
      disputeLogged: FieldValue.delete(),
      musicianFeeStatus: FieldValue.delete(),
      paymentStatus: FieldValue.delete(),
      clearPendingFeeTaskName: FieldValue.delete(),
      automaticMessageTaskName: FieldValue.delete(),
      paid: false,
      status: "closed",
      cancellationReason: cancellationReason || null,
    });

    return { applicants: updatedApplicants };
  }
);