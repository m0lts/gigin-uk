/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { defaultVenueMemberPerms } from "../../../lib/utils/permissions.js";

/**
 * Callable: accept a venue invite and add the caller as a venue member.
 *
 * Input:
 * - `inviteId` (string) — the invite document id in `venueInvites/{inviteId}`
 *
 * Behavior:
 * - Validates invite exists and is not expired.
 * - Creates/merges `venueProfiles/{venueId}/members/{uid}` with default perms.
 * - Adds `venueId` to `users/{uid}.venueProfiles` array.
 * - Deletes the invite and writes an audit log.
 *
 * Security:
 * - Requires authenticated user.
 * - App Check enforced by the callable wrapper.
 *
 * Region: europe-west3.
 *
 * @function acceptVenueInvite
 * @param {import("firebase-functions/v2/https").CallableRequest} req
 * @returns {Promise<{ok: boolean, venueId?: string, message?: string}>}
 */
export const acceptVenueInvite = callable(
  {
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
    authRequired: true,
    // enforceAppCheck: true is already defaulted in our wrapper; add here if you want explicit
  },
  async (req) => {
    const uid = req.auth.uid;
    if (!uid) throw new Error("UNAUTHENTICATED");

    const inviteId = (req.data.inviteId || "").trim();
    if (!inviteId) throw new Error("INVALID_ARGUMENT: inviteId");

    const inviteRef = db.doc(`venueInvites/${inviteId}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) throw new Error("NOT_FOUND: invite");

    const invite = inviteSnap.data();
    const venueId = invite.venueId;
    const expiresAt = invite.expiresAt;
    if (!venueId || !expiresAt) throw new Error("INVALID_INVITE_DATA");

    const now = Timestamp.now();
    if (expiresAt.toMillis() <= now.toMillis()) {
      throw new Error("EXPIRED_INVITE");
    }

    const memberRef = db.doc(`venueProfiles/${venueId}/members/${uid}`);
    const memberSnap = await memberRef.get();
    if (memberSnap.exists && memberSnap.get("status") === "active") {
      await inviteRef.delete();
      return { ok: true, message: "ALREADY_MEMBER", venueId };
    }

    const perms = defaultVenueMemberPerms();

    const batch = db.batch();
    batch.set(
      memberRef,
      {
        status: "active",
        perms,
        addedBy: invite.invitedBy || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const userRef = db.doc(`users/${uid}`);
    batch.set(userRef, {
      venueProfiles: FieldValue.arrayUnion(venueId),
    });

    batch.delete(inviteRef);

    batch.set(db.collection("auditLogs").doc(), {
      type: "venueInviteAccepted",
      venueId,
      inviteId,
      invitedBy: invite.invitedBy || null,
      memberUid: uid,
      at: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return { ok: true, venueId };
  }
);