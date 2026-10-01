/* eslint-disable */
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import archiver from "archiver";
import { db, admin, FieldValue } from "../config/admin.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { assertVenuePerm } from "../utils/permissions.js";
import { loadGuestPrivates, loadPrivateDetails, mergeApplicants, savePrivateDetails } from "../lib/gigPrivacy.js";

const router = express.Router();

const FILE_LIMIT = 50 * 1024 * 1024;
const TOTAL_LIMIT = 250 * 1024 * 1024;
const MAX_FILES = 30;
const MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a few minutes and try again." },
});

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function safeName(name) {
  return String(name || "file").replace(/[^\w.\-]+/g, "-").slice(0, 80) || "file";
}

function mediaList(gig) {
  return Array.isArray(gig?.media) ? gig.media : [];
}

function publicMedia(item) {
  return {
    id: item.id,
    name: item.name,
    contentType: item.contentType,
    size: item.size,
    uploadedAt: item.uploadedAt || null,
  };
}

async function loadGigForCaller(gigId, caller) {
  const snap = await db.doc(`gigs/${gigId}`).get();
  if (!snap.exists) {
    const error = new Error("Gig not found.");
    error.statusCode = 404;
    throw error;
  }
  const details = await loadPrivateDetails(snap.id);
  const gig = {
    gigId: snap.id,
    ...snap.data(),
    media: Array.isArray(details.media) ? details.media : [],
    mediaShareTokenHash: details.mediaShareTokenHash || null,
  };
  if (!gig.venueId) {
    const error = new Error("Gig is missing a venue.");
    error.statusCode = 400;
    throw error;
  }
  await assertVenuePerm(db, caller, gig.venueId, "gigs.update");
  return { ref: snap.ref, gig };
}

async function gigByShareToken(token) {
  const raw = String(token || "");
  if (!/^[a-f0-9]{64}$/.test(raw)) return null;
  const snap = await db.collectionGroup("private").where("mediaShareTokenHash", "==", hashToken(raw)).limit(1).get();
  if (snap.empty) return null;
  const details = snap.docs[0].data() || {};
  const gigRef = snap.docs[0].ref.parent.parent;
  if (!gigRef) return null;
  const gigSnap = await gigRef.get();
  if (!gigSnap.exists) return null;
  return {
    ref: gigSnap.ref,
    gig: {
      gigId: gigSnap.id,
      ...gigSnap.data(),
      media: Array.isArray(details.media) ? details.media : [],
      mediaShareTokenHash: details.mediaShareTokenHash || null,
    },
  };
}

function safeOrigin(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

const BOOKED = new Set(["confirmed", "accepted", "paid", "payment processing"]);

async function confirmedActEmails(gig) {
  const privates = await loadGuestPrivates(gig.gigId);
  const applicants = mergeApplicants(gig.applicants, privates);
  const emails = new Set();
  for (const applicant of applicants) {
    if (!BOOKED.has(String(applicant?.status || "").toLowerCase())) continue;
    if (applicant?.type === "guest" || applicant?.guest === true) {
      const email = String(applicant.email || "").trim().toLowerCase();
      if (email.includes("@")) emails.add(email);
      continue;
    }
    const profileId = applicant?.id;
    if (!profileId || String(profileId).startsWith("manual-")) continue;
    const profileSnap = await db.doc(`artistProfiles/${profileId}`).get();
    const profile = profileSnap.exists ? profileSnap.data() || {} : {};
    const direct = String(profile.email || applicant.email || "").trim().toLowerCase();
    if (direct.includes("@")) {
      emails.add(direct);
      continue;
    }
    if (profile.userId) {
      try {
        const user = await admin.auth().getUser(profile.userId);
        const authEmail = String(user.email || "").trim().toLowerCase();
        if (authEmail.includes("@")) emails.add(authEmail);
      } catch {
        /* no auth user */
      }
    }
  }
  return [...emails];
}

router.post("/upload-url", requireAuth, asyncHandler(async (req, res) => {
  const { gigId, contentType, name, size } = req.body || {};
  if (!gigId) return res.status(400).json({ error: "gigId is required." });
  const type = String(contentType || "").toLowerCase();
  const bytes = Number(size) || 0;
  if (!MEDIA_TYPES.has(type)) return res.status(400).json({ error: "Use a photo or video (JPG, PNG, WEBP, HEIC, MP4, MOV, or WEBM)." });
  if (bytes <= 0 || bytes > FILE_LIMIT) return res.status(400).json({ error: "Each file must be 50 MB or smaller." });
  const { gig } = await loadGigForCaller(gigId, req.auth.uid);
  const existing = mediaList(gig);
  if (existing.length >= MAX_FILES) return res.status(400).json({ error: "This gig already has 30 files." });
  const used = existing.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
  if (used + bytes > TOTAL_LIMIT) return res.status(400).json({ error: "This gig's photos and videos are over the 250 MB limit." });
  const path = `gig-media/${gigId}/${crypto.randomUUID()}-${safeName(name)}`;
  const bucket = admin.storage().bucket();
  if (process.env.STORAGE_EMULATOR_HOST) {
    const host = req.get("host");
    const uploadUrl = `${req.protocol}://${host}/api/gig-media/emulator-upload?path=${encodeURIComponent(path)}`;
    return res.json({ uploadUrl, path, contentType: type, method: "POST" });
  }
  const [uploadUrl] = await bucket.file(path).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: type,
  });
  return res.json({ uploadUrl, path, contentType: type, method: "PUT" });
}));

