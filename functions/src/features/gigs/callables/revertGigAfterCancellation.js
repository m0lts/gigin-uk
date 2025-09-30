/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { FieldValue } from "firebase-admin/firestore";

/**
 * revertGigAfterCancellation (CF)
 * Mirrors client logic:
 * - Removes the cancelling musician from applicants
 * - Sets remaining applicants' status => "pending"
 * - Resets payment/dispute fields, sets paid=false, status="open", writes cancellationReason
 * - Reopens relevant conversations and posts an announcement
 *
 * Input:
 *   {
 *     gigData: {
 *       gigId: string,
 *       venueId: string,
 *       applicants: Array<{ id: string, status?: string }>
 *     },
 *     musicianId: string,
 *     cancellationReason: string
 *   }
 * Output:
 *   { applicants: Array<Object> } // reopened applicants
 */
export const revertGigAfterCancellation = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigData, musicianId, cancellationReason } = req.data || {};
    const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
    const remaining = applicants.filter((a) => a?.id !== musicianId);
    const reopenedApplicants = remaining.map((a) => ({ ...a, status: "pending" }));

    const gigRef = db.doc(`gigs/${gigData.gigId}`);

    // Update gig document, mirror deleteField() with FieldValue.delete()
    await gigRef.update({
      applicants: reopenedApplicants,
      agreedFee: FieldValue.delete(),
      disputeClearingTime: FieldValue.delete(),
      disputeLogged: FieldValue.delete(),
      musicianFeeStatus: FieldValue.delete(),
      paymentStatus: FieldValue.delete(),
      clearPendingFeeTaskName: FieldValue.delete(),
      automaticMessageTaskName: FieldValue.delete(),
      paid: false,
      status: "open",
      cancellationReason: cancellationReason || null,
    });

    // Conversations fan-out
    const venueId = gigData?.venueId;
    const otherApplicantIds = new Set(reopenedApplicants.map((a) => a.id));
    const convSnap = await db
      .collection("conversations")
      .where("gigId", "==", gigData.gigId)
      .get();

    const pendingTypes = ["application", "invitation", "negotiation"];
    const reopenText = "This gig has reopened. Applications are open again.";
    const now = new Date();

    for (const convDoc of convSnap.docs) {
      const convData = convDoc.data() || {};
      const participants = Array.isArray(convData.participants) ? convData.participants : [];
      const matchedApplicantId = [...otherApplicantIds].find((id) => participants.includes(id));
      const isVenueAndApplicant = participants.includes(venueId) && matchedApplicantId;
      if (!isVenueAndApplicant) continue;

      const messagesRef = convDoc.ref.collection("messages");

      // Find messages with status "apps-closed" and type in pendingTypes
      const closedSnap = await messagesRef
        .where("status", "==", "apps-closed")
        .where("type", "in", pendingTypes)
        .get();

      const batch = db.batch();

      closedSnap.forEach((msgDoc) => batch.update(msgDoc.ref, { status: "pending" }));

      const announcementRef = messagesRef.doc();
      batch.set(announcementRef, {
        senderId: "system",
        text: reopenText,
        timestamp: now,
        type: "announcement",
        status: "reopened",
      });

      batch.update(convDoc.ref, {
        lastMessage: reopenText,
        lastMessageTimestamp: now,
        lastMessageSenderId: "system",
        status: "open",
      });

      await batch.commit();
    }

    return { applicants: reopenedApplicants };
  }
);