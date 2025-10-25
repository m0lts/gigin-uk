/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * updateBandMemberImg (CF)
 * Direct move from client:
 * - For each bandId, updates bands/{bandId}.members array (set img)
 * - Upserts bands/{bandId}/members/{musicianProfileId} with { memberImg }
 *
 * Input:
 *   {
 *     musicianProfileId: string,
 *     pictureUrl: string,
 *     bands: string[]        // array of bandIds
 *   }
 * Output:
 *   { success: true }
 */
export const updateBandMemberImg = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { musicianProfileId, pictureUrl, bands } = req.data || {};
    if (!musicianProfileId || !pictureUrl || !Array.isArray(bands) || bands.length === 0) {
      return { success: true }; // no-op, mirrors client’s early returns
    }

    const batch = db.batch();

    for (const bandId of bands) {
      try {
        const bandRef = db.doc(`bands/${bandId}`);
        const bandSnap = await bandRef.get();
        if (!bandSnap.exists) continue;

        const bandData = bandSnap.data() || {};
        const members = Array.isArray(bandData.members) ? bandData.members : [];

        const updatedMembers = members.map((m) =>
          m && m.id === musicianProfileId ? { ...m, img: pictureUrl } : m
        );

        // Determine if any change occurred
        const membersChanged =
          members.length !== updatedMembers.length ||
          members.some((m, i) => (m?.img !== updatedMembers[i]?.img));

        if (membersChanged) {
          batch.set(bandRef, { members: updatedMembers }, { merge: true });
        }

        const memberRef = bandRef.collection("members").doc(musicianProfileId);
        batch.set(memberRef, { memberImg: pictureUrl }, { merge: true });
      } catch (err) {
        console.error(`updateBandMemberImg: failed for band ${bandId}`, err);
      }
    }

    await batch.commit();
    return { success: true };
  }
);