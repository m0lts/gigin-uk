/* eslint-disable */
import { db, FieldValue } from "../../../lib/admin.js";

/**
 * Append a venue-staff "accountNames" entry for a user to every conversation
 * that includes the venueId in its `participants` array.
 *
 * - Idempotent: skips if an equivalent entry for this user+venue already exists
 * - Batches updates in chunks to stay under Firestore limits
 *
 * @param {string} venueId
 * @param {string} uid
 * @returns {Promise<{updated: number}>}
 */
export async function addUserToVenueConversations(venueId, uid) {
  // Fetch minimal user + venue display info for the entry
  const userSnap = await db.doc(`users/${uid}`).get();

  const user = userSnap.exists ? (userSnap.data() || {}) : {};

  const entry = {
    accountId: uid,
    accountName: user.name ?? null,
    role: "venue",
    participantId: venueId,
    accountImg: user.picture || null,
  };

  // Query all conversations that involve this venue
  // (If you also store a role-scoped participants structure, adjust accordingly.)
  const convosRef = db.collection("conversations")
    .where("participants", "array-contains", venueId);

  let updatedCount = 0;
  let lastDoc = null;

  while (true) {
    let q = convosRef.orderBy("__name__").limit(300);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    // Batch in chunks
    let batch = db.batch();
    let opsInBatch = 0;

    for (const doc of snap.docs) {
      lastDoc = doc;
      const data = doc.data() || {};
      const current = Array.isArray(data.accountNames) ? data.accountNames : [];

      const alreadyPresent = current.some(
        (a) =>
          a &&
          a.accountId === uid &&
          a.role === "venue" &&
          a.participantId === venueId
      );

      if (alreadyPresent) continue;

      batch.update(doc.ref, {
        accountNames: FieldValue.arrayUnion(entry),
        authorizedUserIds: FieldValue.arrayUnion(uid),
      });
      opsInBatch++;
      updatedCount++;

      if (opsInBatch >= 450) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }

    if (opsInBatch > 0) {
      await batch.commit();
    }

    if (snap.size < 300) break;
  }

  return { updated: updatedCount };
}