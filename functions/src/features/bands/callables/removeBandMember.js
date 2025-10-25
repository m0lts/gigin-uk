/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

/**
 * removeBandMember (CF)
 * Direct move from client:
 * - Reads member being removed and remaining members
 * - Redistributes their split evenly across remaining members
 * - Deletes member subdoc
 * - Updates band/musician/user references
 * - Returns refreshed members list
 *
 * Input:
 *   {
 *     bandId: string,
 *     musicianProfileId: string,
 *     userId: string
 *   }
 * Output:
 *   { members: Array<{ id: string, ...data }> }
 */
export const removeBandMember = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { bandId, musicianProfileId, userId } = req.data || {};

    const bandRef = db.doc(`bands/${bandId}`);
    const bandMusicianProfileRef = db.doc(`musicianProfiles/${bandId}`);
    const memberRef = bandRef.collection("members").doc(musicianProfileId);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);
    const userRef = db.doc(`users/${userId}`);

    // Load needed docs
    const [memberSnap, musicianSnap] = await Promise.all([memberRef.get(), musicianRef.get()]);
    const removedSplit = memberSnap.exists ? (memberSnap.data()?.split || 0) : 0;
    const musicianProfile = musicianSnap.exists ? (musicianSnap.data() || {}) : {};

    // Get all members to compute redistribution
    const membersRef = bandRef.collection("members");
    const allMembersSnap = await membersRef.get();
    const remaining = allMembersSnap.docs.filter((d) => d.id !== musicianProfileId);
    const numRemaining = remaining.length;
    const extraPerMember = numRemaining > 0 ? removedSplit / numRemaining : 0;

    // Batch updates
    const batch = db.batch();

    // redistribute splits
    remaining.forEach((docSnap) => {
      const currentSplit = docSnap.data()?.split || 0;
      const newSplit = currentSplit + extraPerMember;
      batch.update(docSnap.ref, { split: Number(newSplit.toFixed(2)) });
    });

    // delete member subdoc
    batch.delete(memberRef);

    // remove from band musician-profile "members" (array of objects)
    const memberToRemove = {
      id: musicianProfileId,
      name: musicianProfile.name,
      img: musicianProfile.picture,
    };
    batch.update(bandMusicianProfileRef, {
      members: FieldValue.arrayRemove(memberToRemove),
    });

    // remove from band doc "members" (array that stores ids in your client code here)
    batch.update(bandRef, {
      members: FieldValue.arrayRemove(musicianProfileId),
    });

    // remove bandId from musician & user
    batch.update(musicianRef, {
      bands: FieldValue.arrayRemove(bandId),
    });
    batch.update(userRef, {
      bands: FieldValue.arrayRemove(bandId),
    });

    await batch.commit();

    const refreshed = await membersRef.get();
    const members = refreshed.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    return { members };
  }
);