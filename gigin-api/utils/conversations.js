import { db, admin } from "../config/admin.js";

/**
 * Add a user to all existing conversations for a given account (venue or artist).
 *
 * @param {"venue"|"artist"} accountType - Type of account.
 * @param {string} accountId - Venue ID or artistProfile ID that appears in `participants`.
 * @param {string} uid - User UID to add.
 */
export async function addUserToAccountConversations(accountType, accountId, uid) {
  if (!accountType || !accountId || !uid) {
    throw new Error("addUserToAccountConversations: accountType, accountId, and uid are required");
  }

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? (userSnap.data() || {}) : {};

  const role = accountType === "venue" ? "venue" : "musician";

  const entry = {
    accountId: uid,
    accountName: user.name ?? null,
    role,
    participantId: accountId,
    accountImg: user.picture || null,
  };

  const convosRef = db
    .collection("conversations")
    .where("participants", "array-contains", accountId);

  let updatedCount = 0;
  let lastDoc = null;

  while (true) {
    let q = convosRef.orderBy("__name__").limit(300);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

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
          a.role === role &&
          a.participantId === accountId
      );
      if (alreadyPresent) continue;

      batch.update(doc.ref, {
        accountNames: admin.firestore.FieldValue.arrayUnion(entry),
        authorizedUserIds: admin.firestore.FieldValue.arrayUnion(uid),
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

// Backwards-compatible wrapper for existing venue code.
export async function addUserToVenueConversations(venueId, uid) {
  return addUserToAccountConversations("venue", venueId, uid);
}

// New helper for artist profiles.
export async function addUserToArtistConversations(artistProfileId, uid) {
  return addUserToAccountConversations("artist", artistProfileId, uid);
}