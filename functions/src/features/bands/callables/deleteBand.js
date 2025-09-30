/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

/**
 * deleteBand (CF)
 * Direct move from client:
 * - For each member: remove bandId from their user & musician profiles, delete member subdoc
 * - Delete musicianProfiles/{bandId} (band-as-musician profile) and bands/{bandId}
 *
 * Input:
 *   { bandId: string }
 * Output:
 *   { success: true }
 */
export const deleteBand = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { bandId } = req.data || {};
    const batch = db.batch();

    const bandRef = db.doc(`bands/${bandId}`);
    const bandMusicianProfileRef = db.doc(`musicianProfiles/${bandId}`);
    const membersRef = bandRef.collection("members");

    const membersSnap = await membersRef.get();
    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data() || {};
      const musicianRef = db.doc(`musicianProfiles/${member.musicianProfileId}`);
      const userRef = db.doc(`users/${member.memberUserId}`);

      batch.update(musicianRef, {
        bands: member.musicianProfileId ? FieldValue.arrayRemove(bandId) : [],
      });
      batch.update(userRef, {
        bands: member.memberUserId ? FieldValue.arrayRemove(bandId) : [],
      });
      batch.delete(memberDoc.ref);
    }

    batch.delete(bandMusicianProfileRef);
    batch.delete(bandRef);

    await batch.commit();
    return { success: true };
  }
);