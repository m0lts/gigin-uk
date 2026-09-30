/* eslint-disable */
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { db, admin, FieldValue } from "../config/admin.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
const router = express.Router();

const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again.", captchaRequired: true },
});

router.use(guestLimiter);

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

function publicApplication(applicant, gig) {
  const when = gig ? gigDate(gig) : null;
  const past = when ? when.getTime() < Date.now() : false;
  const status = publicStatus(applicant.status);
  return {
    applicationId: applicant.id,
    gigId: applicant.gigId || gig?.gigId || "",
    slotGigIds: applicant.slotGigIds || [],
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

async function findByToken(gigId, token) {
  if (!gigId || !token) return null;
  const manageTokenHash = hashToken(token);
  const docs = await loadGroup(gigId);
  for (const doc of docs) {
    const applicant = guestsOn(doc.data).find((entry) => entry.manageTokenHash === manageTokenHash);
    if (applicant) return { gig: doc, applicant, docs };
  }
  return null;
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
    slotGigIds: body.slotGigIds || [],
    gigId: body.gigId || null,
    venueId: body.venueId || null,
    inviteId: body.inviteId || null,
    crmEntryId: body.crmEntryId || null,
    gigName: body.gigName || "",
    venueName: body.venueName || "",
    dateLabel: body.dateLabel || "",
    setLabel: body.setLabel || "",
    source: body.source || "public",
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
    const match = snap.docs.find((doc) => {
      const data = doc.data() || {};
      return (emailKey && emailNorm(data.email) === emailKey) || (phoneKey && phoneNorm(data.phone) === phoneKey);
    });
    if (match) ref = match.ref;
  }
  const fields = {
    name: actName,
    email: email || null,
    phone: phone || null,
    instagram: instagram || null,
    contactType: "artist",
    artistId: null,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!ref) {
    ref = col.doc();
    await ref.set({
      ...fields,
      notes: contactName ? `Contact: ${contactName}` : "",
      tags: ["guest"],
      createdAt: FieldValue.serverTimestamp(),
    });
  } else {
    const current = (await ref.get()).data() || {};
    const tags = Array.from(new Set([...(current.tags || []), "guest"]));
    await ref.set({ ...fields, tags, notes: current.notes || (contactName ? `Contact: ${contactName}` : "") }, { merge: true });
  }
  return ref.id;
}

async function writeApplicant(gigId, applicant, remove) {
  const ref = db.collection("gigs").doc(gigId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current = Array.isArray(snap.data().applicants) ? snap.data().applicants : [];
    const next = current.filter((entry) => entry?.id !== applicant.id);
    if (!remove) next.push(applicant);
    tx.update(ref, { applicants: next });
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
  if (!to) return;
  await db.collection("mail").add({ to, message: { subject, text, html } });
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
  const bucket = admin.storage().bucket();
  const [uploadUrl] = await bucket.file(path).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: type,
  });
  return res.json({ uploadUrl, path });
}));

