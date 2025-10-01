/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";
import { FieldPath } from "firebase-admin/firestore";

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
// transferVenueOwnership.ts
// Utility: commit writes in chunks of ~400
async function commitInChunks(mutators, chunkSize = 400) {
  for (let i = 0; i < mutators.length; i += chunkSize) {
    const batch = db.batch();
    for (const m of mutators.slice(i, i + chunkSize)) m(batch);
    await batch.commit();
  }
}

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

    if (!venueId || typeof venueId !== 'string') fail('invalid-argument', 'venueId required');

    // Resolve recipient
    let toUserId = null;
    let recipientName = '';
    let recipientPhoto = null;

    if (typeof recipientEmail === 'string' && recipientEmail.trim()) {
      const normalized = recipientEmail.trim().toLowerCase();
      uiLog.push({ level: 'info', code: 'lookup-start', message: `Looking up ${normalized}…` });
      const q = await db.collection('users').where('email', '==', normalized).limit(1).get();
      if (q.empty) {
        return {
          success: false,
          code: 'recipient-not-found',
          message: 'No Gigin account found for that email.',
          uiLog: [...uiLog, { level: 'warn', code: 'lookup-miss', message: 'No account found for that email.' }],
        };
      }
      const doc = q.docs[0];
      const u = doc.data() || {};
      toUserId = doc.id;
      recipientName = (u.name || '').trim();
      recipientPhoto = (u.photoURL || null);
      uiLog.push({ level: 'info', code: 'lookup-hit', message: `Found ${recipientName || toUserId}.` });
    } else if (typeof rawToUserId === 'string' && rawToUserId.trim()) {
      const toSnap = await db.doc(`users/${rawToUserId}`).get();
      if (!toSnap.exists) fail('not-found', 'Recipient user profile not found');
      const u = toSnap.data() || {};
      toUserId = rawToUserId.trim();
      recipientName = (u.name || '').trim();
      recipientPhoto = (u.photoURL || null);
      uiLog.push({ level: 'info', code: 'uid-provided', message: `Target user ID provided (${toUserId}).` });
    } else {
      fail('invalid-argument', 'recipientEmail or toUserId is required');
    }

    if (toUserId === caller) {
      return {
        success: false,
        code: 'self-transfer',
        message: 'You already own this venue.',
        uiLog: [...uiLog, { level: 'warn', code: 'self-transfer', message: 'Cannot transfer to yourself.' }],
      };
    }

    const venueRef     = db.doc(`venueProfiles/${venueId}`);
    const fromUserRef  = db.doc(`users/${caller}`);
    const toUserRef    = db.doc(`users/${toUserId}`);

    // --- Transaction: swap owner on venue + update users' venueProfiles arrays
    await db.runTransaction(async (tx) => {
      const [venueSnap, fromSnap, toSnap] = await Promise.all([
        tx.get(venueRef),
        tx.get(fromUserRef),
        tx.get(toUserRef),
      ]);
      if (!venueSnap.exists) fail('not-found', 'Venue not found');
      if (!fromSnap.exists)  fail('not-found', 'Current user profile not found');
      if (!toSnap.exists)    fail('not-found', 'Recipient user profile not found');

      const venue = venueSnap.data() || {};
      const from  = fromSnap.data()  || {};
      const to    = toSnap.data()    || {};

      const currentOwner = venue.createdBy || venue.userId;
      if (currentOwner !== caller) fail('permission-denied', 'Only the current owner can transfer this venue');

      const fromList = Array.isArray(from.venueProfiles) ? from.venueProfiles : [];
      const toList   = Array.isArray(to.venueProfiles)   ? to.venueProfiles   : [];
      const nextFrom = fromList.filter((id) => id !== venueId);
      const nextTo   = toList.includes(venueId) ? toList : [...toList, venueId];

      const newAccountName = recipientName;
      const newEmail       = (to.email || '').trim();

      tx.update(venueRef, {
        createdBy: toUserId,
        userId: toUserId, // legacy field
        ...(newAccountName ? { accountName: newAccountName } : {}),
        ...(newEmail ? { email: newEmail } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(fromUserRef, { venueProfiles: nextFrom });
      tx.update(toUserRef,   { venueProfiles: nextTo });
    });

    // ---------- FAN-OUT UPDATES (batched; admin bypasses rules)
    const oldUid = caller;
    const newUid = toUserId;

    const mutators = [];

    // 1) GIGS: set venue.userId = newUid
    {
      const gigsSnap = await db.collection('gigs').where('venueId', '==', venueId).get();
      const fpVenueUserId = new FieldPath('venue', 'userId');
      gigsSnap.forEach((doc) => {
        const d = doc.data() || {};
        if (d.venue && d.venue.userId !== newUid) {
          mutators.push((b) => b.update(doc.ref, { [fpVenueUserId.toString()]: newUid }));
        }
      });
      uiLog.push({ level: 'info', code: 'gigs-updated', message: `Queued ${mutators.length} gig updates.` });
    }

    // 2) CONVERSATIONS: replace authorizedUserIds, update accountNames venue entry, rename lastViewed key
    {
      const convSnap = await db.collection('conversations')
        .where('participants', 'array-contains', venueId)
        .get();

      convSnap.forEach((doc) => {
        const d = doc.data() || {};
        const updates = {};

        // authorizedUserIds
        const auth = Array.isArray(d.authorizedUserIds) ? d.authorizedUserIds : [];
        const set = new Set(auth);
        set.delete(oldUid);
        set.add(newUid);
        updates['authorizedUserIds'] = Array.from(set);

        // accountNames[]
        if (Array.isArray(d.accountNames)) {
          const next = d.accountNames.map((a) => {
            if (a?.role === 'venue' && a?.participantId === venueId) {
              return {
                ...a,
                accountId: newUid,
                accountName: recipientName || a.accountName,
                accountImg: recipientPhoto ?? a.accountImg ?? null,
              };
            }
            return a;
          });
          updates['accountNames'] = next;
        }

        // lastViewed key rename
        if (d.lastViewed && d.lastViewed[oldUid]) {
          updates[`lastViewed.${newUid}`] = d.lastViewed[oldUid];
          updates[`lastViewed.${oldUid}`] = FieldValue.delete();
        }

        mutators.push((b) => b.update(doc.ref, updates));
      });
      uiLog.push({ level: 'info', code: 'conversations-updated', message: `Queued updates for ${convSnap.size} conversations.` });
    }

    // 3) TEMPLATES: set createdBy/new owner and venue.userId
    {
      const tplSnap = await db.collection('templates').where('venueId', '==', venueId).get();
      const fpVenueUserId = new FieldPath('venue', 'userId');

      tplSnap.forEach((doc) => {
        const d = doc.data() || {};
        const updates = { createdBy: newUid };
        if (d.venue && d.venue.userId !== newUid) {
          updates[fpVenueUserId.toString()] = newUid;
        }
        mutators.push((b) => b.update(doc.ref, updates));
      });
      uiLog.push({ level: 'info', code: 'templates-updated', message: `Queued updates for ${tplSnap.size} templates.` });
    }

    // Commit in chunks
    await commitInChunks(mutators);

    uiLog.push({ level: 'success', code: 'transfer-complete', message: 'Venue ownership transferred and related data updated.' });

    return {
      success: true,
      venueId,
      fromUserId: oldUid,
      toUserId: newUid,
      recipientName,
      uiLog,
    };
  }
);