/* eslint-disable */
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db, admin, FieldValue, Timestamp, GeoPoint } from "../config/admin.js";
import { assertVenuePerm, assertArtistPerm } from "../utils/permissions.js";
import {
  loadGuestPrivate,
  loadGuestPrivates,
  loadPrivateApplications,
  loadPrivateDetails,
  publicMediaItem,
  sanitiseApplicants,
  savePrivateApplications,
  savePrivateDetails,
  splitGigUpdate,
  venueGuestView,
} from "../lib/gigPrivacy.js";
import { publicLineup } from "../lib/nightApplications.js";
import { queueMail } from "../lib/queueMail.js";
import { keepReminderHtml } from "../lib/keepProfile.js";
import { placeLoggedInApplication, acceptApplication, assignApplication, declineApplication, undoApplication, closeApplications, undoClose, reopenApplications, saveSoundTech, readNightApplications, publishNightApplicants, withdrawGuestApplication } from "../lib/nightApplicationOps.js";

function visibleApplicants(list, gigId, viewerId, showAll) {
  if (showAll) return list || [];
  const lineup = publicLineup(list, gigId);
  const mine = (list || []).find((entry) => String(entry?.id) === String(viewerId));
  if (mine && !lineup.some((entry) => String(entry.id) === String(mine.id))) return [...lineup, mine];
  return lineup;
}

async function mergePublishApplicants(gigId, incoming) {
  const { applications } = await readNightApplications(gigId);
  const map = new Map((applications || []).map((entry) => [String(entry.id), { ...entry }]));
  for (const entry of incoming || []) {
    if (entry?.id == null) continue;
    const prev = map.get(String(entry.id));
    map.set(String(entry.id), prev ? { ...prev, ...entry, id: prev.id } : entry);
  }
  const list = [...map.values()];
  await publishNightApplicants(gigId, list);
  return list;
}

const router = express.Router();

// Normalize various incoming representations (Date, ISO string, millis, {seconds,nanoseconds})
// into a Firestore Admin Timestamp. Returns null if input is falsy/invalid.
function toAdminTimestamp(input) {
  try {
    if (!input) return null;
    // Already an Admin Timestamp-like object
    if (input instanceof Date) return Timestamp.fromDate(input);
    if (typeof input === "number") return Timestamp.fromDate(new Date(input));
    if (typeof input === "string") return Timestamp.fromDate(new Date(input));
    if (typeof input === "object") {
      const seconds = input.seconds ?? input._seconds;
      const nanoseconds = input.nanoseconds ?? input._nanoseconds;
      if (typeof seconds === "number" && typeof nanoseconds === "number") {
        return new Timestamp(seconds, nanoseconds);
      }
      // Fallback: if it looks like a date string property
      if (input.toDate instanceof Function) {
        // Firestore client Timestamp (when deserialized in some environments)
        return Timestamp.fromDate(input.toDate());
      }
    }
  } catch (_) {
    // ignore and fall through
  }
  return null;
}

// Normalize various incoming representations of GeoPoint
// into a Firestore Admin GeoPoint. Returns null if input is falsy/invalid.
function toAdminGeoPoint(input) {
  try {
    if (!input) return null;
    // Already an Admin GeoPoint
    if (input instanceof GeoPoint) return input;
    // Handle serialized GeoPoint object from client (e.g., {latitude, longitude, type})
    if (typeof input === "object") {
      const lat = input.latitude ?? input._latitude;
      const lng = input.longitude ?? input._longitude;
      if (typeof lat === "number" && typeof lng === "number") {
        return new GeoPoint(lat, lng);
      }
    }
    // Handle array format [longitude, latitude] (GeoJSON format)
    if (Array.isArray(input) && input.length === 2) {
      const [lng, lat] = input;
      if (typeof lat === "number" && typeof lng === "number") {
        return new GeoPoint(lat, lng);
      }
    }
  } catch (_) {
    // ignore and fall through
  }
  return null;
}

/**
 * Validates a gig invite for private gigs
 * @param {Object} gig - The gig document data
 * @param {string} inviteId - The invite ID from the request
 * @param {string} musicianId - The musician/artist profile ID applying
 * @returns {Promise<{valid: boolean, error?: string, message?: string}>}
 */
async function validateGigInvite(gig, inviteId, musicianId) {
  // If gig is not private, no validation needed
  if (!gig.private) {
    return { valid: true };
  }

  // If gig is private, inviteId is required
  if (!inviteId || typeof inviteId !== "string") {
    return { valid: false, error: "INVALID_INVITE", message: "This gig is private and requires a valid invite link." };
  }

  // Check if inviteId is in gig's inviteIds array
  const gigInviteIds = Array.isArray(gig.inviteIds) ? gig.inviteIds : [];
  if (!gigInviteIds.includes(inviteId)) {
    return { valid: false, error: "INVALID_INVITE", message: "Invalid invite link." };
  }

  // Fetch the invite document
  const inviteRef = db.doc(`gigInvites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  
  if (!inviteSnap.exists) {
    return { valid: false, error: "INVALID_INVITE", message: "Invite not found." };
  }

  const inviteData = inviteSnap.data() || {};

  // Check if invite is active
  if (!inviteData.active) {
    return { valid: false, error: "INVALID_INVITE", message: "This invite is no longer active." };
  }

  // Check if invite has expired
  if (inviteData.expiresAt) {
    const expiresAt = toAdminTimestamp(inviteData.expiresAt);
    if (expiresAt) {
      const now = Timestamp.now();
      if (expiresAt.toMillis() < now.toMillis()) {
        return { valid: false, error: "INVALID_INVITE", message: "This invite has expired." };
      }
    }
  }

  // If invite has an artistId, it must match the musicianId
  if (inviteData.artistId && inviteData.artistId !== musicianId) {
    return { valid: false, error: "INVALID_INVITE", message: "This invite is for a different artist." };
  }

  // All checks passed
  return { valid: true };
}

/** Aligns with GigPage / Book New Event: Open Mic without maxApplicants is uncapped. */
function resolveMaxApplicantsForListing(gig) {
  const rawMax = Number(gig?.maxApplicants);
  const hasExplicitMax = Number.isFinite(rawMax) && rawMax >= 1;
  const isOpenMicGig = gig?.kind === "Open Mic";
  if (hasExplicitMax) return Math.max(1, Math.floor(rawMax));
  if (isOpenMicGig) return Number.POSITIVE_INFINITY;
  return 1;
}

function countBookedApplicantsForListing(gig) {
  const applicants = gig?.applicants;
  if (!Array.isArray(applicants)) return 0;
  if (gig?.kind === "Open Mic") {
    return applicants.filter((a) => a?.status === "confirmed").length;
  }
  return applicants.filter((a) =>
    ["confirmed", "accepted", "paid", "payment processing"].includes(a?.status)
  ).length;
}

function isListingClosedToNewApplicants(gig) {
  if (!gig) return false;
  const max = resolveMaxApplicantsForListing(gig);
  if (!Number.isFinite(max)) return false;
  return countBookedApplicantsForListing(gig) >= max;
}

function musicianOccupiesBookedSlotOnListing(gig, musicianProfileId) {
  if (!musicianProfileId) return false;
  const me = (Array.isArray(gig?.applicants) ? gig.applicants : []).find((a) => a?.id === musicianProfileId);
  if (!me) return false;
  if (gig?.kind === "Open Mic") {
    return me.status === "confirmed";
  }
  return ["confirmed", "accepted", "paid", "payment processing"].includes(me?.status);
}

/** All gig doc ids in the same multi-set group (BFS over `gigSlots` links). */
async function collectMultiSlotGigGroupIds(startGigId) {
  const visited = new Set();
  const queue = [startGigId];
  while (queue.length) {
    const id = queue.shift();
    if (!id || typeof id !== "string" || visited.has(id)) continue;
    visited.add(id);
    const snap = await db.doc(`gigs/${id}`).get();
    if (!snap.exists) continue;
    const slots = snap.data()?.gigSlots;
    if (!Array.isArray(slots)) continue;
    for (const sid of slots) {
      if (sid && typeof sid === "string" && !visited.has(sid)) queue.push(sid);
    }
  }
  return visited;
}

const BOOKED_APPLICANT_STATUSES = new Set(["confirmed", "accepted", "paid", "payment processing"]);

function shouldAutoDeclineApplicantOnSiblingSlot(applicant) {
  if (!applicant || applicant.id == null) return false;
  const st = String(applicant.status || "").toLowerCase();
  if (BOOKED_APPLICANT_STATUSES.has(st)) return false;
  if (st === "withdrawn" || st === "declined") return false;
  return true;
}

const OTHER_SET_DECLINE_LAST_MESSAGE =
  "Application declined — you were confirmed for another set at this event.";

function applicantIsGuest(applicant) {
  return applicant?.type === "guest" || applicant?.guest === true;
}

async function emailGuest(gigId, applicant, { subject, text, remind = false }) {
  let to = applicant?.email;
  let priv = null;
  if (gigId && applicant?.id) {
    priv = await loadGuestPrivate(gigId, applicant.id);
    to = to || priv?.email || null;
  }
  let extra = "";
  if (remind && to) {
    extra = await keepReminderHtml({
      email: to,
      artistProfileId: priv?.artistProfileId || applicant?.artistProfileId,
      keepProfileOffer: priv?.keepProfileOffer || applicant?.keepProfileOffer,
      gigId,
      applicantId: applicant.id,
      actName: applicant?.name || applicant?.artistName || "",
      venueName: applicant?.venueName || "",
    });
  }
  await queueMail({
    to,
    from: "Gigin <noreply@giginmusic.com>",
    message: {
      subject,
      text,
      html: `<p style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0F1115;">${text}</p>${extra}`,
    },
  });
}

async function markApplicationThreadDeclinedForOtherSet(gigId, musicianProfileId) {
  const convQ = await db
    .collection("conversations")
    .where("participants", "array-contains", musicianProfileId)
    .where("gigId", "==", gigId)
    .limit(1)
    .get();
  if (convQ.empty) return;
  const convId = convQ.docs[0].id;
  const ts = Timestamp.now();
  const msgsSnap = await db
    .collection("conversations")
    .doc(convId)
    .collection("messages")
    .orderBy("timestamp", "desc")
    .limit(40)
    .get();
  let targetRef = null;
  for (const doc of msgsSnap.docs) {
    const m = doc.data() || {};
    if (m.type === "application" || m.type === "invitation") {
      targetRef = doc.ref;
      break;
    }
  }
  if (!targetRef) return;
  await targetRef.update({
    status: "declined",
    declineDetail: "accepted_other_set",
    timestamp: ts,
  });
  await db.doc(`conversations/${convId}`).update({
    lastMessage: OTHER_SET_DECLINE_LAST_MESSAGE,
    lastMessageTimestamp: ts,
    lastMessageSenderId: "system",
  });
}

