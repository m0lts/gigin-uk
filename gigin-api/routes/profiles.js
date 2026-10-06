/* eslint-disable */
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import archiver from "archiver";
import { admin } from "../config/admin.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { assertVenuePerm } from "../utils/permissions.js";
import { db } from "../config/admin.js";
import { ogCardPng } from "../lib/ogCard.js";
import {
  APP_ORIGIN,
  askForPressKit,
  clearProfileCookie,
  claimProfileAccount,
  inspectConfirmToken,
  consumeEditToken,
  consumePrefill,
  deleteProfile,
  forgetSession,
  hideProfile,
  ownerPayload,
  listOwnPressKit,
  logPressDownload,
  ogDescription,
  prefillHint,
  pressKitAccess,
  pressKitKindOk,
  profileUrl,
  pendingChoicesView,
  publicProfileView,
  readSession,
  editorFromRequest,
  redeemNudge,
  removePressAsset,
  resendConfirm,
  savePendingChoices,
  savePressAsset,
  sendEditLink,
  sendPrefillLink,
  sessionProfile,
  setProfileCookie,
  submitProfileContact,
  updateOwnProfile,
  artistContactForVenue,
} from "../lib/keepProfile.js";
import { startArtistSignup } from "../lib/artistSignup.js";

const router = express.Router();

const signupIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: () => {
    const parsed = Number(process.env.ARTIST_SIGNUP_IP_MAX);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  validate: { trustProxy: false, xForwardedForHeader: false },
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages. Please wait a few minutes and try again.", captchaRequired: true },
});

function fail(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    error: error.code || error.message || "Something went wrong.",
    slug: error.slug || undefined,
    hasPassword: error.hasPassword,
    hasGoogle: error.hasGoogle,
  });
}

router.post("/signup", signupIpLimiter, asyncHandler(async (req, res) => {
  try {
    await startArtistSignup(req.body || {});
    return res.json({ sent: true });
  } catch (error) {
    if (error.statusCode === 429) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    throw error;
  }
}));

router.get("/public/:slug", asyncHandler(async (req, res) => {
  const profile = await publicProfileView(req.params.slug);
  if (!profile) return res.status(404).json({ error: "unavailable" });
  res.set("Cache-Control", "public, max-age=60");
  return res.json({ profile, og: { title: `${profile.name} · Gigin`, description: ogDescription(profile), url: profileUrl(profile.slug || req.params.slug) } });
}));

router.get("/public/:slug/og.png", asyncHandler(async (req, res) => {
  const profile = await publicProfileView(req.params.slug);
  if (!profile) return res.status(404).end();
  if (profile.heroMedia?.url) return res.redirect(profile.heroMedia.url);
  const initials = String(profile.name || "G").split(/\s+/).map((part) => part[0]).join("").slice(0, 3);
  const png = ogCardPng(initials);
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=86400");
  return res.send(png);
}));

router.get("/public/:slug/preview", asyncHandler(async (req, res) => {
  const profile = await publicProfileView(req.params.slug);
  if (!profile) {
    return res.status(404).type("html").send("<!doctype html><title>Profile</title><p>This profile isn't available.</p>");
  }
  const title = `${profile.name} · Gigin`;
  const description = ogDescription(profile);
  const image = `${APP_ORIGIN}/api/profiles/public/${encodeURIComponent(profile.slug || req.params.slug)}/og.png`;
  const page = profileUrl(profile.slug || req.params.slug);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta property="og:title" content="${title.replace(/"/g, "&quot;")}">
<meta property="og:description" content="${description.replace(/"/g, "&quot;")}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${page}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${page}"></head><body><p><a href="${page}">${title}</a></p></body></html>`;
  res.set("Cache-Control", "public, max-age=300");
  return res.type("html").send(html);
}));

router.get("/pending/:token", asyncHandler(async (req, res) => {
  try {
    return res.json(await pendingChoicesView(req.params.token));
  } catch (error) {
    return fail(res, error);
  }
}));

