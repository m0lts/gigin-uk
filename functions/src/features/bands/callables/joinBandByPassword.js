/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";

/**
 * joinBandByPassword (CF)
 * Direct move from client:
 * - In a transaction: add member subdoc, update band.members array, and add bandId to user/musician
 * - Then: recalc member splits evenly (first doc gets the remainder)
 *
 * Input:
 *   {
 *     bandId: string,
 *     musicianProfile: {
 *       musicianId: string,
 *       name: string,
 *       picture?: string,
 *       userId: string
 *     }
 *   }
 * Output:
 *   { success: true }
 */
export const joinBandByPassword = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { bandId, musicianProfile } = req.data || {};
    const bandRef = db.doc(`bands/${bandId}`);
    const memberRef = bandRef.collection("members").doc(musicianProfile.musicianId);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfile.musicianId}`);
    const userRef = db.doc(`users/${musicianProfile.userId}`);

    await db.runTransaction(async (tx) => {
      const bandSnap = await tx.get(bandRef);
      if (!bandSnap.exists) {
        const e = new Error("NOT_FOUND: band");
        e.code = "not-found";
        throw e;
      }

      tx.set(memberRef, {
        musicianProfileId: musicianProfile.musicianId,
        memberName: musicianProfile.name,
        memberImg: musicianProfile.picture || "",
        joinedAt: Timestamp.now(),
        isAdmin: false,
        role: "Band Member",
        memberUserId: musicianProfile.userId,
        split: 0,
      });

      tx.update(bandRef, {
        members: FieldValue.arrayUnion({
          id: musicianProfile.musicianId,
          img: musicianProfile.picture,
          name: musicianProfile.name,
        }),
      });

      tx.update(musicianRef, {
        bands: FieldValue.arrayUnion(bandId),
      });

      tx.update(userRef, {
        bands: FieldValue.arrayUnion(bandId),
      });
    });

    // Recalculate splits
    const membersSnap = await bandRef.collection("members").get();
    const totalMembers = membersSnap.size;
    if (totalMembers > 0) {
      const even = Math.floor(100 / totalMembers);
      const remainder = 100 - even * totalMembers;
      let index = 0;

      const writes = [];
      for (const doc of membersSnap.docs) {
        const split = index === 0 ? even + remainder : even;
        index++;
        writes.push(doc.ref.update({ split }));
      }
      await Promise.all(writes);
    }

    return { success: true };
  }
);