router.post("/emulator-upload", requireAuth, express.raw({ type: "*/*", limit: "50mb" }), asyncHandler(async (req, res) => {
  if (!process.env.STORAGE_EMULATOR_HOST) return res.status(404).json({ error: "Not found." });
  const path = String(req.query.path || "");
  if (!path.startsWith("gig-media/") || path.includes("..")) {
    return res.status(400).json({ error: "Upload path is not valid." });
  }
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
  if (!body.length) return res.status(400).json({ error: "Upload was empty." });
  await admin.storage().bucket().file(path).save(body, {
    contentType: String(req.get("content-type") || "application/octet-stream").split(";")[0],
  });
  return res.json({ ok: true });
}));

router.post("/commit", requireAuth, asyncHandler(async (req, res) => {
  const { gigId, path, name } = req.body || {};
  if (!gigId || !path || !String(path).startsWith(`gig-media/${gigId}/`)) {
    return res.status(400).json({ error: "Upload path is not valid." });
  }
  const { ref, gig } = await loadGigForCaller(gigId, req.auth.uid);
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) return res.status(400).json({ error: "Upload was not found." });
  const [meta] = await file.getMetadata();
  const type = String(meta.contentType || req.body?.contentType || "").toLowerCase();
  const bytes = Number(meta.size) || 0;
  if (!MEDIA_TYPES.has(type)) return res.status(400).json({ error: "That file type is not allowed." });
  if (bytes <= 0 || bytes > FILE_LIMIT) return res.status(400).json({ error: "Each file must be 50 MB or smaller." });
  const existing = mediaList(gig);
  if (existing.some((item) => item.path === path)) return res.json({ media: existing.map(publicMedia) });
  if (existing.length >= MAX_FILES) return res.status(400).json({ error: "This gig already has 30 files." });
  const used = existing.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
  if (used + bytes > TOTAL_LIMIT) return res.status(400).json({ error: "This gig's photos and videos are over the 250 MB limit." });
  const item = {
    id: crypto.randomUUID(),
    name: safeName(name || path.split("/").pop()),
    contentType: type,
    size: bytes,
    path,
    uploadedAt: new Date().toISOString(),
  };
  await savePrivateDetails(gig.gigId, { media: [...existing, item] });
  return res.json({ media: [...existing, item].map(publicMedia) });
}));

router.delete("/item/:gigId/:mediaId", requireAuth, asyncHandler(async (req, res) => {
  const { gigId, mediaId } = req.params;
  const { gig } = await loadGigForCaller(gigId, req.auth.uid);
  const existing = mediaList(gig);
  const item = existing.find((entry) => entry.id === mediaId);
  if (!item) return res.status(404).json({ error: "File not found." });
  await savePrivateDetails(gigId, { media: existing.filter((entry) => entry.id !== mediaId) });
  if (item.path && String(item.path).startsWith(`gig-media/${gigId}/`)) {
    try { await admin.storage().bucket().file(item.path).delete({ ignoreNotFound: true }); } catch { /* keep metadata removal */ }
  }
  return res.json({ ok: true });
}));