router.patch("/pending/:token", asyncHandler(async (req, res) => {
  try {
    return res.json(await savePendingChoices(req.params.token, req.body || {}));
  } catch (error) {
    return fail(res, error);
  }
}));

router.get("/confirm/:token", asyncHandler(async (req, res) => {
  try {
    return res.json(await inspectConfirmToken(req.params.token));
  } catch (error) {
    return fail(res, error);
  }
}));

router.post("/confirm/:token", optionalAuth, asyncHandler(async (req, res) => {
  try {
    const result = await claimProfileAccount({
      rawToken: req.params.token,
      password: req.body?.password,
      authUser: req.auth,
    });
    return res.json({ slug: result.slug, url: result.url, profileId: result.profileId, email: result.email });
  } catch (error) {
    return fail(res, error);
  }
}));

router.post("/confirm/:token/resend", asyncHandler(async (req, res) => {
  return res.json(await resendConfirm(req.params.token));
}));

router.post("/edit-link", asyncHandler(async (req, res) => {
  const session = await readSession(req, { editor: false });
  await sendEditLink({ email: req.body?.email, profileId: session?.profile?.id || null });
  return res.json({ ok: true });
}));

router.post("/edit-session/:token", asyncHandler(async (req, res) => {
  try {
    const result = await consumeEditToken(req.params.token);
    setProfileCookie(res, result.cookie);
    return res.json({ ok: true, profileId: result.profileId });
  } catch (error) {
    return fail(res, error);
  }
}));

router.post("/prefill/:token", asyncHandler(async (req, res) => {
  try {
    const result = await consumePrefill(req.params.token);
    setProfileCookie(res, result.cookie);
    return res.json({ ok: true });
  } catch (error) {
    return fail(res, error);
  }
}));

router.post("/prefill-hint", asyncHandler(async (req, res) => {
  return res.json(await prefillHint(req.body?.email));
}));

router.post("/prefill-link", asyncHandler(async (req, res) => {
  await sendPrefillLink(req.body?.email);
  return res.json({ ok: true });
}));

router.post("/nudge/:token", asyncHandler(async (req, res) => {
  return res.json(await redeemNudge(req.params.token));
}));

router.get("/session", asyncHandler(async (req, res) => {
  const data = await sessionProfile(req, { editor: false });
  if (!data) return res.json({ profile: null });
  return res.json(data);
}));

router.post("/session/forget", asyncHandler(async (req, res) => {
  await forgetSession(req);
  clearProfileCookie(res);
  return res.json({ ok: true });
}));

router.get("/me", optionalAuth, asyncHandler(async (req, res) => {
  const profile = await editorFromRequest(req);
  if (!profile) return res.status(401).json({ error: "Log in to edit your profile." });
  return res.json(await ownerPayload(profile));
}));

router.patch("/me", optionalAuth, asyncHandler(async (req, res) => {
  const profile = await editorFromRequest(req);
  if (!profile) return res.status(401).json({ error: "Log in to edit your profile." });
  await updateOwnProfile(profile, req.body || {});
  return res.json({ ok: true });
}));

router.post("/me/hide", optionalAuth, asyncHandler(async (req, res) => {
  const profile = await editorFromRequest(req);
  if (!profile) return res.status(401).json({ error: "Log in to edit your profile." });
  await hideProfile(profile);
  return res.json({ ok: true });
}));

router.delete("/me", optionalAuth, asyncHandler(async (req, res) => {
  const profile = await editorFromRequest(req);
  if (!profile) return res.status(401).json({ error: "Log in to edit your profile." });
  await deleteProfile(profile);
  await forgetSession(req);
  clearProfileCookie(res);
  return res.json({ ok: true });
}));

router.post("/:slug/contact", contactLimiter, asyncHandler(async (req, res) => {
  try {
    const result = await submitProfileContact({
      slug: req.params.slug,
      name: req.body?.name,
      email: req.body?.email,
      venue: req.body?.venue,
      message: req.body?.message,
    });
    return res.json(result);
  } catch (error) {
    return fail(res, error);
  }
}));

