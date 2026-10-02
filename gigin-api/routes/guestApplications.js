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
  mergeApplicants,
  sanitiseApplicants,
} from "../lib/gigPrivacy.js";
import { queueMail } from "../lib/queueMail.js";
import { preferencePhrase, readNight } from "../lib/nightApplications.js";
import {
  emailForAct,
  loadNightSlots,
  notifyVenueOfNewApplication,
  preferenceFromBody,
  withdrawGuestApplication,
  writeGuestApplication,
} from "../lib/nightApplicationOps.js";
import { dismissKeepOffer, keepProfileForGuest, noteProfileApplication } from "../lib/keepProfile.js";
const router = express.Router();

const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again.", captchaRequired: true },
});

if (!process.env.FIRESTORE_EMULATOR_HOST) router.use(guestLimiter);

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ASSET_TYPES = new Set([...IMAGE_TYPES, "application/pdf"]);
const IMAGE_LIMIT = 10 * 1024 * 1024;
const ASSET_LIMIT = 20 * 1024 * 1024;

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
    editable: (applicant.status === "pending" || applicant.status === "sent") && !past,
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
  const docs = await loadGroup(gigId);
  const slots = [];
  for (const doc of docs) {
    const guests = await mergedGuests(doc);
    const guestIds = new Set(guests.map((entry) => entry.id));
    const rest = (Array.isArray(doc.data.applicants) ? doc.data.applicants : []).filter((entry) => (
      !isGuest(entry) && !guestIds.has(entry?.id)
    ));
    slots.push({ gigId: doc.id, ...doc.data, applicants: [...rest, ...guests] });
  }
  return { docs, night: readNight(slots) };
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

router.post("/upload-url", asyncHandler(async (req, res) => {
  const { applicationId, kind, contentType, name, size } = req.body || {};
  if (!applicationId || !/^[a-zA-Z0-9-]{16,80}$/.test(applicationId)) {
    return res.status(400).json({ error: "A valid application id is required." });
  }
  const type = String(contentType || "").toLowerCase();
  const bytes = Number(size) || 0;
  if (kind === "photo") {
    if (!IMAGE_TYPES.has(type)) return res.status(400).json({ error: "Use a JPG or PNG." });
    if (bytes > IMAGE_LIMIT) return res.status(400).json({ error: "Photos must be 10 MB or smaller.", captchaRequired: false });
  } else if (!ASSET_TYPES.has(type) || bytes > ASSET_LIMIT) {
    return res.status(400).json({ error: "Files must be 20 MB or smaller." });
  }
  const safe = String(name || "file").replace(/[^\w.\-]+/g, "-").slice(0, 80);
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
  if (!/^guest-applications\/[a-zA-Z0-9-]{16,80}\/[^/]+$/.test(path) || path.includes("..")) {
    return res.status(400).json({ error: "Upload path is not valid." });
  }
  const fileName = path.split("/").pop();
  const isPhoto = fileName.startsWith("photo");
  const type = String(req.get("content-type") || "").split(";")[0].toLowerCase();
  const allowed = isPhoto ? IMAGE_TYPES : ASSET_TYPES;
  const limit = isPhoto ? IMAGE_LIMIT : ASSET_LIMIT;
  if (!allowed.has(type)) return res.status(400).json({ error: isPhoto ? "Use a JPG or PNG." : "Files must be 20 MB or smaller." });
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
  if (!body.length || body.length > limit) {
    return res.status(400).json({ error: isPhoto ? "Photos must be 10 MB or smaller." : "Files must be 20 MB or smaller." });
  }
  await admin.storage().bucket().file(path).save(body, { contentType: type });
  return res.json({ ok: true });
}));

router.post("/lookup", asyncHandler(async (req, res) => {
  const gigId = String(req.body?.gigId || "");
  const email = emailNorm(req.body?.email);
  const phone = phoneNorm(req.body?.phone);
  if (!gigId || (!email && !phone)) return res.json({ exists: false });
  const { night } = await loadNightDocs(gigId);
  const match = night.applications.find((entry) => {
    if (entry.status === "withdrawn") return false;
    return (email && emailNorm(entry.email) === email) || (phone && phoneNorm(entry.phone) === phone);
  });
  if (!match) return res.json({ exists: false });
  return res.json({
    exists: true,
    setLabel: match.setLabel || "a set",
    preferredSlotGigIds: match.preferredSlotGigIds || [],
    assignedSlotGigId: match.assignedSlotGigId || null,
    appliedAt: match.appliedAt || null,
    dateLabel: match.dateLabel || "",
  });
}));

