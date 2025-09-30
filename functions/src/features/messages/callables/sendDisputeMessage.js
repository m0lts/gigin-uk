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
    const messagesRef = db.collection("conversations")
      .doc(conversationId)
      .collection("messages");

    await messagesRef.add({
      senderId: "system",
      text: `${venueName} has reported this gig. We have withheld the gig fee until the dispute is resolved. We will be in touch shortly.`,
      type: "announcement",
      status: "dispute",
      timestamp: ts,
    });

    return { timestamp: ts.toMillis() };
  }
);