/**
 * When an artist is confirmed/accepted on one set, decline their pending applications
 * on sibling sets in the same multi-set night and mark threads so the reason is clear.
 */
async function declineArtistOnOtherSetsInGroup(acceptedGigId, musicianProfileId) {
  if (!acceptedGigId || !musicianProfileId) return;
  let groupIds;
  try {
    groupIds = await collectMultiSlotGigGroupIds(acceptedGigId);
  } catch (e) {
    console.error("collectMultiSlotGigGroupIds failed", e);
    return;
  }
  if (groupIds.size <= 1) return;

  for (const otherGigId of groupIds) {
    if (otherGigId === acceptedGigId) continue;
    const gigRef = db.doc(`gigs/${otherGigId}`);
    let snap;
    try {
      snap = await gigRef.get();
    } catch (e) {
      console.error("sibling gig read failed", otherGigId, e);
      continue;
    }
    if (!snap.exists) continue;
    const gig = snap.data() || {};
    const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
    let changed = false;
    const nextApplicants = applicants.map((a) => {
      if (a?.id !== musicianProfileId || !shouldAutoDeclineApplicantOnSiblingSlot(a)) {
        return a;
      }
      changed = true;
      return {
        ...a,
        status: "declined",
        declinedForOtherSet: true,
        acceptedOnGigId: acceptedGigId,
      };
    });
    if (!changed) continue;
    try {
      const rootId = gig.applicationsRootGigId || otherGigId;
      const existing = await loadPrivateApplications(rootId);
      const saved = existing?.applicants?.length
        ? existing.applicants.map((entry) => (
          String(entry?.id) === String(musicianProfileId) && shouldAutoDeclineApplicantOnSiblingSlot(entry)
            ? { ...entry, status: "declined", declinedForOtherSet: true, acceptedOnGigId: acceptedGigId }
            : entry
        ))
        : nextApplicants;
      await savePrivateApplications(rootId, saved);
      const onlySlot = !Array.isArray(gig.gigSlots) || gig.gigSlots.length < 2;
      await gigRef.update({ applicants: publicLineup(saved, otherGigId, { onlySlot }) });
    } catch (e) {
      console.error("sibling gig applicant update failed", otherGigId, e);
      continue;
    }
    try {
      await markApplicationThreadDeclinedForOtherSet(otherGigId, musicianProfileId);
    } catch (e) {
      console.error("markApplicationThreadDeclinedForOtherSet failed", otherGigId, e);
    }
  }
}

// POST /api/gigs/postMultipleGigs
router.post("/postMultipleGigs", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { venueId, gigDocuments } = req.body || {};
  if (!venueId || !Array.isArray(gigDocuments) || gigDocuments.length === 0) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and gigDocuments[] required" });
  }
  if (gigDocuments.length > 20) {
    return res.status(400).json({ error: "TOO_MANY_GIGS", message: "Max 20 gigs per request" });
  }

  // Permission: venue owner or active member with gigs.create
  await assertVenuePerm(db, caller, venueId, "gigs.create");

  const batch = db.batch();
  const gigIds = [];
  for (const raw of gigDocuments) {
    // Coerce date-like fields to Firestore Timestamps to avoid storing plain maps
    const normalized = { ...raw };
    // Never persist a stray client-side id field; Firestore doc id is gigId
    if (Object.prototype.hasOwnProperty.call(normalized, "id")) delete normalized.id;
    const startTs = toAdminTimestamp(raw.startDateTime);
    if (startTs) normalized.startDateTime = startTs;
    const dateTs = toAdminTimestamp(raw.date);
    if (dateTs) normalized.date = dateTs;
    // Ensure createdAt exists and is a Timestamp
    const createdAtTs = toAdminTimestamp(raw.createdAt) || Timestamp.fromDate(new Date());
    normalized.createdAt = createdAtTs;
    if (normalized.applicationsOpen === undefined) normalized.applicationsOpen = true;
    // Normalize geopoint to Firestore Admin GeoPoint (handles serialized objects from client)
    const geopoint = toAdminGeoPoint(raw.geopoint);
    if (geopoint) normalized.geopoint = geopoint;

    const gigId = raw?.gigId;
    if (!gigId) return res.status(400).json({ error: "INVALID_GIG", message: "missing gigId" });
    const ref = db.collection("gigs").doc(gigId);
    batch.set(ref, { ...normalized, venueId }, { merge: false });
    gigIds.push(gigId);
  }

  const uniqueIds = Array.from(new Set(gigIds));
  const venueRef = db.collection("venueProfiles").doc(venueId);
  batch.set(venueRef, { gigs: FieldValue.arrayUnion(...uniqueIds) }, { merge: true });

  await batch.commit();
  return res.json({ data: { ok: true, gigIds: uniqueIds } });
}));

// POST /api/gigs/updateGigDocument
router.post("/updateGigDocument", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { gigId, action, updates } = req.body || {};
  if (!gigId || typeof gigId !== "string") return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId required" });
  if (!updates || typeof updates !== "object") return res.status(400).json({ error: "INVALID_ARGUMENT", message: "updates object required" });
  if (!action || typeof action !== "string") return res.status(400).json({ error: "INVALID_ARGUMENT", message: "action required" });

  const gigRef = db.doc(`gigs/${gigId}`);
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "gig" });
  const gig = gigSnap.data() || {};
  const venueId = gig?.venueId;
  if (!venueId) return res.status(400).json({ error: "FAILED_PRECONDITION", message: "gig missing venueId" });
  // Permission checks by action (parity with callable)
  switch (action) {
    case "gigs.applications.manage":
      await assertVenuePerm(db, caller, venueId, "gigs.applications.manage");
      break;
    case "gigs.update":
      await assertVenuePerm(db, caller, venueId, "gigs.update");
      break;
    case "reviews.create":
      await assertVenuePerm(db, caller, venueId, "reviews.create");
      break;
    case "musician.withdraw.application":
    case "artist.withdraw.application": {
      const userSnap = await db.doc(`users/${caller}`).get();
      const user = userSnap.data() || {};
      const callerIds = action === "artist.withdraw.application"
        ? (Array.isArray(user.artistProfiles) ? user.artistProfiles : []).filter(Boolean)
        : (Array.isArray(user.musicianProfile) ? user.musicianProfile : (user.musicianProfile ? [user.musicianProfile] : []));
      const { applications } = await readNightApplications(gigId);
      const match = (applications || []).find((entry) => callerIds.includes(entry?.id));
      if (!match) {
        return res.status(403).json({ error: "PERMISSION_DENIED", message: "caller is not an applicant on this gig" });
      }
      if (action === "artist.withdraw.application") {
        const artistSnap = await db.doc(`artistProfiles/${match.id}`).get();
        if (artistSnap.exists) await assertArtistPerm(db, caller, match.id, "gigs.book");
      }
      await withdrawGuestApplication({ gigId, applicant: match });
      delete updates.applicants;
      break;
    }
    default:
      return res.status(400).json({ error: "INVALID_ARGUMENT", message: `unsupported action "${action}"` });
  }

  // Normalize any geopoint in updates (handles serialized objects from client)
  const normalizedUpdates = { ...updates };
  if (Array.isArray(normalizedUpdates.applicants)) {
    await mergePublishApplicants(gigId, normalizedUpdates.applicants);
    delete normalizedUpdates.applicants;
  }
  if (normalizedUpdates.geopoint) {
    const geopoint = toAdminGeoPoint(normalizedUpdates.geopoint);
    if (geopoint) normalizedUpdates.geopoint = geopoint;
  }
  // Also normalize timestamps if present
  if (normalizedUpdates.startDateTime) {
    const startTs = toAdminTimestamp(normalizedUpdates.startDateTime);
    if (startTs) normalizedUpdates.startDateTime = startTs;
  }
  if (normalizedUpdates.date) {
    const dateTs = toAdminTimestamp(normalizedUpdates.date);
    if (dateTs) normalizedUpdates.date = dateTs;
  }
  
  const { publicUpdates, privatePatch } = splitGigUpdate(normalizedUpdates);
  if (Object.keys(privatePatch).length) await savePrivateDetails(gigId, privatePatch);
  if (Object.keys(publicUpdates).length) await gigRef.update(publicUpdates);
  return res.json({ data: { success: true } });
}));

router.post("/privateBundle", requireAuth, asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.gigIds)
    ? [...new Set(req.body.gigIds.filter((id) => typeof id === "string" && id))].slice(0, 40)
    : [];
  const caller = req.auth.uid;
  const gigs = {};
  for (const gigId of ids) {
    const snap = await db.doc(`gigs/${gigId}`).get();
    if (!snap.exists) continue;
    const gig = snap.data() || {};
    if (!gig.venueId) continue;
    try {
      await assertVenuePerm(db, caller, gig.venueId, "gigs.read");
    } catch {
      continue;
    }
    const details = await loadPrivateDetails(gigId);
    const privates = await loadGuestPrivates(gigId);
    const guests = {};
    privates.forEach((data, id) => {
      guests[id] = venueGuestView(data);
    });
    const rootId = gig.applicationsRootGigId || gigId;
    const stored = await loadPrivateApplications(rootId);
    gigs[gigId] = {
      soundTech: details.soundTech || null,
      soundEngineerName: details.soundEngineerName || null,
      soundEngineerContact: details.soundEngineerContact || null,
      soundEngineerLastEdited: details.soundEngineerLastEdited || null,
      media: Array.isArray(details.media) ? details.media.map(publicMediaItem) : [],
      hasShareLink: Boolean(details.mediaShareTokenHash),
      guests,
      applications: stored?.applicants || null,
      applicationsRootGigId: rootId,
    };
  }
  return res.json({ gigs });
}));

