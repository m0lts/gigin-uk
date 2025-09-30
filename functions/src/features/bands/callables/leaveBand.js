/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

/**
 * leaveBand (CF)
 * Direct move from client:
 * - Deletes member subdoc
 * - Removes member object from musicianProfile(bandId).members
 * - Removes musicianProfileId from bands/{bandId}.members
 * - Removes bandId from users/{userId}.bands and musicianProfiles/{musicianProfileId}.bands
 *
 * Input:
 *   {
 *     bandId: string,
 *     musicianProfileId: string,
 *     userId: string
 *   }
 * Output:
 *   { success: true }
 */
export const leaveBand = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { bandId, musicianProfileId, userId } = req.data || {};

    const bandRef = db.doc(`bands/${bandId}`);
    const bandMusicianProfileRef = db.doc(`musicianProfiles/${bandId}`);
    const memberRef = bandRef.collection("members").doc(musicianProfileId);
    const userRef = db.doc(`users/${userId}`);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);

    // fetch musician profile to construct memberToRemove (name/img)
    const musicianSnap = await musicianRef.get();
    const musicianProfile = musicianSnap.exists ? (musicianSnap.data() || {}) : {};

    const memberToRemove = {
      id: musicianProfileId,
      name: musicianProfile.name,
      img: musicianProfile.picture,
    };

    const batch = db.batch();
    batch.delete(memberRef);
    batch.update(bandMusicianProfileRef, {
      members: FieldValue.arrayRemove(memberToRemove),
    });
    batch.update(bandRef, {
      members: FieldValue.arrayRemove(musicianProfileId),
    });
    batch.update(userRef, {
      bands: FieldValue.arrayRemove(bandId),
    });
    batch.update(musicianRef, {
      bands: FieldValue.arrayRemove(bandId),
    });
    await batch.commit();

    return { success: true };
  }
);