router.post("/:gigId/share", requireAuth, asyncHandler(async (req, res) => {
  await loadGigForCaller(req.params.gigId, req.auth.uid);
  const token = newToken();
  await savePrivateDetails(req.params.gigId, { mediaShareTokenHash: hashToken(token) });
  return res.json({ token });
}));

router.delete("/:gigId/share", requireAuth, asyncHandler(async (req, res) => {
  await loadGigForCaller(req.params.gigId, req.auth.uid);
  await savePrivateDetails(req.params.gigId, { mediaShareTokenHash: FieldValue.delete() });
  return res.json({ ok: true });
}));

router.post("/:gigId/share/email", requireAuth, asyncHandler(async (req, res) => {
  const { gig } = await loadGigForCaller(req.params.gigId, req.auth.uid);
  if (!gig.mediaShareTokenHash) return res.status(400).json({ error: "Create a share link first." });
  const token = String(req.body?.token || "");
  if (!token || hashToken(token) !== gig.mediaShareTokenHash) {
    return res.status(400).json({ error: "That share link is no longer valid. Create a new one." });
  }
  const origin = safeOrigin(req.body?.origin);
  if (!origin) return res.status(400).json({ error: "A valid site address is required." });
  const link = `${origin}/share/gig-media/${token}`;
  const title = String(gig.gigName || "your gig").replace(/\s*\(Set\s+\d+\)\s*$/, "");
  const emails = await confirmedActEmails(gig);
  for (const to of emails) {
    await db.collection("mail").add({
      to,
      message: {
        subject: `Your photos and videos from ${title}`,
        text: `Photos and videos from ${title} are ready. Open them here: ${link}`,
        html: `<p style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0F1115;">Photos and videos from <strong>${title}</strong> are ready.</p><p><a href="${link}">View and download</a></p>`,
      },
    });
  }
  return res.json({ sent: emails.length });
}));

router.get("/share/:token", publicLimiter, asyncHandler(async (req, res) => {
  const found = await gigByShareToken(req.params.token);
  if (!found) return res.status(404).json({ error: "This link is no longer available." });
  const title = String(found.gig.gigName || "Gig").replace(/\s*\(Set\s+\d+\)\s*$/, "");
  return res.json({
    title,
    venueName: found.gig.venue?.venueName || found.gig.venueName || "",
    media: mediaList(found.gig).map(publicMedia),
  });
}));

router.get("/share/:token/file/:mediaId", publicLimiter, asyncHandler(async (req, res) => {
  const found = await gigByShareToken(req.params.token);
  if (!found) return res.status(404).json({ error: "This link is no longer available." });
  const item = mediaList(found.gig).find((entry) => entry.id === req.params.mediaId);
  if (!item?.path || !String(item.path).startsWith(`gig-media/${found.gig.gigId}/`)) {
    return res.status(404).json({ error: "File not found." });
  }
  res.setHeader("Content-Type", item.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName(item.name)}"`);
  admin.storage().bucket().file(item.path).createReadStream().pipe(res);
}));

router.get("/share/:token/zip", publicLimiter, asyncHandler(async (req, res) => {
  const found = await gigByShareToken(req.params.token);
  if (!found) return res.status(404).json({ error: "This link is no longer available." });
  const items = mediaList(found.gig).filter((item) => item?.path && String(item.path).startsWith(`gig-media/${found.gig.gigId}/`));
  if (!items.length) return res.status(404).json({ error: "There are no files to download." });
  const title = safeName(String(found.gig.gigName || "gig-media").replace(/\s*\(Set\s+\d+\)\s*$/, ""));
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${title}.zip"`);
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err) => {
    console.error("gig media zip failed", err);
    if (!res.headersSent) res.status(500).json({ error: "Could not build the download." });
    else res.end();
  });
  archive.pipe(res);
  const bucket = admin.storage().bucket();
  items.forEach((item, index) => {
    archive.append(bucket.file(item.path).createReadStream(), { name: `${index + 1}-${safeName(item.name)}` });
  });
  archive.finalize();
}));

export default router;