// POST /api/gigs/applyToGig
router.post("/applyToGig", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { gigId, musicianProfile, inviteId, techSetup, applicationMessage } = req.body || {};
  const musicianId = musicianProfile?.musicianId;
  if (!gigId || !musicianId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId and musicianProfile.musicianId required" });
  }

  // If this is an artistProfile application, enforce gigs.book permission
  const artistRef = db.doc(`artistProfiles/${musicianId}`);
  const artistSnap = await artistRef.get();
  if (artistSnap.exists) {
    await assertArtistPerm(db, caller, musicianId, "gigs.book");
  }

  const gigRef = db.doc(`gigs/${gigId}`);
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) return res.json({ data: { applicants: null } });
  const gig = gigSnap.data() || {};
  if (gig.applicationsOpen === false) {
    return res.status(409).json({
      error: "APPLICATIONS_CLOSED",
      message: "Applications for this gig are closed.",
    });
  }
  if (isListingClosedToNewApplicants(gig)) {
    return res.status(409).json({
      error: "GIG_SLOT_FILLED",
      message: "This set is no longer accepting applications.",
    });
  }

  // Validate invite if gig is private
  const inviteValidation = await validateGigInvite(gig, inviteId, musicianId);
  if (!inviteValidation.valid) {
    return res.status(403).json({ 
      error: inviteValidation.error || "INVALID_INVITE", 
      message: inviteValidation.message || "Invalid invite link." 
    });
  }

  let applicationMessageStored = null;
  if (typeof applicationMessage === "string") {
    const m = applicationMessage.trim();
    if (m) applicationMessageStored = m.slice(0, 4000);
  }

  const now = new Date();
  const newApplication = {
    id: musicianProfile?.musicianId,
    timestamp: now,
    fee: gig.budget || "£0",
    status: "pending",
    type: artistSnap.exists ? "artist" : (musicianProfile?.bandProfile ? "band" : "musician"),
    ...(techSetup && typeof techSetup === "object" && Object.keys(techSetup).length > 0 ? { techSetup } : {}),
    ...(applicationMessageStored ? { applicationMessage: applicationMessageStored } : {}),
    name: musicianProfile?.name || "",
    artistName: musicianProfile?.name || "",
  };
  try {
    const placed = await placeLoggedInApplication({
      gigId,
      application: newApplication,
      preferredSlotGigIds: Array.isArray(req.body?.preferredSlotGigIds) ? req.body.preferredSlotGigIds : undefined,
    });
    return res.json({ data: { updatedApplicants: placed.applicants, rootGigId: placed.rootGigId } });
  } catch (error) {
    if (error.statusCode === 409 && error.code) {
      return res.status(409).json({ error: error.code, message: error.message });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
}));

// POST /api/gigs/inviteToGig
router.post("/inviteToGig", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { gigId, musicianProfile } = req.body || {};
  const musicianId = musicianProfile?.musicianId;
  const musicianName = musicianProfile?.name || null;
  if (!gigId || !musicianId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId and musicianProfile.musicianId required" });

  const gigRef = db.doc(`gigs/${gigId}`);
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) return res.json({ data: { applicants: null } });
  const gig = gigSnap.data() || {};

  // Permission: venue owner or active member with gigs.invite
  const venueId = gig.venueId;
  if (!venueId) return res.status(400).json({ error: "FAILED_PRECONDITION", message: "gig missing venueId" });
  await assertVenuePerm(db, caller, venueId, "gigs.invite");

  // Find matching invite for this artist if gig is private
  let matchingInviteId = null;
  let matchingInviteExpiresAt = null;
  if (gig.private) {
    const inviteIds = Array.isArray(gig.inviteIds) ? gig.inviteIds : [];
    if (inviteIds.length > 0) {
      // Query invites to find one matching this artist
      const invitesRef = db.collection('gigInvites');
      const invitesQuery = invitesRef
        .where('gigId', '==', gigId)
        .where('artistId', '==', musicianId)
        .where('active', '==', true)
        .limit(1);
      const invitesSnapshot = await invitesQuery.get();
      if (!invitesSnapshot.empty) {
        const inviteDoc = invitesSnapshot.docs[0];
        matchingInviteId = inviteDoc.id;
        matchingInviteExpiresAt = inviteDoc.data()?.expiresAt || null;
      }
    }
  }

  const now = new Date();
  const applicant = { 
    id: musicianId, 
    timestamp: now, 
    fee: gig.budget || "£0", 
    status: "pending", 
    invited: true, 
    viewed: false,
    ...(matchingInviteId ? { inviteId: matchingInviteId } : {}),
    ...(matchingInviteExpiresAt ? { inviteExpiresAt: matchingInviteExpiresAt } : {})
  };
  const currentApplicants = Array.isArray(gig.applicants) ? gig.applicants : [];
  const alreadyIncluded = currentApplicants.some(a => a?.id === musicianId);
  const updatedApplicants = alreadyIncluded ? currentApplicants : currentApplicants.concat(applicant);

  await db.runTransaction(async (tx) => {
    const freshGigSnap = await tx.get(gigRef);
    const freshGig = freshGigSnap.exists ? (freshGigSnap.data() || {}) : {};
    const rootId = freshGig.applicationsRootGigId || gigId;
    const privateSnap = await tx.get(db.doc(`gigs/${rootId}/private/applications`));
    const freshApplicants = privateSnap.exists && Array.isArray(privateSnap.data()?.applicants)
      ? privateSnap.data().applicants
      : (Array.isArray(freshGig.applicants) ? freshGig.applicants : []);
    const existingApplicantIndex = freshApplicants.findIndex(a => a?.id === musicianId);
    
    let nextApplicants;
    if (existingApplicantIndex >= 0) {
      // Update existing applicant with invite info
      nextApplicants = [...freshApplicants];
      nextApplicants[existingApplicantIndex] = {
        ...nextApplicants[existingApplicantIndex],
        invited: true,
        ...(matchingInviteId ? { inviteId: matchingInviteId } : {}),
        ...(matchingInviteExpiresAt ? { inviteExpiresAt: matchingInviteExpiresAt } : {})
      };
    } else {
      // Add new applicant
      nextApplicants = freshApplicants.concat(applicant);
    }

    // Support both legacy musicianProfiles and new artistProfiles collections
    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
    const artistRef = db.doc(`artistProfiles/${musicianId}`);
    const [musicianSnap, artistSnap] = await Promise.all([tx.get(musicianRef), tx.get(artistRef)]);

    tx.set(db.doc(`gigs/${rootId}/private/applications`), {
      gigId: rootId,
      applicants: sanitiseApplicants(nextApplicants),
    }, { merge: true });
    const onlySlot = !Array.isArray(freshGig.gigSlots) || freshGig.gigSlots.length < 2;
    tx.update(gigRef, { applicants: publicLineup(nextApplicants, gigId, { onlySlot }) });

    const gigApplicationEntry = {
      gigId,
      profileId: musicianId,
      ...(musicianName ? { name: musicianName } : {}),
    };

    if (musicianSnap.exists) {
      tx.update(musicianRef, { gigApplications: FieldValue.arrayUnion(gigApplicationEntry) });
    } else if (artistSnap.exists) {
      tx.update(artistRef, { gigApplications: FieldValue.arrayUnion(gigApplicationEntry) });
    }
  });
  return res.json({ data: { applicants: updatedApplicants, success: true } });
}));

// POST /api/gigs/negotiateGigFee
router.post("/negotiateGigFee", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { gigId, musicianProfile, newFee, sender } = req.body || {};
  const musicianId = musicianProfile?.musicianId;
  if (!gigId || !musicianId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId and musicianProfile.musicianId required" });
  }

  // If this is an artistProfile negotiation, enforce gigs.book permission
  const artistRef = db.doc(`artistProfiles/${musicianId}`);
  const artistSnap = await artistRef.get();
  if (artistSnap.exists) {
    await assertArtistPerm(db, caller, musicianId, "gigs.book");
  }

  const gigRef = db.doc(`gigs/${gigId}`);
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) return res.json({ data: { applicants: [] } });
  const gig = gigSnap.data() || {};
  if (isListingClosedToNewApplicants(gig)) {
    return res.status(409).json({
      error: "GIG_SLOT_FILLED",
      message: "This set is fully booked.",
    });
  }
  const now = new Date();
  const newApplication = {
    id: musicianProfile?.musicianId,
    timestamp: now,
    fee: newFee ?? "£0",
    status: "pending",
    sentBy: sender,
  };
  const updatedApplicants = [ ...(Array.isArray(gig.applicants) ? gig.applicants : []), newApplication ];
  const published = await mergePublishApplicants(gigId, updatedApplicants);
  return res.json({ data: { updatedApplicants: visibleApplicants(published, gigId, musicianId, false) } });
}));

// POST /api/gigs/duplicateGig
router.post("/duplicateGig", requireAuth, asyncHandler(async (req, res) => {
  const { gigId } = req.body || {};
  if (!gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId required" });
  const originalRef = db.doc(`gigs/${gigId}`);
  const originalSnap = await originalRef.get();
  if (!originalSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "gig not found" });
  const originalData = originalSnap.data() || {};
  const newGigId = uuidv4();
  const newGigRef = db.collection("gigs").doc(newGigId);
  const now = new Date();
  const normalizedOriginal = { ...originalData };
  // Drop any stray client-side id and normalize timestamps
  if (Object.prototype.hasOwnProperty.call(normalizedOriginal, "id")) delete normalizedOriginal.id;
  
  // Remove payment and applicant-related fields - should not be copied to duplicated gig
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
  ];
  fieldsToRemove.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(normalizedOriginal, field)) {
      delete normalizedOriginal[field];
    }
  });
  const normalizedDate = toAdminTimestamp(normalizedOriginal.date) || normalizedOriginal.date;
  const normalizedStart = toAdminTimestamp(normalizedOriginal.startDateTime) || normalizedOriginal.startDateTime;
  // Normalize geopoint (in case original was saved with serialized geopoint)
  const normalizedGeopoint = toAdminGeoPoint(normalizedOriginal.geopoint) || normalizedOriginal.geopoint;
  const createdAtTs = Timestamp.fromDate(now);
  const updatedAtTs = Timestamp.fromDate(now);
  const newGig = {
    ...normalizedOriginal,
    gigId: newGigId,
    applicants: [],
    createdAt: createdAtTs,
    updatedAt: updatedAtTs,
    status: "open",
    ...(normalizedDate ? { date: normalizedDate } : {}),
    ...(normalizedStart ? { startDateTime: normalizedStart } : {}),
    ...(normalizedGeopoint ? { geopoint: normalizedGeopoint } : {}),
  };
  await newGigRef.set(newGig, { merge: false });
  if (originalData.venueId) {
    const venueRef = db.doc(`venueProfiles/${originalData.venueId}`);
    await venueRef.update({ gigs: FieldValue.arrayUnion(newGigId) }).catch(() => venueRef.set({ gigs: [newGigId] }, { merge: true }));
  }
  return res.json({ data: { gigId: newGigId } });
}));

