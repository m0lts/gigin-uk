/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * notifyOtherApplicantsGigConfirmed (CF)
 * Direct move from client:
 * - Builds newApplicants array with others -> status:"declined"
 * - For all conversations of the gig:
 *     • if it's venue + one of the "other" applicants
 *     • set pending application/invitation/negotiation messages -> "declined"
 *     • add system announcement
 *     • close the conversation with lastMessage fields
 *
 * NOTE: This function does NOT write the gig doc; it only returns newApplicants,
 *       mirroring your client code which updates the gig elsewhere.
 *
 * Input:
 *   {
 *     gigData: {
 *       gigId: string,
 *       venueId: string,
 *       applicants?: Array<{ id: string, [k:string]: any }>
 *     },
 *     acceptedMusicianId: string
 *   }
 * Output:
 *   { newApplicants: Array<Object> }
 */
export const notifyOtherApplicantsGigConfirmed = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigData = {}, acceptedMusicianId } = req.data || {};
    const applicants = Array.isArray(gigData.applicants) ? gigData.applicants : [];
    const otherIds = applicants
      .map((a) => a?.id)
      .filter(Boolean)
      .filter((id) => id !== acceptedMusicianId);

    // 1) Build updated applicants array (decline others)
    const newApplicants = applicants.map((a) =>
      a?.id === acceptedMusicianId ? a : { ...a, status: "declined" }
    );

    // 2) Flip pending messages to declined + add announcement + close conversations
    const convSnap = await db
      .collection("conversations")
      .where("gigId", "==", gigData.gigId)
      .get();

    const pendingTypes = ["application", "invitation", "negotiation"];
    const text =
      "This gig has been confirmed with another musician. Applications are now closed.";

    for (const convDoc of convSnap.docs) {
      const data = convDoc.data() || {};
      const participants = Array.isArray(data.participants) ? data.participants : [];
      const isVenueAndOtherApplicant =
        participants.includes(gigData.venueId) &&
        otherIds.some((id) => participants.includes(id));

      if (!isVenueAndOtherApplicant) continue;

      const messagesRef = convDoc.ref.collection("messages");

      // Fetch all pending application/invitation/negotiation messages
      const pendingSnap = await messagesRef
        .where("status", "==", "pending")
        .where("type", "in", pendingTypes)
        .get();

      const batch = db.batch();

      // Mark pending -> declined
      pendingSnap.forEach((m) => batch.update(m.ref, { status: "declined" }));

      // Announcement
      const announceRef = messagesRef.doc();
      batch.set(announceRef, {
        senderId: "system",
        text,
        timestamp: Timestamp.now(),
        type: "announcement",
        status: "gig confirmed",
      });

      // Close conversation
      batch.update(convDoc.ref, {
        lastMessage: text,
        lastMessageTimestamp: Timestamp.now(),
        lastMessageSenderId: "system",
        status: "closed",
      });

      await batch.commit();
    }

    return { newApplicants };
  }
);