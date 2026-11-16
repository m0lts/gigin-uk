/* eslint-disable */
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { db, admin, FieldValue } from "../config/admin.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  guestPrivate,
  guestStub,
  loadGuestPrivates,
  loadPrivateApplications,
  mergeApplicants,
  sanitiseApplicants,
  savePrivateApplications,
} from "../lib/gigPrivacy.js";
import { queueMail } from "../lib/queueMail.js";
import { MAIL_FROM } from "../lib/accessRequest.js";
import { applicationDateLabel, createWindowLimiter, isUpcomingOrRecent, manageLinksText } from "../lib/manageLinks.js";
import { preferencePhrase, publicLineup, readNight } from "../lib/nightApplications.js";
import {
  emailForAct,
  loadNightSlots,
  notifyVenueOfNewApplication,
  preferenceFromBody,
  withdrawGuestApplication,
  writeGuestApplication,
} from "../lib/nightApplicationOps.js";
import { dismissKeepOffer, keepProfileForGuest, noteProfileApplication } from "../lib/keepProfile.js";
import { assertVenueCanOperate } from "../lib/venueApproval.js";
import { ownerName } from "../lib/ownerName.js";
import { formatPromoDay, preparePromo, promoDueKey, promoEditable } from "../lib/promo.js";
import {
  acceptPromoPhotos,
  acceptPromoTrack,
  acceptSubmittedAssets,
  AUDIO_CAP,
  countAudioObjects,
  deleteStoredFile,
  pathBelongs,
  readLocalTicket,
  safeObjectName,
  uploadRequestProblem,
  withAudioReadUrls,
} from "../lib/guestAssets.js";
import {
  checkReturningGuest,
  claimReturnToken,
  guestCreateDecision,
  lookupGuest,
  redeemReturnToken,
  returnCheckHttp,
} from "../lib/guestReturn.js";
const router = express.Router();

const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again.", captchaRequired: true },
});

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  router.use((req, res, next) => {
    if (req.path === "/manage-links" || req.path === "/return-check") return next();
    return guestLimiter(req, res, next);
  });
}

const manageLinkIpLimit = createWindowLimiter({ max: 5 });
const manageLinkEmailLimit = createWindowLimiter({ max: 3 });


