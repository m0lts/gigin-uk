/* eslint-disable */
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db, admin, FieldValue, Timestamp, GeoPoint } from "../config/admin.js";
import { assertVenuePerm, assertArtistPerm } from "../utils/permissions.js";

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
    case "musician.withdraw.application": {
      // Validate caller is one of the applicants' linked user
      const userSnap = await db.doc(`users/${caller}`).get();
      const user = userSnap.data() || {};
      const callerMusicianIds = Array.isArray(user.musicianProfile)
        ? user.musicianProfile
        : (user.musicianProfile ? [user.musicianProfile] : []);
      const applicants = Array.isArray(gig?.applicants) ? gig.applicants : [];
      const callerIsApplicant = applicants.some(a => callerMusicianIds.includes(a?.id));
      if (!callerIsApplicant) return res.status(403).json({ error: "PERMISSION_DENIED", message: "caller is not an applicant on this gig" });
      break;
    }
    case "artist.withdraw.application": {
      // Validate caller is one of the applicants' linked artist profiles
      const userSnap = await db.doc(`users/${caller}`).get();
      const user = userSnap.data() || {};

      const artistIdsField = Array.isArray(user.artistProfiles) ? user.artistProfiles : [];
      const callerArtistIds = artistIdsField.map((id) => id).filter(Boolean);

      const applicants = Array.isArray(gig?.applicants) ? gig.applicants : [];
      const applicantIdsOnGig = new Set(
        applicants.map((a) => a?.id).filter(Boolean)
      );
      const callerArtistIdsOnGig = callerArtistIds.filter((id) =>
        applicantIdsOnGig.has(id)
      );
      const callerIsApplicant = callerArtistIdsOnGig.length > 0;
      if (!callerIsApplicant) {
        return res.status(403).json({
          error: "PERMISSION_DENIED",
          message: "caller is not an applicant on this gig",
        });
      }

      // Enforce gigs.book permission for the matching artist profile
      const artistIdForGig = callerArtistIdsOnGig[0];
      const artistRef = db.doc(`artistProfiles/${artistIdForGig}`);
      const artistSnap = await artistRef.get();
      if (artistSnap.exists) {
        await assertArtistPerm(db, caller, artistIdForGig, "gigs.book");
      }
      break;
    }
    default:
      return res.status(400).json({ error: "INVALID_ARGUMENT", message: `unsupported action "${action}"` });
  }

  // Normalize any geopoint in updates (handles serialized objects from client)
  const normalizedUpdates = { ...updates };
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
  
  await gigRef.update(normalizedUpdates);
  return res.json({ data: { success: true } });
}));

