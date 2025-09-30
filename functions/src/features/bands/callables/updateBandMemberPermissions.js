/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * updateBandMemberPermissions (CF)
 * Direct move from client:
 * - If updates.isAdmin === true, ensure no other member is admin
 * - Update the member document
 * - Return the updated member snapshot
 *
 * Input:
 *   {
 *     bandId: string,
 *     musicianProfileId: string,
 *     updates: { [key:string]: any }   // e.g. { role: 'Band Leader', isAdmin: true }
 *   }
 * Output:
 *   { member: { id: string, ...data } }
 */
export const updateBandMemberPermissions = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { bandId, musicianProfileId, updates = {} } = req.data || {};

    const memberRef = db.doc(`bands/${bandId}/members/${musicianProfileId}`);

    if (updates?.isAdmin === true) {
      const membersSnap = await db.collection(`bands/${bandId}/members`).get();
      const existingAdmin = membersSnap.docs.find((d) => {
        const data = d.data() || {};
        return data.isAdmin === true && d.id !== musicianProfileId;
      });
      if (existingAdmin) {
        const e = new Error("Only one admin is allowed. Revoke admin rights from the current admin first.");
        e.code = "failed-precondition";
        throw e;
      }
    }

    await memberRef.update(updates);

    const updated = await memberRef.get();
    return { member: { id: updated.id, ...(updated.data() || {}) } };
  }
);