// POST /api/gigs/acceptGigOffer
router.post("/acceptGigOffer", requireAuth, asyncHandler(async (req, res) => {
  const { gigData, musicianProfileId, nonPayableGig = false, role, inviteId } = req.body || {};
  const caller = req.auth.uid;
  if (!gigData || !musicianProfileId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData and musicianProfileId required" });

  // Guard: reject actions on past gigs (fetch fresh to prevent client spoofing)
  if (gigData.gigId) {
    const freshSnap = await db.doc(`gigs/${gigData.gigId}`).get();
    if (freshSnap.exists) {
      const freshGig = freshSnap.data() || {};
      const startTs = toAdminTimestamp(freshGig.startDateTime);
      if (startTs && startTs.toDate() < new Date()) {
        return res.status(409).json({ error: "GIG_IN_PAST", message: "This gig has already passed and cannot be accepted." });
      }
    }
  }

  // Validate invite if gig is private (only for musician role)
  if (role === 'musician' && gigData.private) {
    const inviteValidation = await validateGigInvite(gigData, inviteId, musicianProfileId);
    if (!inviteValidation.valid) {
      return res.status(403).json({ 
        error: inviteValidation.error || "INVALID_INVITE", 
        message: inviteValidation.message || "Invalid invite link." 
      });
    }
  }

  if (role === 'venue') {
    const venueId = gigData?.venueId;
    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "venue" });
    const venue = venueSnap.data() || {};
    const isOwner = venue?.createdBy === caller || venue?.userId === caller;
    if (!isOwner) {
      const memberSnap = await venueRef.collection('members').doc(caller).get();
      const memberData = memberSnap.exists ? memberSnap.data() : null;
      const isActiveMember = !!memberData && memberData.status === 'active';
      const perms = (memberData && memberData.permissions) ? memberData.permissions : {};
      const hasManage = !!perms['gigs.applications.manage'];
      if (!(isActiveMember && hasManage)) return res.status(403).json({ error: "PERMISSION_DENIED", message: "gigs.applications.manage required" });
    }
  }

  if (role === 'musician') {
    // If this is an artistProfile, enforce gigs.book permission for the caller
    const artistRef = db.doc(`artistProfiles/${musicianProfileId}`);
    const artistSnap = await artistRef.get();
    if (artistSnap.exists) {
      await assertArtistPerm(db, caller, musicianProfileId, "gigs.book");
    }
  }

  if (role === "musician" && gigData?.gigId) {
    const gigRefFresh = db.doc(`gigs/${gigData.gigId}`);
    const gigFreshSnap = await gigRefFresh.get();
    if (!gigFreshSnap.exists) {
      return res.status(404).json({ error: "NOT_FOUND", message: "gig not found" });
    }
    const gigFresh = gigFreshSnap.data() || {};
    if (
      isListingClosedToNewApplicants(gigFresh) &&
      !musicianOccupiesBookedSlotOnListing(gigFresh, musicianProfileId)
    ) {
      return res.status(409).json({
        error: "GIG_SLOT_FILLED",
        message: "This set is fully booked.",
      });
    }
  }

  const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
  const isInApplicants = applicants.some(a => a?.id === musicianProfileId);
  
  // If artist is not in applicants array (e.g., invite via link), add them first
  let applicantsToProcess = applicants;
  if (!isInApplicants) {
    const now = Timestamp.fromDate(new Date());
    
    // Get artist profile to get the name
    const artistRef = db.doc(`artistProfiles/${musicianProfileId}`);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);
    const [artistSnap, musicianSnap] = await Promise.all([artistRef.get(), musicianRef.get()]);
    
    const artistName = artistSnap.exists ? (artistSnap.data()?.name || null) : (musicianSnap.exists ? (musicianSnap.data()?.name || null) : null);
    
    const newApplicant = {
      id: musicianProfileId,
      timestamp: now,
      fee: gigData.budget || "£0",
      status: "confirmed",
      invited: true,
      viewed: true,
      ...(inviteId ? { inviteId } : {})
    };
    applicantsToProcess = [...applicants, newApplicant];
    
    // Add to artist's gigApplications array
    const gigApplicationEntry = {
      gigId: gigData.gigId,
      profileId: musicianProfileId,
      ...(artistName ? { name: artistName } : {})
    };
    
    if (artistSnap.exists) {
      await artistRef.update({ gigApplications: FieldValue.arrayUnion(gigApplicationEntry) });
    } else if (musicianSnap.exists) {
      await musicianRef.update({ gigApplications: FieldValue.arrayUnion(gigApplicationEntry) });
    }
  }
  
  let agreedFee = null;
  // maxApplicants gates the "auto-decline other pending applicants" behaviour
  // for paid gigs and the "auto-close" behaviour below. When > 1 the venue
  // can keep accepting up to `maxApplicants` artists for the same gig before
  // the listing closes. Default 1 preserves today's "first-accept-wins"
  // behaviour for paid gigs.
  const rawMaxApplicants = Number(gigData?.maxApplicants);
  const maxApplicants = Number.isFinite(rawMaxApplicants) && rawMaxApplicants >= 1
    ? Math.max(1, Math.min(50, Math.floor(rawMaxApplicants)))
    : 1;
  const confirmedBefore = applicantsToProcess.filter((a) => a?.status === "confirmed" || a?.status === "accepted").length;
  const willHitMax = (confirmedBefore + 1) >= maxApplicants;

  const updatedApplicants = applicantsToProcess.map((applicant) => {
    if (applicant.id === musicianProfileId) {
      agreedFee = applicant.fee;
      return { ...applicant, status: nonPayableGig ? "confirmed" : "accepted" };
    }
    // For paid gigs we historically auto-declined every other applicant on
    // first acceptance. With maxApplicants > 1 we only do that once the
    // listing fills up; otherwise we leave other applicants pending so
    // additional acceptances can still happen.
    if (!nonPayableGig && willHitMax) return { ...applicant, status: "declined" };
    return { ...applicant };
  });

  const acceptedApplicant = applicantsToProcess.find((applicant) => applicant?.id === musicianProfileId);
  const guestAccept = applicantIsGuest(acceptedApplicant);

  // Compute payout config for payable gigs with artistProfiles
  let payoutConfig = null;
  if (!guestAccept && !nonPayableGig && agreedFee != null) {
    // Check if this is an artistProfile (new model)
    const artistRef = db.doc(`artistProfiles/${musicianProfileId}`);
    const artistSnap = await artistRef.get();
    
    if (artistSnap.exists) {
      // Fetch all members of the artist profile
      const membersRef = artistRef.collection('members');
      const membersSnap = await membersRef.get();
      
      if (!membersSnap.empty) {
        const shares = [];
        let totalPercent = 0;
        
        membersSnap.forEach((memberDoc) => {
          const memberData = memberDoc.data();
          // Only include members with payoutsEnabled: true
          if (memberData.status === 'active') {
            const percent = typeof memberData.payoutSharePercent === 'number' 
              ? memberData.payoutSharePercent 
              : 0;
            
            if (percent > 0) {
              shares.push({
                userId: memberData.userId || memberDoc.id,
                percent: percent,
              });
              totalPercent += percent;
            }
          }
        });
        
        // Only create payoutConfig if we have at least one share
        // If total doesn't equal 100%, we'll still store it (can be normalized later if needed)
        if (shares.length > 0) {
          payoutConfig = {
            artistProfileId: musicianProfileId,
            totalFee: agreedFee,
            shares: shares,
          };
        }
      }
    }
  }

  const gigRef = db.doc(`gigs/${gigData.gigId}`);
  // Close logic: today nonPayable + Ticketed close on the first acceptance.
  // With maxApplicants > 1 we keep them open until the slot list fills up.
  const shouldCloseOnAccept = (nonPayableGig || gigData?.kind === "Ticketed Gig") && willHitMax;
  const publishedApplicants = await mergePublishApplicants(gigData.gigId, updatedApplicants);
  const gigUpdate = {
    agreedFee: `${agreedFee}`,
    paid: !!nonPayableGig,
    status: shouldCloseOnAccept ? "closed" : "open",
  };
  
  // Add payoutConfig if computed
  if (payoutConfig) {
    gigUpdate.payoutConfig = payoutConfig;
  }
  
  await gigRef.update(gigUpdate);
  if (!guestAccept) await declineArtistOnOtherSetsInGroup(gigData.gigId, musicianProfileId);

  if (guestAccept) {
    await emailGuest(gigData.gigId, acceptedApplicant, {
      subject: `You're booked to play ${gigData.gigName || "the gig"}`,
      text: `Your application to play at ${gigData.venue?.venueName || "the venue"} has been accepted. We'll only email you about this.`,
      remind: true,
    });
  } else if (nonPayableGig) {
    // For legacy musician profiles, confirmed gigs were stored on musicianProfiles.
    // For the new artistProfiles-based flow, use artistProfiles instead.
    const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);
    const musicianSnap = await musicianRef.get();
    if (musicianSnap.exists) {
      await musicianRef.update({ confirmedGigs: FieldValue.arrayUnion(gigData.gigId) });
    } else {
      const artistRef = db.doc(`artistProfiles/${musicianProfileId}`);
      const artistSnap = await artistRef.get();
      if (artistSnap.exists) {
        await artistRef.update({ confirmedGigs: FieldValue.arrayUnion(gigData.gigId) });
      }
    }
  }

  return res.json({
    data: {
      updatedApplicants: visibleApplicants(publishedApplicants, gigData.gigId, musicianProfileId, role === "venue"),
      agreedFee,
    },
  });
}));

