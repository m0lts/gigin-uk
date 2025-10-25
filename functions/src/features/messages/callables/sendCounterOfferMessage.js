/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * sendCounterOfferMessage (CF)
 * Direct move from client:
 * - Adds a negotiation message (pending) with old/new fee
 * - Marks the original message as 'countered'
 * - Updates conversation lastMessage*
 *
 * Input:
 *   {
 *     conversationId: string,
 *     messageId: string,        // original message being countered
 *     senderId: string,
 *     newFee: number|string,
 *     oldFee: number|string,
 *     userRole: 'musician' | 'venue'
 *   }
 * Output:
 *   { timestamp: number }
 */
export const sendCounterOfferMessage = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const {
      conversationId,
      messageId,
      senderId,
      newFee,
      oldFee,
      userRole,
    } = req.data || {};

    const ts = Timestamp.now();
    const convRef = db.doc(`conversations/${conversationId}`);
    const messagesRef = convRef.collection("messages");

    // 1) Add the counter-offer message
    await messagesRef.add({
      senderId,
      text: `The ${userRole} proposes a new fee:`,
      timestamp: ts,
      type: "negotiation",
      status: "pending",
      oldFee,
      newFee,
    });

    // 2) Mark the original message as countered
    const counteredRef = messagesRef.doc(messageId);
    await counteredRef.update({ status: "countered" });

    // 3) Update conversation metadata
    await convRef.update({
      lastMessage: `The ${userRole} proposes a new fee of ${newFee}.`,
      lastMessageTimestamp: ts,
      lastMessageSenderId: senderId,
    });

    return { timestamp: ts.toMillis() };
  }
);