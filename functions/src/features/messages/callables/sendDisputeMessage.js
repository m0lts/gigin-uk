/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * sendDisputeMessage (CF)
 * Sends a system-generated dispute message to a conversation.
 *
 * Input:
 *   {
 *     conversationId: string,
 *     venueName: string
 *   }
 * Output:
 *   { timestamp: number }
 */
export const sendDisputeMessage = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { conversationId, venueName } = req.data || {};
    if (!conversationId || !venueName) {
      throw new Error("conversationId and venueName are required.");
    }


    const ts = Timestamp.now();
    const convRef = db.collection("conversations").doc(conversationId);
    const messagesRef = convRef.collection("messages");

    const text = `${venueName} has reported this gig. We have withheld the gig fee until the dispute is resolved. We will be in touch shortly.`;

    await messagesRef.add({
      senderId: "system",
      text,
      type: "announcement",
      status: "dispute",
      timestamp: ts,
    });

    // 🔔 Bump the conversation so list/notifications pick it up
    await convRef.update({
      lastMessage: text,
      lastMessageTimestamp: ts,
      lastMessageSenderId: "system",
      status: "open",
    });

    return { timestamp: ts.toMillis() };
  }
);