/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";

/**
 * Callable: remove (soft-delete) a venue member and unlink venue from their user doc.
 *
 * Security:
 * - Caller must be active and have `members.update: true`.
 * - Cannot remove self.
 * - Cannot remove an "owner".
 */
export const removeVenueMember = callable(
  { region: REGION_PRIMARY, timeoutSeconds: 60, authRequired: true },
  async (req) => {
    const callerUid = req.auth.uid;
    const { venueId, memberUid } = req.data || {};
    if (!venueId || !memberUid) throw new Error("INVALID_ARGUMENT");
    if (callerUid === memberUid) throw new Error("CANNOT_REMOVE_SELF");

    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const callerRef = venueRef.collection("members").doc(callerUid);
    const targetRef = venueRef.collection("members").doc(memberUid);
    const userRef = db.doc(`users/${memberUid}`);

    const [callerSnap, targetSnap] = await Promise.all([callerRef.get(), targetRef.get()]);
    if (!callerSnap.exists) throw new Error("CALLER_NOT_MEMBER");
    if (!targetSnap.exists) throw new Error("TARGET_NOT_MEMBER");

    const caller = callerSnap.data() || {};
    const target = targetSnap.data() || {};
    if (caller.status !== "active") throw new Error("CALLER_NOT_ACTIVE");
    if (!caller.permissions?.["members.update"]) throw new Error("FORBIDDEN");
    if (target.role === "owner") throw new Error("CANNOT_REMOVE_OWNER");

    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const venueProfiles = Array.isArray(userData.venueProfiles) ? userData.venueProfiles : [];
    const shouldDeleteField = venueProfiles.length === 1 && venueProfiles[0] === venueId;

    const batch = db.batch();
    batch.update(targetRef, {
      status: "removed",
      removedAt: FieldValue.serverTimestamp(),
    });

    if (shouldDeleteField) {
      batch.update(userRef, { venueProfiles: FieldValue.delete() });
    } else {
      batch.update(userRef, { venueProfiles: FieldValue.arrayRemove(venueId) });
    }

    batch.set(db.collection("auditLogs").doc(), {
      type: "memberRemoved",
      venueId,
      targetUid: memberUid,
      byUid: callerUid,
      at: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return { ok: true };
  }
);