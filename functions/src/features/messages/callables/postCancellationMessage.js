/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * postCancellationMessage (CF)
 * - Inserts a cancellation announcement into the messages subcollection
 * - Updates the conversation doc with cancellation info
 *
 * Input:
 *   {
 *     conversationId: string,
 *     senderId: string,
 *     message: string,
 *     cancellingParty: string
 *   }
 * Output: { success: true }
 */
export const postCancellationMessage = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { conversationId, senderId, message, cancellingParty } = req.data || {};

    if (!conversationId || !senderId || !message || !cancellingParty) {
      throw new Error("conversationId, senderId, message, and cancellingParty are required.");
    }

    const ts = Timestamp.now();
    const convRef = db.collection("conversations").doc(conversationId);
    const messagesRef = convRef.collection("messages");

    await messagesRef.add({
      senderId,
      text: message,
      type: "announcement",
      status: "cancellation",
      cancellingParty,
      timestamp: ts,
    });

    await convRef.update({
      lastMessage: `Unfortunately, ${cancellingParty} has had to cancel.`,
      lastMessageTimestamp: ts,
      lastMessageSenderId: senderId,
    });

    return { success: true };
  }
);