// POST /api/gigs/acceptGigOfferOM
router.post("/acceptGigOfferOM", requireAuth, asyncHandler(async (req, res) => {
  const { gigData, musicianProfileId, role, inviteId } = req.body || {};
  const caller = req.auth.uid;
  if (!gigData || !musicianProfileId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData and musicianProfileId required" });

  // Guard: reject actions on past gigs
  if (gigData.gigId) {
    const freshSnap = await db.doc(`gigs/${gigData.gigId}`).get();
    if (freshSnap.exists) {
      const freshGig = freshSnap.data() || {};
      const startTs = toAdminTimestamp(freshGig.startDateTime);
      if (startTs && startTs.toDate() < new Date()) {
        return res.status(409).json({ error: "GIG_IN_PAST", message: "This gig has already passed and cannot be accepted." });
      }
    }
  }

  // Validate invite if gig is private (only for musician role)
  if (role === 'musician' && gigData.private) {
    const inviteValidation = await validateGigInvite(gigData, inviteId, musicianProfileId);
    if (!inviteValidation.valid) {
      return res.status(403).json({ 
        error: inviteValidation.error || "INVALID_INVITE", 
        message: inviteValidation.message || "Invalid invite link." 
      });
    }
  }

  if (role === 'venue') {
    const venueId = gigData?.venueId;
    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "venue" });
    const venue = venueSnap.data() || {};
    const isOwner = venue?.createdBy === caller || venue?.userId === caller;
    if (!isOwner) {
      const memberSnap = await venueRef.collection('members').doc(caller).get();
      const memberData = memberSnap.exists ? memberSnap.data() : null;
      const isActiveMember = !!memberData && memberData.status === 'active';
      const perms = (memberData && memberData.permissions) ? memberData.permissions : {};
      const hasManage = !!perms['gigs.applications.manage'];
      if (!(isActiveMember && hasManage)) return res.status(403).json({ error: "PERMISSION_DENIED", message: "gigs.applications.manage required" });
    }
  }

  if (role === 'musician') {
    // If this is an artistProfile, enforce gigs.book permission for the caller
    const artistRef = db.doc(`artistProfiles/${musicianProfileId}`);
    const artistSnap = await artistRef.get();
    if (artistSnap.exists) {
      await assertArtistPerm(db, caller, musicianProfileId, "gigs.book");
    }
  }

  if (role === "musician" && gigData?.gigId) {
    const gigRefFreshOm = db.doc(`gigs/${gigData.gigId}`);
    const gigFreshSnapOm = await gigRefFreshOm.get();
    if (!gigFreshSnapOm.exists) {
      return res.status(404).json({ error: "NOT_FOUND", message: "gig not found" });
    }
    const gigFreshOm = gigFreshSnapOm.data() || {};
    if (
      isListingClosedToNewApplicants(gigFreshOm) &&
      !musicianOccupiesBookedSlotOnListing(gigFreshOm, musicianProfileId)
    ) {
      return res.status(409).json({
        error: "GIG_SLOT_FILLED",
        message: "This set is fully booked.",
      });
    }
  }

  const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
  const isInApplicants = applicants.some(a => a?.id === musicianProfileId);
  
  // If artist is not in applicants array (e.g., invite via link), add them first
  let applicantsToProcess = applicants;
  if (!isInApplicants) {
    const now = Timestamp.fromDate(new Date());
    
    // Get artist profile to get the name
    const artistRef = db.doc(`artistProfiles/${musicianProfileId}`);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);
    const [artistSnap, musicianSnap] = await Promise.all([artistRef.get(), musicianRef.get()]);
    
    const artistName = artistSnap.exists ? (artistSnap.data()?.name || null) : (musicianSnap.exists ? (musicianSnap.data()?.name || null) : null);
    
    const newApplicant = {
      id: musicianProfileId,
      timestamp: now,
      fee: gigData.budget || "£0",
      status: "confirmed",
      invited: true,
      viewed: true,
      ...(inviteId ? { inviteId } : {})
    };
    applicantsToProcess = [...applicants, newApplicant];
    
    // Add to artist's gigApplications array
    const gigApplicationEntry = {
      gigId: gigData.gigId,
      profileId: musicianProfileId,
      ...(artistName ? { name: artistName } : {})
    };
    
    if (artistSnap.exists) {
      await artistRef.update({ gigApplications: FieldValue.arrayUnion(gigApplicationEntry) });
    } else if (musicianSnap.exists) {
      await musicianRef.update({ gigApplications: FieldValue.arrayUnion(gigApplicationEntry) });
    }
  }
  
  // Open Mic listings have always stayed open after each acceptance — they're
  // multi-artist by nature and the venue closes them manually when the night
  // is full. We only auto-close now when `maxApplicants` was explicitly set
  // by the venue (via the wizard), preserving today's "stays open" default
  // for existing OM gigs that don't carry the field.
  const rawMaxApplicantsOM = Number(gigData?.maxApplicants);
  const maxApplicantsOM = Number.isFinite(rawMaxApplicantsOM) && rawMaxApplicantsOM >= 1
    ? Math.max(1, Math.min(50, Math.floor(rawMaxApplicantsOM)))
    : null;
  const confirmedBeforeOM = applicantsToProcess.filter((a) => a?.status === "confirmed").length;
  const updatedApplicants = applicantsToProcess.map((a) => a.id === musicianProfileId ? { ...a, status: "confirmed" } : { ...a });
  const confirmedAfterOM = confirmedBeforeOM + 1;
  const omShouldClose = maxApplicantsOM != null && confirmedAfterOM >= maxApplicantsOM;
  const publishedApplicants = await mergePublishApplicants(gigData.gigId, updatedApplicants);
  const gigRef = db.doc(`gigs/${gigData.gigId}`);
  await gigRef.update({ paid: true, status: omShouldClose ? "closed" : "open" });
  const acceptedApplicant = applicantsToProcess.find((applicant) => applicant?.id === musicianProfileId);
  if (applicantIsGuest(acceptedApplicant)) {
    await emailGuest(gigData.gigId, acceptedApplicant, {
      subject: `You're booked to play ${gigData.gigName || "the gig"}`,
      text: `Your application to play at ${gigData.venue?.venueName || "the venue"} has been accepted. We'll only email you about this.`,
      remind: true,
    });
  } else {
    await declineArtistOnOtherSetsInGroup(gigData.gigId, musicianProfileId);
    const musicianRef = db.doc(`musicianProfiles/${musicianProfileId}`);
    const musicianSnap = await musicianRef.get();
    if (musicianSnap.exists) {
      await musicianRef.update({ confirmedGigs: FieldValue.arrayUnion(gigData.gigId) });
    } else {
      const artistRef = db.doc(`artistProfiles/${musicianProfileId}`);
      const artistSnap = await artistRef.get();
      if (artistSnap.exists) {
        await artistRef.update({ confirmedGigs: FieldValue.arrayUnion(gigData.gigId) });
      }
    }
  }
  return res.json({ data: { updatedApplicants: visibleApplicants(publishedApplicants, gigData.gigId, musicianProfileId, role === "venue") } });
}));

// POST /api/gigs/declineGigApplication
router.post("/declineGigApplication", requireAuth, asyncHandler(async (req, res) => {
  const { gigData, musicianProfileId, role = 'venue' } = req.body || {};
  const caller = req.auth.uid;
  if (!gigData || !musicianProfileId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData and musicianProfileId required" });

  // Guard: reject actions on past gigs
  if (gigData.gigId) {
    const freshSnap = await db.doc(`gigs/${gigData.gigId}`).get();
    if (freshSnap.exists) {
      const freshGig = freshSnap.data() || {};
      const startTs = toAdminTimestamp(freshGig.startDateTime);
      if (startTs && startTs.toDate() < new Date()) {
        return res.status(409).json({ error: "GIG_IN_PAST", message: "This gig has already passed and cannot be declined." });
      }
    }
  }

  if (role === 'venue') {
    const venueId = gigData?.venueId;
    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "venue" });
    const venue = venueSnap.data() || {};
    const isOwner = venue?.createdBy === caller || venue?.userId === caller;
    if (!isOwner) {
      const memberSnap = await venueRef.collection('members').doc(caller).get();
      const memberData = memberSnap.exists ? memberSnap.data() : null;
      const isActiveMember = !!memberData && memberData.status === 'active';
      const perms = (memberData && memberData.permissions) ? memberData.permissions : {};
      const hasManage = !!perms['gigs.applications.manage'];
      if (!(isActiveMember && hasManage)) return res.status(403).json({ error: "PERMISSION_DENIED", message: "gigs.applications.manage required" });
    }
  }

  if (role === 'musician') {
    // If this is an artistProfile, enforce gigs.book permission for the caller
    const artistRef = db.doc(`artistProfiles/${musicianProfileId}`);
    const artistSnap = await artistRef.get();
    if (artistSnap.exists) {
      await assertArtistPerm(db, caller, musicianProfileId, "gigs.book");
    }
  }

  const { applications } = await readNightApplications(gigData.gigId);
  const applicants = applications.length
    ? applications
    : (Array.isArray(gigData?.applicants) ? gigData.applicants : []);
  const declinedApplicant = applicants.find((applicant) => applicant?.id === musicianProfileId);
  const updatedApplicants = applicants.map((a) => a.id === musicianProfileId ? { ...a, status: "declined", assignedSlotGigId: null } : { ...a });
  const publishedApplicants = await publishNightApplicants(gigData.gigId, updatedApplicants);
  if (applicantIsGuest(declinedApplicant)) {
    await emailGuest(gigData.gigId, declinedApplicant, {
      subject: `Update on your application for ${gigData.gigName || "the gig"}`,
      text: `The venue won't be booking you for this gig. We'll only email you about this.`,
      remind: true,
    });
  }
  return res.json({
    data: { updatedApplicants: visibleApplicants(publishedApplicants.applicants, gigData.gigId, musicianProfileId, role === "venue") },
  });
}));

