/* eslint-disable */
import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { admin, db } from "../config/admin.js";

const router = express.Router();

// POST /api/conversations/getOrCreateConversation
router.post("/getOrCreateConversation", requireAuth, asyncHandler(async (req, res) => {
  const { musicianProfile = {}, gigData = {}, venueProfile = {}, type = "application" } = req.body || {};
  const gigId = gigData.gigId || gigData.id;
  const venueId = gigData.venueId || venueProfile?.venueId || venueProfile?.id;
  const bandOrMusicianId = musicianProfile.musicianId || musicianProfile.profileId || musicianProfile.artistId || musicianProfile.id;
  if (!gigId || !bandOrMusicianId || !venueId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId/venueId/musicianId required" });
  }

  // 1) Existing conversation lookup by band/musician + gigId
  const existingQ = await db
    .collection("conversations")
    .where("participants", "array-contains", bandOrMusicianId)
    .where("gigId", "==", gigId)
    .limit(1)
    .get();

  if (!existingQ.empty) {
    return res.json({ data: { conversationId: existingQ.docs[0].id } });
  }

  // 2) Build participants + accountNames
  const participants = [venueId];
  const accountNames = [];

  // 2a) venue active members → accountNames (speak as venue)
  try {
    const memSnap = await db
      .collection("venueProfiles")
      .doc(venueId)
      .collection("members")
      .where("status", "==", "active")
      .get();

    const existingIds = new Set(accountNames.map((a) => a.accountId).filter(Boolean));
    memSnap.forEach((d) => {
      const uid = d.id;
      if (existingIds.has(uid)) return;
      const m = d.data() || {};
      accountNames.push({
        participantId: venueId,
        accountName: m.displayName || m.name || venueProfile.accountName || "Venue Staff",
        accountId: uid,
        role: "venue",
        accountImg: m.picture || null,
      });
      existingIds.add(uid);
    });
  } catch (_) {
    // non-fatal
  }

  // 2b) Artist / musician side
  // We now treat artistProfiles as the primary musician-side accounts.
  // If an artistProfile exists for musicianId, we add ALL active members as participants.
  let isArtistProfile = false;
  try {
    const artistSnap = await db.collection("artistProfiles").doc(bandOrMusicianId).get();
    isArtistProfile = artistSnap.exists;
  } catch (_) {
    isArtistProfile = false;
  }

  if (isArtistProfile) {
    // Artist profile: conversation participants include the artistProfile id,
    // and accountNames include all active members as 'musician' role.
    participants.push(bandOrMusicianId);

    try {
      const memSnap = await db
        .collection("artistProfiles")
        .doc(bandOrMusicianId)
        .collection("members")
        .where("status", "==", "active")
        .get();

      const existingIds = new Set(accountNames.map((a) => a.accountId).filter(Boolean));
      memSnap.forEach((d) => {
        const uid = d.id;
        if (existingIds.has(uid)) return;
        const m = d.data() || {};
        accountNames.push({
          participantId: bandOrMusicianId,
          accountName: m.userName || musicianProfile.name || "Artist Member",
          accountId: uid,
          role: "musician",
          accountImg: null,
        });
        existingIds.add(uid);
      });
    } catch (_) {
      // non-fatal
    }
  } else {
    // Legacy solo musicianProfile
    participants.push(bandOrMusicianId);
    accountNames.push({
      participantId: bandOrMusicianId,
      accountName: musicianProfile.name,
      accountId: musicianProfile.userId,
      role: "musician",
      musicianImg: musicianProfile.picture || null,
    });
  }

  // 3) lastMessage (keep simple parity)
  const dateLike = gigData.startDateTime || gigData.date || null;
  let dateStr = "";
  if (dateLike) {
    const d = typeof dateLike?.toDate === "function" ? dateLike.toDate() : new Date(dateLike);
    if (!isNaN(d.getTime())) {
      const pad2 = (n) => String(n).padStart(2, "0");
      dateStr = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
  }
  const venueName = gigData?.venue?.venueName || venueProfile?.accountName || null;
  const lastMessage =
    type === "negotiation"
      ? `${musicianProfile.name} wants to negotiate the fee on ${dateStr} at ${venueName}.`
      : type === "application"
      ? `${musicianProfile.name} applied to the gig on ${dateStr} at ${venueName}.`
      : type === "invitation"
      ? `${venueProfile.accountName || "Venue"} invited ${musicianProfile.name} to play at their gig on ${dateStr}.`
      : type === "dispute"
      ? `${venueProfile.accountName || "Venue"} has disputed the gig performed on ${dateStr}.`
      : "";

  // authorizedUserIds from accountNames.accountId
  const authorizedUserIds = Array.from(new Set(accountNames.map((a) => a.accountId).filter(Boolean)));

  // 4) Save conversation
  const now = admin.firestore.Timestamp.now();
  const payload = {
    participants,
    venueImg: Array.isArray(venueProfile.photos) ? venueProfile.photos[0] || null : null,
    venueName,
    accountNames,
    authorizedUserIds,
    gigDate: gigData.date || null,
    gigId,
    artistName: musicianProfile.name || null,
    artistImage: musicianProfile?.heroMedia?.url || null,
    lastMessage,
    lastMessageTimestamp: now,
    lastMessageSenderId: "system",
    status: "open",
    createdAt: now,
  };

  const docRef = await db.collection("conversations").add(payload);
  return res.json({ data: { conversationId: docRef.id } });
}));

// POST /api/conversations/updateConversationDocument
router.post("/updateConversationDocument", requireAuth, asyncHandler(async (req, res) => {
  const { convId, updates } = req.body || {};
  if (!convId || !updates || typeof updates !== "object") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "convId and updates required" });
  }
  await db.doc(`conversations/${convId}`).update(updates);
  return res.json({ data: { success: true } });
}));

