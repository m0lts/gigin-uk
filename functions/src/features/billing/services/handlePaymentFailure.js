/* eslint-disable */
import { admin, Timestamp } from "../../../lib/admin.js";

/**
 * Handles post-payment failure side effects:
 * - Marks gig payment as failed, reopens the gig
 * - Posts a system announcement in the conversation between venue & musician
 * - Updates conversation last message metadata
 *
 * @function handlePaymentFailure
 * @param {import("stripe").Stripe.PaymentIntent} failedIntent
 * @returns {Promise<void>}
 */
export const handlePaymentFailure = async (failedIntent) => {
  const gigId = failedIntent.metadata.gigId;
  const venueId = failedIntent.metadata.venueId;
  const applicantId = failedIntent.metadata.applicantId;
  const paymentIntentId = failedIntent.id;
  if (!gigId || !venueId || !applicantId) {
    console.error("Missing required metadata in failedIntent");
    return;
  }
  try {
    const timestamp = Timestamp.now();
    const gigRef = admin.firestore().collection("gigs").doc(gigId);
    await gigRef.update({
      paymentStatus: "failed",
      paid: false,
      paymentIntentId,
      status: "open",
    });
    const conversationsRef = admin.firestore().collection("conversations");
    const convoSnap = conversationsRef
        .where("gigId", "==", gigId)
        .where("participants", "array-contains", venueId);
    const convoDoc = convoSnap.docs.find((d) => {
      const data = d.data() || {};
      const participants = data.participants || [];
      return Array.isArray(participants) && participants.includes(applicantId);
    });
    if (convoDoc) {
      const conversationId = convoDoc.id;
      const messagesRef = admin
          .firestore()
          .collection("conversations")
          .doc(conversationId)
          .collection("messages");
      await messagesRef.add({
        senderId: "system",
        text:
        `The payment for this gig failed. Please try again or contact support.`,
        timestamp: timestamp,
        type: "announcement",
        status: "payment failed",
      });
      await admin.firestore()
          .collection("conversations")
          .doc(conversationId).update({
            lastMessage: "The payment for this gig failed.",
            lastMessageTimestamp: timestamp,
            lastMessageSenderId: "system",
          });
      console.log(
          `Updated conversation ${conversationId} for payment failure.`,
      );
    } else {
      console.error(
          "No relevant conversation found between venue and musician.",
      );
    }
    console.log(`Handled payment failure for gig ${gigId}`);
  } catch (error) {
    console.error("Error handling payment failure:", error.message);
    throw new Error("Error updating gig and other data after payment failure.");
  }
};