function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function emailNorm(value) {
  const email = String(value || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function phoneNorm(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits.length >= 7 ? digits : "";
}

function gigDate(gig) {
  const raw = gig?.startDateTime || gig?.date;
  if (!raw) return null;
  if (typeof raw.toDate === "function") return raw.toDate();
  if (raw._seconds || raw.seconds) return new Date((raw._seconds || raw.seconds) * 1000);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLong(date) {
  if (!date) return "the night";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function isGuest(applicant) {
  return applicant?.type === "guest" || applicant?.guest === true;
}

function publicStatus(status) {
  if (status === "pending") return "sent";
  if (status === "confirmed") return "accepted";
  return status || "sent";
}

function publicApplication(applicant, gig, night) {
  const when = gig ? gigDate(gig) : null;
  const past = when ? when.getTime() < Date.now() : false;
  const status = publicStatus(applicant.status);
  const preferred = Array.isArray(applicant.preferredSlotGigIds)
    ? applicant.preferredSlotGigIds
    : (Array.isArray(applicant.slotGigIds) ? applicant.slotGigIds : []);
  return {
    applicationId: applicant.id,
    gigId: applicant.gigId || gig?.gigId || night?.applicationsRootGigId || "",
    applicationsRootGigId: night?.applicationsRootGigId || null,
    slotGigIds: preferred,
    preferredSlotGigIds: preferred,
    assignedSlotGigId: applicant.assignedSlotGigId || null,
    withdrawnAfterAccept: applicant.withdrawnAfterAccept === true,
    acceptedAt: applicant.acceptedAt || null,
    assignedAt: applicant.assignedAt || null,
    declinedAt: applicant.declinedAt || null,
    withdrawnAt: applicant.withdrawnAt || null,
    slots: night?.publicSlots || [],
    venueId: applicant.venueId || gig?.venueId || null,
    actName: applicant.name || applicant.actName || "",
    contactName: applicant.contactName || "",
    contacts: {
      email: applicant.email || null,
      phone: applicant.phone || null,
      instagram: applicant.instagram || null,
    },
    photo: applicant.photo || (applicant.photoUrl ? { url: applicant.photoUrl } : null),
    assets: applicant.assets || [],
    links: applicant.links || {},
    members: applicant.members || [],
    needs: applicant.needs || [],
    bringOwn: applicant.bringOwn || [],
    note: applicant.note || "",
    status,
    createdAt: applicant.appliedAt || applicant.timestamp || null,
    updatedAt: applicant.updatedAt || null,
    gigName: applicant.gigName || "",
    venueName: applicant.venueName || "",
    dateLabel: applicant.dateLabel || "",
    artistProfileId: applicant.artistProfileId || null,
    profileSlug: applicant.profileSlug || null,
    keepProfileOffer: applicant.keepProfileOffer || "none",
    promo: applicant.promo ? {
      bio: applicant.promo.bio || "",
      photos: Array.isArray(applicant.promo.photos) ? applicant.promo.photos : [],
      track: applicant.promo.track || null,
      videoUrl: applicant.promo.videoUrl || "",
      played: applicant.promo.played || "",
      submittedAt: applicant.promo.submittedAt || null,
    } : null,
    promoPermission: applicant.promoPermission || null,
    promoDue: formatPromoDay(promoDueKey(gig?.startDateTime || gig?.date, applicant.acceptedAt)),
    promoOpen: ["accepted", "paid"].includes(status) && promoEditable(gig?.startDateTime || gig?.date),
    setChangedFrom: applicant.setChangedFrom || null,
    setChangeSeenAt: applicant.setChangeSeenAt || null,
    gigStatus: gig?.status || null,
    editable: (applicant.status === "pending" || applicant.status === "sent") && !past && gig?.status !== "cancelled",
  };
}

async function groupIds(gigId) {
  const visited = new Set();
  const queue = [gigId];
  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const snap = await db.collection("gigs").doc(id).get();
    if (!snap.exists) continue;
    const slots = snap.data()?.gigSlots;
    if (!Array.isArray(slots)) continue;
    for (const sid of slots) {
      if (sid && !visited.has(sid)) queue.push(sid);
    }
  }
  return [...visited];
}

async function loadGroup(gigId) {
  const ids = await groupIds(gigId);
  const docs = [];
  for (const id of ids) {
    const ref = db.collection("gigs").doc(id);
    const snap = await ref.get();
    if (snap.exists) docs.push({ id, ref, data: snap.data() || {} });
  }
  return docs;
}

function guestsOn(gig) {
  return (Array.isArray(gig?.applicants) ? gig.applicants : []).filter(isGuest);
}

async function mergedGuests(doc) {
  const map = await loadGuestPrivates(doc.id);
  return mergeApplicants(guestsOn(doc.data), map);
}

async function loadNightDocs(gigId) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const docs = slots.map((slot) => ({ id: slot.id, ref: slot.ref, data: { ...slot.data } }));
  const root = docs.find((doc) => doc.id === rootId) || docs[0];
  if (root) {
    const guests = await mergedGuests({ id: root.id, data: root.data });
    const guestIds = new Set(guests.map((entry) => entry.id));
    const rest = (Array.isArray(root.data.applicants) ? root.data.applicants : []).filter((entry) => (
      !isGuest(entry) && !guestIds.has(entry?.id)
    ));
    root.data = { ...root.data, applicants: [...rest, ...guests] };
  }
  return { docs, night: readNight(docs.map((doc) => ({ gigId: doc.id, ...doc.data }))) };
}

async function findByToken(gigId, token) {
  if (!gigId || !token) return null;
  const manageTokenHash = hashToken(token);
  const { docs, night } = await loadNightDocs(gigId);
  const applicant = night.applications.find((entry) => entry.manageTokenHash === manageTokenHash);
  if (!applicant) return null;
  const gig = docs.find((doc) => doc.id === night.applicationsRootGigId) || docs[0];
  return { gig, applicant, docs, night };
}

async function loadGig(gigId) {
  const snap = await db.collection("gigs").doc(gigId).get();
  return snap.exists ? { gigId: snap.id, ...snap.data() } : null;
}

function applicantRecord(body, photoUrl) {
  const contacts = body.contacts || {};
  return {
    id: body.applicationId,
    type: "guest",
    guest: true,
    name: body.actName,
    artistName: body.actName,
    contactName: body.contactName,
    email: contacts.email || null,
    phone: contacts.phone || null,
    instagram: contacts.instagram || null,
    status: body.status || "pending",
    timestamp: body.timestamp || new Date().toISOString(),
    appliedAt: body.appliedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewed: false,
    invited: false,
    sentBy: "musician",
    photoUrl: photoUrl || body.photoUrl || null,
    photo: body.photo || null,
    assets: body.assets || [],
    links: body.links || {},
    members: body.members || [],
    needs: body.needs || [],
    bringOwn: body.bringOwn || [],
    note: body.note || "",
    applicationMessage: body.note || "",
    manageTokenHash: body.manageTokenHash || null,
    slotGigIds: body.slotGigIds || body.preferredSlotGigIds || [],
    preferredSlotGigIds: body.preferredSlotGigIds || body.slotGigIds || [],
    manageToken: body.manageToken || null,
    gigId: body.gigId || null,
    venueId: body.venueId || null,
    inviteId: body.inviteId || null,
    crmEntryId: body.crmEntryId || null,
    gigName: body.gigName || "",
    venueName: body.venueName || "",
    dateLabel: body.dateLabel || "",
    setLabel: body.setLabel || "",
    source: body.source || "public",
    artistProfileId: body.artistProfileId || null,
  };
}

async function upsertVenueContact({ userId, crmEntryId, actName, contactName, email, phone, instagram }) {
  if (!userId || !actName) return crmEntryId || null;
  const col = db.collection("users").doc(userId).collection("artistCRM");
  let ref = crmEntryId ? col.doc(crmEntryId) : null;
  if (ref) {
    const existing = await ref.get();
    if (!existing.exists) ref = null;
  }
  if (!ref) {
    const snap = await col.limit(400).get();
    const emailKey = emailNorm(email);
    const phoneKey = phoneNorm(phone);
    const byEmail = emailKey
      ? snap.docs.find((doc) => emailNorm(doc.data()?.email) === emailKey)
      : null;
    const byPhone = !byEmail && phoneKey
      ? snap.docs.find((doc) => phoneNorm(doc.data()?.phone) === phoneKey)
      : null;
    const match = byEmail || byPhone;
    if (match) ref = match.ref;
  }
  const fields = {
    name: actName,
    email: email || null,
    phone: phone || null,
    instagram: instagram || null,
    contactType: "artist",
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!ref) {
    ref = col.doc();
    await ref.set({
      ...fields,
      artistId: null,
      notes: contactName ? `Contact: ${contactName}` : "",
      tags: ["guest"],
      createdAt: FieldValue.serverTimestamp(),
    });
  } else {
    const current = (await ref.get()).data() || {};
    const tags = Array.from(new Set([...(current.tags || []), "guest"]));
    await ref.set({
      ...fields,
      artistId: current.artistId || null,
      tags,
      notes: current.notes || (contactName ? `Contact: ${contactName}` : ""),
    }, { merge: true });
  }
  return ref.id;
}

async function writeApplicant(gigId, applicant, remove) {
  const ref = db.collection("gigs").doc(gigId);
  const privRef = applicant?.id ? db.doc(`gigs/${gigId}/guestApplicants/${applicant.id}`) : null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current = Array.isArray(snap.data().applicants) ? snap.data().applicants : [];
    const next = current.filter((entry) => entry?.id !== applicant.id);
    if (!remove) next.push(guestStub({ ...applicant, gigId }));
    tx.update(ref, { applicants: sanitiseApplicants(next) });
    if (!privRef) return;
    if (remove) tx.delete(privRef);
    else tx.set(privRef, guestPrivate(applicant, gigId), { merge: true });
  });
}

async function publicDownloadUrl(path) {
  if (!path || typeof path !== "string" || path.includes("..")) return null;
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);
  const token = crypto.randomUUID();
  await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

