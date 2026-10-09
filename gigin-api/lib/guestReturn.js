/* Returning guests prove they own an email before earlier details are reused. */
import crypto from "crypto";
import { db } from "../config/admin.js";
import { queueMail } from "./queueMail.js";
import { MAIL_FROM } from "./accessRequest.js";
import { createWindowLimiter } from "./manageLinks.js";
import { renderArtistEmail } from "./artistEmails.js";
import { ownerName } from "./ownerName.js";
import { loadGuestPrivates, loadPrivateApplications } from "./gigPrivacy.js";
import { loadNightSlots } from "./nightApplicationOps.js";

const HOUR_MS = 60 * 60 * 1000;
const returnIpLimit = createWindowLimiter({ max: 20, windowMs: HOUR_MS });
const returnEmailLimit = createWindowLimiter({ max: 3, windowMs: HOUR_MS });
const LIVE = new Set(["pending", "sent", "accepted", "confirmed", "paid"]);

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function emailNorm(value) {
  const email = String(value || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function phoneNorm(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits.length >= 7 ? digits : "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function statusOf(app) {
  return String(app?.status || "pending").toLowerCase();
}

function isWithdrawn(app) {
  return statusOf(app) === "withdrawn";
}

function isLive(app) {
  return LIVE.has(statusOf(app));
}

function whenOf(app) {
  const raw = app?.appliedAt || app?.timestamp || app?.createdAt || "";
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : 0;
}

function gigDate(gig) {
  const raw = gig?.startDateTime || gig?.date;
  if (!raw) return null;
  if (typeof raw.toDate === "function") return raw.toDate();
  if (raw._seconds || raw.seconds) return new Date((raw._seconds || raw.seconds) * 1000);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nightTitle(gig) {
  return String(gig?.gigName || "the night").replace(/\s*\(Set\s+\d+\)\s*$/i, "").trim() || "the night";
}

function appOrigin() {
  return String(process.env.BASE_URL || "https://giginmusic.com").replace(/\/$/, "");
}

async function nightContext(gigId) {
  const { slots, rootId } = await loadNightSlots(gigId);
  if (!slots.length) return null;
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  const ids = new Set(slots.map((slot) => slot.id));
  if (rootId) ids.add(rootId);
  return { slots, rootId, root, ids };
}

async function loadHistory(email) {
  const snap = await db.collectionGroup("guestApplicants").where("email", "==", email).limit(40).get();
  const rows = [];
  const seen = new Set();
  for (const doc of snap.docs || []) {
    const data = doc.data() || {};
    const applicantId = data.applicantId || doc.id;
    const gigId = data.gigId || doc.ref?.parent?.parent?.id;
    if (!applicantId || !gigId || seen.has(`${gigId}:${applicantId}`)) continue;
    seen.add(`${gigId}:${applicantId}`);
    const stored = await loadPrivateApplications(gigId);
    const app = (stored?.applicants || []).find((entry) => String(entry?.id) === String(applicantId));
    if (!app || isWithdrawn(app)) continue;
    rows.push({
      gigId,
      applicantId,
      app,
      priv: data,
      when: whenOf(app),
    });
  }
  rows.sort((a, b) => b.when - a.when);
  return rows;
}

function prefillFrom(row) {
  const app = row?.app || {};
  const priv = row?.priv || {};
  const links = priv.links || app.links || {};
  return {
    actName: app.name || app.actName || app.artistName || priv.actName || "",
    contactName: priv.contactName || app.contactName || "",
    email: emailNorm(priv.email || app.email),
    phone: priv.phone || app.phone || "",
    instagram: priv.instagram || app.instagram || "",
    links: {
      spotify: links.spotify || "",
      youtube: links.youtube || "",
      instagram: links.instagram || "",
      website: links.website || "",
    },
    members: Array.isArray(priv.members) ? priv.members : (Array.isArray(app.members) ? app.members : []),
    needs: Array.isArray(priv.needs) ? priv.needs : [],
    bringOwn: Array.isArray(priv.bringOwn) ? priv.bringOwn : [],
    note: priv.note || app.note || "",
  };
}

async function sendArtistMail({ to, subject, heading, paras, button }) {
  const rendered = renderArtistEmail({
    subject,
    preheader: heading,
    eyebrow: "YOUR APPLICATION",
    heading,
    paras,
    button,
    footer: "You're getting this because you applied to a gig on giginmusic.com.",
  });
  await queueMail({
    to,
    from: MAIL_FROM,
    message: {
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    },
  });
}

function indexId(email, gigId) {
  return hashToken(`${email}|${gigId}`);
}

async function rememberToken({ email, gigId, tokenHash, source, now }) {
  const indexRef = db.doc(`guestApplyReturnIndex/${indexId(email, gigId)}`);
  const previous = await indexRef.get();
  const oldHash = previous.exists ? previous.data()?.tokenHash : "";
  if (oldHash && oldHash !== tokenHash) {
    await db.doc(`guestApplyReturns/${oldHash}`).set({ usedAt: new Date(now).toISOString() }, { merge: true });
  }
  const expiresAt = new Date(now + HOUR_MS).toISOString();
  await db.doc(`guestApplyReturns/${tokenHash}`).set({
    email,
    gigId,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    usedAt: null,
    consumedBy: null,
    sourceGigId: source?.gigId || null,
    sourceApplicantId: source?.applicantId || null,
  });
  await indexRef.set({ tokenHash, expiresAt });
}

/** Same-gig phone or email match. Before proof, only whether a match exists. */
export async function lookupGuest({ gigId, email, phone }) {
  const emailKey = emailNorm(email);
  const phoneKey = phoneNorm(phone);
  if (!gigId || (!emailKey && !phoneKey)) return { exists: false };
  const night = await nightContext(gigId);
  if (!night) return { exists: false };
  const stored = await loadPrivateApplications(night.rootId);
  const privates = await loadGuestPrivates(night.rootId);
  const exists = (stored?.applicants || []).some((entry) => {
    if (!entry || isWithdrawn(entry)) return false;
    const priv = privates.get(entry.id) || {};
    const mergedEmail = emailNorm(priv.email || entry.email);
    const mergedPhone = phoneNorm(priv.phone || entry.phone);
    return (emailKey && mergedEmail === emailKey) || (phoneKey && mergedPhone === phoneKey);
  });
  return { exists };
}

/**
 * @returns {{limited:true}|{known:false}|{known:true,sameGig:boolean}}
 */
export async function checkReturningGuest({ email, gigId, ip, now = Date.now() }) {
  const normalised = emailNorm(email);
  const id = String(gigId || "");
  if (!normalised || !id) return { known: false };
  const ipKey = String(ip || "unknown");
  if (!returnIpLimit.allow(ipKey, now) || !returnEmailLimit.allow(normalised, now)) {
    return { limited: true };
  }
  const night = await nightContext(id);
  if (!night) return { known: false };
  const history = await loadHistory(normalised);
  if (!history.length) return { known: false };
  const liveHere = history.filter((row) => night.ids.has(row.gigId) && isLive(row.app));
  const venueSnap = night.root.data?.venueId
    ? await db.doc(`venueProfiles/${night.root.data.venueId}`).get()
    : null;
  const venue = venueSnap?.exists ? (venueSnap.data() || {}) : {};
  const booker = ownerName(venue, night.root.data);
  const venueName = venue.name || venue.venueName || night.root.data?.venue?.venueName || "the venue";
  const name = nightTitle(night.root.data);
  const when = gigDate(night.root.data);
  const whenLabel = when
    ? when.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : "the night";
  if (liveHere.length) {
    const current = liveHere[0];
    const token = newToken();
    await db.doc(`gigs/${night.rootId}/guestApplicants/${current.applicantId}`).set({
      manageTokenHash: hashToken(token),
      gigId: night.rootId,
      applicantId: current.applicantId,
      email: normalised,
    }, { merge: true });
    const act = prefillFrom(current).actName || "there";
    const url = `${appOrigin()}/gig/${encodeURIComponent(night.rootId)}/application/${token}`;
    await sendArtistMail({
      to: normalised,
      subject: `You already applied to ${name} at ${venueName}`,
      heading: "You already applied",
      paras: [
        `Hi ${escapeHtml(act.split(/\s+/)[0] || "there")},`,
        `You've already applied to ${escapeHtml(name)} at ${escapeHtml(venueName)} on <b>${escapeHtml(whenLabel)}</b>. This is the private link to that application. We haven't started a second one.`,
      ],
      button: ["View your application", url],
    });
    return { known: true, sameGig: true };
  }
  const source = history[0];
  const filled = prefillFrom(source);
  const token = newToken();
  await rememberToken({
    email: normalised,
    gigId: night.rootId,
    tokenHash: hashToken(token),
    source,
    now,
  });
  const url = `${appOrigin()}/gig/${encodeURIComponent(night.rootId)}?return=${token}`;
  const act = filled.actName || "there";
  await sendArtistMail({
    to: normalised,
    subject: `Welcome back, ${act}. Continue your application to ${name} at ${venueName}`,
    heading: `Welcome back, ${escapeHtml(act)}`,
    paras: [
      `Hi ${escapeHtml(act.split(/\s+/)[0] || "there")},`,
      `${escapeHtml(booker)} at ${escapeHtml(venueName)} has ${escapeHtml(name)} on <b>${escapeHtml(whenLabel)}</b>. Use the button to continue with the details from your last application. You can change anything before you send it.`,
    ],
    button: ["Continue your application", url],
  });
  return { known: true, sameGig: false };
}

export function returnCheckHttp(result) {
  if (result?.limited) {
    return {
      status: 429,
      body: { error: "Too many attempts. Please wait a few minutes and try again." },
    };
  }
  if (!result?.known) return { status: 200, body: { known: false } };
  return { status: 200, body: { known: true, sameGig: result.sameGig === true } };
}

export async function redeemReturnToken({ token, gigId, now = Date.now() }) {
  const raw = String(token || "");
  const id = String(gigId || "");
  if (raw.length < 32 || !id) return null;
  const ref = db.doc(`guestApplyReturns/${hashToken(raw)}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const night = await nightContext(id);
  if (!night || data.gigId !== night.rootId) return null;
  if (data.usedAt || data.consumedBy) return null;
  if (!data.expiresAt || Date.parse(data.expiresAt) <= now) return null;
  await ref.set({ usedAt: new Date(now).toISOString() }, { merge: true });
  const stored = await loadPrivateApplications(data.sourceGigId);
  const app = (stored?.applicants || []).find((entry) => String(entry?.id) === String(data.sourceApplicantId));
  const privSnap = await db.doc(`gigs/${data.sourceGigId}/guestApplicants/${data.sourceApplicantId}`).get();
  const priv = privSnap.exists ? (privSnap.data() || {}) : {};
  if (!app && !priv.email) return null;
  return prefillFrom({ app: app || {}, priv, gigId: data.sourceGigId, applicantId: data.sourceApplicantId });
}

async function priorTokenMatches({ token, gigId, email }) {
  const raw = String(token || "");
  if (raw.length < 32) return false;
  const night = await nightContext(gigId);
  if (!night) return false;
  const hash = hashToken(raw);
  const privates = await loadGuestPrivates(night.rootId);
  for (const [applicantId, priv] of privates.entries()) {
    if (priv?.manageTokenHash !== hash) continue;
    if (emailNorm(priv.email) !== email) continue;
    const stored = await loadPrivateApplications(night.rootId);
    const app = (stored?.applicants || []).find((entry) => String(entry?.id) === String(applicantId));
    return Boolean(app);
  }
  return false;
}

async function returnTokenValid({ token, email, gigId, now, applicationId }) {
  const raw = String(token || "");
  if (raw.length < 32) return false;
  const night = await nightContext(gigId);
  if (!night) return false;
  const snap = await db.doc(`guestApplyReturns/${hashToken(raw)}`).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  if (emailNorm(data.email) !== email || data.gigId !== night.rootId) return false;
  if (!data.usedAt) return false;
  if (data.consumedBy && data.consumedBy !== String(applicationId || "")) return false;
  if (!data.expiresAt || Date.parse(data.expiresAt) <= now) return false;
  return true;
}

export async function guestCreateDecision(body, now = Date.now()) {
  const email = emailNorm(body?.contacts?.email);
  const gigId = String(body?.gigId || "");
  if (!email || !gigId) return { action: "allow" };
  const wantsAnother = body?.anotherAct === true || Boolean(body?.priorManageToken);
  if (wantsAnother) {
    const ok = await priorTokenMatches({ token: body?.priorManageToken, gigId, email });
    if (!ok) {
      return { action: "reject", status: 409, error: "Confirm this email from the link we sent." };
    }
    return { action: "another" };
  }
  const night = await nightContext(gigId);
  if (!night) return { action: "allow" };
  const history = await loadHistory(email);
  const liveHere = history.filter((row) => night.ids.has(row.gigId) && isLive(row.app));
  if (liveHere.length) {
    return { action: "reject", status: 409, error: "You've already applied for this gig." };
  }
  if (!history.length) return { action: "allow" };
  const ok = await returnTokenValid({
    token: body?.returnToken,
    email,
    gigId,
    now,
    applicationId: body?.applicationId,
  });
  if (!ok) {
    return { action: "reject", status: 409, error: "Confirm this email from the link we sent." };
  }
  return { action: "allow", claimToken: true };
}

export async function claimReturnToken({ token, email, gigId, applicationId }) {
  const raw = String(token || "");
  const normalised = emailNorm(email);
  const night = await nightContext(gigId);
  if (raw.length < 32 || !normalised || !night || !applicationId) return false;
  const ref = db.doc(`guestApplyReturns/${hashToken(raw)}`);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  if (emailNorm(data.email) !== normalised || data.gigId !== night.rootId) return false;
  if (data.consumedBy && data.consumedBy !== applicationId) return false;
  await ref.set({ consumedBy: applicationId }, { merge: true });
  return true;
}
