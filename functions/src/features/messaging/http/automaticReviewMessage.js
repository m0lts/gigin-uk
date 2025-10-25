/* eslint-disable */
import { httpRaw } from "../../../lib/https.js"
import { REGION_US_CENTRAL } from "../../../config/regions.js";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { reviewPromptEmail } from "../../../lib/utils/emails.js";

/**
 * HTTP endpoint (Cloud Tasks target): posts an automatic “review prompt”
 * message into the conversation after a gig and emails both parties.
 *
 * Region: europe-west3 (adjust if your queue/endpoint is in another region)
 *
 * @function automaticReviewMessage
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const automaticReviewMessage = httpRaw(
  {
    timeoutSeconds: 3600,
    region: REGION_US_CENTRAL,
    memory: "512MiB",
  },
  async (req, res) => {
    const {
      musicianId,
      applicantId,
      gigId,
      disputeClearingTime,
      venueId,
      musicianName,
      musicianEmail,
      venueEmail,
      venueName,
    } = req.body;

    if (
      !musicianId ||
      !gigId ||
      !disputeClearingTime ||
      !venueId ||
      !musicianName ||
      !applicantId
    ) {
      console.error("Invalid payload received in task.");
      res.status(400).send("Invalid payload.");
      return;
    }

    try {
      const firestore = getFirestore();
      const conversationsRef = firestore.collection("conversations");
      const conversationQuery = conversationsRef
        .where("gigId", "==", gigId)
        .where("participants", "array-contains", applicantId);

      const conversationsSnapshot = await conversationQuery.get();
      const conversationDoc = conversationsSnapshot.docs[0];
      const conversationId = conversationDoc.id;

      const messagesRef = firestore
        .collection("conversations")
        .doc(conversationId)
        .collection("messages");

      await messagesRef.add({
        senderId: "system",
        text:
          `How was the gig? Please ` +
          "let us know if you had any issues within 48 hours.",
        type: "review",
        status: "open",
        disputeClearingTime,
        timestamp: Timestamp.now(),
      });

      await firestore
        .collection("conversations")
        .doc(conversationId)
        .update({
          lastMessage: `How was the gig?`,
          lastMessageTimestamp: Timestamp.now(),
          lastMessageSenderId: "system",
        });

      const mailRef = firestore.collection("mail");
      const musicianMessage = reviewPromptEmail({
        audience: "musician",
        musicianName,
        venueName,
        baseUrl: "https://giginmusic.com",
      });
      const venueMessage = reviewPromptEmail({
        audience: "venue",
        musicianName,
        venueName,
        baseUrl: "https://giginmusic.com",
      });

      await mailRef.add({ to: musicianEmail, message: musicianMessage });
      await mailRef.add({ to: venueEmail, message: venueMessage });

      console.log("Review message sent successfully.");
      res.status(200).send({ success: true });
    } catch (error) {
      console.error("Error clearing fee:", error);
      res.status(500).send("Internal Server Error.");
    }
  }
);