async function sendMail({ to, subject, text, html }) {
  await queueMail({ to, message: { subject, text, html } });
}

let directStorageUpload = Boolean(process.env.STORAGE_EMULATOR_HOST);

function directUploadUrl(req, path) {
  const host = req.get("host");
  return `${req.protocol}://${host}/api/guest-applications/direct-upload?path=${encodeURIComponent(path)}`;
}

function emailShell({ title, inner, buttonLabel, buttonUrl, footer }) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F7F9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="600" style="max-width:600px;background:#fff;border:1px solid #E5E7EB;border-radius:16px;">
          <tr><td style="padding:28px 28px 0;font-family:Geist,Inter,Arial,sans-serif;font-size:20px;font-weight:700;">gigin.</td></tr>
          <tr><td style="padding:16px 28px 0;font-family:Geist,Inter,Arial,sans-serif;font-size:22px;font-weight:650;color:#0F1115;">${title}</td></tr>
          <tr><td style="padding:12px 28px 0;font-family:Geist,Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#4B5160;">${inner}</td></tr>
          ${buttonUrl ? `<tr><td style="padding:22px 28px 0;"><a href="${buttonUrl}" style="display:inline-block;background:#111317;color:#fff;text-decoration:none;font-family:Geist,Inter,Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 18px;border-radius:10px;">${buttonLabel}</a></td></tr>` : ""}
          <tr><td style="padding:18px 28px 28px;font-family:Geist,Inter,Arial,sans-serif;font-size:12.5px;line-height:1.5;color:#6B7280;">${footer || ""}</td></tr>
        </table>
      </td></tr>
    </table>`;
}

function validApplicationId(applicationId) {
  return Boolean(applicationId) && /^[a-zA-Z0-9-]{16,80}$/.test(applicationId);
}

function applicationEditable(applicant) {
  const status = String(applicant?.status || "");
  return status === "pending" || status === "sent";
}

async function applicationIsStored(applicationId) {
  try {
    const snap = await db.collectionGroup("guestApplicants").where("applicantId", "==", applicationId).limit(1).get();
    return !snap.empty;
  } catch {
    return true;
  }
}

async function ownedApplication(gigId, manageToken, applicationId) {
  if (!gigId || !manageToken) return null;
  const found = await findByToken(gigId, manageToken);
  if (!found || found.applicant?.id !== applicationId) return null;
  return found;
}

async function ignoreAudioPaths(body, applicationId) {
  const requested = Array.isArray(body?.ignorePaths) ? body.ignorePaths.map(String) : [];
  if (!requested.length) return [];
  const found = await ownedApplication(body?.gigId, body?.manageToken, applicationId);
  if (!found || !applicationEditable(found.applicant)) return [];
  const known = new Set((found.applicant.assets || []).map((asset) => asset?.path).filter(Boolean));
  return requested.filter((path) => known.has(path) && pathBelongs(path, [applicationId]) && isAudioPath(path));
}

function isAudioPath(path) {
  return /\.(mp3|m4a|wav)$/i.test(String(path || ""));
}

async function presentApplication(applicant, gig, night, req) {
  const view = publicApplication(applicant, gig, night);
  view.assets = await withAudioReadUrls(view.assets, req);
  return view;
}

async function acceptPhoto(photo, applicationIds) {
  if (!photo) return { photo: null };
  if (!photo.path || !pathBelongs(photo.path, applicationIds)) return { error: "Photo path is not valid." };
  return {
    photo: {
      path: photo.path,
      name: String(photo.name || "photo").slice(0, 180),
      size: Number(photo.size) || 0,
      contentType: String(photo.contentType || "").split(";")[0].trim().toLowerCase(),
      url: await publicDownloadUrl(photo.path),
    },
  };
}

router.post("/upload-url", asyncHandler(async (req, res) => {
  const { applicationId, kind, contentType, name, size } = req.body || {};
  if (!validApplicationId(applicationId)) {
    return res.status(400).json({ error: "A valid application id is required." });
  }
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  const problem = uploadRequestProblem({ kind, contentType: type, name, size });
  if (problem?.error) return res.status(400).json({ error: problem.error });
  if (kind !== "photo" && isAudioPath(name)) {
    const ignore = await ignoreAudioPaths(req.body, applicationId);
    const used = await countAudioObjects(applicationId, ignore);
    if (used >= AUDIO_CAP) return res.status(400).json({ error: "You can add up to 3 audio files." });
  }
  const safe = safeObjectName(name);
  const path = `guest-applications/${applicationId}/${kind === "photo" ? "photo" : crypto.randomUUID()}-${safe}`;
  if (directStorageUpload) {
    return res.json({ uploadUrl: directUploadUrl(req, path), path, method: "POST" });
  }
  try {
    const [uploadUrl] = await admin.storage().bucket().file(path).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType: type,
    });
    return res.json({ uploadUrl, path, method: "PUT" });
  } catch (error) {
    if (!/client_email/.test(String(error?.message || ""))) throw error;
    directStorageUpload = true;
    return res.json({ uploadUrl: directUploadUrl(req, path), path, method: "POST" });
  }
}));

router.post("/direct-upload", express.raw({ type: "*/*", limit: "20mb" }), asyncHandler(async (req, res) => {
  if (!directStorageUpload) return res.status(404).json({ error: "Not found." });
  const path = String(req.query.path || "");
  const applicationId = path.split("/")[1];
  if (!validApplicationId(applicationId) || !pathBelongs(path, [applicationId])) {
    return res.status(400).json({ error: "Upload path is not valid." });
  }
  const fileName = path.split("/").pop();
  const isPhoto = fileName.startsWith("photo");
  const type = String(req.get("content-type") || "").split(";")[0].toLowerCase();
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
  const problem = uploadRequestProblem({
    kind: isPhoto ? "photo" : "asset",
    contentType: type,
    name: isPhoto ? (fileName || "photo.jpg") : fileName,
    size: body.length,
  });
  if (problem?.error) return res.status(400).json({ error: problem.error });
  if (!isPhoto && isAudioPath(fileName)) {
    const used = await countAudioObjects(applicationId);
    if (used >= AUDIO_CAP) return res.status(400).json({ error: "You can add up to 3 audio files." });
  }
  await admin.storage().bucket().file(path).save(body, { contentType: type });
  return res.json({ ok: true });
}));

router.post("/delete-upload", asyncHandler(async (req, res) => {
  const { applicationId, path, gigId, manageToken } = req.body || {};
  if (!validApplicationId(applicationId) || !pathBelongs(path, [applicationId])) {
    return res.status(400).json({ error: "Upload path is not valid." });
  }
  const stored = await applicationIsStored(applicationId);
  const found = await ownedApplication(gigId, manageToken, applicationId);
  if (stored && !found) return res.status(403).json({ error: "This file can't be removed." });
  if (found) {
    const saved = new Set((found.applicant.assets || []).map((asset) => asset?.path).filter(Boolean));
    if (found.applicant.photo?.path) saved.add(found.applicant.photo.path);
    for (const photo of found.applicant.promo?.photos || []) {
      if (photo?.path) saved.add(photo.path);
    }
    if (found.applicant.promo?.track?.path) saved.add(found.applicant.promo.track.path);
    if (saved.has(path)) return res.status(400).json({ error: "Save your changes to remove this file." });
    if (!applicationEditable(found.applicant)) {
      const booked = ["accepted", "confirmed", "paid"].includes(String(found.applicant.status || "").toLowerCase());
      if (!booked) return res.status(400).json({ error: "This application can no longer be edited." });
    }
  }
  await deleteStoredFile(path);
  return res.json({ ok: true });
}));

router.get("/asset-read/:ticket", asyncHandler(async (req, res) => {
  if (!process.env.STORAGE_EMULATOR_HOST) return res.status(404).json({ error: "Not found." });
  const payload = readLocalTicket(req.params.ticket);
  if (!payload?.path) return res.status(403).json({ error: "This link is not valid." });
  const file = admin.storage().bucket().file(payload.path);
  const [exists] = await file.exists();
  if (!exists) return res.status(404).json({ error: "File not found." });
  const [meta] = await file.getMetadata();
  if (payload.disposition) res.setHeader("Content-Disposition", payload.disposition);
  res.setHeader("Content-Type", meta.contentType || "application/octet-stream");
  file.createReadStream().pipe(res);
}));

router.post("/lookup", asyncHandler(async (req, res) => {
  const result = await lookupGuest({
    gigId: req.body?.gigId,
    email: req.body?.email,
    phone: req.body?.phone,
  });
  return res.json({ exists: result.exists === true });
}));

router.post("/return-check", asyncHandler(async (req, res) => {
  try {
    const result = await checkReturningGuest({
      email: req.body?.email,
      gigId: req.body?.gigId,
      ip: req.ip || req.socket?.remoteAddress || "unknown",
    });
    const http = returnCheckHttp(result);
    return res.status(http.status).json(http.body);
  } catch {
    console.error("return check failed");
    return res.status(500).json({ error: "Something went wrong." });
  }
}));

router.post("/return", asyncHandler(async (req, res) => {
  try {
    const draft = await redeemReturnToken({ token: req.body?.token, gigId: req.body?.gigId });
    if (!draft) return res.status(410).json({ error: "This link has expired." });
    return res.json({ draft });
  } catch {
    console.error("return redeem failed");
    return res.status(410).json({ error: "This link has expired." });
  }
}));

router.post("/magic-link", asyncHandler(async (req, res) => {
  const gigId = String(req.body?.gigId || "");
  const email = emailNorm(req.body?.email);
  const phone = phoneNorm(req.body?.phone);
  const loaded = gigId ? await loadNightDocs(gigId) : null;
  const docs = loaded?.docs || [];
  const match = loaded?.night?.applications?.find((entry) => (
    (email && emailNorm(entry.email) === email) || (phone && phoneNorm(entry.phone) === phone)
  )) || null;
  if (match?.email) {
    const manageToken = crypto.randomBytes(32).toString("hex");
    const manageTokenHash = hashToken(manageToken);
    const rootId = loaded?.night?.applicationsRootGigId || gigId;
    await db.doc(`gigs/${rootId}/guestApplicants/${match.id}`).set({
      manageTokenHash,
      gigId: rootId,
      applicantId: match.id,
    }, { merge: true });
    const url = `${process.env.BASE_URL || "https://giginmusic.com"}/gig/${match.gigId || gigId}/application/${manageToken}`;
    await sendMail({
      to: match.email,
      subject: `Your application for ${match.gigName || "the gig"}`,
      text: `Open your application: ${url}`,
      html: emailShell({
        title: "Your application",
        inner: `Here is the private link for your application to play at ${match.venueName || "the venue"}.`,
        buttonLabel: "View my application",
        buttonUrl: url,
        footer: "This link is private. Don't forward it. We'll only email you about this application.",
      }),
    });
  }
  return res.json({ sent: true });
}));

function escapeMail(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

router.post("/manage-links", asyncHandler(async (req, res) => {
  const email = emailNorm(req.body?.email);
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  if (!manageLinkIpLimit.allow(ip) || !email || !manageLinkEmailLimit.allow(email)) {
    return res.json({ sent: true });
  }
  try {
    await sendFreshManageLinks(email);
  } catch (error) {
    console.error("manage links failed", error);
  }
  return res.json({ sent: true });
}));

async function sendFreshManageLinks(email) {
  const snap = await db.collectionGroup("guestApplicants").where("email", "==", email).limit(40).get();
  const seen = new Set();
  const rows = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const applicantId = data.applicantId || doc.id;
    if (!applicantId || seen.has(applicantId)) continue;
    seen.add(applicantId);
    const gigId = data.gigId || doc.ref.parent?.parent?.id;
    if (!gigId) continue;
    const docs = await loadGroup(gigId);
    const rootIdForLinks = docs.find((slot) => slot.data.applicationsRootGigId)?.data.applicationsRootGigId || gigId;
    const storedApps = await loadPrivateApplications(rootIdForLinks);
    const fromPrivate = (storedApps?.applicants || []).filter((entry) => entry?.id === applicantId);
    const stubs = fromPrivate.length ? fromPrivate : docs.flatMap((slot) => (
      (Array.isArray(slot.data.applicants) ? slot.data.applicants : []).filter((entry) => entry?.id === applicantId)
    ));
    if (!stubs.length) continue;
    if (stubs.some((entry) => String(entry?.status || "").toLowerCase() === "withdrawn")) continue;
    const dated = docs
      .map((slot) => ({ slot, when: gigDate(slot.data) }))
      .filter((item) => item.when)
      .sort((a, b) => a.when - b.when);
    const when = dated[0]?.when || null;
    if (!isUpcomingOrRecent(when)) continue;
    const token = crypto.randomBytes(32).toString("hex");
    const manageTokenHash = hashToken(token);
    let wrote = false;
    if (fromPrivate.length) {
      await db.doc(`gigs/${rootIdForLinks}/guestApplicants/${applicantId}`).set({
        manageTokenHash,
        gigId: rootIdForLinks,
        applicantId,
      }, { merge: true });
      wrote = true;
    } else {
      for (const slot of docs) {
        const applicants = Array.isArray(slot.data.applicants) ? slot.data.applicants : [];
        if (!applicants.some((entry) => entry?.id === applicantId)) continue;
        await db.doc(`gigs/${slot.id}/guestApplicants/${applicantId}`).set({
          manageTokenHash,
          gigId: slot.id,
          applicantId,
        }, { merge: true });
        wrote = true;
      }
    }
    if (!wrote) continue;
    const primary = dated[0]?.slot?.data || docs[0]?.data || {};
    const gigName = String(primary.eventName || primary.gigName || data.gigName || "Gig").replace(/\s*\(Set\s+\d+\)\s*$/i, "").trim() || "Gig";
    let venueName = data.venueName || primary.venueName || "";
    if (!venueName && primary.venueId) {
      const venue = await db.collection("venueProfiles").doc(primary.venueId).get();
      venueName = venue.exists ? (venue.data()?.name || "") : "";
    }
    const rootId = primary.applicationsRootGigId || gigId;
    rows.push({
      gigName,
      venueName: venueName || "the venue",
      dateLabel: applicationDateLabel(when),
      url: `${process.env.BASE_URL || "https://giginmusic.com"}/gig/${rootId}/application/${token}`,
    });
    if (rows.length >= 12) break;
  }
  if (!rows.length) return;
  const button = (url) => `<a href="${escapeMail(url)}" style="display:inline-block;background:#111317;color:#fff;text-decoration:none;font-family:Geist,Inter,Arial,sans-serif;font-size:15px;font-weight:600;padding:12px 16px;border-radius:10px;">View my application</a>`;
  const inner = `<p style="margin:0 0 16px;">Here are the private links for your applications on Gigin.</p>${rows.map((row) => `
    <p style="margin:0 0 6px;color:#0F1115;font-weight:600;">${escapeMail(row.gigName)} · ${escapeMail(row.venueName)} · ${escapeMail(row.dateLabel)}</p>
    <p style="margin:0 0 18px;">${button(row.url)}</p>`).join("")}`;
  await queueMail({
    to: email,
    from: MAIL_FROM,
    message: {
      subject: "Your Gigin applications",
      text: manageLinksText(rows),
      html: emailShell({
        title: "Your Gigin applications",
        inner,
        footer: "These links are private. Don't forward them. If you didn't ask for this, you can ignore this email.",
      }),
    },
  });
}

router.post("/claim", asyncHandler(async (req, res) => {
  const { inviteId, applicationId } = req.body || {};
  if (!inviteId || !applicationId) return res.status(400).json({ error: "Invite and application are required." });
  const inviteSnap = await db.collection("gigInvites").doc(inviteId).get();
  const inviteGigId = inviteSnap.exists ? inviteSnap.data()?.gigId : null;
  const docs = inviteGigId ? await loadGroup(inviteGigId) : [];
  const found = docs.some((doc) => (doc.data.applicants || []).some((entry) => entry?.id === applicationId));
  if (!found) return res.status(404).json({ error: "Application not found." });
  await db.collection("gigInvites").doc(inviteId).set({
    claimedByApplicationId: applicationId,
    claimedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return res.json({ ok: true });
}));

function validateCreate(body) {
  const actName = String(body.actName || "").trim();
  const contactName = String(body.contactName || "").trim();
  const contacts = body.contacts || {};
  const email = emailNorm(contacts.email);
  const phone = phoneNorm(contacts.phone);
  const instagram = String(contacts.instagram || "").trim();
  if (!actName || !contactName) return "Add your act name and your name.";
  if (!email && !phone && !instagram) return "Add at least one way to reach you.";
  if (!body.applicationId || !body.manageToken || String(body.manageToken).length < 32) return "Application could not be saved.";
  return null;
}

router.post("/", asyncHandler(async (req, res) => {
  const body = req.body || {};
  const problem = validateCreate(body);
  if (problem) return res.status(400).json({ error: problem });
  const gig = await loadGig(body.gigId);
  if (!gig) return res.status(404).json({ error: "Gig not found." });
  try {
    await assertVenueCanOperate(gig.venueId);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
  const when = gigDate(gig);
  if (when && when.getTime() < Date.now()) return res.status(400).json({ error: "This gig has already happened." });
  const groupForClose = await loadGroup(body.gigId);
  const chosen = new Set(Array.isArray(body.slotGigIds) ? body.slotGigIds : []);
  const closedTarget = groupForClose.find((doc) => {
    const selected = doc.id === body.gigId || chosen.has(doc.id);
    return selected && doc.data?.applicationsOpen === false;
  });
  if (gig.applicationsOpen === false || closedTarget) {
    return res.status(409).json({ error: "Applications for this gig are closed." });
  }
  const accountEmail = emailNorm(body.contacts?.email);
  if (accountEmail) {
    try {
      await admin.auth().getUserByEmail(accountEmail);
      return res.status(409).json({ error: "This email already has a Gigin account. Log in to apply." });
    } catch (err) {
      if (err?.code !== "auth/user-not-found") throw err;
    }
  }

  const group = groupForClose;
  const submittedApplicationId = String(body.applicationId);
  const decision = await guestCreateDecision(body);
  if (decision.action === "reject") {
    return res.status(decision.status).json({ error: decision.error });
  }
  const allowAnother = decision.action === "another";
  if (!allowAnother) {
    const { night } = await loadNightDocs(body.gigId);
    const email = emailNorm(body.contacts?.email);
    const phone = phoneNorm(body.contacts?.phone);
    const liveMatch = night.applications.find((entry) => {
      const status = String(entry.status || "").toLowerCase();
      if (status === "withdrawn" || status === "declined") return false;
      if (String(entry.id) === submittedApplicationId) return false;
      return (email && emailNorm(entry.email) === email) || (phone && phoneNorm(entry.phone) === phone);
    });
    if (liveMatch) {
      return res.status(409).json({ error: "You've already applied for this gig." });
    }
  }
  const manageTokenHash = hashToken(body.manageToken);
  const already = group.flatMap((doc) => doc.data.applicants || []).find((entry) => entry?.id === body.applicationId);
  if (already) {
    let storedHash = null;
    for (const doc of group) {
      const priv = await db.doc(`gigs/${doc.id}/guestApplicants/${already.id}`).get();
      if (priv.exists && priv.data()?.manageTokenHash) {
        storedHash = priv.data().manageTokenHash;
        break;
      }
    }
    if (storedHash === manageTokenHash) {
      if (decision.claimToken) {
        await claimReturnToken({
          token: body.returnToken,
          email: body.contacts?.email,
          gigId: body.gigId,
          applicationId: body.applicationId,
        });
      }
      return res.json({ ok: true, applicationId: body.applicationId, already: true });
    }
    return res.status(409).json({ error: "This application already exists." });
  }

  const applicationIds = [submittedApplicationId, body.applicationId];
  const acceptedPhoto = await acceptPhoto(body.photo || null, applicationIds);
  if (acceptedPhoto.error) return res.status(400).json({ error: acceptedPhoto.error });
  const photo = acceptedPhoto.photo;
  const acceptedAssets = await acceptSubmittedAssets(body.assets, applicationIds);
  if (acceptedAssets.error) return res.status(400).json({ error: acceptedAssets.error });
  const assets = [];
  for (const asset of acceptedAssets.assets) {
    if (String(asset.contentType || "").startsWith("audio/")) {
      assets.push(asset);
      continue;
    }
    assets.push({ ...asset, url: await publicDownloadUrl(asset.path) });
  }

  const venueSnap = gig.venueId ? await db.collection("venueProfiles").doc(gig.venueId).get() : null;
  const venue = venueSnap?.exists ? venueSnap.data() : {};
  const venueName = venue.name || venue.venueName || gig.venue?.venueName || "the venue";
  const gigName = String(gig.gigName || "Gig").replace(/\s*\(Set\s+\d+\)\s*$/, "");
  const dateLabel = formatLong(when);
  const contacts = {
    email: emailNorm(body.contacts?.email) || null,
    phone: String(body.contacts?.phone || "").trim() || null,
    instagram: String(body.contacts?.instagram || "").trim() || null,
  };
  const venueUserId = venue.createdBy || venue.userId || null;
  const crmEntryId = await upsertVenueContact({
    userId: venueUserId,
    crmEntryId: body.crmEntryId || null,
    actName: String(body.actName).trim(),
    contactName: String(body.contactName).trim(),
    email: contacts.email,
    phone: contacts.phone,
    instagram: contacts.instagram,
  });
  const loadedSlots = await loadNightSlots(body.gigId);
  const pref = preferenceFromBody(body, loadedSlots.slots);
  if (pref.error) return res.status(400).json({ error: pref.error });
  const phrase = preferencePhrase(loadedSlots.slots.map((slot) => ({ gigId: slot.id, ...slot.data })), pref.preferredSlotGigIds);
  const setLabel = phrase || "no preference";
  const record = {
    applicationId: body.applicationId,
    gigId: body.gigId,
    slotGigIds: body.slotGigIds,
    venueId: gig.venueId || null,
    inviteId: body.inviteId || null,
    crmEntryId: body.crmEntryId || null,
    actName: String(body.actName).trim(),
    contactName: String(body.contactName).trim(),
    contacts,
    emailNorm: contacts.email || "",
    phoneNorm: phoneNorm(contacts.phone),
    photo,
    assets,
    links: body.links || {},
    members: Array.isArray(body.members) ? body.members.slice(0, 12) : [],
    needs: Array.isArray(body.needs) ? body.needs : [],
    bringOwn: Array.isArray(body.bringOwn) ? body.bringOwn : [],
    note: String(body.note || "").slice(0, 500),
    status: "pending",
    manageTokenHash,
    source: body.inviteId ? "invite" : "public",
    gigName,
    venueName,
    dateLabel,
    setLabel,
    crmEntryId,
  };
  const applicant = applicantRecord({
    ...body,
    ...record,
    contacts,
    actName: record.actName,
    contactName: record.contactName,
    note: record.note,
    photo,
    photoUrl: photo?.url || null,
    assets,
  }, photo?.url);
  applicant.preferredSlotGigIds = pref.preferredSlotGigIds;
  applicant.manageToken = body.manageToken;
  applicant.whatsapp = Boolean(body.contacts?.whatsapp);
  let saved;
  try {
    saved = await writeGuestApplication({
      gigId: body.gigId,
      applicant,
      preferredSlotGigIds: pref.preferredSlotGigIds,
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
  if (decision.claimToken) {
    await claimReturnToken({
      token: body.returnToken,
      email: contacts.email,
      gigId: body.gigId,
      applicationId: body.applicationId,
    });
  }
  if (applicant.artistProfileId) {
    await noteProfileApplication({
      profileId: applicant.artistProfileId,
      venueId: applicant.venueId,
      gigId: body.gigId,
      applicantId: applicant.id,
      inviteId: body.inviteId || null,
    }).catch(() => {});
  }
  if (body.inviteId) {
    await db.collection("gigInvites").doc(body.inviteId).set({
      claimedByApplicationId: body.applicationId,
      claimedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  const manageUrl = `${process.env.BASE_URL || "https://giginmusic.com"}/gig/${body.gigId}/application/${body.manageToken}`;
  const first = record.contactName.split(/\s+/)[0];
  if (contacts.email) {
    const built = await emailForAct({
      kind: "received",
      app: { ...applicant, email: contacts.email, members: record.members, preferredSlotGigIds: pref.preferredSlotGigIds },
      slots: saved.slots,
      venue,
      gig,
      token: body.manageToken,
    });
    await sendMail({ to: contacts.email, ...built.message });
  }
  if (gig.venueId) {
    await notifyVenueOfNewApplication({
      venueId: gig.venueId,
      venue,
      app: { ...applicant, preferredSlotGigIds: pref.preferredSlotGigIds },
      slots: saved.slots,
      gig,
      rootId: saved.rootId,
    });
  }
  return res.json({ ok: true, applicationId: body.applicationId });
}));

router.post("/:token/seen", asyncHandler(async (req, res) => {
  const found = await findByToken(req.body?.gigId || req.query.gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  const rootId = found.night?.applicationsRootGigId || found.gig?.id;
  await db.doc(`gigs/${rootId}/guestApplicants/${found.applicant.id}`).set({
    setChangeSeenAt: new Date().toISOString(),
  }, { merge: true });
  return res.json({ ok: true });
}));

router.post("/:token/promo", asyncHandler(async (req, res) => {
  const found = await findByToken(req.body?.gigId || req.query.gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  const current = found.applicant;
  const state = String(current.status || "").toLowerCase();
  if (!["accepted", "confirmed", "paid"].includes(state)) {
    return res.status(400).json({ error: "Promo is sent after you are booked." });
  }
  if (String(found.gig?.data?.status || "").toLowerCase() === "cancelled") {
    return res.status(400).json({ error: "This night has been cancelled." });
  }
  const gigWhen = found.gig?.data?.startDateTime || found.gig?.data?.date;
  if (!promoEditable(gigWhen)) return res.status(400).json({ error: "Promo can no longer be changed." });
  const prepared = preparePromo(req.body || {}, {
    contactName: current.contactName,
    email: current.email,
  });
  if (prepared.error) return res.status(400).json({ error: prepared.error });
  const applicationIds = [current.id];
  const photos = await acceptPromoPhotos(prepared.photos, applicationIds);
  if (photos.error) return res.status(400).json({ error: photos.error });
  let track = prepared.track;
  if (prepared.track?.path) {
    const stored = await acceptPromoTrack(prepared.track, applicationIds);
    if (stored.error) return res.status(400).json({ error: stored.error });
    track = stored.track;
  }
  const withUrls = [];
  for (const photo of photos.photos) {
    withUrls.push({ ...photo, url: await publicDownloadUrl(photo.path) });
  }
  if (track?.path) track = { ...track, url: await publicDownloadUrl(track.path) };
  const promo = { ...prepared.promo, photos: withUrls, track };
  const rootId = found.night?.applicationsRootGigId || found.gig?.id;
  await db.doc(`gigs/${rootId}/guestApplicants/${current.id}`).set({
    promo,
    promoPermission: prepared.permission,
  }, { merge: true });
  const fresh = await findByToken(req.body?.gigId || req.query.gigId, req.params.token);
  return res.json(await presentApplication(fresh?.applicant || { ...current, promo, promoPermission: prepared.permission }, found.gig.data, fresh?.night || found.night, req));
}));

router.get("/:token", asyncHandler(async (req, res) => {
  const found = await findByToken(req.query.gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  const when = gigDate(found.gig.data);
  const expired = when ? Date.now() > when.getTime() + 7 * 24 * 60 * 60 * 1000 : false;
  if (expired) return res.status(410).json({ error: "This link has expired." });
  return res.json(await presentApplication(found.applicant, found.gig.data, found.night, req));
}));

router.patch("/:token", asyncHandler(async (req, res) => {
  const gigId = req.body?.gigId || req.query.gigId;
  const found = await findByToken(gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  const current = found.applicant;
  if (current.status !== "pending" && current.status !== "sent") {
    return res.status(400).json({ error: "This application can no longer be edited." });
  }
  const body = req.body || {};
  let photo = current.photo;
  let photoUrl = current.photoUrl;
  let assets = current.assets;
  if (Object.prototype.hasOwnProperty.call(body, "photo") || Array.isArray(body.assets)) {
    const applicationIds = [current.id];
    if (Object.prototype.hasOwnProperty.call(body, "photo")) {
      const acceptedPhoto = await acceptPhoto(body.photo || null, applicationIds);
      if (acceptedPhoto.error) return res.status(400).json({ error: acceptedPhoto.error });
      photo = acceptedPhoto.photo;
      photoUrl = photo?.url || null;
    }
    if (Array.isArray(body.assets)) {
      const acceptedAssets = await acceptSubmittedAssets(body.assets, applicationIds);
      if (acceptedAssets.error) return res.status(400).json({ error: acceptedAssets.error });
      const previous = new Set((acceptedAssets.assets || []).map((asset) => asset.path));
      for (const asset of current.assets || []) {
        if (asset?.path && !previous.has(asset.path) && pathBelongs(asset.path, applicationIds)) {
          await deleteStoredFile(asset.path);
        }
      }
      assets = [];
      for (const asset of acceptedAssets.assets) {
        if (String(asset.contentType || "").startsWith("audio/")) assets.push(asset);
        else assets.push({ ...asset, url: await publicDownloadUrl(asset.path) });
      }
    }
  }
  const contacts = body.contacts ? {
    email: emailNorm(body.contacts.email) || null,
    phone: String(body.contacts.phone || "").trim() || null,
    instagram: String(body.contacts.instagram || "").trim() || null,
  } : { email: current.email, phone: current.phone, instagram: current.instagram };
  const venueSnap = current.venueId ? await db.collection("venueProfiles").doc(current.venueId).get() : null;
  const venue = venueSnap?.exists ? venueSnap.data() : {};
  const crmEntryId = await upsertVenueContact({
    userId: venue.createdBy || venue.userId || null,
    crmEntryId: current.crmEntryId,
    actName: String(body.actName || current.name).trim(),
    contactName: String(body.contactName || current.contactName).trim(),
    email: contacts.email,
    phone: contacts.phone,
    instagram: contacts.instagram,
  });
  const next = applicantRecord({
    ...current,
    applicationId: current.id,
    actName: String(body.actName || current.name).trim(),
    contactName: String(body.contactName || current.contactName).trim(),
    contacts,
    links: body.links || current.links,
    members: body.members || current.members,
    needs: body.needs || current.needs,
    bringOwn: body.bringOwn || current.bringOwn,
    note: body.note != null ? String(body.note).slice(0, 500) : current.note,
    slotGigIds: Array.isArray(body.preferredSlotGigIds)
      ? body.preferredSlotGigIds
      : (Array.isArray(body.slotGigIds) ? body.slotGigIds : (current.preferredSlotGigIds || current.slotGigIds || [])),
    preferredSlotGigIds: Array.isArray(body.preferredSlotGigIds)
      ? body.preferredSlotGigIds
      : (Array.isArray(body.slotGigIds) ? body.slotGigIds : (current.preferredSlotGigIds || current.slotGigIds || [])),
    status: "pending",
    manageTokenHash: current.manageTokenHash,
    manageToken: current.manageToken,
    crmEntryId,
    photo,
    photoUrl,
    assets,
    appliedAt: current.appliedAt,
    timestamp: current.timestamp,
    gigName: current.gigName,
    venueName: current.venueName,
    dateLabel: current.dateLabel,
    gigId: current.gigId,
    venueId: current.venueId,
  }, photoUrl);
  try {
    await writeGuestApplication({
      gigId: current.gigId || gigId,
      applicant: next,
      preferredSlotGigIds: next.preferredSlotGigIds || [],
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
  const fresh = await loadNightSlots(current.gigId || gigId);
  const night = readNight(fresh.slots.map((slot) => ({ gigId: slot.id, ...slot.data })));
  return res.json(await presentApplication(next, found.gig.data, night, req));
}));

router.post("/:token/keep-profile", asyncHandler(async (req, res) => {
  const gigId = req.body?.gigId || req.query.gigId;
  const found = await findByToken(gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  try {
    const result = await keepProfileForGuest({
      guest: found.applicant,
      gigId: found.night?.applicationsRootGigId || gigId,
      email: req.body?.email || found.applicant.email,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}));

router.post("/:token/keep-dismiss", asyncHandler(async (req, res) => {
  const gigId = req.body?.gigId || req.query.gigId;
  const found = await findByToken(gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  await dismissKeepOffer({
    gigId: found.night?.applicationsRootGigId || gigId,
    applicantId: found.applicant.id,
  });
  return res.json({ ok: true, keepProfileOffer: "dismissed" });
}));

router.post("/:token/withdraw", asyncHandler(async (req, res) => {
  const gigId = req.body?.gigId || req.query.gigId;
  const found = await findByToken(gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  const current = found.applicant;
  if (current.status === "withdrawn") return res.json(await presentApplication(current, found.gig.data, found.night, req));
  const wasAccepted = current.status === "confirmed" || current.status === "accepted";
  const next = await withdrawGuestApplication({ gigId, applicant: current });
  if (current.email && !wasAccepted) {
    const venueId = current.venueId || found.gig?.data?.venueId;
    let venue = {};
    if (venueId) {
      const venueSnap = await db.collection("venueProfiles").doc(venueId).get();
      if (venueSnap.exists) venue = venueSnap.data() || {};
    }
    const owner = ownerName(venue, found.gig?.data);
    const when = current.dateLabel || "the gig";
    await sendMail({
      to: current.email,
      subject: `You withdrew your application for ${current.gigName || "the gig"}`,
      text: `${owner} has been told you can't make ${when}. You can apply again while it is still open.`,
      html: emailShell({
        title: "Application withdrawn",
        inner: `${escapeMail(owner)} has been told you can't make ${escapeMail(when)}. You can apply again while it is still open.`,
        footer: "You're receiving this because you applied on Gigin.",
      }),
    });
  }
  const fresh = await loadNightSlots(gigId);
  const night = readNight(fresh.slots.map((slot) => ({ gigId: slot.id, ...slot.data })));
  return res.json(await presentApplication(next, found.gig.data, night, req));
}));

