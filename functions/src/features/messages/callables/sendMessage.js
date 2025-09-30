/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * sendMessage (CF)
 * Input:
 *   { conversationId: string, message: { senderId: string, text: string } }
 * Output:
 *   { success: true, timestamp: number }
 */
export const sendMessage = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { conversationId, message = {} } = req.data || {};
    const { senderId, text } = message;

    const ts = Timestamp.now();

    const messagesRef = db.collection("conversations").doc(conversationId).collection("messages");
    await messagesRef.add({
      senderId,
      text,
      timestamp: ts,
      type: "text",
    });

    const convRef = db.doc(`conversations/${conversationId}`);
    await convRef.update({
      lastMessage: text,
      lastMessageTimestamp: ts,
      lastMessageSenderId: senderId,
    });

    return { success: true, timestamp: ts.toMillis() };
  }
);