router.get("/me/press-kit", optionalAuth, asyncHandler(async (req, res) => {
  const profile = await editorFromRequest(req);
  if (!profile) return res.status(401).json({ error: "Log in to edit your profile." });
  const files = await listOwnPressKit(profile.id);
  return res.json({ files, pressKitRightsConfirmedAt: profile.pressKitRightsConfirmedAt || null });
}));

router.post("/me/press-kit/upload-url", optionalAuth, asyncHandler(async (req, res) => {
  const profile = await editorFromRequest(req);
  if (!profile) return res.status(401).json({ error: "Log in to edit your profile." });
  const { kind, contentType, name, size } = req.body || {};
  const existing = await db.collection(`artistProfiles/${profile.id}/pressKit`).where("kind", "==", kind).get();
  const problem = pressKitKindOk(kind, contentType, size, existing.size);
  if (problem) return res.status(400).json({ error: problem });
  const assetId = crypto.randomUUID();
  const safe = String(name || "file").replace(/[^\w.\-]+/g, "-").slice(0, 80);
  const path = `artist-press-kits/${profile.id}/${assetId}-${safe}`;
  const [uploadUrl] = await admin.storage().bucket().file(path).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 20 * 60 * 1000,
    contentType: String(contentType || "application/octet-stream"),
  });
  return res.json({ uploadUrl, path, assetId, method: "PUT" });
}));

router.post("/me/press-kit", optionalAuth, asyncHandler(async (req, res) => {
  const profile = await editorFromRequest(req);
  if (!profile) return res.status(401).json({ error: "Log in to edit your profile." });
  const body = req.body || {};
  if (body.kind !== "bio") {
    const existing = await db.collection(`artistProfiles/${profile.id}/pressKit`).where("kind", "==", body.kind).get();
    const problem = pressKitKindOk(body.kind, body.contentType, body.size, body.id ? 0 : existing.size);
    if (problem) return res.status(400).json({ error: problem });
    if (body.path && !String(body.path).startsWith(`artist-press-kits/${profile.id}/`)) {
      return res.status(400).json({ error: "Upload path is not valid." });
    }
  }
  const id = await savePressAsset(profile.id, body);
  if (body.rightsConfirmed) await updateOwnProfile(profile, { pressKitRights: true });
  return res.json({ id });
}));

router.delete("/me/press-kit/:assetId", optionalAuth, asyncHandler(async (req, res) => {
  const profile = await editorFromRequest(req);
  if (!profile) return res.status(401).json({ error: "Log in to edit your profile." });
  await removePressAsset(profile.id, req.params.assetId);
  return res.json({ ok: true });
}));

router.get("/home", optionalAuth, asyncHandler(async (req, res) => {
  let profileId = null;
  if (req.auth?.uid) {
    const snap = await db.collection("artistProfiles").where("userId", "==", req.auth.uid).limit(1).get();
    if (!snap.empty) profileId = snap.docs[0].id;
  }
  if (!profileId) {
    const session = await readSession(req);
    profileId = session?.profile?.id || null;
  }
  if (!profileId) return res.json({ profile: null, gigs: [], applications: [] });
  const profileSnap = await db.doc(`artistProfiles/${profileId}`).get();
  const profile = profileSnap.data() || {};
  const gigs = [];
  const applications = [];
  const played = Array.isArray(profile.playedAt) ? profile.playedAt : [];
  for (const row of played) {
    gigs.push({ gigId: row.gigId, name: row.venueName, venue: row.venueName, city: row.city, date: row.date, status: "confirmed" });
  }
  const guestIds = Array.isArray(profile.guestApplicationIds) ? profile.guestApplicationIds : [];
  for (const entry of guestIds.slice(0, 20)) {
    const applicationId = typeof entry === "string" ? entry : entry?.id;
    const gigId = typeof entry === "string" ? "" : entry?.gigId;
    if (!applicationId || !gigId) continue;
    const snap = await db.doc(`gigs/${gigId}/guestApplicants/${applicationId}`).get();
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const gig = await db.doc(`gigs/${gigId}`).get();
    const stub = ((gig.data()?.applicants) || []).find((row) => row?.id === applicationId) || {};
    applications.push({
      id: applicationId,
      gigId,
      gigName: data.gigName || gig.data()?.gigName || "",
      venueName: data.venueName || "",
      dateLabel: data.dateLabel || "",
      status: stub.status || data.status || "pending",
    });
  }
  return res.json({
    profile: {
      id: profileId,
      name: profile.name || "",
      slug: profile.slug || "",
      bio: profile.bio || "",
      status: profile.status || "live",
      source: profile.source || null,
      userId: profile.userId || null,
      heroMedia: profile.heroMedia || null,
      homeWelcomeDismissedAt: profile.homeWelcomeDismissedAt || null,
    },
    gigs,
    applications,
  });
}));

