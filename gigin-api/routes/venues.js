/* eslint-disable */
import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { admin, db, FieldValue } from "../config/admin.js";
import { v4 as uuidv4 } from "uuid";
import { assertVenuePerm, PERM_DEFAULTS, PERM_KEYS, sanitizePermissions } from "../utils/permissions.js";
import { addUserToVenueConversations } from "../utils/conversations.js";

const router = express.Router();

// POST /api/venues/fetchVenueMembersWithUsers (auth)
router.post("/fetchVenueMembersWithUsers", requireAuth, asyncHandler(async (req, res) => {
  const { venueId } = req.body || {};
  if (!venueId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId is required" });
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const venueSnap = await venueRef.get();
  if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
  const membersSnap = await venueRef.collection("members").where("status", "==", "active").get();
  if (membersSnap.empty) return res.json({ data: [] });
  const userRefs = membersSnap.docs.map(d => db.doc(`users/${d.id}`));
  const userSnaps = await db.getAll(...userRefs);
  const userById = new Map();
  userSnaps.forEach(s => {
    if (s.exists) {
      const u = s.data() || {};
      userById.set(s.id, {
        id: s.id,
        name: u.name || null,
        email: u.email || null,
        photoURL: u.picture || u.photoURL || null,
      });
    }
  });
  const result = membersSnap.docs.map(d => {
    const m = d.data() || {};
    const user = userById.get(d.id) || null;
    return {
      uid: d.id,
      status: m.status || "active",
      role: m.role || "member",
      permissions: m.permissions || {},
      createdAt: m.createdAt || null,
      updatedAt: m.updatedAt || null,
      user,
      userName: user?.name || null,
      userEmail: user?.email || null,
    };
  });
  return res.json({ data: result });
}));

// POST /api/venues/acceptVenueInvite (auth)
router.post("/acceptVenueInvite", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const { inviteId } = req.body || {};
  if (!inviteId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "inviteId is required" });
  
  const inviteRef = db.doc(`venueInvites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Invite not found" });
  
  const invite = inviteSnap.data() || {};
  const venueId = invite.venueId;
  if (!venueId) return res.status(400).json({ error: "INVALID_INVITE_DATA", message: "Missing venueId in invite" });
  
  const expiresAt = invite.expiresAt;
  const nowMs = Date.now();
  const expMs = expiresAt?.toMillis?.() ? expiresAt.toMillis() : (expiresAt instanceof Date ? expiresAt.getTime() : 0);
  if (!expMs || expMs <= nowMs) {
    return res.status(400).json({ error: "EXPIRED_INVITE", message: "Invite has expired" });
  }

  const memberRef = db.doc(`venueProfiles/${venueId}/members/${uid}`);
  const memberSnap = await memberRef.get();
  if (memberSnap.exists && (memberSnap.data() || {}).status === "active") {
    await inviteRef.delete();
    try {
      await addUserToVenueConversations(venueId, uid);
    } catch (e) {
      console.error("addUserToVenueConversations failed:", e);
    }
    return res.json({ data: { ok: true, message: "ALREADY_MEMBER", venueId } });
  }

  const invitedPerms = (invite && typeof invite.permissions === "object")
  ? invite.permissions
  : PERM_DEFAULTS;
  const permissions = sanitizePermissions(invitedPerms);

  await db.runTransaction(async (tx) => {
    tx.set(memberRef, {
      status: "active",
      permissions,
      addedBy: invite.invitedBy || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const userRef = db.doc(`users/${uid}`);
    tx.set(userRef, { venueProfiles: admin.firestore.FieldValue.arrayUnion(venueId) }, { merge: true });

    tx.delete(inviteRef);

    tx.set(db.collection("auditLogs").doc(), {
      type: "venueInviteAccepted",
      venueId,
      inviteId,
      invitedBy: invite.invitedBy || null,
      memberUid: uid,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  try {
    await addUserToVenueConversations(venueId, uid);
  } catch (e) {
    console.error("addUserToVenueConversations failed:", e);
  }

  return res.json({ data: { ok: true, venueId } });
}));

// POST /api/venues/createVenueInvite (auth)
router.post("/createVenueInvite", requireAuth, asyncHandler(async (req, res) => {
  const inviterUid = req.auth.uid;
  const { venueId, email, permissionsInput = {}, invitedByName = null, ttlDays = 7 } = req.body || {};
  if (!venueId || !email) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and email required" });
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "email format invalid" });
  }
  await assertVenuePerm(db, inviterUid, venueId, "members.invite");

  const nowMs = Date.now();
  const existingQ = await db.collection("venueInvites")
    .where("venueId", "==", venueId)
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
  
  const safePermissions = sanitizePermissions(permissionsInput || {});
  const boundedDays = Math.max(1, Math.min(30, Number(ttlDays) || 7));
  const inviteId = uuidv4();
  
  const inviteDoc = {
    inviteId,
    venueId,
    invitedBy: inviterUid,
    invitedByName: invitedByName || null,
    email: normalizedEmail,
    permissions: safePermissions,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + boundedDays * 24 * 60 * 60 * 1000),
    status: "pending",
  };
  await db.collection("venueInvites").doc(inviteId).set(inviteDoc);
  return res.json({ data: { inviteId, reused: false } });

}));

// POST /api/venues/updateVenueMemberPermissions (auth)
router.post("/updateVenueMemberPermissions", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, memberUid, permissions } = req.body || {};
  const callerUid = req.auth.uid;
  if (!venueId || !memberUid || typeof permissions !== "object") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId, memberUid, permissions required" });
  }
  if (callerUid === memberUid) {
    return res.status(400).json({ error: "CANNOT_EDIT_SELF", message: "Cannot edit own permissions" });
  }
  for (const k of Object.keys(permissions)) {
    if (!PERM_KEYS.includes(k)) {
      return res.status(400).json({ error: "INVALID_PERMISSION_KEY", message: `Invalid key: ${k}` });
    }
  }
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const callerRef = venueRef.collection("members").doc(callerUid);
  const targetRef = venueRef.collection("members").doc(memberUid);
  const [callerSnap, targetSnap, venueSnap] = await Promise.all([callerRef.get(), targetRef.get(), venueRef.get()]);
  if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
  if (!callerSnap.exists) return res.status(403).json({ error: "CALLER_NOT_MEMBER", message: "Caller not a member" });
  if (!targetSnap.exists) return res.status(404).json({ error: "TARGET_NOT_MEMBER", message: "Target not a member" });
  
  const caller = callerSnap.data() || {};
  const target = targetSnap.data() || {};
  if (caller.status !== "active") return res.status(403).json({ error: "CALLER_NOT_ACTIVE", message: "Caller inactive" });
  if (!caller.permissions?.["members.update"]) return res.status(403).json({ error: "FORBIDDEN", message: "members.update required" });
  
  const ownerUid = (venueSnap.data() || {}).createdBy || (venueSnap.data() || {}).userId || null;
  if (target.role === "owner" || memberUid === ownerUid) {
    return res.status(403).json({ error: "CANNOT_EDIT_OWNER", message: "Cannot edit owner" });
  }
  
  const normalized = sanitizePermissions({ ...PERM_DEFAULTS, ...permissions });
  await targetRef.set({ permissions: normalized, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await db.collection("auditLogs").add({
    type: "memberPermissionsUpdated",
    venueId,
    targetUid: memberUid,
    byUid: callerUid,
    at: admin.firestore.FieldValue.serverTimestamp(),
    permissionsAfter: normalized,
  });
  return res.json({ data: { ok: true } });

}));

// POST /api/venues/removeVenueMember (auth)
router.post("/removeVenueMember", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, memberUid } = req.body || {};
  const callerUid = req.auth.uid;
  if (!venueId || !memberUid) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and memberUid required" });
  if (callerUid === memberUid) return res.status(400).json({ error: "CANNOT_REMOVE_SELF", message: "Cannot remove self" });
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const callerRef = venueRef.collection("members").doc(callerUid);
  const targetRef = venueRef.collection("members").doc(memberUid);
  const userRef = db.doc(`users/${memberUid}`);
  const [venueSnap, callerSnap, targetSnap, userSnap] = await Promise.all([venueRef.get(), callerRef.get(), targetRef.get(), userRef.get()]);
  if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
  if (!callerSnap.exists) return res.status(403).json({ error: "CALLER_NOT_MEMBER", message: "Caller not a member" });
  if (!targetSnap.exists) return res.status(404).json({ error: "TARGET_NOT_MEMBER", message: "Target not a member" });
  const caller = callerSnap.data() || {};
  const target = targetSnap.data() || {};
  if (caller.status !== "active") return res.status(403).json({ error: "CALLER_NOT_ACTIVE", message: "Caller inactive" });
  if (!caller.permissions?.["members.update"]) return res.status(403).json({ error: "FORBIDDEN", message: "members.update required" });
  const ownerUid = (venueSnap.data() || {}).createdBy || (venueSnap.data() || {}).userId || null;
  if (memberUid === ownerUid || target.role === "owner") {
    return res.status(403).json({ error: "CANNOT_REMOVE_OWNER", message: "Cannot remove owner" });
  }
  const userData = userSnap.exists ? (userSnap.data() || {}) : {};
  const venueProfiles = Array.isArray(userData.venueProfiles) ? userData.venueProfiles : [];
  const onlyThisVenue = venueProfiles.length === 1 && venueProfiles[0] === venueId;
  const batch = db.batch();
  batch.update(targetRef, {
    status: "removed",
    removedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  if (onlyThisVenue) {
    batch.update(userRef, { venueProfiles: admin.firestore.FieldValue.delete() });
  } else {
    batch.update(userRef, { venueProfiles: admin.firestore.FieldValue.arrayRemove(venueId) });
  }
  batch.set(db.collection("auditLogs").doc(), {
    type: "memberRemoved",
    venueId,
    targetUid: memberUid,
    byUid: callerUid,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return res.json({ data: { ok: true } });
}));

// POST /api/venues/transferVenueOwnership (auth)
router.post("/transferVenueOwnership", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, recipientEmail, toUserId: rawToUserId } = req.body || {};
  const caller = req.auth.uid;
  if (!venueId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId required" });
  let toUserId = null;
  if (typeof recipientEmail === "string" && recipientEmail.trim()) {
    const normalized = recipientEmail.trim().toLowerCase();
    const q = await db.collection("users").where("email", "==", normalized).limit(1).get();
    if (q.empty) return res.status(404).json({ error: "recipient-not-found", message: "No account found for that email." });
    toUserId = q.docs[0].id;
  } else if (typeof rawToUserId === "string" && rawToUserId.trim()) {
    const toSnap = await db.doc(`users/${rawToUserId}`).get();
    if (!toSnap.exists) return res.status(404).json({ error: "not-found", message: "Recipient user not found" });
    toUserId = rawToUserId.trim();
  } else {
    return res.status(400).json({ error: "invalid-argument", message: "recipientEmail or toUserId is required" });
  }
  if (toUserId === caller) {
    return res.json({ data: { success: false, code: "self-transfer", message: "You already own this venue." } });
  }
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const fromUserRef = db.doc(`users/${caller}`);
  const toUserRef = db.doc(`users/${toUserId}`);
  await db.runTransaction(async (tx) => {
    const [venueSnap, fromSnap, toSnap] = await Promise.all([tx.get(venueRef), tx.get(fromUserRef), tx.get(toUserRef)]);
    if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
    if (!fromSnap.exists || !toSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User profile not found" });
    const venue = venueSnap.data() || {};
    const currentOwner = venue.createdBy || venue.userId;
    if (currentOwner !== caller) return res.status(403).json({ error: "PERMISSION_DENIED", message: "Only the current owner can transfer this venue" });
    const fromList = Array.isArray((fromSnap.data() || {}).venueProfiles) ? (fromSnap.data() || {}).venueProfiles : [];
    const toList   = Array.isArray((toSnap.data() || {}).venueProfiles) ? (toSnap.data() || {}).venueProfiles : [];
    const nextFrom = fromList.filter(id => id !== venueId);
    const nextTo   = toList.includes(venueId) ? toList : [...toList, venueId];
    const newOwnerName = (toSnap.data() || {}).name || (toSnap.data() || {}).accountName || null;
    const newOwnerPicture = (toSnap.data() || {}).picture || null;
    tx.update(venueRef, {
      createdBy: toUserId,
      userId: toUserId,
      ...(newOwnerName ? { accountName: newOwnerName } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.update(fromUserRef, { venueProfiles: nextFrom });
    tx.update(toUserRef,   { venueProfiles: nextTo });

    // Members subcollection updates
    const membersCol = venueRef.collection("members");
    // Remove old owner member doc
    tx.delete(membersCol.doc(caller));
    // Add/overwrite new owner member doc with full permissions true
    const allTruePermissions = {
      "gigs.read": true,
      "gigs.create": true,
      "gigs.update": true,
      "gigs.applications.manage": true,
      "gigs.invite": true,
      "gigs.pay": true,
      "reviews.create": true,
      "finances.read": true,
      "finances.update": true,
      "venue.update": true,
      "members.invite": true,
      "members.update": true,
    };
    tx.set(membersCol.doc(toUserId), {
      addedBy: caller,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      permissions: allTruePermissions,
      role: "owner",
      status: "active",
    }, { merge: true });
  });
  // Update conversations: replace old user with new in authorizedUserIds and accountNames
  try {
    const toUserSnap = await db.doc(`users/${toUserId}`).get();
    const toUser = toUserSnap.data() || {};
    const newName = toUser.name || toUser.accountName || "Owner";
    const newImg = toUser.picture || null;
    const convSnap = await db.collection("conversations")
      .where("participants", "array-contains", venueId)
      .get();
    const batch = db.batch();
    convSnap.docs.forEach((doc) => {
      const data = doc.data() || {};
      const authorizedUserIds = Array.isArray(data.authorizedUserIds) ? data.authorizedUserIds : [];
      const accountNames = Array.isArray(data.accountNames) ? data.accountNames : [];
      const nextAuth = Array.from(new Set(authorizedUserIds.filter(id => id !== caller).concat([toUserId])));
      const nextAccountNames = accountNames
        .filter(a => !(a && a.participantId === venueId && a.accountId === caller))
        .concat([{
          participantId: venueId,
          accountName: newName,
          accountId: toUserId,
          role: "venue",
          accountImg: newImg,
        }]);
      batch.update(doc.ref, {
        authorizedUserIds: nextAuth,
        accountNames: nextAccountNames,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (e) {
    // Non-fatal; log and continue
    console.error("transferVenueOwnership conversation update error:", e);
  }
  return res.json({ data: { success: true, venueId, fromUserId: caller, toUserId } });
}));

// POST /api/venues/deleteVenueData (auth)
router.post("/deleteVenueData", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, confirm } = req.body || {};
  const uid = req.auth.uid;
  if (!venueId || !confirm) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and confirm=true required" });
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const venueSnap = await venueRef.get();
  if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
  const data = venueSnap.data() || {};
  const ownerId = data.userId || data.createdBy;
  if (ownerId !== uid) return res.status(403).json({ error: "PERMISSION_DENIED", message: "Only owner can delete venue" });
  const deleteMembers = async () => {
    const col = venueRef.collection("members");
    for (;;) {
      const page = await col.limit(500).get();
      if (page.empty) break;
      const batch = db.batch();
      page.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  };
  const deleteTemplates = async () => {
    const snap = await db.collection("templates").where("venueId", "==", venueId).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  };
  await Promise.all([deleteMembers(), deleteTemplates()]);
  await venueRef.delete();
  return res.json({ data: { success: true, venueId } });
}));

// POST /api/venues/saveGigTemplate (auth)
router.post("/saveGigTemplate", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const payload = req.body.templateData || {};

  const venueId = String(payload.venueId || "");
  if (!venueId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId is required" });
  }

  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const venueSnap = await venueRef.get();
  if (!venueSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
  }
  const venue = venueSnap.data() || {};
  const ownerUid = venue.createdBy || venue.userId || null;

  // Authorize owner or active member
  const isOwner = ownerUid === uid;
  let isActiveMember = false;
  if (!isOwner) {
    const memberRef = venueRef.collection("members").doc(uid);
    const memberSnap = await memberRef.get();
    isActiveMember = memberSnap.exists && ((memberSnap.data() || {}).status === "active");
  }
  if (!isOwner && !isActiveMember) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Only the venue owner or an active member can save templates",
    });
  }

  const templateId = payload.templateId;
  if (!templateId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "templateId is required" });
  }

  // Remove payment, applicant, and task-related fields from template - templates should be plain gig documents
  const templateData = { ...payload };
  const fieldsToRemove = [
    "payoutConfig",
    "agreedFee",
    "paymentIntentId",
    "paymentStatus",
    "paid",
    "musicianFeeStatus",
    "disputeClearingTime",
    "disputeLogged",
    "clearPendingFeeTaskName",
    "automaticMessageTaskName",
    "applicants", // Templates shouldn't have applicants
    "gigId", // Templates have templateId, not gigId
  ];
  fieldsToRemove.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(templateData, field)) {
      delete templateData[field];
    }
  });

  const templateRef = db.doc(`templates/${templateId}`);

  await db.runTransaction(async (tx) => {
    const [existingT] = await Promise.all([tx.get(templateRef)]);
    const isCreate = !existingT.exists;
    if (!isCreate) {
      const existingVenueId = existingT.data()?.venueId;
      if (existingVenueId && existingVenueId !== venueId) {
        const err = new Error("Template belongs to a different venue");
        err.code = "FAILED_PRECONDITION";
        throw err;
      }
    }

    tx.set(templateRef, templateData, { merge: true });

  });

  return res.json({ data: { templateId } });
}));

export default router;