router.post("/account-check", asyncHandler(async (req, res) => {
  const email = emailNorm(req.body?.email);
  if (!email) return res.json({ hasAccount: false });
  try {
    await admin.auth().getUserByEmail(email);
    return res.json({ hasAccount: true });
  } catch (err) {
    if (err?.code === "auth/user-not-found") return res.json({ hasAccount: false });
    throw err;
  }
}));

router.post("/:token/link", requireAuth, asyncHandler(async (req, res) => {
  const gigId = req.body?.gigId || req.query.gigId;
  const found = await findByToken(gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  const profileSnap = await db.collection("artistProfiles").where("userId", "==", req.auth.uid).limit(1).get();
  const profile = profileSnap.empty ? null : { id: profileSnap.docs[0].id, ...(profileSnap.docs[0].data() || {}) };
  const rootId = found.night?.applicationsRootGigId || gigId;
  const stored = await loadPrivateApplications(rootId);
  const current = stored?.applicants?.length ? stored.applicants : (found.night?.applications || []);
  const next = current.map((entry) => (
    entry?.id === found.applicant.id
      ? { ...entry, userId: req.auth.uid, ...(profile ? { linkedArtistId: profile.id } : {}) }
      : entry
  ));
  await savePrivateApplications(rootId, next);
  for (const doc of found.docs) {
    await doc.ref.update({ applicants: publicLineup(next, doc.id) });
  }
  let artistLinked = false;
  if (profile && found.applicant.crmEntryId && found.gig.data?.venueId) {
    const venueSnap = await db.doc(`venueProfiles/${found.gig.data.venueId}`).get();
    const ownerId = venueSnap.exists ? (venueSnap.data()?.createdBy || venueSnap.data()?.userId) : null;
    if (ownerId) {
      await db.doc(`users/${ownerId}/artistCRM/${found.applicant.crmEntryId}`).set({
        artistId: profile.id,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      artistLinked = true;
    }
  }
  return res.json({ ok: true, artistLinked });
}));

export default router;