// POST /api/gigs/updateGigWithCounterOffer
router.post("/updateGigWithCounterOffer", requireAuth, asyncHandler(async (req, res) => {
  const { gigData, musicianProfileId, newFee, sender } = req.body || {};
  const caller = req.auth.uid;
  if (!gigData || !musicianProfileId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData and musicianProfileId required" });
  }

  if (sender === 'musician') {
    // If this is an artistProfile, enforce gigs.book permission for the caller
    const artistRef = db.doc(`artistProfiles/${musicianProfileId}`);
    const artistSnap = await artistRef.get();
    if (artistSnap.exists) {
      await assertArtistPerm(db, caller, musicianProfileId, "gigs.book");
    }
  }

  const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
  const now = new Date();
  const updatedApplicants = applicants.map((applicant) => (
    applicant.id === musicianProfileId
      ? { ...applicant, fee: newFee, timestamp: now, status: "pending", sentBy: sender }
      : { ...applicant }
  ));
  const published = await mergePublishApplicants(gigData.gigId, updatedApplicants);
  return res.json({
    data: { updatedApplicants: visibleApplicants(published, gigData.gigId, musicianProfileId, sender !== "musician") },
  });
}));

// POST /api/gigs/removeGigApplicant
router.post("/removeGigApplicant", requireAuth, asyncHandler(async (req, res) => {
  const { gigId, musicianId } = req.body || {};
  const gigRef = db.doc(`gigs/${gigId}`);
  const snap = await gigRef.get();
  if (!snap.exists) return res.json({ data: { applicants: [] } });
  const gig = snap.data() || {};
  const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
  
  // Check if the removed applicant was confirmed/accepted (would have payoutConfig)
  const removedApplicant = applicants.find((a) => a?.id === musicianId);
  const wasConfirmed = removedApplicant?.status === 'accepted' || removedApplicant?.status === 'confirmed';
  
  const updatedApplicants = applicants.filter((a) => a?.id !== musicianId);
  const updateData = { applicants: updatedApplicants };
  
  // Remove payoutConfig if the confirmed applicant was removed
  if (wasConfirmed && gig.payoutConfig) {
    updateData.payoutConfig = FieldValue.delete();
    updateData.agreedFee = FieldValue.delete();
  }
  
  await gigRef.update(updateData);
  return res.json({ data: { updatedApplicants } });
}));

// POST /api/gigs/revertGigAfterCancellation
router.post("/revertGigAfterCancellation", requireAuth, asyncHandler(async (req, res) => {
  const { gigData, musicianId, cancellationReason } = req.body || {};
  const caller = req.auth.uid;

  if (!gigData || !gigData.gigId || !musicianId) {
    return res.status(400).json({
      error: "INVALID_ARGUMENT",
      message: "gigData.gigId and musicianId are required",
    });
  }

  // Enforce that the caller is allowed to act on behalf of this applicant.
  // For artistProfiles, require gigs.book permission.
  const userSnap = await db.doc(`users/${caller}`).get();
  const user = userSnap.data() || {};
  const artistIdsField = Array.isArray(user.artistProfiles) ? user.artistProfiles : [];
  const callerArtistIds = artistIdsField.map((id) => id).filter(Boolean);

  if (callerArtistIds.includes(musicianId)) {
    const artistRef = db.doc(`artistProfiles/${musicianId}`);
    const artistSnap = await artistRef.get();
    if (artistSnap.exists) {
      await assertArtistPerm(db, caller, musicianId, "gigs.book");
    }
  }

  const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
  const remaining = applicants.filter((a) => a?.id !== musicianId);
  const reopenedApplicants = remaining.map((a) => ({ ...a, status: "pending" }));
  const gigRef = db.doc(`gigs/${gigData.gigId}`);
  
  // Get payoutConfig before deleting it (needed for pendingFunds update)
  const gigSnap = await gigRef.get();
  const currentGigData = gigSnap.exists ? gigSnap.data() : {};
  const payoutConfig = currentGigData.payoutConfig || gigData.payoutConfig || null;
  
  await gigRef.update({
    applicants: reopenedApplicants,
    agreedFee: FieldValue.delete(),
    payoutConfig: FieldValue.delete(), // Remove payout config when gig is cancelled
    disputeClearingTime: FieldValue.delete(),
    disputeLogged: FieldValue.delete(),
    musicianFeeStatus: FieldValue.delete(),
    paymentStatus: FieldValue.delete(),
    clearPendingFeeTaskName: FieldValue.delete(),
    automaticMessageTaskName: FieldValue.delete(),
    paid: false,
    status: "open",
    cancellationReason: cancellationReason || null,
  });

  // Mark pending fees as cancelled for this gig
  // Check both artistProfiles and musicianProfiles (legacy)
  const artistRef = db.doc(`artistProfiles/${musicianId}`);
  const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
  const [artistSnap, musicianSnap] = await Promise.all([artistRef.get(), musicianRef.get()]);
  
  if (artistSnap.exists) {
    // New model: update pending fees in artistProfiles
    const pendingFeesRef = artistRef.collection("pendingFees");
    const pendingFeesSnap = await pendingFeesRef.where("gigId", "==", gigData.gigId).get();
    
    if (!pendingFeesSnap.empty) {
      const batch = db.batch();
      pendingFeesSnap.forEach((feeDoc) => {
        const feeData = feeDoc.data();
        // Only mark as cancelled if still pending (not already cleared or in dispute)
        if (feeData.status === "pending") {
          batch.update(feeDoc.ref, {
            status: "cancelled",
            cancelledAt: FieldValue.serverTimestamp(),
            cancellationReason: cancellationReason || null,
          });
          
          // Decrement pendingFunds from user documents
          if (payoutConfig && payoutConfig.shares) {
            const totalFee = payoutConfig.totalFee || feeData.amount || 0;
            for (const share of payoutConfig.shares) {
              const shareUserId = share.userId;
              const sharePercent = share.percent || 0;
              const shareAmount = Math.round((totalFee * sharePercent / 100) * 100) / 100;
              
              if (shareAmount > 0 && shareUserId) {
                const userRef = db.doc(`users/${shareUserId}`);
                batch.update(userRef, {
                  pendingFunds: FieldValue.increment(-shareAmount),
                });
              }
            }
          } else {
            // Legacy: single user - try to get userId from fee data or profile
            const feeAmount = feeData.amount || 0;
            if (feeAmount > 0) {
              // Try to get userId from the artist profile
              const artistData = artistSnap.data() || {};
              const userId = artistData.userId || artistData.createdBy;
              if (userId) {
                const userRef = db.doc(`users/${userId}`);
                batch.update(userRef, {
                  pendingFunds: FieldValue.increment(-feeAmount),
                });
              }
            }
          }
        }
      });
      await batch.commit();
    }
  } else if (musicianSnap.exists) {
    // Legacy model: update pending fees in musicianProfiles
    const pendingFeesRef = musicianRef.collection("pendingFees");
    const pendingFeesSnap = await pendingFeesRef.where("gigId", "==", gigData.gigId).get();
    
    if (!pendingFeesSnap.empty) {
      const batch = db.batch();
      pendingFeesSnap.forEach((feeDoc) => {
        const feeData = feeDoc.data();
        if (feeData.status === "pending") {
          batch.update(feeDoc.ref, {
            status: "cancelled",
            cancelledAt: FieldValue.serverTimestamp(),
            cancellationReason: cancellationReason || null,
          });
          
          // Decrement pendingFunds for legacy model
          const feeAmount = feeData.amount || 0;
          if (feeAmount > 0) {
            const musicianData = musicianSnap.data() || {};
            const userId = musicianData.userId;
            if (userId) {
              const userRef = db.doc(`users/${userId}`);
              batch.update(userRef, {
                pendingFunds: FieldValue.increment(-feeAmount),
              });
            }
          }
        }
      });
      await batch.commit();
    }
  }

  // Conversations updates
  const venueId = gigData?.venueId;
  const otherApplicantIds = new Set(reopenedApplicants.map((a) => a.id));
  const convSnap = await db.collection("conversations").where("gigId", "==", gigData.gigId).get();
  const pendingTypes = ["application", "invitation", "negotiation"];
  const reopenText = "This gig has reopened. Applications are open again.";
  const now = new Date();
  for (const convDoc of convSnap.docs) {
    const convData = convDoc.data() || {};
    const participants = Array.isArray(convData.participants) ? convData.participants : [];
    const matchedApplicantId = [...otherApplicantIds].find((id) => participants.includes(id));
    const isVenueAndApplicant = participants.includes(venueId) && matchedApplicantId;
    if (!isVenueAndApplicant) continue;
    const messagesRef = convDoc.ref.collection("messages");
    const closedSnap = await messagesRef.where("status", "==", "apps-closed").where("type", "in", pendingTypes).get();
    const batch = db.batch();
    closedSnap.forEach((msgDoc) => batch.update(msgDoc.ref, { status: "pending" }));
    const announcementRef = messagesRef.doc();
    batch.set(announcementRef, { senderId: "system", text: reopenText, timestamp: now, type: "announcement", status: "reopened" });
    batch.update(convDoc.ref, { lastMessage: reopenText, lastMessageTimestamp: now, lastMessageSenderId: "system", status: "open" });
    await batch.commit();
  }
  return res.json({ data: { applicants: reopenedApplicants } });
}));

