/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";

/**
 * createBandInvite (CF)
 * - Adds a new invite doc in bandInvites
 * - Sets status=pending, createdAt, expiresAt (+7 days)
 *
 * Input:
 *   { bandId: string, invitedBy: string, invitedEmail?: string }
 * Output:
 *   { inviteId: string }
 */
export const createBandInvite = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { bandId, invitedBy, invitedEmail = "" } = req.data || {};
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    const docRef = await db.collection("bandInvites").add({
      bandId,
      invitedBy,
      invitedEmail,
      status: "pending",
      createdAt: Timestamp.now(),
      expiresAt,
    });

    return { inviteId: docRef.id };
  }
);