router.post("/magic-link", asyncHandler(async (req, res) => {
  const gigId = String(req.body?.gigId || "");
  const email = emailNorm(req.body?.email);
  const phone = phoneNorm(req.body?.phone);
  const docs = gigId ? await loadGroup(gigId) : [];
  let match = null;
  for (const doc of docs) {
    const guests = await mergedGuests(doc);
    match = guests.find((entry) => (email && emailNorm(entry.email) === email) || (phone && phoneNorm(entry.phone) === phone));
    if (match) break;
  }
  if (match?.email) {
    const manageToken = crypto.randomBytes(32).toString("hex");
    const manageTokenHash = hashToken(manageToken);
    for (const doc of docs) {
      const applicants = Array.isArray(doc.data.applicants) ? doc.data.applicants : [];
      if (!applicants.some((entry) => entry?.id === match.id)) continue;
      await db.doc(`gigs/${doc.id}/guestApplicants/${match.id}`).set({
        manageTokenHash,
        gigId: doc.id,
        applicantId: match.id,
      }, { merge: true });
    }
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
  let updatingExisting = null;
  if (!body.anotherAct) {
    const { night } = await loadNightDocs(body.gigId);
    const email = emailNorm(body.contacts?.email);
    const phone = phoneNorm(body.contacts?.phone);
    updatingExisting = night.applications.find((entry) => {
      const status = String(entry.status || "").toLowerCase();
      if (status === "withdrawn" || status === "declined") return false;
      if (String(entry.id) === submittedApplicationId) return false;
      return (email && emailNorm(entry.email) === email) || (phone && phoneNorm(entry.phone) === phone);
    }) || null;
    if (updatingExisting) {
      const status = String(updatingExisting.status || "").toLowerCase();
      if (status === "accepted" || status === "confirmed" || status === "paid") {
        return res.status(409).json({ error: "You've already applied for this gig." });
      }
      body.applicationId = updatingExisting.id;
    }
  }
  const manageTokenHash = hashToken(body.manageToken);
  const already = group.flatMap((doc) => doc.data.applicants || []).find((entry) => entry?.id === body.applicationId);
  if (already && !updatingExisting) {
    let storedHash = null;
    for (const doc of group) {
      const priv = await db.doc(`gigs/${doc.id}/guestApplicants/${already.id}`).get();
      if (priv.exists && priv.data()?.manageTokenHash) {
        storedHash = priv.data().manageTokenHash;
        break;
      }
    }
    if (storedHash === manageTokenHash) {
      return res.json({ ok: true, applicationId: body.applicationId, already: true });
    }
    return res.status(409).json({ error: "This application already exists." });
  }

  let photo = body.photo || null;
  if (photo?.path) {
    if (!String(photo.path).startsWith(`guest-applications/${submittedApplicationId}/`) && !String(photo.path).startsWith(`guest-applications/${body.applicationId}/`)) {
      return res.status(400).json({ error: "Photo path is not valid." });
    }
    photo = { ...photo, url: await publicDownloadUrl(photo.path) };
  }
  const assets = [];
  for (const asset of Array.isArray(body.assets) ? body.assets.slice(0, 5) : []) {
    if (!asset?.path || (!String(asset.path).startsWith(`guest-applications/${submittedApplicationId}/`) && !String(asset.path).startsWith(`guest-applications/${body.applicationId}/`))) continue;
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
  if (contacts.email && !updatingExisting) {
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
  if (!updatingExisting && gig.venueId) {
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

router.get("/:token", asyncHandler(async (req, res) => {
  const found = await findByToken(req.query.gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  const when = gigDate(found.gig.data);
  const expired = when ? Date.now() > when.getTime() + 7 * 24 * 60 * 60 * 1000 : false;
  if (expired) return res.status(410).json({ error: "This link has expired." });
  return res.json(publicApplication(found.applicant, found.gig.data, found.night));
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
    photo: current.photo,
    photoUrl: current.photoUrl,
    assets: current.assets,
    appliedAt: current.appliedAt,
    timestamp: current.timestamp,
    gigName: current.gigName,
    venueName: current.venueName,
    dateLabel: current.dateLabel,
    gigId: current.gigId,
    venueId: current.venueId,
  }, current.photoUrl);
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
  return res.json(publicApplication(next, found.gig.data, night));
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
  if (current.status === "withdrawn") return res.json(publicApplication(current, found.gig.data, found.night));
  const wasAccepted = current.status === "confirmed" || current.status === "accepted";
  const next = await withdrawGuestApplication({ gigId, applicant: current });
  if (current.email && !wasAccepted) {
    await sendMail({
      to: current.email,
      subject: `You withdrew your application for ${current.gigName || "the gig"}`,
      text: `Your application to play at ${current.venueName || "the venue"} has been withdrawn.`,
      html: emailShell({
        title: "Application withdrawn",
        inner: `Jez has been told you can't make ${current.dateLabel || "the gig"}. You can apply again while it is still open.`,
        footer: "You're receiving this because you applied on Gigin.",
      }),
    });
  }
  const fresh = await loadNightSlots(gigId);
  const night = readNight(fresh.slots.map((slot) => ({ gigId: slot.id, ...slot.data })));
  return res.json(publicApplication(next, found.gig.data, night));
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
  for (const doc of found.docs) {
    const applicants = Array.isArray(doc.data.applicants) ? doc.data.applicants : [];
    if (!applicants.some((entry) => entry?.id === found.applicant.id)) continue;
    await doc.ref.update({
      applicants: sanitiseApplicants(applicants.map((entry) => entry?.id === found.applicant.id
        ? { ...entry, userId: req.auth.uid, ...(profile ? { linkedArtistId: profile.id } : {}) }
        : entry)),
    });
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
