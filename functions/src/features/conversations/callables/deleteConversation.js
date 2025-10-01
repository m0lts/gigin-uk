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
  async (req) => {
    const conversationId = String(req.data?.conversationId || '');
    if (!conversationId) {
      const e = new Error('INVALID_ARGUMENT: conversationId is required');
      e.code = 'invalid-argument';
      throw e;
    }

    const callerUid = req.auth?.uid;
    if (!callerUid) {
      const e = new Error('UNAUTHENTICATED');
      e.code = 'unauthenticated';
      throw e;
    }

    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();
    if (!convSnap.exists) {
      // Idempotent delete semantics
      return { success: true };
    }

    const conv = convSnap.data() || {};
    const allowed = Array.isArray(conv.authorizedUserIds)
      ? conv.authorizedUserIds.includes(callerUid)
      : false;

    if (!allowed) {
      const e = new Error('PERMISSION_DENIED: not authorized on this conversation');
      e.code = 'permission-denied';
      throw e;
    }

    // Delete messages subcollection in chunks, then delete the conversation doc
    const messagesCol = convRef.collection('messages');

    while (true) {
      const page = await messagesCol.limit(500).get();
      if (page.empty) break;

      const batch = db.batch();
      page.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    await convRef.delete();
    return { success: true };
  }
);