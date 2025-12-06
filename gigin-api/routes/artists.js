/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { admin, db, FieldValue } from "../config/admin.js";
import { v4 as uuidv4 } from "uuid";
import { assertVenuePerm, assertArtistPerm, assertArtistOwner, sanitizeArtistPermissions } from "../utils/permissions.js";
import { addUserToArtistConversations } from "../utils/conversations.js";

const router = express.Router();

// POST /api/artists/updateArtistProfile (auth)
router.post("/updateArtistProfile", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { artistProfileId, updates } = req.body || {};
  if (!artistProfileId || !updates || typeof updates !== "object") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "artistProfileId and updates are required" });
  }

  try {
    // Ensure caller has profile.edit permission on this artist profile
    await assertArtistPerm(db, uid, artistProfileId, "profile.edit");

    const allowedUpdates = { ...updates };
    // Server-controlled fields: never allow client to override
    delete allowedUpdates.userId;
    delete allowedUpdates.createdBy;
    delete allowedUpdates.createdAt;
    delete allowedUpdates.updatedAt;

    const artistRef = db.doc(`artistProfiles/${artistProfileId}`);
    await artistRef.update({
      ...allowedUpdates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ data: { success: true } });
  } catch (err) {
    console.error("updateArtistProfile error:", err);
    const code = err.code || err.message || "INTERNAL";
    if (code === "permission-denied" || code === "PERMISSION_DENIED") {
      return res.status(403).json({ error: "PERMISSION_DENIED", message: "You do not have permission to edit this artist profile." });
    }
    return res.status(500).json({ error: "INTERNAL", message: "Failed to update artist profile." });
  }
}));

// POST /api/artists/updateArtistMemberPermissions (auth)
router.post("/updateArtistMemberPermissions", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { artistProfileId, memberId, permissionsInput = {} } = req.body || {};
  if (!artistProfileId || !memberId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "artistProfileId and memberId are required" });
  }

  try {
    // Only the artist owner can change member permissions
    await assertArtistOwner(db, uid, artistProfileId);

    const safePermissions = sanitizeArtistPermissions(permissionsInput || {});
    const memberRef = db.doc(`artistProfiles/${artistProfileId}/members/${memberId}`);
    await memberRef.update({
      permissions: safePermissions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ data: { success: true } });
  } catch (err) {
    console.error("updateArtistMemberPermissions error:", err);
    const code = err.code || err.message || "INTERNAL";
    if (code === "permission-denied" || code === "PERMISSION_DENIED") {
      return res.status(403).json({ error: "PERMISSION_DENIED", message: "You do not have permission to edit member permissions for this artist profile." });
    }
    return res.status(500).json({ error: "INTERNAL", message: "Failed to update member permissions." });
  }
}));

// POST /api/musicians/cancelledGigMusicianProfileUpdate
router.post("/cancelledGigMusicianProfileUpdate", requireAuth, asyncHandler(async (req, res) => {
  const { musicianId, gigId } = req.body || {};
  if (!musicianId || !gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "musicianId and gigId are required" });
  // Support both legacy musicianProfiles and new artistProfiles using the same identifier
  let profileRef = db.doc(`musicianProfiles/${musicianId}`);
  let snapshot = await profileRef.get();

  if (!snapshot.exists) {
    const artistRef = db.doc(`artistProfiles/${musicianId}`);
    const artistSnap = await artistRef.get();
    if (!artistSnap.exists) {
      return res.status(404).json({ error: "NOT_FOUND", message: "musician/artist profile not found" });
    }
    profileRef = artistRef;
    snapshot = artistSnap;
  }

  const data = snapshot.data() || {};
  const updatedGigApplications = Array.isArray(data.gigApplications) ? data.gigApplications.filter((app) => app?.gigId !== gigId) : [];
  await profileRef.update({ gigApplications: updatedGigApplications, confirmedGigs: FieldValue.arrayRemove(gigId) });
  return res.json({ data: { success: true, musicianId, gigId } });
}));

// POST /api/musicians/findPendingFeeByGigId
router.post("/findPendingFeeByGigId", requireAuth, asyncHandler(async (req, res) => {
  const { musicianId, gigId } = req.body || {};
  if (!musicianId || !gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "musicianId and gigId are required" });
  
  const artistRef = db.doc(`artistProfiles/${musicianId}`);
  const artistSnap = await artistRef.get();
  
  if (!artistSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "artist profile not found" });
  }
  
  const snap = await artistRef.collection("pendingFees").where("gigId", "==", gigId).limit(1).get();
  if (snap.empty) return res.json({ data: { found: false } });
  const d = snap.docs[0];
  return res.json({ data: { docId: d.id, data: d.data() || {} } });
}));

