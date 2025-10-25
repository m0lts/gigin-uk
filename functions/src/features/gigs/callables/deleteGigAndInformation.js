/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * deleteGigAndInformation (CF)
 * Server-side port of client logic:
 * - Delete gig
 * - Remove from venueProfiles/{venueId}.gigs
 * - Remove from each musicianProfiles/{id}.gigApplications
 * - For each relevant conversation:
 *     • set pending app/invite/negotiation messages to "apps-closed"
 *     • add system announcement
 *     • close the conversation
 *
 * Input:  { gigId: string }
 * Output: { success: true }
 */
export const deleteGigAndInformation = callable(
  { authRequired: true, enforceAppCheck: true, memory: "512MiB" },
  async (req) => {
    const { gigId } = req.data || {};
    if (!gigId || typeof gigId !== "string") {
      const e = new Error("INVALID_ARGUMENT: gigId is required");
      e.code = "invalid-argument";
      throw e;
    }

    const gigRef = db.doc(`gigs/${gigId}`);
    const gigSnap = await gigRef.get();
    if (!gigSnap.exists) {
      // mimic client: warn-and-return
      return { success: true };
    }

    const gigData = gigSnap.data() || {};
    const venueId = gigData.venueId;
    const applicants = Array.isArray(gigData.applicants) ? gigData.applicants : [];
    const ts = new Date();

    const batch = db.batch();

    // 1) Delete the gig doc
    batch.delete(gigRef);

    // 2) Remove from venue profile's gigs array
    if (venueId) {
      const venueRef = db.doc(`venueProfiles/${venueId}`);
      const venueSnap = await venueRef.get();
      if (venueSnap.exists) {
        const venueData = venueSnap.data() || {};
        const list = Array.isArray(venueData.gigs) ? venueData.gigs : [];
        const updatedGigs =
          list.length && typeof list[0] === "object" && list[0] !== null && "gigId" in list[0]
            ? list.filter((g) => g?.gigId !== gigId)
            : list.filter((id) => id !== gigId);
        batch.update(venueRef, { gigs: updatedGigs });
      }
    }

    // 3) Remove gig from each applicant's musicianProfile.gigApplications
    for (const applicant of applicants) {
      const musicianId = applicant?.id;
      if (!musicianId) continue;

      const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
      const musicianSnap = await musicianRef.get();
      if (musicianSnap.exists) {
        const musicianData = musicianSnap.data() || {};
        const apps = Array.isArray(musicianData.gigApplications) ? musicianData.gigApplications : [];
        const updatedApplications = apps.filter((a) => a?.gigId !== gigId);
        batch.update(musicianRef, { gigApplications: updatedApplications });
      }
    }

    // 4) Conversations fan-out
    const pendingTypes = ["application", "invitation", "negotiation"];
    const cancellationText = "This gig has been deleted by the venue.";

    for (const applicant of applicants) {
      const applicantId = applicant?.id;
      if (!applicantId) continue;

      const convsSnap = await db
        .collection("conversations")
        .where("gigId", "==", gigId)
        .where("participants", "array-contains", applicantId)
        .get();

      for (const convDoc of convsSnap.docs) {
        const convData = convDoc.data() || {};
        const participants = Array.isArray(convData.participants) ? convData.participants : [];
        if (!participants.includes(venueId)) continue; // ensure venue–applicant conversation

        const messagesRef = convDoc.ref.collection("messages");

        // 1) Set ALL messages of those types to apps-closed
        const typeSnap = await messagesRef.where("type", "in", pendingTypes).get();
        typeSnap.forEach((msgDoc) => {
          batch.update(msgDoc.ref, { status: "apps-closed" });
        });

        // 2) Add system announcement
        const newMsgRef = messagesRef.doc();
        batch.set(newMsgRef, {
          senderId: "system",
          text: cancellationText,
          timestamp: ts,
          type: "announcement",
          status: "gig deleted",
        });

        // 3) Update conversation last-message fields
        batch.update(convDoc.ref, {
          lastMessage: cancellationText,
          lastMessageTimestamp: ts,
          lastMessageSenderId: "system",
          status: "closed",
        });
      }
    }

    await batch.commit();
    return { success: true };
  }
);