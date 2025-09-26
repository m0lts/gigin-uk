/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { PERM_KEYS, PERM_DEFAULTS, sanitizePermissions } from "../../../lib/utils/permissions.js";

/**
 * Callable: update a venue member's permissions.
 *
 * Security:
 * - Caller must be an *active* member of the venue with `members.update: true`.
 * - Caller cannot:
 *   - edit themselves
 *   - edit a user with role "owner"
 *
 * Input:
 * - venueId (string)
 * - memberUid (string)
 * - permissions (object) flat boolean map (partial or full)
 *
 * Writes:
 * - venueProfiles/{venueId}/members/{memberUid}.permissions (full normalized map)
 * - venueProfiles/{venueId}/members/{memberUid}.updatedAt
 * - auditLogs/...
 */
export const updateVenueMemberPermissions = callable(
  { region: REGION_PRIMARY, timeoutSeconds: 60, authRequired: true },
  async (req) => {
    const callerUid = req.auth.uid;
    const { venueId, memberUid, permissions } = req.data || {};
    if (!venueId || !memberUid || typeof permissions !== "object") {
      throw new Error("INVALID_ARGUMENT");
    }
    if (callerUid === memberUid) throw new Error("CANNOT_EDIT_SELF");

    // Validate keys
    for (const k of Object.keys(permissions)) {
      if (!PERM_KEYS.includes(k)) throw new Error(`INVALID_PERMISSION_KEY:${k}`);
    }

    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const callerRef = venueRef.collection("members").doc(callerUid);
    const targetRef = venueRef.collection("members").doc(memberUid);

    const [callerSnap, targetSnap] = await Promise.all([callerRef.get(), targetRef.get()]);
    if (!callerSnap.exists) throw new Error("CALLER_NOT_MEMBER");
    if (!targetSnap.exists) throw new Error("TARGET_NOT_MEMBER");

    const caller = callerSnap.data() || {};
    const target = targetSnap.data() || {};

    if (caller.status !== "active") throw new Error("CALLER_NOT_ACTIVE");
    const callerPerms = caller.permissions || {};
    if (!callerPerms["members.update"]) throw new Error("FORBIDDEN");

    if (target.role === "owner") throw new Error("CANNOT_EDIT_OWNER");

    // Normalize + enforce gigs.read true
    const normalized = sanitizePermissions({ ...PERM_DEFAULTS, ...permissions });

    await targetRef.set(
      { permissions: normalized, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    await db.collection("auditLogs").add({
      type: "memberPermissionsUpdated",
      venueId,
      targetUid: memberUid,
      byUid: callerUid,
      at: FieldValue.serverTimestamp(),
      permissionsAfter: normalized,
    });

    return { ok: true };
  }
);