// POST /api/musicians/markPendingFeeInDispute
router.post("/markPendingFeeInDispute", requireAuth, asyncHandler(async (req, res) => {
  const callerUid = req.auth.uid;
  const { musicianId, docId, gigId, disputeReason, details, venueId } = req.body || {};
  if (!musicianId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "musicianId is required" });
  if (!docId && !gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "provide docId or gigId" });
  const safeExtras = {};
  if (typeof disputeReason === "string") safeExtras.disputeReason = disputeReason.trim().slice(0, 2000);
  if (typeof details === "string") safeExtras.details = details.trim().slice(0, 5000);

  // Check artist profile
  const artistRef = db.doc(`artistProfiles/${musicianId}`);
  const artistSnap = await artistRef.get();
  
  if (!artistSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "artist profile not found" });
  }

  // Authorization: either venue reviewer (venueId provided) or owner/member of artist profile
  if (venueId) {
    await assertVenuePerm(db, callerUid, venueId, 'reviews.create');
  } else {
    // Check if caller is owner or active member of the artist profile
    try {
      await assertArtistPerm(db, callerUid, musicianId, "gigs.book"); // Using gigs.book as proxy for review permission
    } catch (permError) {
      return res.status(403).json({ error: "PERMISSION_DENIED", message: "caller must be owner or active member of artist profile or provide venueId" });
    }
  }

  const pendingCol = artistRef.collection("pendingFees");
  let result;
  try {
    result = await db.runTransaction(async (tx) => {
      const artistSnapTx = await tx.get(artistRef);
      if (!artistSnapTx.exists) {
        throw new Error("NOT_FOUND: artist profile");
      }
      let pfRef = null; let pfSnap = null;
      if (docId) {
        pfRef = pendingCol.doc(docId);
        pfSnap = await tx.get(pfRef);
        if (!pfSnap.exists) {
          throw new Error("NOT_FOUND: pending fee (docId)");
        }
      } else {
        const qSnap = await tx.get(pendingCol.where("gigId", "==", gigId).limit(1));
        if (qSnap.empty) {
          throw new Error("NOT_FOUND: pending fee (gigId)");
        }
        pfSnap = qSnap.docs[0];
        pfRef = pfSnap.ref;
      }
      const before = pfSnap.data() || {};
      const currentStatus = String(before.status || "").toLowerCase();
      if (currentStatus === "in dispute") {
        return { alreadyInDispute: true, pendingFeeId: pfSnap.id, status: "in dispute" };
      }
      tx.update(pfRef, { disputeLogged: true, status: "in dispute", disputeClearingTime: null, updatedAt: FieldValue.serverTimestamp(), ...safeExtras });
      const disputeRef = db.collection("disputes").doc();
      tx.set(disputeRef, { type: "pendingFeeDispute", musicianId, pendingFeeId: pfSnap.id, gigId: before.gigId || null, raisedByUid: callerUid, disputeReason: safeExtras.disputeReason ?? null, details: safeExtras.details ?? null, createdAt: FieldValue.serverTimestamp() });
      return { alreadyInDispute: false, pendingFeeId: pfSnap.id, status: "in dispute", disputeDocId: disputeRef.id };
    });
  } catch (error) {
    if (error.message?.startsWith("NOT_FOUND:")) {
      const message = error.message.replace("NOT_FOUND: ", "");
      return res.status(404).json({ error: "NOT_FOUND", message });
    }
    throw error;
  }
  return res.json({ data: { success: true, ...result, message: result.alreadyInDispute ? 'This fee is already marked as "in dispute".' : 'Dispute submitted. We\'ll review it and pause clearing.' } });
}));

// POST /api/musicians/markInviteAsViewed
router.post("/markInviteAsViewed", requireAuth, asyncHandler(async (req, res) => {
  const { gigId, applicantId } = req.body || {};
  if (!gigId || !applicantId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId and applicantId are required" });
  const gigRef = db.collection("gigs").doc(gigId);
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: `Gig ${gigId} does not exist.` });
  const gigData = gigSnap.data() || {};
  const applicants = Array.isArray(gigData.applicants) ? gigData.applicants : [];
  const updatedApplicants = applicants.map((a) => a?.id === applicantId ? { ...a, viewed: true } : a);
  await gigRef.update({ applicants: updatedApplicants });
  return res.json({ data: { success: true } });
}));

// POST /api/artists/createArtistInvite (auth)
router.post("/createArtistInvite", requireAuth, asyncHandler(async (req, res) => {
  const inviterUid = req.auth.uid;
  const { artistProfileId, email, permissionsInput = {}, invitedByName = null, ttlDays = 7 } = req.body || {};
  if (!artistProfileId || !email) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "artistProfileId and email required" });
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "email format invalid" });
  }
  // Only the artist owner can invite new members
  await assertArtistOwner(db, inviterUid, artistProfileId);

  const nowMs = Date.now();
  const existingQ = await db.collection("artistInvites")
    .where("artistProfileId", "==", artistProfileId)
    .where("email", "==", normalizedEmail)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  
  if (!existingQ.empty) {
    const doc = existingQ.docs[0];
    const d = doc.data() || {};
    const exp = d.expiresAt?.toMillis?.() ? d.expiresAt.toMillis() : (d.expiresAt instanceof Date ? d.expiresAt.getTime() : 0);
    if (exp > nowMs) {
      return res.json({ data: { inviteId: doc.id, reused: true } });
    }
  }
  
  const safePermissions = sanitizeArtistPermissions(permissionsInput || {});
  const boundedDays = Math.max(1, Math.min(30, Number(ttlDays) || 7));
  const inviteId = uuidv4();
  
  const inviteDoc = {
    inviteId,
    artistProfileId,
    invitedBy: inviterUid,
    invitedByName: invitedByName || null,
    email: normalizedEmail,
    permissions: safePermissions,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + boundedDays * 24 * 60 * 60 * 1000),
    status: "pending",
  };
  await db.collection("artistInvites").doc(inviteId).set(inviteDoc);
  return res.json({ data: { inviteId, reused: false } });
}));

