/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * updateDeclinedApplicationMessage (CF)
 *
 * Input:
 *   {
 *     conversationId: string,
 *     originalMessageId: string,
 *     senderId: string,
 *     userRole: string,
 *     fee?: string|number
 *   }
 * Output:
 *   { timestamp: number, lastMessage: string }
 */
export const updateDeclinedApplicationMessage = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const {
      conversationId,
      originalMessageId,
      senderId,
      userRole,
      fee = null,
    } = req.data || {};

    const ts = Timestamp.now();
    const lastMessage = fee
      ? `The fee of ${fee} was declined by the ${userRole}.`
      : "The gig application has been declined.";

    // 1) Update original message
    const msgRef = db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .doc(originalMessageId);

    await msgRef.update({
      status: "declined",
      timestamp: ts,
    });

    // 2) Update conversation metadata
    const convRef = db.doc(`conversations/${conversationId}`);
    await convRef.update({
      lastMessage,
      lastMessageTimestamp: ts,
      lastMessageSenderId: senderId,
    });

    return { timestamp: ts.toMillis(), lastMessage };
  }
);