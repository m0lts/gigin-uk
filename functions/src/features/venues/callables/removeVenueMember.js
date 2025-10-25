/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";

/**
 * Callable: remove (soft-delete) a venue member and unlink venue from their user doc,
 * then remove them from all venue conversations' accountNames.
 *
 * Input: { venueId: string, memberUid: string }
 */
export const removeVenueMember = callable(
  { region: REGION_PRIMARY, timeoutSeconds: 300, authRequired: true, memory: "512MiB" },
  async (req) => {
    const callerUid = req.auth.uid;
    const { venueId, memberUid } = req.data || {};
    if (!venueId || !memberUid) throw new Error("INVALID_ARGUMENT");
    if (callerUid === memberUid) throw new Error("CANNOT_REMOVE_SELF");

    const venueRef   = db.doc(`venueProfiles/${venueId}`);
    const callerRef  = venueRef.collection("members").doc(callerUid);
    const targetRef  = venueRef.collection("members").doc(memberUid);
    const userRef    = db.doc(`users/${memberUid}`);

    // --- AuthZ checks
    const [callerSnap, targetSnap] = await Promise.all([callerRef.get(), targetRef.get()]);
    if (!callerSnap.exists) throw new Error("CALLER_NOT_MEMBER");
    if (!targetSnap.exists) throw new Error("TARGET_NOT_MEMBER");

    const caller = callerSnap.data() || {};
    const target = targetSnap.data() || {};
    if (caller.status !== "active") throw new Error("CALLER_NOT_ACTIVE");
    if (!caller.permissions?.["members.update"]) throw new Error("FORBIDDEN");
    if (target.role === "owner") throw new Error("CANNOT_REMOVE_OWNER");

    // --- Read the user's venues to decide whether to delete or arrayRemove
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const venueProfiles = Array.isArray(userData.venueProfiles) ? userData.venueProfiles : [];
    const onlyThisVenue =
      venueProfiles.length === 1 && venueProfiles[0] === venueId;

    // --- Member soft-remove + user doc update + audit
    {
      const batch = db.batch();

      batch.update(targetRef, {
        status: "removed",
        removedAt: FieldValue.serverTimestamp(),
      });

      if (onlyThisVenue) {
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
    }

    // --- Remove the member from all venue conversations' accountNames (and lastViewed)
    // Conversations schema assumptions:
    // - participants: [venueId, musicianIdOrBandId]
    // - accountNames: array of maps; venue staff entries have participantId == venueId AND accountId == memberUid
    // - optional lastViewed: { [uid]: Timestamp }
    const convsCol = db.collection("conversations");
    const PAGE = 400; // keep headroom for batch writes

    let lastDoc = null;
    let totalUpdated = 0;

    // paginate through venue conversations
    for (;;) {
      let q = convsCol.where("participants", "array-contains", venueId).orderBy("__name__").limit(PAGE);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();
      let writes = 0;

      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const accountNames = Array.isArray(data.accountNames) ? data.accountNames : [];
        const lastViewed   = (data.lastViewed && typeof data.lastViewed === "object") ? data.lastViewed : null;

        // Filter out the staff entry for this member
        const filtered = accountNames.filter(
          (a) => !(a && a.participantId === venueId && a.accountId === memberUid)
        );

        let changed = filtered.length !== accountNames.length;

        // Optionally remove lastViewed for this staffer
        let newLastViewed = lastViewed;
        if (lastViewed && Object.prototype.hasOwnProperty.call(lastViewed, memberUid)) {
          newLastViewed = { ...lastViewed };
          delete newLastViewed[memberUid];
          changed = true;
        }

        if (changed) {
          const updatePayload = { accountNames: filtered };
          if (lastViewed) updatePayload.lastViewed = newLastViewed;
          batch.update(docSnap.ref, updatePayload);
          writes++;
        }
      });

      if (writes > 0) {
        await batch.commit();
        totalUpdated += writes;
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE) break; // no more pages
    }

    return { ok: true, conversationsUpdated: totalUpdated };
  }
);