export default router;

export const artistExtra = express.Router();

artistExtra.get("/:profileId/contact", requireAuth, asyncHandler(async (req, res) => {
  const venueId = String(req.query.venueId || "");
  if (!venueId) return res.status(400).json({ error: "venueId is required." });
  try {
    await assertVenuePerm(db, req.auth.uid, venueId, "gigs.read");
  } catch {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    return res.json(await artistContactForVenue({ profileId: req.params.profileId, venueId }));
  } catch (error) {
    return fail(res, error);
  }
}));

artistExtra.get("/:profileId/press-kit", requireAuth, asyncHandler(async (req, res) => {
  const venueId = String(req.query.venueId || "");
  if (!venueId) return res.status(400).json({ error: "venueId is required." });
  try {
    await assertVenuePerm(db, req.auth.uid, venueId, "gigs.read");
  } catch {
    return res.status(403).json({ reason: "not_booked" });
  }
  const access = await pressKitAccess(req.params.profileId, venueId);
  if (access.http === 403) {
    return res.status(403).json({ reason: access.reason, cancelledDate: access.cancelledDate || null, actName: access.actName || "" });
  }
  const files = access.files.map((file) => ({
    id: file.id,
    kind: file.kind,
    name: file.name,
    size: file.size,
    contentType: file.contentType,
    credit: file.credit || "",
    bioText: file.kind === "bio" ? file.bioText || "" : undefined,
    durationSec: file.durationSec || null,
  }));
  return res.json({ files, actName: access.actName, slug: access.slug, state: access.state });
}));

artistExtra.post("/:profileId/press-kit/zip", requireAuth, asyncHandler(async (req, res) => {
  const venueId = String(req.body?.venueId || req.query.venueId || "");
  try {
    await assertVenuePerm(db, req.auth.uid, venueId, "gigs.read");
  } catch {
    return res.status(403).json({ reason: "not_booked" });
  }
  const access = await pressKitAccess(req.params.profileId, venueId);
  if (access.state !== "active") return res.status(403).json({ reason: access.reason || "not_booked" });
  await logPressDownload({ profileId: req.params.profileId, venueId, userId: req.auth.uid });
  const slug = access.slug || "artist";
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}-press-kit.zip"`);
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", () => { if (!res.headersSent) res.status(500).end(); });
  archive.pipe(res);
  for (const file of access.files) {
    if (file.kind === "bio") {
      archive.append(String(file.bioText || ""), { name: "bio.txt" });
      continue;
    }
    if (!file.path) continue;
    archive.append(admin.storage().bucket().file(file.path).createReadStream(), { name: file.name || file.id });
  }
  archive.finalize();
}));

artistExtra.post("/:profileId/press-kit/request", requireAuth, asyncHandler(async (req, res) => {
  const venueId = String(req.body?.venueId || "");
  try {
    await assertVenuePerm(db, req.auth.uid, venueId, "gigs.read");
  } catch {
    return res.status(403).json({ error: "forbidden" });
  }
  return res.json(await askForPressKit({ profileId: req.params.profileId, venueId }));
}));
