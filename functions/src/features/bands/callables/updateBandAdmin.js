/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * updateBandAdmin (CF)
 * Direct move from client:
 * - Iterates all members
 * - Demotes previous admin(s), promotes new admin, applies optional roleUpdates
 * - Updates bands/{bandId}.admin = { musicianId, userId }
 * - Returns refreshed members list
 *
 * Input:
 *   {
 *     bandId: string,
 *     newAdminData: { musicianProfileId: string, memberUserId: string },
 *     roleUpdates?: { [musicianProfileId: string]: { role?: string, [k:string]: any } }
 *   }
 * Output:
 *   { members: Array<{ id: string, ...data }> }
 */
export const updateBandAdmin = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { bandId, newAdminData, roleUpdates = {} } = req.data || {};

    const membersRef = db.collection(`bands/${bandId}/members`);
    const membersSnap = await membersRef.get();
    const bandDocRef = db.doc(`bands/${bandId}`);

    const ops = [];

    for (const docSnap of membersSnap.docs) {
      const memberId = docSnap.id;
      const data = docSnap.data() || {};
      const isCurrentAdmin = data.isAdmin === true;

      if (isCurrentAdmin && memberId !== newAdminData.musicianProfileId) {
        ops.push(membersRef.doc(memberId).update({ isAdmin: false }));
      }
      if (memberId === newAdminData.musicianProfileId) {
        ops.push(membersRef.doc(memberId).update({
          isAdmin: true,
          ...(roleUpdates[memberId] || {}),
        }));
      } else if (roleUpdates[memberId]) {
        ops.push(membersRef.doc(memberId).update({ ...roleUpdates[memberId] }));
      }
    }

    ops.push(bandDocRef.update({
      admin: {
        musicianId: newAdminData.musicianProfileId,
        userId: newAdminData.memberUserId,
      }
    }));

    await Promise.all(ops);

    const refreshed = await membersRef.get();
    const members = refreshed.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    return { members };
  }
);