import rateLimit from "express-rate-limit";
import { db } from "../config/admin.js";
import { queueMail } from "./queueMail.js";
import { assertVenuePerm } from "../utils/permissions.js";
import { allowedMailOrigin } from "./legacyMail.js";

export const MAIL_RECIPIENT_CAP = 5;

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^(\d{1,2}):([0-5]\d)$/;

export const mailUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.uid || "anonymous",
  message: { error: "Too many emails. Please wait and try again." },
  validate: { xForwardedForHeader: false, trustProxy: false },
});

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plain(value, max = 180) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function requireId(value, name) {
  const id = String(value || "").trim();
  if (!ID_RE.test(id)) throw fail(400, `${name} is required`);
  return id;
}

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return "";
  return email;
}

function clock(value) {
  const match = TIME_RE.exec(String(value || "").trim());
  if (!match) throw fail(400, "A start time must be HH:MM");
  const hours = Number(match[1]);
  if (hours > 23) throw fail(400, "A start time must be HH:MM");
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function minutes(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 24 * 60) throw fail(400, "Duration must be a whole number of minutes");
  return n;
}

function formatDuration(duration) {
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  if (hours === 0) return `${mins} minutes`;
  if (mins === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  return `${hours} hour${hours > 1 ? "s" : ""} ${mins} minutes`;
}

function toJsDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return new Date(value);
  const secs = typeof value.seconds === "number" ? value.seconds : typeof value._seconds === "number" ? value._seconds : null;
  if (secs !== null) return new Date(secs * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWhen(value) {
  const date = toJsDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function gigTitle(gig) {
  return plain(String(gig?.gigName || "the gig").replace(/\s*\(Set\s+\d+\)\s*$/, ""), 120) || "the gig";
}

async function loadGig(gigId) {
  const snap = await db.doc(`gigs/${gigId}`).get();
  if (!snap.exists) throw fail(404, "Gig not found");
  return { id: snap.id, ...(snap.data() || {}) };
}

async function loadVenue(venueId) {
  const snap = await db.doc(`venueProfiles/${venueId}`).get();
  if (!snap.exists) throw fail(404, "Venue not found");
  return { id: snap.id, ...(snap.data() || {}) };
}

function venueLabel(venue, gig) {
  return plain(venue?.accountName || venue?.name || venue?.venueName || gig?.venue?.venueName || "the venue");
}

function venueInbox(venue) {
  return normalizeEmail(venue?.email || venue?.userEmail || "");
}

async function ownsApplicant(uid, applicantId) {
  const artist = await db.doc(`artistProfiles/${applicantId}`).get();
  if (artist.exists && artist.data()?.userId === uid) return true;
  const member = await db.doc(`artistProfiles/${applicantId}/members/${uid}`).get();
  if (member.exists && member.data()?.status === "active") return true;
  const musician = await db.doc(`musicianProfiles/${applicantId}`).get();
  const owner = musician.exists ? (musician.data()?.userId || musician.data()?.uid) : "";
  return owner === uid;
}

async function emailsForApplicant(gigId, applicant) {
  const applicantId = String(applicant?.id || "");
  if (!applicantId) return [];
  if (applicant.guest === true || applicant.type === "guest") {
    const priv = await db.doc(`gigs/${gigId}/guestApplicants/${applicantId}`).get();
    const stored = normalizeEmail(priv.exists ? priv.data()?.email : applicant.email);
    return stored ? [stored] : [];
  }
  const members = await db.collection(`artistProfiles/${applicantId}/members`).get();
  const fromMembers = members.docs
    .map((doc) => doc.data() || {})
    .filter((member) => member.status === "active")
    .map((member) => normalizeEmail(member.userEmail))
    .filter(Boolean);
  if (fromMembers.length) return fromMembers;
  const profile = await db.doc(`artistProfiles/${applicantId}`).get();
  const profileEmail = normalizeEmail(profile.exists ? profile.data()?.email : "");
  if (profileEmail) return [profileEmail];
  const musician = await db.doc(`musicianProfiles/${applicantId}`).get();
  const musicianEmail = normalizeEmail(musician.exists ? musician.data()?.email : "");
  return musicianEmail ? [musicianEmail] : [];
}

function findApplicant(gig, applicantId) {
  const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
  return applicants.find((entry) => entry && entry.id === applicantId) || null;
}

async function callerIsVenue(uid, venueId, permission) {
  try {
    await assertVenuePerm(db, uid, venueId, permission);
    return true;
  } catch (error) {
    if (error.code === "permission-denied") return false;
    throw error;
  }
}

async function queueTo(recipients, message) {
  const unique = [];
  for (const email of recipients) {
    const next = normalizeEmail(email);
    if (next && !unique.includes(next)) unique.push(next);
  }
  if (unique.length > MAIL_RECIPIENT_CAP) throw fail(400, "Too many recipients");
  if (!unique.length) return { sent: false, recipients: 0 };
  await Promise.all(unique.map((to) => queueMail({ to, message })));
  return { sent: true, recipients: unique.length };
}

function letter({ subject, text, html, link, linkLabel }) {
  const safeSubject = plain(subject, 200);
  const safeText = plain(text, 2000);
  const href = escapeHtml(link || "");
  const body = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:#333333;">
      ${html}
    </p>
    ${link ? `<p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;"><a href="${href}">${escapeHtml(linkLabel || "Open in Gigin")}</a></p>` : ""}
  `;
  return {
    subject: safeSubject,
    text: link ? `${safeText} ${link}` : safeText,
    html: body,
  };
}

async function sendVenueInvite(uid, body) {
  const inviteId = requireId(body.inviteId, "inviteId");
  const snap = await db.doc(`venueInvites/${inviteId}`).get();
  if (!snap.exists) throw fail(404, "Invite not found");
  const invite = snap.data() || {};
  await assertVenuePerm(db, uid, invite.venueId, "members.invite");
  const venue = await loadVenue(invite.venueId);
  const to = normalizeEmail(invite.email);
  if (!to) throw fail(400, "This invite has no email address.");
  const name = plain(venue?.name || venue?.venueName || venue?.accountName || "the venue");
  const origin = allowedMailOrigin(body.origin);
  const link = `${origin}/join-venue?invite=${encodeURIComponent(inviteId)}`;
  const message = letter({
    subject: `You're invited to join ${name} on Gigin`,
    text: `You've been invited to join ${name} on Gigin.`,
    html: `You've been invited to join <strong>${escapeHtml(name)}</strong> on Gigin.`,
    link,
    linkLabel: "Join venue",
  });
  return queueTo([to], message);
}

async function sendGigInvite(uid, body) {
  const inviteId = requireId(body.inviteId, "inviteId");
  const snap = await db.doc(`gigInvites/${inviteId}`).get();
  if (!snap.exists) throw fail(404, "Invite not found");
  const invite = snap.data() || {};
  if (invite.active === false) throw fail(400, "This invite is no longer active.");
  await assertVenuePerm(db, uid, invite.venueId, "gigs.invite");
  const gig = await loadGig(invite.gigId);
  const venue = await loadVenue(invite.venueId);
  const to = normalizeEmail(invite.email);
  if (!to) throw fail(400, "This invite has no email address.");
  const who = plain(venue?.accountName || venue?.name || "A venue");
  const place = plain(venue?.name || venue?.venueName || gig?.venue?.venueName || who);
  const when = formatWhen(gig.startDateTime || gig.date);
  const origin = allowedMailOrigin(body.origin);
  const link = gig.private
    ? `${origin}/gig/${encodeURIComponent(gig.id)}?inviteId=${encodeURIComponent(inviteId)}`
    : `${origin}/gig/${encodeURIComponent(gig.id)}`;
  const whenText = when ? ` on ${when}` : "";
  const message = letter({
    subject: `${who} has invited you to play at ${place}`,
    text: `${who} has invited you to play at their gig at ${place}${whenText}. Check it out on Gigin.`,
    html: `<strong>${escapeHtml(who)}</strong> has invited you to play at their gig at <strong>${escapeHtml(place)}</strong>${when ? ` on <strong>${escapeHtml(when)}</strong>` : ""}.`,
    link,
    linkLabel: "Check it out on Gigin",
  });
  return queueTo([to], message);
}

async function sendGigTiming(uid, body) {
  const gigId = requireId(body.gigId, "gigId");
  const applicantId = body.applicantId ? requireId(body.applicantId, "applicantId") : "";
  const oldStart = clock(body.oldStartTime);
  const nextStart = clock(body.newStartTime);
  const oldDuration = minutes(body.oldDuration);
  const nextDuration = minutes(body.newDuration);
  const gig = await loadGig(gigId);
  await assertVenuePerm(db, uid, gig.venueId, "gigs.update");
  const venue = gig.venueId ? await loadVenue(gig.venueId) : {};
  const applicants = (Array.isArray(gig.applicants) ? gig.applicants : []).filter((entry) => {
    if (!entry || !["confirmed", "paid"].includes(entry.status)) return false;
    return applicantId ? entry.id === applicantId : true;
  });
  if (!applicants.length) throw fail(404, "Confirmed applicant not found");
  const recipients = [];
  let name = "there";
  for (const applicant of applicants) {
    const found = await emailsForApplicant(gigId, applicant);
    recipients.push(...found);
    if (name === "there") name = plain(applicant.name || applicant.artistName || "there");
  }
  const place = venueLabel(venue, gig);
  const when = formatWhen(gig.startDateTime || gig.date);
  const title = gigTitle(gig);
  const timeChanged = oldStart !== nextStart;
  const durationChanged = oldDuration !== nextDuration;
  let text = `Hi ${name}, we've updated the gig timings for ${title} at ${place}${when ? ` on ${when}` : ""}.`;
  if (timeChanged && durationChanged) {
    text += ` The start time has changed from ${oldStart} to ${nextStart}, and the duration has changed from ${formatDuration(oldDuration)} to ${formatDuration(nextDuration)}.`;
  } else if (timeChanged) {
    text += ` The start time has changed from ${oldStart} to ${nextStart}.`;
  } else if (durationChanged) {
    text += ` The duration has changed from ${formatDuration(oldDuration)} to ${formatDuration(nextDuration)}.`;
  }
  text += " Please let us know if this causes any issues.";
  const message = letter({
    subject: `Updated timings for ${title}`,
    text,
    html: escapeHtml(text),
  });
  return queueTo(recipients, message);
}

async function emailApplicantOrVenue(uid, gig, applicantId, { venueSubject, artistSubject, venueText, artistText }) {
  const applicant = findApplicant(gig, applicantId);
  if (!applicant) throw fail(404, "Applicant not found");
  const venue = await loadVenue(gig.venueId);
  const place = venueLabel(venue, gig);
  const when = formatWhen(gig.startDateTime || gig.date);
  const who = plain(applicant.name || applicant.artistName || "An artist");
  const asVenue = await callerIsVenue(uid, gig.venueId, "gigs.applications.manage");
  if (asVenue) {
    const recipients = await emailsForApplicant(gig.id, applicant);
    const text = artistText({ who, place, when });
    return queueTo(recipients, letter({ subject: artistSubject, text, html: escapeHtml(text) }));
  }
  if (!(await ownsApplicant(uid, applicantId))) throw fail(403, "You cannot send email for this gig");
  const inbox = venueInbox(venue);
  const text = venueText({ who, place, when });
  return queueTo(inbox ? [inbox] : [], letter({ subject: venueSubject, text, html: escapeHtml(text) }));
}

async function sendDecision(uid, body, accepted) {
  const gigId = requireId(body.gigId, "gigId");
  const applicantId = requireId(body.applicantId, "applicantId");
  const gig = await loadGig(gigId);
  if (!gig.venueId) throw fail(400, "Gig has no venue");
  return emailApplicantOrVenue(uid, gig, applicantId, accepted ? {
    artistSubject: "Your Gig Application Has Been Accepted!",
    venueSubject: "Your Invitation Was Accepted!",
    artistText: ({ place, when }) => `Your application for the gig at ${place}${when ? ` on ${when}` : ""} has been accepted.`,
    venueText: ({ who, place, when }) => `${who} has accepted your invitation for the gig at ${place}${when ? ` on ${when}` : ""}.`,
  } : {
    artistSubject: "Your Gig Application Was Declined",
    venueSubject: "An application was declined",
    artistText: ({ place, when }) => `Your application for the gig at ${place}${when ? ` on ${when}` : ""} was declined.`,
    venueText: ({ who, place, when }) => `${who} declined the gig at ${place}${when ? ` on ${when}` : ""}.`,
  });
}

async function sendToVenueAboutCaller(uid, body, copy) {
  const gigId = requireId(body.gigId, "gigId");
  const gig = await loadGig(gigId);
  if (!gig.venueId) throw fail(400, "Gig has no venue");
  const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
  let applicant = null;
  for (const entry of applicants) {
    if (entry?.id && await ownsApplicant(uid, entry.id)) {
      applicant = entry;
      break;
    }
  }
  if (!applicant) throw fail(403, "You cannot send email for this gig");
  const venue = await loadVenue(gig.venueId);
  const place = venueLabel(venue, gig);
  const when = formatWhen(gig.startDateTime || gig.date);
  const who = plain(applicant.name || applicant.artistName || "An artist");
  const text = copy({ who, place, when });
  return queueTo(venueInbox(venue) ? [venueInbox(venue)] : [], letter({
    subject: copy.subject,
    text,
    html: escapeHtml(text),
  }));
}

const handlers = {
  "venue-invite": sendVenueInvite,
  "gig-invite": sendGigInvite,
  "gig-timing": sendGigTiming,
  "gig-accepted": (uid, body) => sendDecision(uid, body, true),
  "gig-declined": (uid, body) => sendDecision(uid, body, false),
  "gig-application": (uid, body) => sendToVenueAboutCaller(uid, body, Object.assign(
    ({ who, place, when }) => `${who} has applied to your gig at ${place}${when ? ` on ${when}` : ""}.`,
    { subject: "New Gig Application" },
  )),
  negotiation: (uid, body) => sendToVenueAboutCaller(uid, body, Object.assign(
    ({ who, place, when }) => `${who} has proposed a new fee for your gig at ${place}${when ? ` on ${when}` : ""}.`,
    { subject: "New Negotiation Request" },
  )),
  "counter-offer": async (uid, body) => {
    const gigId = requireId(body.gigId, "gigId");
    const gig = await loadGig(gigId);
    if (body.applicantId) return emailApplicantOrVenue(uid, gig, requireId(body.applicantId, "applicantId"), {
      artistSubject: "You've received a counter-offer",
      venueSubject: "You've received a counter-offer",
      artistText: ({ place, when }) => `You have a counter-offer for the gig at ${place}${when ? ` on ${when}` : ""}.`,
      venueText: ({ who, place, when }) => `${who} sent a counter-offer for the gig at ${place}${when ? ` on ${when}` : ""}.`,
    });
    return sendToVenueAboutCaller(uid, body, Object.assign(
      ({ who, place, when }) => `${who} sent a counter-offer for the gig at ${place}${when ? ` on ${when}` : ""}.`,
      { subject: "You've received a counter-offer" },
    ));
  },
  "invitation-accepted": (uid, body) => sendToVenueAboutCaller(uid, body, Object.assign(
    ({ who, place, when }) => `${who} has accepted the invitation to play at ${place}${when ? ` on ${when}` : ""}.`,
    { subject: "Your Invitation Was Accepted!" },
  )),
};

export const REACHABLE_MAIL_KINDS = Object.keys(handlers);

export async function sendStoredMail(uid, kind, body) {
  const send = handlers[kind];
  if (!send) throw fail(404, "Not Found");
  const source = body && typeof body === "object" ? body : {};
  return send(uid, {
    inviteId: source.inviteId,
    gigId: source.gigId,
    applicantId: source.applicantId,
    origin: source.origin,
    oldStartTime: source.oldStartTime,
    newStartTime: source.newStartTime,
    oldDuration: source.oldDuration,
    newDuration: source.newDuration,
  });
}