// POST /api/conversations/markGigApplicantAsViewed
router.post("/markGigApplicantAsViewed", requireAuth, asyncHandler(async (req, res) => {
  const { gigId, musicianId } = req.body || {};
  if (!gigId || !musicianId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId and musicianId required" });
  }

  const gigRef = db.doc(`gigs/${gigId}`);
  const snap = await gigRef.get();
  if (!snap.exists) {
    return res.json({ data: { success: false, reason: "Gig not found" } });
  }

  const data = snap.data() || {};
  const applicants = Array.isArray(data.applicants) ? data.applicants : [];
  const updatedApplicants = applicants.map((a) =>
    a?.id === musicianId ? { ...a, viewed: true } : a
  );

  await gigRef.update({ applicants: updatedApplicants });
  return res.json({ data: { success: true } });
}));

// POST /api/conversations/notifyOtherApplicantsGigConfirmed
router.post("/notifyOtherApplicantsGigConfirmed", requireAuth, asyncHandler(async (req, res) => {
  const { gigData = {}, acceptedMusicianId } = req.body || {};
  const gigId = gigData.gigId || gigData.id;
  const venueId = gigData.venueId;
  if (!gigId || !venueId || !acceptedMusicianId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId, venueId and acceptedMusicianId required" });
  }

  const applicants = Array.isArray(gigData.applicants) ? gigData.applicants : [];
  const otherIds = applicants
    .map((a) => a?.id)
    .filter(Boolean)
    .filter((id) => id !== acceptedMusicianId);

  // 1) Build updated applicants array (decline others)
  const newApplicants = applicants.map((a) =>
    a?.id === acceptedMusicianId ? a : { ...a, status: "declined" }
  );

  // 2) Flip pending messages to declined + add announcement + close conversations
  const convSnap = await db
    .collection("conversations")
    .where("gigId", "==", gigId)
    .get();

  const pendingTypes = ["application", "invitation", "negotiation"];
  const text =
    "This gig has been confirmed with another musician. Applications are now closed.";
  const now = admin.firestore.Timestamp.now();

  for (const convDoc of convSnap.docs) {
    const data = convDoc.data() || {};
    const participants = Array.isArray(data.participants) ? data.participants : [];
    const isVenueAndOtherApplicant =
      participants.includes(venueId) && otherIds.some((id) => participants.includes(id));

    if (!isVenueAndOtherApplicant) continue;

    const messagesRef = convDoc.ref.collection("messages");

    // Pending application/invitation/negotiation messages -> declined
    const pendingSnap = await messagesRef
      .where("status", "==", "pending")
      .where("type", "in", pendingTypes)
      .get();

    const batch = db.batch();

    pendingSnap.forEach((m) => batch.update(m.ref, { status: "declined" }));

    // Announcement
    const announceRef = messagesRef.doc();
    batch.set(announceRef, {
      senderId: "system",
      text,
      timestamp: now,
      type: "announcement",
      status: "gig confirmed",
    });

    // Close conversation
    batch.update(convDoc.ref, {
      lastMessage: text,
      lastMessageTimestamp: now,
      lastMessageSenderId: "system",
      status: "closed",
    });

    await batch.commit();
  }

  return res.json({ data: { newApplicants } });
}));

// POST /api/conversations/deleteConversation
router.post("/deleteConversation", requireAuth, asyncHandler(async (req, res) => {
  const { conversationId } = req.body || {};
  if (!conversationId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "conversationId required" });
  }

  const convRef = db.collection("conversations").doc(conversationId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) {
    // idempotent delete semantics
    return res.json({ data: { success: true } });
  }

  const conv = convSnap.data() || {};
  const allowed = Array.isArray(conv.authorizedUserIds)
    ? conv.authorizedUserIds.includes(req.auth.uid)
    : false;

  if (!allowed) {
    return res.status(403).json({ error: "PERMISSION_DENIED", message: "not authorized on this conversation" });
  }

  // Delete messages subcollection in chunks
  const messagesCol = convRef.collection("messages");
  for (;;) {
    const page = await messagesCol.limit(500).get();
    if (page.empty) break;

    const batch = db.batch();
    page.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await convRef.delete();
  return res.json({ data: { success: true } });
}));

export default router;
