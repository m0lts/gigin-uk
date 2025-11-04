/* eslint-disable */
import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { admin, db, FieldValue } from "../config/admin.js";

const router = express.Router();

// POST /api/venues/fetchVenueMembersWithUsers (auth)
router.post("/fetchVenueMembersWithUsers", requireAuth, asyncHandler(async (req, res) => {
  const { venueId } = req.body || {};
  if (!venueId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId is required" });

  const membersSnap = await db.collection(`venueProfiles/${venueId}/members`).get();
  const members = [];
  for (const doc of membersSnap.docs) {
    const data = doc.data() || {};
    const userSnap = await db.doc(`users/${doc.id}`).get();
    const user = userSnap.exists ? { id: userSnap.id, ...(userSnap.data() || {}) } : null;
    members.push({ id: doc.id, ...data, user });
  }
  return res.json({ data: members });
}));

// POST /api/venues/acceptVenueInvite (auth)
router.post("/acceptVenueInvite", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { inviteId } = req.body || {};
  if (!inviteId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "inviteId is required" });

  const inviteRef = db.doc(`venueInvites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Invite not found" });
  const invite = inviteSnap.data();
  if (invite.recipientUid && invite.recipientUid !== uid) return res.status(403).json({ error: "PERMISSION_DENIED", message: "Invite not for this user" });

  const venueId = invite.venueId;
  const memberRef = db.doc(`venueProfiles/${venueId}/members/${uid}`);
  await memberRef.set({ permissions: invite.permissions || {}, joinedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await inviteRef.delete();
  return res.json({ data: { ok: true, venueId } });
}));

// POST /api/venues/createVenueInvite (auth)
router.post("/createVenueInvite", requireAuth, asyncHandler(async (req, res) => {
  const inviterUid = req.auth.uid;
  const { venueId, email, permissionsInput = {}, invitedByName = null, ttlDays = 7 } = req.body || {};
  if (!venueId || !email) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and email required" });

  const payload = {
    venueId,
    email: String(email || "").trim().toLowerCase(),
    permissions: permissionsInput || {},
    invitedBy: inviterUid,
    invitedByName: invitedByName || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
  };
  const ref = await db.collection("venueInvites").add(payload);
  return res.json({ data: { inviteId: ref.id } });
}));

// POST /api/venues/updateVenueMemberPermissions (auth)
router.post("/updateVenueMemberPermissions", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, memberUid, permissions } = req.body || {};
  if (!venueId || !memberUid || !permissions) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId, memberUid, permissions required" });
  const memberRef = db.doc(`venueProfiles/${venueId}/members/${memberUid}`);
  await memberRef.set({ permissions }, { merge: true });
  return res.json({ data: { ok: true } });
}));

// POST /api/venues/removeVenueMember (auth)
router.post("/removeVenueMember", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, memberUid } = req.body || {};
  if (!venueId || !memberUid) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and memberUid required" });
  const memberRef = db.doc(`venueProfiles/${venueId}/members/${memberUid}`);
  await memberRef.delete();
  return res.json({ data: { ok: true } });
}));

// POST /api/venues/transferVenueOwnership (auth)
router.post("/transferVenueOwnership", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, recipientEmail } = req.body || {};
  if (!venueId || !recipientEmail) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and recipientEmail required" });
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const venueSnap = await venueRef.get();
  if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
  await venueRef.set({ ownerEmail: String(recipientEmail).trim().toLowerCase() }, { merge: true });
  return res.json({ data: { ok: true } });
}));

// POST /api/venues/deleteVenueData (auth)
router.post("/deleteVenueData", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, confirm } = req.body || {};
  if (!venueId || !confirm) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and confirm=true required" });
  // Minimal stub: delete venue doc; expand to cascade deletes if needed
  await db.doc(`venueProfiles/${venueId}`).delete();
  return res.json({ data: { ok: true } });
}));

export default router;


