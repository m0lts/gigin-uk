/* eslint-disable */
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { assertVenuePerm, sanitizePermissions } from "../../../lib/utils/permissions.js";
import { callable } from "../../../lib/callable.js";
import { v4 as uuid } from "uuid";

/**
 * Callable: Create a venue invite with optional initial permissions.
 *
 * Input:
 * {
 *   venueId: string,
 *   email: string,
 *   invitedByName?: string,
 *   permissionsInput?: object,    // optional; will be sanitized
 *   ttlDays?: number              // optional; default 7
 * }
 *
 * Auth: required
 */
export const createVenueInvite = callable(
  {
    region: REGION_PRIMARY,
    authRequired: true,
    enforceAppCheck: true,
    timeoutSeconds: 60,
  },
  async (req) => {
    const caller = req.auth?.uid;
    const {
      venueId,
      email,
      permissionsInput = {},
      invitedByName = null,
      ttlDays = 7,
    } = req.data || {};
    if (!venueId || typeof venueId !== "string") {
      const e = new Error("INVALID_ARGUMENT: venueId is required");
      e.code = "invalid-argument";
      throw e;
    }
    if (!email || typeof email !== "string") {
      const e = new Error("INVALID_ARGUMENT: email is required");
      e.code = "invalid-argument";
      throw e;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      const e = new Error("INVALID_ARGUMENT: email format invalid");
      e.code = "invalid-argument";
      throw e;
    }
    await assertVenuePerm(caller, venueId, "members.invite");
    const nowMs = Date.now();
    const q = await db
      .collection("venueInvites")
      .where("venueId", "==", venueId)
      .where("email", "==", normalizedEmail)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!q.empty) {
      const existing = q.docs[0].data() || {};
      const existingExpiresAt = existing.expiresAt?.toMillis?.()
        ? existing.expiresAt.toMillis()
        : (existing.expiresAt instanceof Date ? existing.expiresAt.getTime() : 0);
      if (existingExpiresAt > nowMs) {
        return { success: true, inviteId: q.docs[0].id, reused: true };
      }
    }
    const inviteId = uuid();
    const safePermissions = sanitizePermissions(permissionsInput || {});
    const expiresAt = Timestamp.fromMillis(
      nowMs + Math.max(1, Math.min(30, Number(ttlDays) || 7)) * 24 * 60 * 60 * 1000
    );
    const inviteDoc = {
      inviteId,
      venueId,
      invitedBy: caller,
      invitedByName: invitedByName || null,
      email: normalizedEmail,
      permissions: safePermissions,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      status: "pending",
    };
    await db.collection("venueInvites").doc(inviteId).set(inviteDoc);
    return { success: true, inviteId, reused: false };
  }
);