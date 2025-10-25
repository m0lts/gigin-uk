/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";

/**
 * acceptBandInvite (CF)
 * Direct move from client:
 * - Validates invite (exists, pending, not expired)
 * - In a transaction: add member, update band.members, add band to musician, mark invite accepted
 * - Then recalculates member splits evenly (first doc gets remainder)
 *
 * Input:
 *   {
 *     inviteId: string,
 *     musicianProfile: {
 *       musicianId: string,
 *       name: string,
 *       picture?: string,
 *       userId: string
 *     }
 *   }
 * Output:
 *   { bandId: string }
 */
export const acceptBandInvite = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { inviteId, musicianProfile } = req.data || {};
    const inviteRef = db.doc(`bandInvites/${inviteId}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      const e = new Error("Invite not found");
      e.code = "not-found";
      throw e;
    }

    const invite = inviteSnap.data() || {};
    const now = new Date();
    if (invite.status !== "pending") {
      const e = new Error("This invite has already been used or cancelled.");
      e.code = "failed-precondition";
      throw e;
    }
    if (invite.expiresAt?.toDate && invite.expiresAt.toDate() < now) {
      const e = new Error("This invite has expired.");
      e.code = "failed-precondition";
      throw e;
    }

    const bandId = invite.bandId;
    const bandRef = db.doc(`bands/${bandId}`);
    const memberRef = bandRef.collection("members").doc(musicianProfile.musicianId);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfile.musicianId}`);

    await db.runTransaction(async (tx) => {
      tx.set(memberRef, {
        musicianProfileId: musicianProfile.musicianId,
        joinedAt: Timestamp.now(),
        isAdmin: false,
        role: "Band Member",
        memberName: musicianProfile.name,
        memberImg: musicianProfile.picture || "",
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

      tx.update(inviteRef, {
        status: "accepted",
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

    return { bandId };
  }
);