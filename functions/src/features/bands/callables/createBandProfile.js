/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * createBandProfile (CF)
 * Direct move from client:
 * - Creates/merges band doc
 * - Creates initial member subdoc with admin=true, split=100
 *
 * Input:
 *   {
 *     bandId: string,
 *     data: object,              // band fields
 *     userId: string,            // creator's auth UID
 *     musicianProfile: { id?: string, musicianId?: string, name: string, picture?: string, userId: string }
 *   }
 * Output:
 *   { bandId: string }
 */
export const createBandProfile = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { bandId, data = {}, userId, musicianProfile = {} } = req.data || {};

    const bandRef = db.doc(`bands/${bandId}`);
    await bandRef.set(
      {
        ...data,
        userId,
      },
      { merge: true }
    );

    const memberId = musicianProfile.id || musicianProfile.musicianId;
    const memberRef = bandRef.collection("members").doc(memberId);
    await memberRef.set({
      musicianProfileId: memberId,
      memberName: musicianProfile.name,
      memberImg: musicianProfile?.picture || "",
      memberUserId: musicianProfile.userId,
      joinedAt: new Date(),
      isAdmin: true,
      role: "Band Leader",
      split: 100,
    });

    return { bandId };
  }
);