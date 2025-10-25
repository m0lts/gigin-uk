/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * updateReviewMessageStatus (CF)
 * Direct move from client:
 * - Finds the most recent 'review' message from the provided messages array
 * - Sets that message's status -> 'closed'
 * - Updates conversation lastMessage* to "Review submitted."
 *
 * Input:
 *   {
 *     conversationId: string,
 *     messages: Array<{ id: string, type: string, timestamp: any }>,
 *     userId: string
 *   }
 * Output:
 *   { messageId: string | null }
 */
export const updateReviewMessageStatus = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { conversationId, messages = [], userId } = req.data || {};

    // Find most recent 'review' message from provided list
    const recentReviewMessage = messages
      .filter((m) => m && m.type === "review")
      .reduce((latest, current) => {
        if (!latest) return current;
        const lt = latest.timestamp;
        const ct = current.timestamp;
        const lms = typeof lt?.toMillis === "function" ? lt.toMillis() : lt;
        const cms = typeof ct?.toMillis === "function" ? ct.toMillis() : ct;
        return cms > lms ? current : latest;
      }, null);

    if (!recentReviewMessage?.id) {
      return { messageId: null };
    }

    const ts = Timestamp.now();

    const msgRef = db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .doc(recentReviewMessage.id);

    const convRef = db.doc(`conversations/${conversationId}`);

    await Promise.all([
      msgRef.update({ status: "closed" }),
      convRef.update({
        lastMessage: "Review submitted.",
        lastMessageTimestamp: ts,
        lastMessageSenderId: userId,
      }),
    ]);

    return { messageId: recentReviewMessage.id };
  }
);