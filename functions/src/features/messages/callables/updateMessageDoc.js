/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * updateMessageDoc (CF)
 *
 * Input:
 *   {
 *     conversationId: string,
 *     messageId: string,
 *     updates: object,                 // partial fields to set on the message (e.g. { status: 'withdrawn' })
 *     conversationUpdates?: object     // optional partial fields to set on conversations/{conversationId}
 *   }
 *
 * Output:
 *   {
 *     success: true,
 *     messageUpdated: boolean,
 *     conversationUpdated: boolean,
 *     messageTimestamp: number,        // when we processed the update (server time)
 *     conversationTimestamp?: number
 *   }
 */
export const updateMessageDoc = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { conversationId, messageId, updates = {}, conversationUpdates = null } = req.data || {};

    if (!conversationId || typeof conversationId !== "string") {
      const e = new Error("INVALID_ARGUMENT: conversationId is required");
      e.code = "invalid-argument";
      throw e;
    }
    if (!messageId || typeof messageId !== "string") {
      const e = new Error("INVALID_ARGUMENT: messageId is required");
      e.code = "invalid-argument";
      throw e;
    }
    if (typeof updates !== "object" || updates === null) {
      const e = new Error("INVALID_ARGUMENT: updates must be an object");
      e.code = "invalid-argument";
      throw e;
    }
    if (conversationUpdates && (typeof conversationUpdates !== "object" || conversationUpdates === null)) {
      const e = new Error("INVALID_ARGUMENT: conversationUpdates must be an object when provided");
      e.code = "invalid-argument";
      throw e;
    }

    const convRef = db.doc(`conversations/${conversationId}`);

    const ts = Timestamp.now();
    const msgRef = convRef.collection("messages").doc(messageId);

    await msgRef.update({
      ...updates,
      timestamp: ts,
    });

    let conversationUpdated = false;
    let convTs;

    if (conversationUpdates && Object.keys(conversationUpdates).length > 0) {
      convTs = Timestamp.now();
      await convRef.update({
        ...conversationUpdates,
        lastMessageTimestamp: convTs,
      });
      conversationUpdated = true;
    }

    return {
      success: true,
      messageUpdated: true,
      conversationUpdated,
      messageTimestamp: ts.toMillis(),
      ...(conversationUpdated ? { conversationTimestamp: convTs.toMillis() } : {}),
    };
  }
);