// POST /api/gigs/revertGigAfterCancellationVenue
router.post("/revertGigAfterCancellationVenue", requireAuth, asyncHandler(async (req, res) => {
  const { gigData, musicianId, cancellationReason } = req.body || {};
  const caller = req.auth.uid;

  if (!gigData || !gigData.gigId) {
    return res.status(400).json({
      error: "INVALID_ARGUMENT",
      message: "gigData.gigId is required",
    });
  }

  const venueId = gigData?.venueId;
  if (!venueId) {
    return res.status(400).json({
      error: "FAILED_PRECONDITION",
      message: "gig missing venueId",
    });
  }

  // Venue-side cancellation: require gigs.applications.manage permission
  await assertVenuePerm(db, caller, venueId, "gigs.applications.manage");

  const gigRef = db.doc(`gigs/${gigData.gigId}`);

  // Get payoutConfig before deleting it (needed for pendingFunds update)
  const gigSnap = await gigRef.get();
  const currentGigData = gigSnap.exists ? gigSnap.data() : {};
  const payoutConfig = currentGigData.payoutConfig || gigData.payoutConfig || null;
  const rootId = currentGigData.applicationsRootGigId || gigData.gigId;
  const stored = await loadPrivateApplications(rootId);
  const applicants = stored?.applicants?.length
    ? stored.applicants
    : (Array.isArray(gigData?.applicants) ? gigData.applicants : []);
  const updatedApplicants = musicianId ? applicants.filter((a) => a?.id !== musicianId) : applicants;
  if (stored?.applicants) await publishNightApplicants(gigData.gigId, updatedApplicants);

  await gigRef.update({
    agreedFee: FieldValue.delete(),
    payoutConfig: FieldValue.delete(), // Remove payout config when gig is cancelled
    disputeClearingTime: FieldValue.delete(),
    disputeLogged: FieldValue.delete(),
    musicianFeeStatus: FieldValue.delete(),
    paymentStatus: FieldValue.delete(),
    clearPendingFeeTaskName: FieldValue.delete(),
    automaticMessageTaskName: FieldValue.delete(),
    paid: false,
    status: "cancelled",
    applicationsOpen: false,
    cancellationReason: cancellationReason || null,
  });
  const slotIds = Array.isArray(gigData?.gigSlots) ? gigData.gigSlots : [];
  await Promise.all(slotIds.filter((id) => id && id !== gigData.gigId).map((id) => db.doc(`gigs/${id}`).set({
    status: "cancelled",
    applicationsOpen: false,
  }, { merge: true })));

  // Mark pending fees as cancelled for all applicants of this gig
  // Get all accepted/confirmed applicants to update their pending fees
  const acceptedApplicants = applicants.filter((a) => 
    (a?.status === "accepted" || a?.status === "confirmed") && a?.id
  );
  
  for (const applicant of acceptedApplicants) {
    if (applicantIsGuest(applicant)) continue;
    const applicantId = applicant.id;
    const artistRef = db.doc(`artistProfiles/${applicantId}`);
    const musicianRef = db.doc(`musicianProfiles/${applicantId}`);
    const [artistSnap, musicianSnap] = await Promise.all([artistRef.get(), musicianRef.get()]);
    
    if (artistSnap.exists) {
      // New model: update pending fees in artistProfiles
      const pendingFeesRef = artistRef.collection("pendingFees");
      const pendingFeesSnap = await pendingFeesRef.where("gigId", "==", gigData.gigId).get();
      
      if (!pendingFeesSnap.empty) {
        const batch = db.batch();
        pendingFeesSnap.forEach((feeDoc) => {
          const feeData = feeDoc.data();
          if (feeData.status === "pending") {
            batch.update(feeDoc.ref, {
              status: "cancelled",
              cancelledAt: FieldValue.serverTimestamp(),
              cancellationReason: cancellationReason || null,
            });
            
            // Decrement pendingFunds from user documents
            if (payoutConfig && payoutConfig.shares) {
              const totalFee = payoutConfig.totalFee || feeData.amount || 0;
              for (const share of payoutConfig.shares) {
                const shareUserId = share.userId;
                const sharePercent = share.percent || 0;
                const shareAmount = Math.round((totalFee * sharePercent / 100) * 100) / 100;
                
                if (shareAmount > 0 && shareUserId) {
                  const userRef = db.doc(`users/${shareUserId}`);
                  batch.update(userRef, {
                    pendingFunds: FieldValue.increment(-shareAmount),
                  });
                }
              }
            } else {
              // Legacy: single user - try to get userId from profile
              const feeAmount = feeData.amount || 0;
              if (feeAmount > 0) {
                const artistData = artistSnap.data() || {};
                const userId = artistData.userId || artistData.createdBy;
                if (userId) {
                  const userRef = db.doc(`users/${userId}`);
                  batch.update(userRef, {
                    pendingFunds: FieldValue.increment(-feeAmount),
                  });
                }
              }
            }
          }
        });
        await batch.commit();
      }
    } else if (musicianSnap.exists) {
      // Legacy model: update pending fees in musicianProfiles
      const pendingFeesRef = musicianRef.collection("pendingFees");
      const pendingFeesSnap = await pendingFeesRef.where("gigId", "==", gigData.gigId).get();
      
      if (!pendingFeesSnap.empty) {
        const batch = db.batch();
        pendingFeesSnap.forEach((feeDoc) => {
          const feeData = feeDoc.data();
          if (feeData.status === "pending") {
            batch.update(feeDoc.ref, {
              status: "cancelled",
              cancelledAt: FieldValue.serverTimestamp(),
              cancellationReason: cancellationReason || null,
            });
            
            // Decrement pendingFunds for legacy model
            const feeAmount = feeData.amount || 0;
            if (feeAmount > 0) {
              const musicianData = musicianSnap.data() || {};
              const userId = musicianData.userId;
              if (userId) {
                const userRef = db.doc(`users/${userId}`);
                batch.update(userRef, {
                  pendingFunds: FieldValue.increment(-feeAmount),
                });
              }
            }
          }
        });
        await batch.commit();
      }
    }
  }

  return res.json({ data: { updatedApplicants } });
}));

// POST /api/gigs/deleteGigAndInformation
router.post("/deleteGigAndInformation", requireAuth, asyncHandler(async (req, res) => {
  const { gigId } = req.body || {};
  if (!gigId || typeof gigId !== "string") return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId required" });
  const gigRef = db.doc(`gigs/${gigId}`);
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) return res.json({ data: { success: true } });
  const gigData = gigSnap.data() || {};
  const venueId = gigData.venueId;
  const applicants = Array.isArray(gigData.applicants) ? gigData.applicants : [];
  const ts = new Date();
  const batch = db.batch();
  batch.delete(gigRef);
  if (venueId) {
    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const venueSnap = await venueRef.get();
    if (venueSnap.exists) {
      const venueData = venueSnap.data() || {};
      const list = Array.isArray(venueData.gigs) ? venueData.gigs : [];
      const updatedGigs = (list.length && typeof list[0] === "object" && list[0] !== null && "gigId" in list[0])
        ? list.filter((g) => g?.gigId !== gigId)
        : list.filter((id) => id !== gigId);
      batch.update(venueRef, { gigs: updatedGigs });
    }
  }
  for (const applicant of applicants) {
    if (applicantIsGuest(applicant)) continue;
    const musicianId = applicant?.id; if (!musicianId) continue;
    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
    const musicianSnap = await musicianRef.get();
    if (musicianSnap.exists) {
      const musicianData = musicianSnap.data() || {};
      const apps = Array.isArray(musicianData.gigApplications) ? musicianData.gigApplications : [];
      const updatedApplications = apps.filter((a) => a?.gigId !== gigId);
      batch.update(musicianRef, { gigApplications: updatedApplications });
    }
  }
  // Delete all associated gig invite documents
  const invitesSnap = await db.collection("gigInvites")
    .where("gigId", "==", gigId)
    .get();
  invitesSnap.forEach((inviteDoc) => {
    batch.delete(inviteDoc.ref);
  });

  const pendingTypes = ["application", "invitation", "negotiation"];
  const cancellationText = "This gig has been deleted by the venue.";
  for (const applicant of applicants) {
    const applicantId = applicant?.id; if (!applicantId) continue;
    const convsSnap = await db.collection("conversations")
      .where("gigId", "==", gigId)
      .where("participants", "array-contains", applicantId)
      .get();
    for (const convDoc of convsSnap.docs) {
      const convData = convDoc.data() || {};
      const participants = Array.isArray(convData.participants) ? convData.participants : [];
      if (!participants.includes(venueId)) continue;
      const messagesRef = convDoc.ref.collection("messages");
      const typeSnap = await messagesRef.where("type", "in", pendingTypes).get();
      typeSnap.forEach((msgDoc) => { batch.update(msgDoc.ref, { status: "apps-closed" }); });
      const newMsgRef = messagesRef.doc();
      batch.set(newMsgRef, { senderId: "system", text: cancellationText, timestamp: ts, type: "announcement", status: "gig deleted" });
      batch.update(convDoc.ref, { lastMessage: cancellationText, lastMessageTimestamp: ts, lastMessageSenderId: "system", status: "closed" });
    }
  }
  await batch.commit();
  return res.json({ data: { success: true } });
}));

// POST /api/gigs/logGigCancellation
router.post("/logGigCancellation", requireAuth, asyncHandler(async (req, res) => {
  const { gigId, musicianId = null, venueId = null, reason = "", cancellingParty = "musician" } = req.body || {};
  const doc = { gigId, musicianId, venueId, reason, cancellingParty, createdAt: new Date(), createdBy: req.auth.uid };
  const ref = await db.collection("cancellations").add(doc);
  return res.json({ data: { id: ref.id } });
}));

// POST /api/gigs/markApplicantsViewed
router.post("/markApplicantsViewed", requireAuth, asyncHandler(async (req, res) => {
  const { venueId, gigId, applicantIds } = req.body || {};
  if (!venueId || !gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId and gigId required" });
  const gigRef = db.collection("gigs").doc(gigId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(gigRef);
    if (!snap.exists) throw new Error("NOT_FOUND: gig");
    const data = snap.data() || {};
    if (data.venueId !== venueId) throw new Error("VENUE_MISMATCH");
    const rootId = data.applicationsRootGigId || gigId;
    const storedSnap = await tx.get(db.doc(`gigs/${rootId}/private/applications`));
    const stored = storedSnap.exists ? (storedSnap.data()?.applicants || []) : [];
    const applicants = stored.length ? stored : (Array.isArray(data.applicants) ? data.applicants : []);
    const targetSet = Array.isArray(applicantIds) && applicantIds.length
      ? new Set(applicantIds)
      : new Set(applicants.map((a) => a?.id).filter(Boolean));
    const nextApplicants = applicants.map((a) => (a && targetSet.has(a.id)) ? { ...a, viewed: true } : a);
    tx.set(db.doc(`gigs/${rootId}/private/applications`), {
      gigId: rootId,
      applicants: sanitiseApplicants(nextApplicants),
    }, { merge: true });
    const onlySlot = !Array.isArray(data.gigSlots) || data.gigSlots.length < 2;
    tx.update(gigRef, { applicants: publicLineup(nextApplicants, gigId, { onlySlot }), updatedAt: FieldValue.serverTimestamp() });
  });
  return res.json({ data: { ok: true } });
}));

