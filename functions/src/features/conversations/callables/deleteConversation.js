/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * deleteConversation (CF)
 * Deletes a conversation if the caller is a participant.
 *
 * Input:
 *   { conversationId: string }
 * Output:
 *   { success: boolean }
 */
export const deleteConversation = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req, ctx) => {
    const { conversationId } = req.data || {};
    if (!conversationId) throw new Error("conversationId is required");

    const convRef = db.collection("conversations").doc(conversationId);
    const convSnap = await convRef.get();
    if (!convSnap.exists) throw new Error("Conversation not found");

    const convData = convSnap.data() || {};
    const participants = Array.isArray(convData.participants)
      ? convData.participants
      : [];

    // Require caller to be a participant
    const callerId = ctx.auth.uid;
    const isParticipant = participants.includes(callerId);
    if (!isParticipant) {
      throw new Error("Permission denied: not a participant of this conversation.");
    }

    await convRef.delete();
    return { success: true };
  }
);