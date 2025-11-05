import { db, admin } from "../config/admin.js";

export async function addUserToVenueConversations(venueId, uid) {
  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? (userSnap.data() || {}) : {};

  const entry = {
    accountId: uid,
    accountName: user.name ?? null,
    role: "venue",
    participantId: venueId,
    accountImg: user.picture || null,
  };

  const convosRef = db.collection("conversations").where("participants", "array-contains", venueId);

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
        (a) => a && a.accountId === uid && a.role === "venue" && a.participantId === venueId
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