// POST /api/artists/removeArtistMember (auth)
router.post("/removeArtistMember", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { artistProfileId, memberId } = req.body || {};
  if (!artistProfileId || !memberId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "artistProfileId and memberId are required" });
  }

  // Ensure caller is the owner of this artist profile
  await assertArtistOwner(db, uid, artistProfileId);

  // Prevent removing the owner by mistake
  const artistSnap = await db.doc(`artistProfiles/${artistProfileId}`).get();
  if (artistSnap.exists) {
    const artist = artistSnap.data() || {};
    if (artist.userId === memberId || artist.createdBy === memberId) {
      return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Cannot remove the artist owner." });
    }
  }

  const memberRef = db.doc(`artistProfiles/${artistProfileId}/members/${memberId}`);
  const userRef = db.doc(`users/${memberId}`);

  await db.runTransaction(async (tx) => {
    tx.delete(memberRef);
    // Remove artistProfileId from the user's artistProfiles array (new model)
    tx.set(
      userRef,
      {
        artistProfiles: FieldValue.arrayRemove(artistProfileId),
      },
      { merge: true }
    );

    tx.set(db.collection("auditLogs").doc(), {
      type: "artistMemberRemoved",
      artistProfileId,
      memberUid: memberId,
      removedBy: uid,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return res.json({ data: { success: true } });
}));

// POST /api/artists/acceptArtistInvite (auth)
router.post("/acceptArtistInvite", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { inviteId } = req.body || {};
  if (!inviteId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "inviteId is required" });
  }

  const inviteRef = db.doc(`artistInvites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Invite not found" });
  }

  const invite = inviteSnap.data() || {};
  const artistProfileId = invite.artistProfileId;
  if (!artistProfileId) {
    return res.status(400).json({ error: "INVALID_INVITE_DATA", message: "Missing artistProfileId in invite" });
  }

  const expiresAt = invite.expiresAt;
  const nowMs = Date.now();
  const expMs = expiresAt?.toMillis?.()
    ? expiresAt.toMillis()
    : (expiresAt instanceof Date ? expiresAt.getTime() : 0);
  if (!expMs || expMs <= nowMs) {
    return res.status(400).json({ error: "EXPIRED_INVITE", message: "Invite has expired" });
  }

  const memberRef = db.doc(`artistProfiles/${artistProfileId}/members/${uid}`);
  const memberSnap = await memberRef.get();
  if (memberSnap.exists && (memberSnap.data() || {}).status === "active") {
    // Already an active member - delete invite and return ok
    await inviteRef.delete();
    try {
      await addUserToArtistConversations(artistProfileId, uid);
    } catch (e) {
      console.error("addUserToArtistConversations failed:", e);
    }
    return res.json({ data: { ok: true, message: "ALREADY_MEMBER", artistProfileId } });
  }

  const invitedPerms =
    invite && typeof invite.permissions === "object"
      ? invite.permissions
      : {};
  const permissions = sanitizeArtistPermissions(invitedPerms);

  // Load user data to stamp onto the member document
  const userSnap = await db.doc(`users/${uid}`).get();
  const userData = userSnap.exists ? (userSnap.data() || {}) : {};
  const userName = userData.name || null;
  const userEmail = userData.email || null;
  const hasStripeConnect = !!userData.stripeConnectId;

  await db.runTransaction(async (tx) => {
    tx.set(
      memberRef,
      {
        status: "active",
        permissions,
        addedBy: invite.invitedBy || null,
        userId: uid,
        userName,
        userEmail,
        payoutSharePercent: 0, // Default to 0%, can be updated later
        payoutsEnabled: hasStripeConnect, // Enabled if user has Stripe Connect account
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const userRef = db.doc(`users/${uid}`);
    // Support both legacy and new artist profile arrays
    tx.set(
      userRef,
      {
        artistProfiles: FieldValue.arrayUnion(artistProfileId),
      },
      { merge: true }
    );

    tx.update(inviteRef, {
      status: "accepted",
      acceptedBy: uid,
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(db.collection("auditLogs").doc(), {
      type: "artistInviteAccepted",
      artistProfileId,
      inviteId,
      invitedBy: invite.invitedBy || null,
      memberUid: uid,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  try {
    await addUserToArtistConversations(artistProfileId, uid);
  } catch (e) {
    console.error("addUserToArtistConversations failed:", e);
  }

  return res.json({ data: { ok: true, artistProfileId } });
}));

export default router;