// POST /api/gigs/applyToGig
router.post("/applyToGig", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { gigId, musicianProfile } = req.body || {};
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
  const now = new Date();
  const newApplication = {
    id: musicianProfile?.musicianId,
    timestamp: now,
    fee: gig.budget || "£0",
    status: "pending",
    type: artistSnap.exists ? "artist" : (musicianProfile?.bandProfile ? "band" : "musician"),
  };
  const updatedApplicants = [...(Array.isArray(gig.applicants) ? gig.applicants : []), newApplication];
  await gigRef.update({ applicants: updatedApplicants });
  return res.json({ data: { updatedApplicants: updatedApplicants } });
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

  const now = new Date();
  const applicant = { id: musicianId, timestamp: now, fee: gig.budget || "£0", status: "pending", invited: true };
  const currentApplicants = Array.isArray(gig.applicants) ? gig.applicants : [];
  const alreadyIncluded = currentApplicants.some(a => a?.id === musicianId);
  const updatedApplicants = alreadyIncluded ? currentApplicants : currentApplicants.concat(applicant);

  await db.runTransaction(async (tx) => {
    const freshGigSnap = await tx.get(gigRef);
    const freshGig = freshGigSnap.exists ? (freshGigSnap.data() || {}) : {};
    const freshApplicants = Array.isArray(freshGig.applicants) ? freshGig.applicants : [];
    const dup = freshApplicants.some(a => a?.id === musicianId);
    const nextApplicants = dup ? freshApplicants : freshApplicants.concat(applicant);

    // Support both legacy musicianProfiles and new artistProfiles collections
    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
    const artistRef = db.doc(`artistProfiles/${musicianId}`);
    const [musicianSnap, artistSnap] = await Promise.all([tx.get(musicianRef), tx.get(artistRef)]);

    tx.update(gigRef, { applicants: nextApplicants });

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
  const now = new Date();
  const newApplication = {
    id: musicianProfile?.musicianId,
    timestamp: now,
    fee: newFee ?? "£0",
    status: "pending",
    sentBy: sender,
  };
  const updatedApplicants = [ ...(Array.isArray(gig.applicants) ? gig.applicants : []), newApplication ];
  await gigRef.update({ applicants: updatedApplicants });
  return res.json({ data: { updatedApplicants } });
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
  const { gigData, musicianProfileId, nonPayableGig = false, role } = req.body || {};
  const caller = req.auth.uid;
  if (!gigData || !musicianProfileId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData and musicianProfileId required" });

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

  const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
  let agreedFee = null;
  const updatedApplicants = applicants.map((applicant) => {
    if (applicant.id === musicianProfileId) {
      agreedFee = applicant.fee;
      return { ...applicant, status: nonPayableGig ? "confirmed" : "accepted" };
    }
    return nonPayableGig ? { ...applicant } : { ...applicant, status: "declined" };
  });

  // Compute payout config for payable gigs with artistProfiles
  let payoutConfig = null;
  if (!nonPayableGig && agreedFee != null) {
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
  const gigUpdate = {
    applicants: updatedApplicants,
    agreedFee: `${agreedFee}`,
    paid: !!nonPayableGig,
    status: nonPayableGig || gigData?.kind === "Ticketed Gig" ? "closed" : "open",
  };
  
  // Add payoutConfig if computed
  if (payoutConfig) {
    gigUpdate.payoutConfig = payoutConfig;
  }
  
  await gigRef.update(gigUpdate);

  if (nonPayableGig) {
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

  return res.json({ data: { updatedApplicants, agreedFee } });
}));

// POST /api/gigs/acceptGigOfferOM
router.post("/acceptGigOfferOM", requireAuth, asyncHandler(async (req, res) => {
  const { gigData, musicianProfileId, role } = req.body || {};
  const caller = req.auth.uid;
  if (!gigData || !musicianProfileId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData and musicianProfileId required" });

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

  const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
  const updatedApplicants = applicants.map((a) => a.id === musicianProfileId ? { ...a, status: "confirmed" } : { ...a });
  const gigRef = db.doc(`gigs/${gigData.gigId}`);
  await gigRef.update({ applicants: updatedApplicants, paid: true, status: "open" });
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
  return res.json({ data: { updatedApplicants } });
}));

// POST /api/gigs/declineGigApplication
router.post("/declineGigApplication", requireAuth, asyncHandler(async (req, res) => {
  const { gigData, musicianProfileId, role = 'venue' } = req.body || {};
  const caller = req.auth.uid;
  if (!gigData || !musicianProfileId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData and musicianProfileId required" });

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

  const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
  const updatedApplicants = applicants.map((a) => a.id === musicianProfileId ? { ...a, status: "declined" } : { ...a });
  const gigRef = db.doc(`gigs/${gigData.gigId}`);
  await gigRef.update({ applicants: updatedApplicants });
  return res.json({ data: { updatedApplicants } });
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
  const gigRef = db.doc(`gigs/${gigData.gigId}`);
  await gigRef.update({ applicants: updatedApplicants });
  return res.json({ data: { updatedApplicants } });
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

  const applicants = Array.isArray(gigData?.applicants) ? gigData.applicants : [];
  const updatedApplicants = applicants.filter((a) => a?.id !== musicianId);
  const gigRef = db.doc(`gigs/${gigData.gigId}`);
  
  // Get payoutConfig before deleting it (needed for pendingFunds update)
  const gigSnap = await gigRef.get();
  const currentGigData = gigSnap.exists ? gigSnap.data() : {};
  const payoutConfig = currentGigData.payoutConfig || gigData.payoutConfig || null;
  
  await gigRef.update({
    applicants: updatedApplicants,
    agreedFee: FieldValue.delete(),
    payoutConfig: FieldValue.delete(), // Remove payout config when gig is cancelled
    disputeClearingTime: FieldValue.delete(),
    disputeLogged: FieldValue.delete(),
    musicianFeeStatus: FieldValue.delete(),
    paymentStatus: FieldValue.delete(),
    clearPendingFeeTaskName: FieldValue.delete(),
    automaticMessageTaskName: FieldValue.delete(),
    paid: false,
    status: "closed",
    cancellationReason: cancellationReason || null,
  });

  // Mark pending fees as cancelled for all applicants of this gig
  // Get all accepted/confirmed applicants to update their pending fees
  const acceptedApplicants = applicants.filter((a) => 
    (a?.status === "accepted" || a?.status === "confirmed") && a?.id
  );
  
  for (const applicant of acceptedApplicants) {
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
    const applicants = Array.isArray(data.applicants) ? data.applicants : [];
    const targetSet = Array.isArray(applicantIds) && applicantIds.length
      ? new Set(applicantIds)
      : new Set(applicants.map((a) => a?.id).filter(Boolean));
    const nextApplicants = applicants.map((a) => (a && targetSet.has(a.id)) ? { ...a, viewed: true } : a);
    tx.update(gigRef, { applicants: nextApplicants, updatedAt: FieldValue.serverTimestamp() });
  });
  return res.json({ data: { ok: true } });
}));

export default router;