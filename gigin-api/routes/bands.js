/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db, FieldValue, Timestamp } from "../config/admin.js";

const router = express.Router();

// POST /api/bands/createBandProfile
router.post(
  "/createBandProfile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bandId, data = {}, userId, musicianProfile = {} } = req.body || {};
    if (!bandId || !userId || !musicianProfile?.userId || !musicianProfile?.name) {
      return res.status(400).json({ error: "INVALID_ARGUMENT", message: "bandId, userId, musicianProfile(userId,name) required" });
    }
    const bandRef = db.doc(`bands/${bandId}`);
    await bandRef.set({ ...data, userId }, { merge: true });
    const memberId = musicianProfile.id || musicianProfile.musicianId;
    const memberRef = bandRef.collection("members").doc(memberId);
    await memberRef.set({
      musicianProfileId: memberId,
      memberName: musicianProfile.name,
      memberImg: musicianProfile?.picture || "",
      memberUserId: musicianProfile.userId,
      joinedAt: Timestamp.now(),
      isAdmin: true,
      role: "Band Leader",
      split: 100,
    });
    return res.json({ data: { bandId } });
  })
);

// POST /api/bands/createBandInvite
router.post(
  "/createBandInvite",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bandId, invitedBy, invitedEmail = "" } = req.body || {};
    if (!bandId || !invitedBy) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "bandId and invitedBy required" });
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const docRef = await db.collection("bandInvites").add({ bandId, invitedBy, invitedEmail, status: "pending", createdAt: Timestamp.now(), expiresAt });
    return res.json({ data: { inviteId: docRef.id } });
  })
);

// POST /api/bands/acceptBandInvite
router.post(
  "/acceptBandInvite",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { inviteId, musicianProfile } = req.body || {};
    if (!inviteId || !musicianProfile?.musicianId || !musicianProfile?.name || !musicianProfile?.userId) {
      return res.status(400).json({ error: "INVALID_ARGUMENT", message: "inviteId and musicianProfile(musicianId,name,userId) required" });
    }
    const inviteRef = db.doc(`bandInvites/${inviteId}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Invite not found" });
    const invite = inviteSnap.data() || {};
    const now = new Date();
    if (invite.status !== "pending") return res.status(400).json({ error: "FAILED_PRECONDITION", message: "Invite used or cancelled" });
    if (invite.expiresAt?.toDate && invite.expiresAt.toDate() < now) return res.status(400).json({ error: "FAILED_PRECONDITION", message: "Invite expired" });
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
        members: FieldValue.arrayUnion({ id: musicianProfile.musicianId, img: musicianProfile.picture, name: musicianProfile.name }),
      });
      tx.update(musicianRef, { bands: FieldValue.arrayUnion(bandId) });
      tx.update(inviteRef, { status: "accepted" });
    });
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
    return res.json({ data: { bandId } });
  })
);

// POST /api/bands/joinBandByPassword
router.post(
  "/joinBandByPassword",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bandId, musicianProfile } = req.body || {};
    if (!bandId || !musicianProfile?.musicianId || !musicianProfile?.name || !musicianProfile?.userId) {
      return res.status(400).json({ error: "INVALID_ARGUMENT", message: "bandId and musicianProfile(musicianId,name,userId) required" });
    }
    const bandRef = db.doc(`bands/${bandId}`);
    const memberRef = bandRef.collection("members").doc(musicianProfile.musicianId);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfile.musicianId}`);
    const userRef = db.doc(`users/${musicianProfile.userId}`);
    await db.runTransaction(async (tx) => {
      const bandSnap = await tx.get(bandRef);
      if (!bandSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "band" });
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
      tx.update(bandRef, { members: FieldValue.arrayUnion({ id: musicianProfile.musicianId, img: musicianProfile.picture, name: musicianProfile.name }) });
      tx.update(musicianRef, { bands: FieldValue.arrayUnion(bandId) });
      tx.update(userRef, { bands: FieldValue.arrayUnion(bandId) });
    });
    const membersSnap = await bandRef.collection("members").get();
    const total = membersSnap.size;
    if (total > 0) {
      const even = Math.floor(100 / total);
      const remainder = 100 - even * total;
      let idx = 0;
      const writes = [];
      for (const doc of membersSnap.docs) {
        const split = idx === 0 ? even + remainder : even;
        idx++;
        writes.push(doc.ref.update({ split }));
      }
      await Promise.all(writes);
    }
    return res.json({ data: { success: true } });
  })
);

