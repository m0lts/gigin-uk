/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * sendGigAcceptedMessage (CF)
 * Direct port:
 * - Sets original message status -> 'accepted'
 * - Adds announcement message (status: 'awaiting payment' | 'gig confirmed')
 * - Updates conversation lastMessage*
 *
 * Input:
 *   {
 *     conversationId: string,
 *     originalMessageId: string,
 *     senderId: string,
 *     agreedFee: string,
 *     userRole: 'musician' | 'venue',
 *     nonPayableGig?: boolean
 *   }
 * Output:
 *   { timestamp: number }
 */
export const sendGigAcceptedMessage = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const {
      conversationId,
      originalMessageId,
      senderId,
      agreedFee,
      userRole,
      nonPayableGig = false,
    } = req.data || {};

    const ts = Timestamp.now();

    // 1) Mark original message accepted
    const msgRef = db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .doc(originalMessageId);
    await msgRef.update({ status: "accepted" });

    // 2) Add announcement
    const announcement = !nonPayableGig
      ? `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`
      : `The ${userRole} has accepted the gig. The gig is now confirmed.`;

    const messagesRef = db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages");

    await messagesRef.add({
      senderId,
      text: announcement,
      timestamp: ts,
      type: "announcement",
      status: nonPayableGig ? "gig confirmed" : "awaiting payment",
    });

    // 3) Update conversation metadata
    const convRef = db.doc(`conversations/${conversationId}`);
    await convRef.update({
      lastMessage: announcement,
      lastMessageTimestamp: ts,
      lastMessageSenderId: senderId,
    });

    return { timestamp: ts.toMillis() };
  }
);