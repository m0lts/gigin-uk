/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

/**
 * Transfer venue ownership to another user (by email).
 *
 * Input:
 *   { venueId: string, recipientEmail?: string, toUserId?: string }
 *     - Prefer recipientEmail; toUserId is supported as a fallback.
 *
 * Behaviour:
 *   - Auth required, App Check enforced
 *   - Validates caller is current owner of the venue
 *   - Looks up recipient by email (if provided)
 *   - Transaction:
 *       * venueProfiles/{venueId} -> createdBy, userId, accountName, email
 *       * users/{from}.venueProfiles array remove
 *       * users/{to}.venueProfiles array add
 *
 * NOTE:
 *   - Does not modify members subcollection (per request)
 *   - Returns a `uiLog` array for front-end UX messages
 */
export const transferVenueOwnership = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const caller = req.auth.uid;
    const { venueId, recipientEmail, toUserId: rawToUserId } = req.data || {};
    const uiLog = [];

    const fail = (code, message) => {
      const e = new Error(message);
      e.code = code;
      throw e;
    };

    // ---- Basic input validation
    if (!venueId || typeof venueId !== "string") {
      fail("invalid-argument", "venueId required");
    }

    // Resolve target user id (email lookup preferred)
    let toUserId = null;
    let recipientName = "";

    if (typeof recipientEmail === "string" && recipientEmail.trim()) {
      const normalized = recipientEmail.trim().toLowerCase();
      uiLog.push({ level: "info", code: "lookup-start", message: `Looking up ${normalized}…` });

      const q = await db.collection("users").where("email", "==", normalized).limit(1).get();
      if (q.empty) {
        // Return a friendly, UI-ready response instead of throwing, so the modal can show a toast nicely
        return {
          success: false,
          code: "recipient-not-found",
          message: "No Gigin account found for that email.",
          uiLog: [...uiLog, { level: "warn", code: "lookup-miss", message: "No account found for that email." }],
        };
      }
      const doc = q.docs[0];
      const u = doc.data() || {};
      toUserId = doc.id;
      recipientName = u.name || "";
      uiLog.push({ level: "info", code: "lookup-hit", message: `Found ${recipientName || toUserId}.` });
    } else if (typeof rawToUserId === "string" && rawToUserId.trim()) {
      toUserId = rawToUserId.trim();
      uiLog.push({ level: "info", code: "uid-provided", message: `Target user ID provided (${toUserId}).` });
    } else {
      fail("invalid-argument", "recipientEmail or toUserId is required");
    }

    if (toUserId === caller) {
      return {
        success: false,
        code: "self-transfer",
        message: "You already own this venue.",
        uiLog: [...uiLog, { level: "warn", code: "self-transfer", message: "Cannot transfer to yourself." }],
      };
    }

    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const fromUserRef = db.doc(`users/${caller}`);
    const toUserRef   = db.doc(`users/${toUserId}`);

    // ---- Transaction: verify + update venue + user arrays
    await db.runTransaction(async (tx) => {
      const [venueSnap, fromSnap, toSnap] = await Promise.all([
        tx.get(venueRef),
        tx.get(fromUserRef),
        tx.get(toUserRef),
      ]);

      if (!venueSnap.exists) fail("not-found", "Venue not found");
      if (!fromSnap.exists)  fail("not-found", "Current user profile not found");
      if (!toSnap.exists)    fail("not-found", "Recipient user profile not found");

      const venue = venueSnap.data() || {};
      const from  = fromSnap.data() || {};
      const to    = toSnap.data() || {};

      // Owner check: treat createdBy as source of truth; fall back to userId for legacy docs
      const currentOwner = venue.createdBy || venue.userId;
      if (currentOwner !== caller) fail("permission-denied", "Only the current owner can transfer this venue");

      // Build next arrays
      const fromList = Array.isArray(from.venueProfiles) ? from.venueProfiles : [];
      const toList   = Array.isArray(to.venueProfiles)   ? to.venueProfiles   : [];

      const nextFrom = fromList.filter((id) => id !== venueId);
      const nextTo   = toList.includes(venueId) ? toList : [...toList, venueId];

      // Denormalised display fields on venue from recipient's profile
      const newAccountName = (to.name || "").trim();
      const newEmail       = (to.email || "").trim();

      // Update venue owner + denorm fields
      tx.update(venueRef, {
        createdBy: toUserId,
        userId: toUserId, // legacy reads
        ...(newAccountName ? { accountName: newAccountName } : {}),
        ...(newEmail ? { email: newEmail } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update user docs (ID arrays)
      tx.update(fromUserRef, { venueProfiles: nextFrom });
      tx.update(toUserRef,   { venueProfiles: nextTo });
    });

    uiLog.push({ level: "success", code: "transfer-complete", message: "Venue ownership transferred." });

    return {
      success: true,
      venueId,
      fromUserId: caller,
      toUserId,
      recipientName,
      uiLog,
    };
  }
);