// POST /api/bands/getBandByPassword
router.post(
  "/getBandByPassword",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    if (!password || typeof password !== "string") return res.status(400).json({ error: "INVALID_ARGUMENT", message: "password required" });
    const q = await db.collection("bands").where("joinPassword", "==", password).limit(1).get();
    if (q.empty) return res.status(404).json({ error: "NOT_FOUND", message: "no band with that password" });
    const snap = q.docs[0];
    return res.json({ data: { id: snap.id, ...(snap.data() || {}) } });
  })
);

// POST /api/bands/leaveBand
router.post(
  "/leaveBand",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bandId, musicianProfileId, userId } = req.body || {};
    if (!bandId || !musicianProfileId || !userId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "bandId, musicianProfileId, userId required" });
    const bandRef = db.doc(`bands/${bandId}`);
    const bandMusicianProfileRef = db.doc(`musicianProfiles/${bandId}`);
    const memberRef = bandRef.collection("members").doc(musicianProfileId);
    const userRef = db.doc(`users/${userId}`);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);
    const musicianSnap = await musicianRef.get();
    const musicianProfile = musicianSnap.exists ? (musicianSnap.data() || {}) : {};
    const memberToRemove = { id: musicianProfileId, name: musicianProfile.name, img: musicianProfile.picture };
    const batch = db.batch();
    batch.delete(memberRef);
    batch.update(bandMusicianProfileRef, { members: FieldValue.arrayRemove(memberToRemove) });
    batch.update(bandRef, { members: FieldValue.arrayRemove(musicianProfileId) });
    batch.update(userRef, { bands: FieldValue.arrayRemove(bandId) });
    batch.update(musicianRef, { bands: FieldValue.arrayRemove(bandId) });
    await batch.commit();
    return res.json({ data: { success: true } });
  })
);

// POST /api/bands/removeBandMember
router.post(
  "/removeBandMember",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bandId, musicianProfileId, userId } = req.body || {};
    if (!bandId || !musicianProfileId || !userId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "bandId, musicianProfileId, userId required" });
    const bandRef = db.doc(`bands/${bandId}`);
    const bandMusicianProfileRef = db.doc(`musicianProfiles/${bandId}`);
    const memberRef = bandRef.collection("members").doc(musicianProfileId);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);
    const userRef = db.doc(`users/${userId}`);
    const [memberSnap, musicianSnap] = await Promise.all([memberRef.get(), musicianRef.get()]);
    const removedSplit = memberSnap.exists ? (memberSnap.data()?.split || 0) : 0;
    const musicianProfile = musicianSnap.exists ? (musicianSnap.data() || {}) : {};
    const membersRef = bandRef.collection("members");
    const allMembersSnap = await membersRef.get();
    const remaining = allMembersSnap.docs.filter((d) => d.id !== musicianProfileId);
    const numRemaining = remaining.length;
    const extraPerMember = numRemaining > 0 ? removedSplit / numRemaining : 0;
    const batch = db.batch();
    remaining.forEach((docSnap) => {
      const currentSplit = docSnap.data()?.split || 0;
      const newSplit = currentSplit + extraPerMember;
      batch.update(docSnap.ref, { split: Number(newSplit.toFixed(2)) });
    });
    batch.delete(memberRef);
    const memberToRemove = { id: musicianProfileId, name: musicianProfile.name, img: musicianProfile.picture };
    batch.update(bandMusicianProfileRef, { members: FieldValue.arrayRemove(memberToRemove) });
    batch.update(bandRef, { members: FieldValue.arrayRemove(musicianProfileId) });
    batch.update(musicianRef, { bands: FieldValue.arrayRemove(bandId) });
    batch.update(userRef, { bands: FieldValue.arrayRemove(bandId) });
    await batch.commit();
    const refreshed = await membersRef.get();
    const members = refreshed.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    return res.json({ data: { members } });
  })
);