// GET /api/gigs/invites
router.get("/invites", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { gigId } = req.query || {};
  if (!gigId || typeof gigId !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId required" });
  }

  const gigRef = db.doc(`gigs/${gigId}`);
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "gig not found" });
  }
  const gig = gigSnap.data() || {};
  const venueId = gig.venueId;
  if (!venueId) {
    return res.status(400).json({ error: "FAILED_PRECONDITION", message: "gig missing venueId" });
  }

  // Permission: venue owner or active member with gigs.invite
  await assertVenuePerm(db, caller, venueId, "gigs.invite");

  const inviteIds = Array.isArray(gig.inviteIds) ? gig.inviteIds : [];
  if (inviteIds.length === 0) {
    return res.json({ data: [] });
  }

  const inviteSnaps = await Promise.all(
    inviteIds.map(id => db.doc(`gigInvites/${id}`).get())
  );
  const invites = inviteSnaps
    .filter(snap => snap.exists)
    .map(snap => ({
      inviteId: snap.id,
      ...snap.data()
    }));

  return res.json({ data: invites });
}));

// POST /api/gigs/invites
router.post("/invites", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { gigId, expiresAt, artistId, crmEntryId, artistName, email } = req.body || {};
  if (!gigId || typeof gigId !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigId required" });
  }

  const gigRef = db.doc(`gigs/${gigId}`);
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "gig not found" });
  }
  const gig = gigSnap.data() || {};
  const venueId = gig.venueId;
  if (!venueId) {
    return res.status(400).json({ error: "FAILED_PRECONDITION", message: "gig missing venueId" });
  }

  // Permission: venue owner or active member with gigs.invite
  await assertVenuePerm(db, caller, venueId, "gigs.invite");

  let storedEmail = "";
  if (crmEntryId) {
    if (typeof crmEntryId !== "string") {
      return res.status(400).json({ error: "INVALID_ARGUMENT", message: "crmEntryId invalid" });
    }
    const crmSnap = await db.doc(`users/${caller}/artistCRM/${crmEntryId}`).get();
    if (!crmSnap.exists) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
    }
    storedEmail = String(crmSnap.data()?.email || "").trim().toLowerCase();
  } else if (email) {
    storedEmail = String(email).trim().toLowerCase();
  }
  if (storedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storedEmail)) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "email format invalid" });
  }

  const inviteId = uuidv4();
  const now = Timestamp.fromDate(new Date());
  const expiresAtTs = expiresAt ? Timestamp.fromDate(new Date(expiresAt)) : null;

  const inviteData = {
    gigId,
    venueId,
    createdAt: now,
    expiresAt: expiresAtTs,
    createdBy: caller,
    active: true,
    applicationCount: 0,
    ...(artistId ? { artistId } : {}),
    ...(crmEntryId ? { crmEntryId } : {}),
    ...(artistName ? { artistName } : {}),
    ...(storedEmail ? { email: storedEmail } : {}),
  };

  await db.runTransaction(async (tx) => {
    // All reads must happen before all writes
    const freshGigSnap = await tx.get(gigRef);
    const freshGig = freshGigSnap.exists ? (freshGigSnap.data() || {}) : {};
    const currentInviteIds = Array.isArray(freshGig.inviteIds) ? freshGig.inviteIds : [];
    const nextInviteIds = currentInviteIds.includes(inviteId) 
      ? currentInviteIds 
      : [...currentInviteIds, inviteId];
    
    // If artistId is provided, update/add the applicant with inviteId and expiresAt
    let gigUpdates = { inviteIds: nextInviteIds };
    if (artistId) {
      const currentApplicants = Array.isArray(freshGig.applicants) ? freshGig.applicants : [];
      const applicantIndex = currentApplicants.findIndex(a => a?.id === artistId);
      
      if (applicantIndex >= 0) {
        // Update existing applicant
        const updatedApplicants = [...currentApplicants];
        updatedApplicants[applicantIndex] = {
          ...updatedApplicants[applicantIndex],
          invited: true,
          inviteId: inviteId,
          inviteExpiresAt: expiresAtTs
        };
        gigUpdates.applicants = updatedApplicants;
      } else {
        // Add new applicant with invite info
        const now = Timestamp.fromDate(new Date());
        const newApplicant = {
          id: artistId,
          timestamp: now,
          fee: freshGig.budget || "£0",
          status: "pending",
          invited: true,
          viewed: false,
          inviteId: inviteId,
          inviteExpiresAt: expiresAtTs
        };
        gigUpdates.applicants = [...currentApplicants, newApplicant];
      }
    }
    
    // Now do all writes
    const inviteRef = db.doc(`gigInvites/${inviteId}`);
    tx.set(inviteRef, inviteData);
    tx.update(gigRef, gigUpdates);
  });

  return res.json({ data: { inviteId, ...inviteData } });
}));

// PUT /api/gigs/invites/:inviteId
router.put("/invites/:inviteId", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { inviteId } = req.params || {};
  const { active, expiresAt } = req.body || {};
  if (!inviteId || typeof inviteId !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "inviteId required" });
  }

  const inviteRef = db.doc(`gigInvites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "invite not found" });
  }
  const invite = inviteSnap.data() || {};
  const venueId = invite.venueId;
  if (!venueId) {
    return res.status(400).json({ error: "FAILED_PRECONDITION", message: "invite missing venueId" });
  }

  // Permission: venue owner or active member with gigs.invite
  await assertVenuePerm(db, caller, venueId, "gigs.invite");

  const updates = {};
  let expiresAtTs = null;
  if (typeof active === "boolean") {
    updates.active = active;
  }
  if (expiresAt !== undefined) {
    expiresAtTs = expiresAt ? Timestamp.fromDate(new Date(expiresAt)) : null;
    updates.expiresAt = expiresAtTs;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "No valid updates provided" });
  }

  // If invite has an artistId, sync the expiresAt in the applicant object
  const artistId = invite.artistId;
  if (artistId && expiresAt !== undefined) {
    const gigRef = db.doc(`gigs/${invite.gigId}`);
    await db.runTransaction(async (tx) => {
      const gigSnap = await tx.get(gigRef);
      if (gigSnap.exists) {
        const gig = gigSnap.data() || {};
        const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
        const applicantIndex = applicants.findIndex(a => a?.id === artistId && a?.inviteId === inviteId);
        
        if (applicantIndex >= 0) {
          const updatedApplicants = [...applicants];
          updatedApplicants[applicantIndex] = {
            ...updatedApplicants[applicantIndex],
            inviteExpiresAt: expiresAtTs
          };
          tx.update(gigRef, { applicants: updatedApplicants });
        }
      }
    });
  }

  await inviteRef.update(updates);
  const updatedSnap = await inviteRef.get();
  return res.json({ data: { inviteId, ...updatedSnap.data() } });
}));

// DELETE /api/gigs/invites/:inviteId
router.delete("/invites/:inviteId", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { inviteId } = req.params || {};
  if (!inviteId || typeof inviteId !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "inviteId required" });
  }

  const inviteRef = db.doc(`gigInvites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "invite not found" });
  }
  const invite = inviteSnap.data() || {};
  const venueId = invite.venueId;
  if (!venueId) {
    return res.status(400).json({ error: "FAILED_PRECONDITION", message: "invite missing venueId" });
  }

  // Permission: venue owner or active member with gigs.invite
  await assertVenuePerm(db, caller, venueId, "gigs.invite");

  const gigId = invite.gigId;
  if (!gigId) {
    return res.status(400).json({ error: "FAILED_PRECONDITION", message: "invite missing gigId" });
  }

  await db.runTransaction(async (tx) => {
    tx.delete(inviteRef);
    const gigRef = db.doc(`gigs/${gigId}`);
    const freshGigSnap = await tx.get(gigRef);
    const freshGig = freshGigSnap.exists ? (freshGigSnap.data() || {}) : {};
    const currentInviteIds = Array.isArray(freshGig.inviteIds) ? freshGig.inviteIds : [];
    const nextInviteIds = currentInviteIds.filter(id => id !== inviteId);
    tx.update(gigRef, { inviteIds: nextInviteIds });
  });

  return res.json({ data: { success: true } });
}));

async function assertGigUpdate(req, gigId) {
  const snap = await db.doc(`gigs/${gigId}`).get();
  if (!snap.exists) {
    const error = new Error("Gig not found.");
    error.statusCode = 404;
    throw error;
  }
  const gig = snap.data() || {};
  await assertVenuePerm(db, req.auth.uid, gig.venueId, "gigs.update");
  return gig;
}

router.post("/:rootGigId/applications/:id/accept", requireAuth, asyncHandler(async (req, res) => {
  await assertGigUpdate(req, req.params.rootGigId);
  res.json(await acceptApplication({
    gigId: req.params.rootGigId,
    applicantId: req.params.id,
    slotGigId: req.body?.slotGigId || null,
  }));
}));

router.post("/:rootGigId/applications/:id/assign", requireAuth, asyncHandler(async (req, res) => {
  await assertGigUpdate(req, req.params.rootGigId);
  res.json(await assignApplication({
    gigId: req.params.rootGigId,
    applicantId: req.params.id,
    slotGigId: req.body?.slotGigId || null,
  }));
}));

router.post("/:rootGigId/applications/:id/decline", requireAuth, asyncHandler(async (req, res) => {
  await assertGigUpdate(req, req.params.rootGigId);
  res.json(await declineApplication({ gigId: req.params.rootGigId, applicantId: req.params.id }));
}));

router.post("/:rootGigId/applications/:id/undo", requireAuth, asyncHandler(async (req, res) => {
  await assertGigUpdate(req, req.params.rootGigId);
  res.json(await undoApplication({ gigId: req.params.rootGigId, applicantId: req.params.id }));
}));

router.post("/:rootGigId/close", requireAuth, asyncHandler(async (req, res) => {
  await assertGigUpdate(req, req.params.rootGigId);
  res.json(await closeApplications({
    gigId: req.params.rootGigId,
    declineWaiting: req.body?.declineWaiting !== false,
  }));
}));

router.post("/:rootGigId/close/undo", requireAuth, asyncHandler(async (req, res) => {
  await assertGigUpdate(req, req.params.rootGigId);
  res.json(await undoClose({ gigId: req.params.rootGigId }));
}));

router.post("/:rootGigId/reopen", requireAuth, asyncHandler(async (req, res) => {
  await assertGigUpdate(req, req.params.rootGigId);
  res.json(await reopenApplications({ gigId: req.params.rootGigId }));
}));

router.post("/:rootGigId/sound-tech", requireAuth, asyncHandler(async (req, res) => {
  await assertGigUpdate(req, req.params.rootGigId);
  res.json(await saveSoundTech({ gigId: req.params.rootGigId, soundTech: req.body?.soundTech }));
}));

export default router;