router.post("/lookup", asyncHandler(async (req, res) => {
  const gigId = String(req.body?.gigId || "");
  const email = emailNorm(req.body?.email);
  const phone = phoneNorm(req.body?.phone);
  if (!gigId || (!email && !phone)) return res.json({ exists: false });
  const docs = await loadGroup(gigId);
  let match = null;
  for (const doc of docs) {
    match = guestsOn(doc.data).find((entry) => {
      if (entry.status === "withdrawn") return false;
      return (email && emailNorm(entry.email) === email) || (phone && phoneNorm(entry.phone) === phone);
    });
    if (match) break;
  }
  if (!match) return res.json({ exists: false });
  return res.json({
    exists: true,
    setLabel: match.setLabel || "a set",
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
    match = guestsOn(doc.data).find((entry) => (email && emailNorm(entry.email) === email) || (phone && phoneNorm(entry.phone) === phone));
    if (match) break;
  }
  if (match?.email) {
    const manageToken = crypto.randomBytes(32).toString("hex");
    const manageTokenHash = hashToken(manageToken);
    for (const doc of docs) {
      const applicants = Array.isArray(doc.data.applicants) ? doc.data.applicants : [];
      if (!applicants.some((entry) => entry?.id === match.id)) continue;
      await doc.ref.update({
        applicants: applicants.map((entry) => entry?.id === match.id ? { ...entry, manageTokenHash } : entry),
      });
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
  if (!Array.isArray(body.slotGigIds) || body.slotGigIds.length === 0) return "Choose a set.";
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

  const group = await loadGroup(body.gigId);
  const manageTokenHash = hashToken(body.manageToken);
  const already = group.flatMap((doc) => doc.data.applicants || []).find((entry) => entry?.id === body.applicationId);
  if (already) {
    if (already.manageTokenHash === manageTokenHash) {
      return res.json({ ok: true, applicationId: body.applicationId, already: true });
    }
    return res.status(409).json({ error: "This application already exists." });
  }

  let photo = body.photo || null;
  if (photo?.path) {
    if (!String(photo.path).startsWith(`guest-applications/${body.applicationId}/`)) {
      return res.status(400).json({ error: "Photo path is not valid." });
    }
    photo = { ...photo, url: await publicDownloadUrl(photo.path) };
  }
  const assets = [];
  for (const asset of Array.isArray(body.assets) ? body.assets.slice(0, 5) : []) {
    if (!asset?.path || !String(asset.path).startsWith(`guest-applications/${body.applicationId}/`)) continue;
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
  const setLabel = (body.slotGigIds || []).map((_, index) => `Set ${index + 1}`).join(", ") || "a set";
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
  for (const slotId of body.slotGigIds) {
    await writeApplicant(slotId, applicant, false);
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
    await sendMail({
      to: contacts.email,
      subject: `You've applied to play ${gigName} at ${venueName}`,
      text: `Hi ${first}, Jez has your application for ${dateLabel}. Change or withdraw it: ${manageUrl}`,
      html: emailShell({
        title: `You've applied to play`,
        inner: `<p>Hi ${first},</p><p>Jez has your application for ${dateLabel} and will reply by email.</p>
          <table role="presentation" width="100%" style="border:1px solid #E5E7EB;border-radius:12px;margin-top:8px;">
            <tr><td style="padding:12px 14px;font-size:14px;"><strong>Act</strong><br>${record.actName}</td></tr>
            <tr><td style="padding:0 14px 12px;font-size:14px;"><strong>Set</strong><br>${setLabel}</td></tr>
            <tr><td style="padding:0 14px 12px;font-size:14px;"><strong>Members</strong><br>${record.members.length || "Not added"}</td></tr>
          </table>`,
        buttonLabel: "Change or withdraw your application",
        buttonUrl: manageUrl,
        footer: "This link is private. Don't forward it. It works until a week after the gig.",
      }),
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
  return res.json(publicApplication(found.applicant, found.gig.data));
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
    slotGigIds: Array.isArray(body.slotGigIds) && body.slotGigIds.length ? body.slotGigIds : current.slotGigIds,
    status: "pending",
    manageTokenHash: current.manageTokenHash,
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
  const slotIds = new Set([...(current.slotGigIds || []), ...(next.slotGigIds || [])]);
  for (const slotId of slotIds) {
    await writeApplicant(slotId, next, !(next.slotGigIds || []).includes(slotId));
  }
  return res.json(publicApplication(next, found.gig.data));
}));

router.post("/:token/withdraw", asyncHandler(async (req, res) => {
  const gigId = req.body?.gigId || req.query.gigId;
  const found = await findByToken(gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  const current = found.applicant;
  if (current.status === "withdrawn") return res.json(publicApplication(current, found.gig.data));
  if (current.status === "confirmed" || current.status === "accepted") {
    return res.status(400).json({ error: "This application has already been accepted." });
  }
  const next = { ...current, status: "withdrawn", updatedAt: new Date().toISOString() };
  for (const doc of found.docs) {
    const applicants = Array.isArray(doc.data.applicants) ? doc.data.applicants : [];
    if (!applicants.some((entry) => entry?.id === current.id)) continue;
    await doc.ref.update({
      applicants: applicants.map((entry) => entry?.id === current.id ? next : entry),
    });
  }
  if (current.email) {
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
  return res.json(publicApplication(next, found.gig.data));
}));

router.post("/:token/link", requireAuth, asyncHandler(async (req, res) => {
  const gigId = req.body?.gigId || req.query.gigId;
  const found = await findByToken(gigId, req.params.token);
  if (!found) return res.status(404).json({ error: "This link is not valid." });
  for (const doc of found.docs) {
    const applicants = Array.isArray(doc.data.applicants) ? doc.data.applicants : [];
    if (!applicants.some((entry) => entry?.id === found.applicant.id)) continue;
    await doc.ref.update({
      applicants: applicants.map((entry) => entry?.id === found.applicant.id ? { ...entry, userId: req.auth.uid } : entry),
    });
  }
  return res.json({ ok: true });
}));

export default router;