// POST /api/bands/updateBandMemberPermissions
router.post(
  "/updateBandMemberPermissions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bandId, musicianProfileId, updates = {} } = req.body || {};
    if (!bandId || !musicianProfileId || typeof updates !== "object") return res.status(400).json({ error: "INVALID_ARGUMENT", message: "bandId, musicianProfileId, updates required" });
    const memberRef = db.doc(`bands/${bandId}/members/${musicianProfileId}`);
    if (updates?.isAdmin === true) {
      const membersSnap = await db.collection(`bands/${bandId}/members`).get();
      const existingAdmin = membersSnap.docs.find((d) => {
        const data = d.data() || {};
        return data.isAdmin === true && d.id !== musicianProfileId;
      });
      if (existingAdmin) return res.status(400).json({ error: "FAILED_PRECONDITION", message: "Only one admin is allowed" });
    }
    await memberRef.update(updates);
    const updated = await memberRef.get();
    return res.json({ data: { member: { id: updated.id, ...(updated.data() || {}) } } });
  })
);

// POST /api/bands/updateBandAdmin
router.post(
  "/updateBandAdmin",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bandId, newAdminData, roleUpdates = {} } = req.body || {};
    if (!bandId || !newAdminData?.musicianProfileId || !newAdminData?.memberUserId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "bandId and newAdminData required" });
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
        ops.push(membersRef.doc(memberId).update({ isAdmin: true, ...(roleUpdates[memberId] || {}) }));
      } else if (roleUpdates[memberId]) {
        ops.push(membersRef.doc(memberId).update({ ...roleUpdates[memberId] }));
      }
    }
    ops.push(bandDocRef.update({ admin: { musicianId: newAdminData.musicianProfileId, userId: newAdminData.memberUserId } }));
    await Promise.all(ops);
    const refreshed = await membersRef.get();
    const members = refreshed.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    return res.json({ data: { members } });
  })
);

// POST /api/bands/updateBandMemberImg
router.post(
  "/updateBandMemberImg",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { musicianProfileId, pictureUrl, bands } = req.body || {};
    if (!musicianProfileId || !pictureUrl || !Array.isArray(bands) || bands.length === 0) {
      return res.json({ data: { success: true } });
    }
    const batch = db.batch();
    for (const bandId of bands) {
      try {
        const bandRef = db.doc(`bands/${bandId}`);
        const bandSnap = await bandRef.get();
        if (!bandSnap.exists) continue;
        const bandData = bandSnap.data() || {};
        const members = Array.isArray(bandData.members) ? bandData.members : [];
        const updatedMembers = members.map((m) => (m && m.id === musicianProfileId ? { ...m, img: pictureUrl } : m));
        const membersChanged = members.length !== updatedMembers.length || members.some((m, i) => m?.img !== updatedMembers[i]?.img);
        if (membersChanged) batch.set(bandRef, { members: updatedMembers }, { merge: true });
        const memberRef = bandRef.collection("members").doc(musicianProfileId);
        batch.set(memberRef, { memberImg: pictureUrl }, { merge: true });
      } catch (err) {
        console.error(`updateBandMemberImg: failed for band ${bandId}`, err);
      }
    }
    await batch.commit();
    return res.json({ data: { success: true } });
  })
);

// POST /api/bands/deleteBand
router.post(
  "/deleteBand",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bandId } = req.body || {};
    if (!bandId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "bandId required" });
    const batch = db.batch();
    const bandRef = db.doc(`bands/${bandId}`);
    const bandMusicianProfileRef = db.doc(`musicianProfiles/${bandId}`);
    const membersRef = bandRef.collection("members");
    const membersSnap = await membersRef.get();
    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data() || {};
      const musicianRef = db.doc(`musicianProfiles/${member.musicianProfileId}`);
      const userRef = db.doc(`users/${member.memberUserId}`);
      batch.update(musicianRef, { bands: member.musicianProfileId ? FieldValue.arrayRemove(bandId) : [] });
      batch.update(userRef, { bands: member.memberUserId ? FieldValue.arrayRemove(bandId) : [] });
      batch.delete(memberDoc.ref);
    }
    batch.delete(bandMusicianProfileRef);
    batch.delete(bandRef);
    await batch.commit();
    return res.json({ data: { success: true } });
  })
);

export default router;


