/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * updateConversationDocument (CF)
 * Direct move from client:
 * - Updates conversations/{convId} with provided partial fields.
 *
 * Input:
 *   { convId: string, updates: Object }
 * Output:
 *   { success: true }
 */
export const updateConversationDocument = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { convId, updates = {} } = req.data || {};
    const convRef = db.doc(`conversations/${convId}`);
    await convRef.update(updates);
    return { success: true };
  }
);