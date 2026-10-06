/* eslint-disable */
import express from "express";
import rateLimit from "express-rate-limit";
import { db } from "../config/admin.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { venueIsApproved } from "../lib/venueApprovalPolicy.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { assertVenuePerm } from "../utils/permissions.js";
import {
  createAreaRequest,
  createProfileRequest,
  createVenueClaim,
  finderVenues,
  readFinderSettings,
  readSession,
  saveFinderListing,
  venueContactPayload,
} from "../lib/keepProfile.js";

const router = express.Router();

const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait and try again." },
});

router.get("/venues", optionalAuth, asyncHandler(async (req, res) => {
  const payload = await finderVenues(req);
  return res.json(payload);
}));

router.get("/venues/:venueId", optionalAuth, asyncHandler(async (req, res) => {
  const listed = await db.doc(`listedVenues/${req.params.venueId}`).get();
  const session = await readSession(req);
  const signedIn = Boolean(req.auth?.uid || session?.profile);
  if (listed.exists && String(listed.data()?.name || "").trim()) {
    const data = listed.data() || {};
    const contact = await venueContactPayload({ ...data, id: listed.id, contactVisibility: "signed_in" }, { signedIn, invited: false, listed: true });
    return res.json({
      id: listed.id,
      kind: "listed",
      name: data.name,
      area: data.area || "",
      city: data.city || "",
      street: data.street || "",
      location: data.location || null,
      hasPA: data.hasPA,
      soundSummary: data.soundSummary || "",
      capacity: data.capacity,
      dealModel: data.dealModel || "",
      dealLabel: data.dealLabel || "",
      howTheyBook: data.howTheyBook || "",
      takesOriginals: data.takesOriginals,
      genres: data.genres || [],
      websiteUrl: data.websiteUrl || "",
      source: data.source || "public_info",
      checkedAt: data.checkedAt || null,
      heroPhoto: data.heroPhoto || "",
      contact,
    });
  }
  const venue = await db.doc(`venueProfiles/${req.params.venueId}`).get();
  if (!venue.exists) return res.status(404).json({ error: "This venue isn't listed." });
  const data = venue.data() || {};
  if (!venueIsApproved(data)) return res.status(404).json({ error: "This venue isn't listed." });
  const invitedIds = session?.profile ? ((await db.doc(`artistProfiles/${session.profile.id}/private/relationships`).get()).data()?.invitedVenueIds || []) : [];
  const contact = await venueContactPayload({
    id: venue.id,
    name: data.name,
    contactVisibility: data.contactVisibility || "signed_in",
    websiteEmail: "",
  }, { signedIn, invited: invitedIds.includes(venue.id), listed: false });
  const listing = data.finderListing || {};
  return res.json({
    id: venue.id,
    kind: "gigin",
    name: data.name || data.venueName || "",
    area: listing.area || data.address?.city || "",
    city: data.address?.city || "",
    street: listing.street || data.address?.line1 || "",
    location: data.location || null,
    hasPA: listing.hasPA ?? null,
    soundSummary: listing.soundSummary || "",
    capacity: listing.capacity ?? data.capacity ?? null,
    dealModel: listing.dealModel || "",
    dealLabel: listing.dealLabel || "",
    howTheyBook: listing.howTheyBook || "",
    takesOriginals: listing.takesOriginals ?? null,
    genres: listing.genres || [],
    websiteUrl: listing.websiteUrl || data.website || "",
    source: "venue",
    checkedAt: listing.updatedAt || null,
    heroPhoto: data.photoUrl || data.heroImage || "",
    contact,
    contactVisibility: data.contactVisibility || "signed_in",
  });
}));

router.post("/area-requests", writeLimiter, asyncHandler(async (req, res) => {
  try {
    return res.json(await createAreaRequest({ town: req.body?.town, email: req.body?.email }));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}));

router.post("/venues/:venueId/claim", writeLimiter, asyncHandler(async (req, res) => {
  try {
    return res.json(await createVenueClaim({
      listedVenueId: req.params.venueId,
      name: req.body?.name,
      role: req.body?.role,
      email: req.body?.email,
    }));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}));

router.post("/venues/:venueId/profile-requests", optionalAuth, writeLimiter, asyncHandler(async (req, res) => {
  const session = await readSession(req);
  const profileId = req.body?.profileId || session?.profile?.id;
  if (!profileId) return res.status(401).json({ error: "Confirm your profile first." });
  const listed = (await db.doc(`listedVenues/${req.params.venueId}`).get()).exists;
  try {
    return res.json(await createProfileRequest({ venueId: req.params.venueId, profileId, listed }));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}));

router.get("/settings/:venueId", requireAuth, asyncHandler(async (req, res) => {
  try {
    await assertVenuePerm(db, req.auth.uid, req.params.venueId, "venue.update");
  } catch {
    return res.status(403).json({ error: "You can't edit this venue." });
  }
  const settings = await readFinderSettings(req.params.venueId);
  if (!settings) return res.status(404).json({ error: "Venue not found." });
  return res.json(settings);
}));

router.patch("/settings/:venueId", requireAuth, asyncHandler(async (req, res) => {
  try {
    await assertVenuePerm(db, req.auth.uid, req.params.venueId, "venue.update");
  } catch {
    return res.status(403).json({ error: "You can't edit this venue." });
  }
  return res.json(await saveFinderListing(req.params.venueId, req.body || {}));
}));

export default router;
