/* eslint-disable */
import { db, FieldValue, Timestamp } from "../config/admin.js";
import { guestPrivate, isGuestApplicant, loadPrivateApplications, operationalApplicant } from "./gigPrivacy.js";
import { queueMail } from "./queueMail.js";
import {
  applicationsRootGigId,
  planAssignment,
  preferencePhrase,
  publicLineup,
  readNight,
  slotGigId,
  slotTaken,
  sortSlots,
} from "./nightApplications.js";
import { actKind, applicationNoticeMessage, applicationReviewUrl, noticeTrack, planVenueNotice, shouldNotify } from "./venueApplicationNotice.js";
import { venueImageSource } from "./emailImages.js";
import { emailThumbUrl } from "./emailThumbs.js";
import { appendPlayedAt, keepReminderHtml, markBookingCancelled } from "./keepProfile.js";
import { bandMemberRow, icsAttachment, icsEvent, renderArtistEmail } from "./artistEmails.js";
import { ownerName } from "./ownerName.js";
import { declinedApplicationMessage, listOtherOpenGigs } from "./outboundMail.js";
import { formatPromoDay, promoDueKey } from "./promo.js";
import { assertVenuePerm } from "../utils/permissions.js";
import { assertVenueCanPublishNights } from "./venueApproval.js";

const DELAY_MS = 10 * 1000;
const DECLINE_DELAY_MS = 5 * 60 * 1000;
const ACTIVE = new Set(["accepted", "confirmed", "paid"]);

function gigDate(gig) {
  const raw = gig?.startDateTime || gig?.date;
  if (!raw) return null;
  if (typeof raw.toDate === "function") return raw.toDate();
  if (raw._seconds || raw.seconds) return new Date((raw._seconds || raw.seconds) * 1000);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLong(date) {
  if (!date) return "the night";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function formatShort(date) {
  if (!date) return "the night";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function clockRange(slot) {
  if (!slot?.startTime) return "";
  const [hours, minutes] = String(slot.startTime).split(":").map(Number);
  if (!Number.isFinite(hours)) return String(slot.startTime);
  const start = `${String(hours).padStart(2, "0")}:${String(minutes || 0).padStart(2, "0")}`;
  if (slot.duration == null) return start;
  const total = hours * 60 + (minutes || 0) + Number(slot.duration);
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  const end = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `${start}–${end}`;
}

function setName(slots, id) {
  const index = slots.findIndex((slot) => slotGigId(slot) === id);
  return index >= 0 ? `Set ${index + 1}` : "a set";
}

function setDetail(slots, id) {
  const slot = slots.find((entry) => slotGigId(entry) === id);
  if (!slot) return setName(slots, id);
  const range = clockRange(slot);
  const length = slot.duration != null ? `${slot.duration} minutes` : "";
  return [setName(slots, slotGigId(slot)), range].filter(Boolean).join(", ") + (length ? "" : "");
}

export function slotLine(slots, id) {
  const slot = slots.find((entry) => slotGigId(entry) === id);
  if (!slot) return setName(slots, id);
  const range = clockRange(slot);
  return `${setName(slots, id)}${range ? `, ${range}` : ""}`;
}

function addressOf(venue) {
  const address = venue?.address;
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.line1 || address.addressLine1, address.city, address.postcode].filter(Boolean).join(", ");
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

function promoCallout(gig, app) {
  const due = formatPromoDay(promoDueKey(gigDate(gig), app?.acceptedAt || new Date()));
  return {
    title: "One thing we need from you",
    body: `Send a bio, a photo and a track by <b>${due || "the due date"}</b> so we can start promoting your set.`,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function emailShell({ title, inner, buttonLabel, buttonUrl, footnote }) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F7F9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="600" style="max-width:600px;background:#fff;border:1px solid #E5E7EB;border-radius:16px;">
          <tr><td style="padding:28px 28px 0;font-family:Geist,Inter,Arial,sans-serif;font-size:20px;font-weight:700;">gigin.</td></tr>
          <tr><td style="padding:16px 28px 0;font-family:Geist,Inter,Arial,sans-serif;font-size:22px;font-weight:650;color:#0F1115;">${title}</td></tr>
          <tr><td style="padding:12px 28px 0;font-family:Geist,Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#4B5160;">${inner}</td></tr>
          ${buttonUrl ? `<tr><td style="padding:22px 28px 0;"><a href="${buttonUrl}" style="display:inline-block;background:#111317;color:#fff;text-decoration:none;font-family:Geist,Inter,Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 18px;border-radius:10px;">${buttonLabel}</a></td></tr>` : ""}
          <tr><td style="padding:18px 28px 28px;font-family:Geist,Inter,Arial,sans-serif;font-size:12.5px;line-height:1.5;color:#6B7280;">${footnote || "This link is just for you, so please don't forward this email. It works until a week after the gig."}<br><br>Gigin · You're getting this because you applied to a gig on gigin.co.uk.</td></tr>
        </table>
      </td></tr>
    </table>`;
}

function appUrl(gigId, token) {
  const base = process.env.BASE_URL || "https://giginmusic.com";
  if (token) return `${base}/gig/${gigId}/application/${token}`;
  return `${base}/gig/${gigId}`;
}

export async function queueDelayedMail({ to, from, message, delayMs = DELAY_MS }) {
  if (!to || !String(to).includes("@")) return null;
  const ref = db.collection("mail").doc();
  await ref.set({
    to,
    ...(from ? { from } : {}),
    message,
    delivery: {
      startTime: Timestamp.fromDate(new Date(Date.now() + delayMs)),
      state: "PENDING",
      attempts: 0,
    },
  });
  return ref.id;
}

export async function cancelMail(id) {
  if (!id) return;
  try {
    await db.collection("mail").doc(id).delete();
  } catch {
    /* already sent or missing */
  }
}

async function collectIds(startId) {
  const visited = new Set();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const snap = await db.doc(`gigs/${id}`).get();
    if (!snap.exists) continue;
    const slots = snap.data()?.gigSlots;
    if (!Array.isArray(slots)) continue;
    for (const sid of slots) {
      if (sid && !visited.has(sid)) queue.push(sid);
    }
  }
  return [...visited];
}

export function slotView(snap) {
  const data = typeof snap?.data === "function" ? (snap.data() || {}) : (snap?.data || {});
  return { ...data, gigId: snap.id };
}

function canonicalStatus(status) {
  const value = String(status || "pending").toLowerCase();
  if (value === "confirmed" || value === "paid") return "accepted";
  if (value === "sent") return "pending";
  return value;
}

function isWithdrawn(app) {
  return canonicalStatus(app?.status) === "withdrawn";
}

function withdrawnRefusal() {
  const error = new Error("This act has withdrawn.");
  error.statusCode = 409;
  return error;
}

function nightIsCancelled(slots) {
  return slots.length > 0 && slots.every((slot) => String(slot.data?.status || "").toLowerCase() === "cancelled");
}

function assertNightNotCancelled(slots) {
  if (!nightIsCancelled(slots)) return;
  const error = new Error("This night has been cancelled.");
  error.statusCode = 409;
  throw error;
}

function projectNight(slots, rootId, allApps, options = {}) {
  const onlySlot = slots.length < 2;
  return slots.map((slot) => {
    const lineup = publicLineup(allApps, slot.id, { onlySlot, cancelled: options.cancelled === true });
    return {
      ref: slot.ref,
      id: slot.id,
      patch: {
        applicants: lineup,
        applicationsRootGigId: rootId,
        bookedApplicantId: lineup[0]?.id || null,
        closeUndo: FieldValue.delete(),
      },
    };
  });
}

function mergeChanged(current, changedApps) {
  const changed = new Map((changedApps || []).filter((app) => app?.id != null).map((app) => [String(app.id), app]));
  const next = (current || []).map((app) => {
    const update = changed.get(String(app.id));
    return update ? { ...app, ...update, id: app.id } : app;
  });
  for (const app of changed.values()) {
    if (!next.some((entry) => String(entry.id) === String(app.id))) next.push(app);
  }
  return next;
}

async function loadVenue(venueId) {
  if (!venueId) return {};
  const snap = await db.doc(`venueProfiles/${venueId}`).get();
  return snap.exists ? snap.data() || {} : {};
}

async function venueInbox(venue) {
  if (venue?.email && String(venue.email).includes("@")) return venue.email;
  const uid = venue?.createdBy || venue?.userId;
  if (!uid) return null;
  const user = await db.doc(`users/${uid}`).get();
  const email = user.exists ? user.data()?.email : null;
  return email && String(email).includes("@") ? email : null;
}

function openSetLine(slots) {
  const list = Array.isArray(slots) ? slots : [];
  if (!list.length) return "";
  const open = list.filter((slot) => !slotTaken(slot));
  if (!open.length) return "No sets still open";
  if (list.length < 2) return "The set is still open";
  return open.map((slot) => {
    const index = list.findIndex((entry) => slotGigId(entry) === slotGigId(slot));
    return `Set ${index + 1}`;
  }).join(", ");
}

function venueNoticeItem({ app, slots, gig, rootId, othersWaiting = 0, photoUrl = "", venueMarkUrl = "" }) {
  const track = noticeTrack(app);
  return {
    applicantId: String(app?.id || ""),
    actName: actName(app),
    gigName: gigTitle(gig),
    photoUrl,
    venueMarkUrl,
    actType: actKind(app?.members),
    trackUrl: track.trackUrl || "",
    trackName: track.trackName || "",
    message: String(app?.note || app?.applicationMessage || "").trim(),
    played: String(app?.promo?.played || app?.played || "").trim(),
    openSets: openSetLine(slots),
    reviewUrl: applicationReviewUrl(rootId),
    othersWaiting: Number(othersWaiting) || 0,
  };
}

/** One email per venue per hour. A second application in that hour replaces the pending mail. */
export async function notifyVenueOfNewApplication({ venueId, venue, app, slots, gig, rootId }) {
  if (!venueId) return { skipped: true };
  const profile = venue?.email || venue?.createdBy || venue?.userId ? venue : await loadVenue(venueId);
  const to = await venueInbox(profile);
  if (!shouldNotify(to)) return { skipped: true };
  const stored = await readNightApplications(rootId);
  const othersWaiting = (stored.applications || []).filter((entry) => {
    const status = String(entry?.status || "pending").toLowerCase();
    return ["pending", "sent", ""].includes(status) && String(entry?.id) !== String(app?.id);
  }).length;
  const photoUrl = await emailThumbUrl(app?.photo?.emailUrl || app?.photo?.path || app?.photoUrl || app?.photo?.url || "");
  const venueMarkUrl = await emailThumbUrl(venueImageSource(venue) || venueImageSource(profile));
  const item = venueNoticeItem({ app, slots, gig, rootId, othersWaiting, photoUrl, venueMarkUrl });
  const ref = db.doc(`venueApplicationNotices/${venueId}`);
  const now = Date.now();
  let batched = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const open = snap.exists ? snap.data() : null;
    const plan = planVenueNotice(open, item, now);
    batched = plan.batched;
    if (plan.previousMailId) tx.delete(db.collection("mail").doc(plan.previousMailId));
    const mailRef = db.collection("mail").doc();
    tx.set(mailRef, {
      to,
      message: applicationNoticeMessage(plan.items),
      delivery: {
        startTime: Timestamp.fromDate(new Date(plan.sendAt)),
        state: "PENDING",
        attempts: 0,
      },
    });
    tx.set(ref, {
      venueId,
      openedAt: plan.openedAt,
      items: plan.items,
      mailId: mailRef.id,
      updatedAt: new Date(now).toISOString(),
    });
  });
  return { skipped: false, batched };
}

function actName(app) {
  return app?.name || app?.artistName || app?.actName || "The act";
}

function gigTitle(gig) {
  return String(gig?.gigName || "the gig").replace(/\s*\(Set\s+\d+\)\s*$/, "");
}

export async function loadNightSlots(gigId) {
  const ids = await collectIds(gigId);
  const slots = [];
  for (const id of ids) {
    const snap = await db.doc(`gigs/${id}`).get();
    if (snap.exists) slots.push({ id, ref: snap.ref, data: snap.data() || {} });
  }
  const views = slots.map((slot) => slotView(slot));
  const rootId = applicationsRootGigId(views);
  const stored = await loadPrivateApplications(rootId);
  if (stored && Array.isArray(stored.applicants)) {
    const root = slots.find((slot) => slot.id === rootId);
    if (root) {
      const data = { ...root.data, applicants: stored.applicants };
      if (stored.closeUndo) data.closeUndo = stored.closeUndo;
      else delete data.closeUndo;
      if (stored.cancelUndo) data.cancelUndo = stored.cancelUndo;
      else delete data.cancelUndo;
      root.data = data;
    }
  }
  return { slots, rootId, views: views.sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || ""))) };
}

function takenIds(slots) {
  const night = readNight(slots.map((slot) => slotView(slot)));
  return new Set(night.slots.filter((slot) => slot.taken).map((slot) => slot.gigId));
}

export function preferenceFromBody(body, slots) {
  const raw = Array.isArray(body?.preferredSlotGigIds)
    ? body.preferredSlotGigIds
    : (Array.isArray(body?.slotGigIds) ? body.slotGigIds : []);
  const allowed = new Set(slots.map((slot) => slot.id));
  const taken = takenIds(slots);
  const ids = [];
  for (const id of raw) {
    if (!id || ids.includes(id)) continue;
    if (!allowed.has(id)) return { error: "That set is not part of this gig." };
    if (taken.has(id)) return { error: "That set has already been booked." };
    ids.push(id);
  }
  return { preferredSlotGigIds: ids };
}

async function readPrivate(rootId, applicantId) {
  if (!rootId || !applicantId) return {};
  const snap = await db.doc(`gigs/${rootId}/guestApplicants/${applicantId}`).get();
  return snap.exists ? snap.data() || {} : {};
}

async function commitApps({ slots, rootId, apps, privatePatch, applicantId }) {
  const current = readNight(slots.map((slot) => slotView(slot))).applications;
  const next = mergeChanged(current, apps);
  const writes = projectNight(slots, rootId, next);
  const operational = next.map(operationalApplicant).filter(Boolean);
  await db.runTransaction(async (tx) => {
    for (const slot of slots) await tx.get(slot.ref);
    for (const write of writes) tx.update(write.ref, write.patch);
    tx.set(db.doc(`gigs/${rootId}/private/applications`), {
      gigId: rootId,
      applicants: operational,
    }, { merge: true });
    if (privatePatch && applicantId) {
      tx.set(db.doc(`gigs/${rootId}/guestApplicants/${applicantId}`), privatePatch, { merge: true });
    }
  });
}

function findApp(slots, applicantId) {
  const night = readNight(slots.map((slot) => slotView(slot)));
  return {
    night,
    app: night.applications.find((entry) => String(entry.id) === String(applicantId)) || null,
  };
}

function doors(gig) {
  return gig?.timingAccessTime || gig?.doorsTime || gig?.doors || "";
}

function slotMoment(gig, slot, end = false) {
  const day = gigDate(gig);
  if (!day || !slot?.startTime) return null;
  const [hours, minutes] = String(slot.startTime).split(":").map(Number);
  if (!Number.isFinite(hours)) return null;
  const start = new Date(day);
  start.setHours(hours, minutes || 0, 0, 0);
  if (!end) return start;
  return new Date(start.getTime() + (Number(slot.duration) || 60) * 60000);
}

export async function emailForAct({ kind, app, slots, venue, gig, token, later, other, reason }) {
  const booker = ownerName(venue, gig);
  const venueName = venue?.name || venue?.venueName || gig?.venue?.venueName || "the venue";
  const markUrl = await emailThumbUrl(venueImageSource(venue));
  const bookerPhotoUrl = await emailThumbUrl(venue?.bookerPhoto || "");
  const name = gigTitle(gig);
  const when = formatLong(gigDate(gig));
  const short = formatShort(gigDate(gig));
  const act = actName(app);
  const first = firstName(app.contactName || act);
  const pref = preferencePhrase(slots, app.preferredSlotGigIds || []);
  const oneSet = slots.length < 2;
  const url = appUrl(slots[0] ? (applicationsRootGigId(slots) || slotGigId(slots[0])) : gig?.gigId, token);
  const reach = app.whatsapp || app.contacts?.whatsapp ? " by email or WhatsApp" : " by email";
  const address = addressOf(venue);
  const arrival = venue?.arrivalNotes || "";
  const door = doors(gig);
  const role = venue?.bookerRole || venue?.role || "";
  const where = [address, arrival].filter(Boolean).join(". ");
  const venueUrl = `${process.env.BASE_URL || "https://giginmusic.com"}/venues/${venue?.venueId || gig?.venueId || ""}`;
  const foot = "You're getting this because you applied to a gig on giginmusic.com.";
  const hi = `Hi ${escapeHtml(first)},`;
  const assigned = slots.find((slot) => slotGigId(slot) === app.assignedSlotGigId) || null;
  const setLabel = assigned ? setName(slots, app.assignedSlotGigId) : "";
  const range = assigned ? clockRange(assigned) : "";
  const minutes = assigned?.duration ? `${assigned.duration} minutes` : "";
  const setLine = [setLabel, range].filter(Boolean).join(" · ") + (minutes ? ` (${minutes})` : "");
  const was = app.setChangedFrom;
  const rootId = applicationsRootGigId(slots) || gig?.gigId || app.gigId;
  let rendered = null;
  let legacy = null;
  if (kind === "received") {
    const setCopy = oneSet
      ? ""
      : (pref
        ? `You'd prefer ${pref}. ${escapeHtml(booker)} will confirm which set you're playing.`
        : `No preference. ${escapeHtml(booker)} will confirm which set you're playing.`);
    rendered = renderArtistEmail({
      subject: `You've applied to play ${name} at ${venueName}`,
      preheader: `${escapeHtml(booker)} has your application for ${escapeHtml(when)}.`,
      eyebrow: "APPLICATION SENT",
      heading: `${escapeHtml(booker)} has your application`,
      paras: [hi, `Thanks for applying. ${escapeHtml(booker)} at ${escapeHtml(venueName)} has your application for <b>${escapeHtml(when)}</b>, and will get back to you${reach}.`],
      boxes: [{ label: "YOUR APPLICATION", rows: [["Act", escapeHtml(act)], setCopy ? ["Set", setCopy] : null, bandMemberRow(app.members)].filter(Boolean) }],
      pre: "Need to change something, or can't make it any more? Use your private link:",
      button: ["Change or withdraw your application", url],
      small: "This link is private, so don't forward it. It works until 7 days after the gig.",
      footer: foot,
    });
  } else if (kind === "accepted-later") {
    const prefer = pref ? ` You said you'd prefer ${escapeHtml(pref)}.` : "";
    rendered = renderArtistEmail({
      subject: `You're in: ${name} at ${venueName}`,
      preheader: `Your set time is still to be confirmed.`,
      eyebrow: "YOU'RE BOOKED",
      brand: { name: venueName, imageUrl: markUrl },
      bookerName: booker,
      bookerPhotoUrl,
      heading: `You're playing ${escapeHtml(name)}`,
      paras: [hi, `Good news. ${escapeHtml(booker)} has accepted ${escapeHtml(act)} for ${escapeHtml(name)} at ${escapeHtml(venueName)} on <b>${escapeHtml(when)}</b>.`, `We'll confirm your set time. ${escapeHtml(booker)} will choose which set you're playing, and we'll email you again as soon as it's set.${prefer}`],
      boxes: [{ label: "YOUR BOOKING", rows: [["Act", escapeHtml(act)], ["When", escapeHtml(when)], ["Set", "To be confirmed"], door ? ["Doors", escapeHtml(door)] : null, where ? ["Where", escapeHtml(where)] : null].filter(Boolean) }],
      pre: `Can't make it after all? Let ${escapeHtml(booker)} know from your private link, so the set can go to someone else.`,
      callout: promoCallout(gig, app),
      button: ["Send your promo", url],
      buttonDark: true,
      footer: foot,
    });
  } else if (kind === "accepted-set" || kind === "set-later" || kind === "set-changed") {
    const changed = kind === "set-changed";
    const subject = changed
      ? `Your set has changed: you're now playing ${setLabel} on ${short}`
      : (oneSet ? `You're playing at ${venueName} on ${short}` : `You're playing ${setLabel} at ${venueName} on ${short}`);
    const lead = changed
      ? `${escapeHtml(booker)} has changed the running order for ${escapeHtml(name)}. ${escapeHtml(act)} is now playing <b>${escapeHtml(setLine)} on ${escapeHtml(when)}</b>${was?.label ? `, instead of ${escapeHtml(was.label)}${was.range ? ` at ${escapeHtml(String(was.range).split("–")[0])}` : ""}` : ""}. Everything else stays the same.`
      : (kind === "set-later"
        ? `${escapeHtml(booker)} has confirmed your set for ${escapeHtml(name)}: you're playing <b>${escapeHtml(setLine)} on ${escapeHtml(when)}</b>.`
        : `Good news. ${escapeHtml(booker)} has accepted ${escapeHtml(act)} for ${escapeHtml(name)}, and you're playing <b>${escapeHtml(setLine)} on ${escapeHtml(when)}</b>.`);
    const ics = icsEvent({
      uid: `gigin-${rootId}-${app.id}@giginmusic.com`,
      sequence: Number(app.calendarSequence) || 0,
      summary: `${act} at ${venueName}`,
      start: slotMoment(gig, assigned, false),
      end: slotMoment(gig, assigned, true),
      location: address,
      description: setLine,
    });
    rendered = renderArtistEmail({
      subject,
      preheader: changed ? `${escapeHtml(setLine)}. Everything else stays the same.` : `${escapeHtml(setLine)}.${door ? ` Doors ${escapeHtml(door)}.` : ""}`,
      eyebrow: changed ? "SET CHANGED" : "YOU'RE BOOKED",
      brand: { name: venueName, imageUrl: markUrl },
      ...(kind === "accepted-set" ? { bookerName: booker, bookerPhotoUrl } : {}),
      heading: changed ? `You're now playing ${escapeHtml(setLabel)}` : `You're playing ${escapeHtml(name)}`,
      paras: [changed ? `${hi} ${lead}` : `Hi ${escapeHtml(first)}, we loved your music and would love to have you on ${escapeHtml(short)}. Here's everything you need.`],
      boxes: [{
        label: changed ? "YOUR NEW SET" : "YOUR SET",
        green: true,
        rows: [
          ["Your set", escapeHtml([setLabel, range, minutes].filter(Boolean).join(" · "))],
          was?.label ? ["Was", escapeHtml([was.label, was.range].filter(Boolean).join(" · ")), true] : null,
          door ? ["Arrive by", escapeHtml(door)] : null,
          where ? ["Where", escapeHtml(where)] : null,
        ].filter(Boolean),
      }],
      pre: changed
        ? `If the new time doesn't work, let ${escapeHtml(booker)} know from your private link.`
        : `Can't make it after all? Just reply to this email and let ${escapeHtml(booker)} know.`,
      callout: kind === "accepted-set" ? promoCallout(gig, app) : null,
      button: kind === "accepted-set" ? ["Send your promo", url] : ["View your booking", url],
      buttonDark: kind === "accepted-set",
      small: changed ? "We've attached an updated calendar file. It replaces the earlier one." : "We've attached a calendar file (gigin-set.ics) with your set time.",
      footer: `Sent by Gigin for ${escapeHtml(venueName)}.`,
    });
    rendered.attachments = icsAttachment(ics);
  } else if (kind === "unset") {
    rendered = renderArtistEmail({
      subject: `Your set time is to be confirmed: ${name}`,
      preheader: `You're still playing at ${venueName}.`,
      eyebrow: "SET UPDATE",
      heading: "Your set time is to be confirmed",
      paras: [hi, `You're still playing at ${escapeHtml(venueName)} on ${escapeHtml(when)}, but ${escapeHtml(booker)} has changed the running order. We'll email you as soon as your new set time is confirmed.`],
      button: ["View your booking", url],
      footer: foot,
    });
  } else if (kind === "declined") {
    const nudge = await keepReminderHtml({
      email: app.email,
      artistProfileId: app.artistProfileId,
      keepProfileOffer: app.keepProfileOffer,
      gigId: app.gigId || rootId,
      applicantId: app.id,
      actName: act,
      venueName,
    });
    const keepUrl = nudge.match(/href="([^"]+)"/)?.[1] || "";
    const openGigs = await listOtherOpenGigs({
      excludeIds: [rootId, ...(slots || []).map((slot) => slotGigId(slot) || slot.id)],
    });
    const kindWord = String(app.kindWord || "").trim();
    rendered = declinedApplicationMessage({
      firstName: first,
      booker,
      venueName,
      gigName: name,
      when: formatShort(gigDate(gig)),
      kindWord,
      openGigs,
      venueUrl,
      markUrl,
      bookerPhotoUrl,
      extra: keepUrl ? { title: "Keep your details for next time?", body: "Turn this application into a Gigin profile with a link you can send to other venues. You'll create a password when you confirm.", link: ["Keep my profile", keepUrl] } : null,
    });
  } else if (kind === "cancelled-accepted" || kind === "cancelled-waiting") {
    const why = String(reason || "").trim();
    const booked = kind === "cancelled-accepted";
    rendered = renderArtistEmail({
      subject: booked
        ? `${venueName} has cancelled ${name} on ${short}`
        : `This night has been cancelled: ${name} on ${short}`,
      preheader: `${escapeHtml(venueName)} has cancelled ${escapeHtml(name)} on ${escapeHtml(short)}.`,
      eyebrow: "NIGHT CANCELLED",
      heading: booked
        ? `${escapeHtml(venueName)} has cancelled ${escapeHtml(name)}`
        : "This night has been cancelled",
      paras: [
        hi,
        booked
          ? `${escapeHtml(booker)} at ${escapeHtml(venueName)} has cancelled ${escapeHtml(name)} on <b>${escapeHtml(when)}</b>.`
          : `${escapeHtml(venueName)} has cancelled ${escapeHtml(name)} on <b>${escapeHtml(when)}</b>. This night has been cancelled.`,
        why ? escapeHtml(why) : null,
      ].filter(Boolean),
      button: token ? ["View your application", url] : ["View the night", url],
      footer: foot,
    });
  } else if (kind === "venue-withdraw") {
    const open = app._freedSet ? `${escapeHtml(app._freedSet)} is open again. ` : "";
    legacy = {
      subject: `${act} can't play on ${short}`,
      inner: `<p>${escapeHtml(act)} has withdrawn from ${escapeHtml(name)}. ${open}You can give it to someone you've accepted, or accept someone who's waiting.</p>`,
      button: "Open the gig",
    };
  }
  if ((kind === "accepted-later" || kind === "accepted-set") && rendered) {
    const nudge = await keepReminderHtml({
      email: app.email,
      artistProfileId: app.artistProfileId,
      keepProfileOffer: app.keepProfileOffer,
      gigId: app.gigId || rootId,
      applicantId: app.id,
      actName: act,
      venueName,
    });
    const keepUrl = nudge.match(/href="([^"]+)"/)?.[1] || "";
    if (keepUrl) {
      const block = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="box" style="margin:4px 0 18px;background:#F6F7F9;border:1px solid #F0F1F3;border-radius:12px;"><tr><td style="padding:14px 16px;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><div class="ink" style="font-size:15px;line-height:22px;font-weight:600;color:#0F1115;">Keep your details for next time?</div><div class="muted" style="font-size:14px;line-height:21px;color:#4B5160;padding:2px 0 8px;">Turn this application into a Gigin profile with a link you can send to other venues. You'll create a password when you confirm.</div><a class="link" href="${keepUrl}" style="font-size:14.5px;font-weight:600;color:#B5462C;">Keep my profile →</a></td></tr></table>`;
      rendered.html = rendered.html.replace("</td></tr>\n<tr><td class=\"muted\"", `${block}</td></tr>\n<tr><td class="muted"`);
      rendered.text += `\n\nKeep your details for next time?\n${keepUrl}\n`;
    }
  }
  const from = "Gigin <noreply@giginmusic.com>";
  if (legacy) {
    return {
      to: null,
      from,
      message: {
        subject: legacy.subject,
        text: legacy.inner.replace(/<[^>]+>/g, " "),
        html: emailShell({ title: legacy.subject, inner: legacy.inner, buttonLabel: legacy.button, buttonUrl: reviewUrl(rootId) }),
      },
    };
  }
  return {
    to: app.email || null,
    from,
    message: rendered || { subject: name, text: "", html: "" },
  };
}

async function mailAct(kind, ctx) {
  const built = await emailForAct({ ...ctx, kind });
  if (!built.to) return null;
  const delay = (kind === "declined" || kind === "cancelled-accepted" || kind === "cancelled-waiting")
    ? DECLINE_DELAY_MS
    : (kind === "received" || kind === "venue-withdraw" ? 0 : DELAY_MS);
  if (delay === 0) {
    await queueMail(built);
    return null;
  }
  return queueDelayedMail({ ...built, delayMs: delay });
}

function stampUndo(app, mailIds, previous) {
  app.undo = {
    until: new Date(Date.now() + DELAY_MS).toISOString(),
    mailIds: mailIds.filter(Boolean),
    status: previous.status,
    assignedSlotGigId: previous.assignedSlotGigId || null,
  };
}

export async function acceptApplication({ gigId, applicantId, slotGigId, deferSet = false }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  const { night, app } = findApp(slots, applicantId);
  if (!app || !root) {
    const error = new Error("Application not found.");
    error.statusCode = 404;
    throw error;
  }
  assertNightNotCancelled(slots);
  if (isWithdrawn(app)) throw withdrawnRefusal();
  if (canonicalStatus(app.status) === "declined") {
    const error = new Error("This act has been declined.");
    error.statusCode = 409;
    throw error;
  }
  const views = night.slots;
  const oneSet = views.length < 2;
  let target = slotGigId || null;
  // "Choose later" sends slotGigId: null. That must stay unassigned, including
  // when this gig is the only slot the server could load. A one-set accept
  // that omits the field still lands on the only open set.
  if (!deferSet && oneSet && !target && !views[0]?.taken) target = views[0].gigId;
  if (target && !views.some((slot) => slot.gigId === target)) {
    const error = new Error("That set is not part of this gig.");
    error.statusCode = 400;
    throw error;
  }
  const targetSlot = target ? views.find((slot) => slot.gigId === target) : null;
  if (targetSlot?.taken && String(targetSlot.bookedApplicantId || "") !== String(applicantId)) {
    const error = new Error("That set has already been booked.");
    error.statusCode = 409;
    throw error;
  }
  const priv = await readPrivate(rootId, applicantId);
  const previous = { status: canonicalStatus(app.status), assignedSlotGigId: app.assignedSlotGigId || null };
  const next = {
    ...priv,
    ...app,
    status: "accepted",
    viewed: true,
    acceptedAt: new Date().toISOString(),
    assignedSlotGigId: target,
    assignedAt: target ? new Date().toISOString() : null,
    email: app.email || priv.email || null,
    manageToken: priv.manageToken || app.manageToken || null,
  };
  const venue = await loadVenue(root.data.venueId);
  if (next.artistProfileId || next.linkedArtistId) {
    await appendPlayedAt({
      profileId: next.artistProfileId || next.linkedArtistId,
      venueId: root.data.venueId,
      venueName: venue?.name || venue?.venueName || "",
      city: venue?.address?.city || venue?.city || "",
      gigId: root.id,
      date: root.data.startDateTime || root.data.date || null,
    });
  }
  const mailId = await mailAct(target ? (previous.status === "accepted" ? "set-later" : "accepted-set") : "accepted-later", {
    app: next,
    slots: views,
    venue,
    gig: root.data,
    token: next.manageToken,
    later: previous.status === "accepted",
  });
  stampUndo(next, [mailId], previous);
  await commitApps({
    slots,
    rootId,
    apps: [next],
    applicantId,
    privatePatch: isGuestApplicant(next) ? guestPrivate({ ...next, id: applicantId }, rootId) : null,
  });
  const label = target ? setName(views, target) : null;
  return {
    ok: true,
    toast: label
      ? `${actName(next)} accepted for ${label}. We've emailed them their set time.`
      : `${actName(next)} accepted. We've told them their set time is still to be confirmed.`,
    undo: { applicationId: applicantId },
  };
}

export async function assignApplication({ gigId, applicantId, slotGigId }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  assertNightNotCancelled(slots);
  const { night, app } = findApp(slots, applicantId);
  if (isWithdrawn(app)) throw withdrawnRefusal();
  const planned = planAssignment(night.applications, applicantId, slotGigId || null);
  if (planned.error) {
    const error = new Error(planned.error);
    error.statusCode = 400;
    throw error;
  }
  const views = night.slots;
  if (slotGigId && !views.some((slot) => slot.gigId === slotGigId)) {
    const error = new Error("That set is not part of this gig.");
    error.statusCode = 400;
    throw error;
  }
  const venue = await loadVenue(root.data.venueId);
  const changed = [planned.applications.find((entry) => String(entry.id) === String(applicantId))];
  if (planned.displaced) changed.push(planned.displaced);
  const mailIds = [];
  for (const app of changed) {
    const priv = await readPrivate(rootId, app.id);
    app.email = app.email || priv.email || null;
    app.manageToken = priv.manageToken || app.manageToken || null;
    app.contactName = app.contactName || priv.contactName || "";
    const hadSet = app === changed[0] ? planned.previous : (planned.displaced ? slotGigId : null);
    let kind = "accepted-set";
    if (!app.assignedSlotGigId) kind = "unset";
    else if (hadSet && hadSet !== app.assignedSlotGigId) kind = "set-changed";
    else if (app !== changed[0]) kind = "set-changed";
    else kind = "set-later";
    if (kind === "set-changed" && hadSet) {
      const previousSlot = views.find((slot) => slot.gigId === hadSet);
      app.setChangedFrom = {
        slotGigId: hadSet,
        label: setName(views, hadSet),
        range: previousSlot ? clockRange(previousSlot) : "",
      };
      app.setChangeSeenAt = null;
      app.calendarSequence = Number(priv.calendarSequence || app.calendarSequence || 0) + 1;
    } else if (kind === "accepted-set" || kind === "set-later") {
      app.calendarSequence = Number(priv.calendarSequence || app.calendarSequence || 0);
    }
    const mailId = await mailAct(kind, { app, slots: views, venue, gig: root.data, token: app.manageToken });
    mailIds.push(mailId);
    if (isGuestApplicant(app)) {
      await db.doc(`gigs/${rootId}/guestApplicants/${app.id}`).set(guestPrivate(app, rootId), { merge: true });
    }
  }
  const primary = changed[0];
  stampUndo(primary, mailIds, { status: "accepted", assignedSlotGigId: planned.previous });
  if (planned.displaced) {
    stampUndo(planned.displaced, mailIds, { status: "accepted", assignedSlotGigId: slotGigId || null });
  }
  await commitApps({ slots, rootId, apps: changed, applicantId: null, privatePatch: null });
  const name = actName(primary);
  let toast = `${name} removed from ${setName(views, planned.previous)}. They're still accepted, with no set yet.`;
  if (primary.assignedSlotGigId && planned.displaced) {
    toast = `${name} is now on ${setName(views, primary.assignedSlotGigId)}. ${actName(planned.displaced)} moved to ${planned.displaced.assignedSlotGigId ? setName(views, planned.displaced.assignedSlotGigId) : "no set"}. We'll email both.`;
  } else if (primary.assignedSlotGigId) {
    toast = `${name} assigned to ${setName(views, primary.assignedSlotGigId)}. We'll email them their set time.`;
  }
  return { ok: true, toast, undo: { applicationId: applicantId } };
}

export async function declineApplication({ gigId, applicantId, kindWord }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  assertNightNotCancelled(slots);
  const { night, app } = findApp(slots, applicantId);
  if (!app) {
    const error = new Error("Application not found.");
    error.statusCode = 404;
    throw error;
  }
  const priv = await readPrivate(rootId, applicantId);
  const previous = { status: canonicalStatus(app.status), assignedSlotGigId: app.assignedSlotGigId || null };
  const next = {
    ...priv,
    ...app,
    status: "declined",
    viewed: true,
    declinedAt: new Date().toISOString(),
    declineEmailSendAt: new Date(Date.now() + DECLINE_DELAY_MS).toISOString(),
    assignedSlotGigId: null,
    email: app.email || priv.email || null,
    manageToken: priv.manageToken || null,
    kindWord: String(kindWord || app.kindWord || priv.kindWord || "").trim().slice(0, 500),
  };
  const venue = await loadVenue(root.data.venueId);
  const mailId = await mailAct("declined", { app: next, slots: night.slots, venue, gig: root.data, token: next.manageToken });
  next.undo = {
    until: next.declineEmailSendAt,
    mailIds: [mailId].filter(Boolean),
    status: previous.status,
    assignedSlotGigId: previous.assignedSlotGigId,
  };
  await commitApps({
    slots,
    rootId,
    apps: [next],
    applicantId,
    privatePatch: isGuestApplicant(next) ? guestPrivate(next, rootId) : null,
  });
  return {
    ok: true,
    toast: `${actName(next)} declined. They'll get a polite email in 5 minutes.`,
    undo: { applicationId: applicantId },
  };
}

export async function undoApplication({ gigId, applicantId }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  assertNightNotCancelled(slots);
  const { app } = findApp(slots, applicantId);
  if (isWithdrawn(app)) throw withdrawnRefusal();
  if (!app?.undo?.until || new Date(app.undo.until).getTime() < Date.now()) {
    const error = new Error("That can't be undone now.");
    error.statusCode = 409;
    throw error;
  }
  for (const id of app.undo.mailIds || []) await cancelMail(id);
  const priv = await readPrivate(rootId, applicantId);
  const restored = {
    ...priv,
    ...app,
    status: app.undo.status || "pending",
    assignedSlotGigId: app.undo.assignedSlotGigId || null,
    declineEmailSendAt: null,
    undo: null,
  };
  const also = [];
  if (restored.assignedSlotGigId) {
    const occupant = findApp(slots, applicantId).night.applications.find((entry) => (
      entry.assignedSlotGigId === restored.assignedSlotGigId && String(entry.id) !== String(applicantId)
    ));
    if (occupant?.undo && !isWithdrawn(occupant)) {
      also.push({ ...occupant, assignedSlotGigId: occupant.undo.assignedSlotGigId || null, undo: null, status: occupant.undo.status || "accepted" });
    }
  }
  await commitApps({
    slots,
    rootId,
    apps: [restored, ...also],
    applicantId,
    privatePatch: isGuestApplicant(restored) ? { ...guestPrivate(restored, rootId), undo: FieldValue.delete(), declineEmailSendAt: null } : null,
  });
  return { ok: true };
}

export async function closeApplications({ gigId, declineWaiting }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  assertNightNotCancelled(slots);
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  const night = readNight(slots.map((slot) => slotView(slot)));
  const waiting = declineWaiting
    ? night.applications.filter((entry) => canonicalStatus(entry.status) === "pending")
    : [];
  const venue = await loadVenue(root.data.venueId);
  const declined = [];
  const mailIds = [];
  for (const app of waiting) {
    const priv = await readPrivate(rootId, app.id);
    const next = {
      ...priv,
      ...app,
      status: "declined",
      viewed: true,
      declinedAt: new Date().toISOString(),
      assignedSlotGigId: null,
      email: app.email || priv.email || null,
      manageToken: priv.manageToken || null,
    };
    const mailId = await mailAct("declined", { app: next, slots: night.slots, venue, gig: root.data, token: next.manageToken });
    mailIds.push(mailId);
    next.undo = { until: new Date(Date.now() + DELAY_MS).toISOString(), mailIds: [mailId].filter(Boolean), status: "pending", assignedSlotGigId: null };
    declined.push(next);
  }
  const next = mergeChanged(night.applications, declined);
  const closeUndo = {
    until: new Date(Date.now() + DELAY_MS).toISOString(),
    mailIds: mailIds.filter(Boolean),
    applicantIds: declined.map((entry) => entry.id),
  };
  await db.runTransaction(async (tx) => {
    for (const slot of slots) await tx.get(slot.ref);
    for (const write of projectNight(slots, rootId, next)) {
      tx.update(write.ref, { ...write.patch, applicationsOpen: false, applicationsRootGigId: rootId });
    }
    tx.set(db.doc(`gigs/${rootId}/private/applications`), {
      gigId: rootId,
      applicants: next.map(operationalApplicant).filter(Boolean),
      closeUndo,
    }, { merge: true });
  });
  const n = declined.length;
  return {
    ok: true,
    toast: `Applications closed.${n ? ` ${n} ${n === 1 ? "act" : "acts"} will get a polite no.` : ""}`,
    undo: { applicationId: null, close: true },
  };
}

export async function undoClose({ gigId }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  assertNightNotCancelled(slots);
  const root = slots.find((slot) => slot.id === rootId);
  const undo = root?.data?.closeUndo;
  if (!undo?.until || new Date(undo.until).getTime() < Date.now()) {
    const error = new Error("That can't be undone now.");
    error.statusCode = 409;
    throw error;
  }
  for (const id of undo.mailIds || []) await cancelMail(id);
  const restored = [];
  for (const id of undo.applicantIds || []) {
    const { app } = findApp(slots, id);
    if (!app || isWithdrawn(app)) continue;
    restored.push({ ...app, status: "pending", undo: null, declineEmailSendAt: null });
  }
  const current = readNight(slots.map((slot) => slotView(slot))).applications;
  const next = mergeChanged(current, restored);
  await db.runTransaction(async (tx) => {
    for (const slot of slots) await tx.get(slot.ref);
    for (const write of projectNight(slots, rootId, next)) {
      tx.update(write.ref, { ...write.patch, applicationsOpen: true });
    }
    tx.set(db.doc(`gigs/${rootId}/private/applications`), {
      gigId: rootId,
      applicants: next.map(operationalApplicant).filter(Boolean),
      closeUndo: FieldValue.delete(),
    }, { merge: true });
  });
  return { ok: true };
}

export async function reopenApplications({ gigId }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  assertNightNotCancelled(slots);
  const batch = db.batch();
  for (const slot of slots) {
    batch.update(slot.ref, { applicationsOpen: true, applicationsRootGigId: rootId });
  }
  await batch.commit();
  return { ok: true };
}

async function assertCanEditNight(callerUid, venueId) {
  if (!callerUid) {
    const error = new Error("PERMISSION_DENIED");
    error.code = "permission-denied";
    error.statusCode = 401;
    throw error;
  }
  await assertVenuePerm(db, callerUid, venueId, "gigs.update");
  await assertVenueCanPublishNights(venueId);
}

function cancelKind(app) {
  const status = canonicalStatus(app?.status);
  if (status === "accepted") return "cancelled-accepted";
  if (status === "pending") return "cancelled-waiting";
  return null;
}

export async function cancelNight({ gigId, reason, callerUid }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  if (!root) {
    const error = new Error("Gig not found.");
    error.statusCode = 404;
    throw error;
  }
  await assertCanEditNight(callerUid, root.data.venueId);
  if (nightIsCancelled(slots)) return { ok: true, already: true };
  const night = readNight(slots.map((slot) => slotView(slot)));
  const venue = await loadVenue(root.data.venueId);
  const note = String(reason || "").trim().slice(0, 500);
  const mailIds = [];
  let accepted = 0;
  let waiting = 0;
  for (const app of night.applications) {
    const kind = cancelKind(app);
    if (!kind) continue;
    if (kind === "cancelled-accepted") accepted += 1;
    else waiting += 1;
    const priv = await readPrivate(rootId, app.id);
    const next = {
      ...app,
      email: app.email || priv.email || null,
      manageToken: priv.manageToken || app.manageToken || null,
      contactName: app.contactName || priv.contactName || "",
    };
    const mailId = await mailAct(kind, {
      app: next,
      slots: night.slots,
      venue,
      gig: root.data,
      token: next.manageToken,
      reason: note,
    });
    if (mailId) mailIds.push(mailId);
  }
  const cancelUndo = {
    until: new Date(Date.now() + DECLINE_DELAY_MS).toISOString(),
    mailIds,
    reason: note,
    slots: slots.map((slot) => ({
      id: slot.id,
      status: slot.data.status || "open",
      applicationsOpen: slot.data.applicationsOpen !== false,
    })),
  };
  await db.runTransaction(async (tx) => {
    for (const slot of slots) await tx.get(slot.ref);
    for (const write of projectNight(slots, rootId, night.applications, { cancelled: true })) {
      tx.update(write.ref, {
        ...write.patch,
        status: "cancelled",
        applicationsOpen: false,
        cancellationReason: note || FieldValue.delete(),
        cancelledAt: new Date().toISOString(),
      });
    }
    tx.set(db.doc(`gigs/${rootId}/private/applications`), {
      gigId: rootId,
      applicants: night.applications.map(operationalApplicant).filter(Boolean),
      cancelUndo,
    }, { merge: true });
  });
  return { ok: true, accepted, waiting, undoUntil: cancelUndo.until };
}

export async function undoCancelNight({ gigId, callerUid }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  if (!root) {
    const error = new Error("Gig not found.");
    error.statusCode = 404;
    throw error;
  }
  await assertCanEditNight(callerUid, root.data.venueId);
  const undo = root.data.cancelUndo;
  if (!undo?.until || new Date(undo.until).getTime() < Date.now()) {
    const error = new Error("That can't be undone now.");
    error.statusCode = 409;
    throw error;
  }
  for (const id of undo.mailIds || []) await cancelMail(id);
  const previous = new Map((undo.slots || []).map((slot) => [slot.id, slot]));
  const night = readNight(slots.map((slot) => slotView(slot)));
  await db.runTransaction(async (tx) => {
    for (const slot of slots) await tx.get(slot.ref);
    for (const write of projectNight(slots, rootId, night.applications)) {
      const prior = previous.get(write.id) || {};
      tx.update(write.ref, {
        ...write.patch,
        status: prior.status || "open",
        applicationsOpen: prior.applicationsOpen !== false,
        cancellationReason: FieldValue.delete(),
        cancelledAt: FieldValue.delete(),
      });
    }
    tx.set(db.doc(`gigs/${rootId}/private/applications`), {
      gigId: rootId,
      applicants: night.applications.map(operationalApplicant).filter(Boolean),
      cancelUndo: FieldValue.delete(),
    }, { merge: true });
  });
  return { ok: true };
}

export async function saveSoundTech({ gigId, soundTech }) {
  const { rootId } = await loadNightSlots(gigId);
  const value = soundTech && soundTech.name
    ? {
      name: String(soundTech.name).trim(),
      role: String(soundTech.role || "House engineer").trim(),
      phone: String(soundTech.phone || "").trim(),
      arrives: String(soundTech.arrives || "").trim(),
    }
    : null;
  const batch = db.batch();
  batch.set(db.doc(`gigs/${rootId}`), { soundTech: FieldValue.delete() }, { merge: true });
  batch.set(db.doc(`gigs/${rootId}/private/details`), { soundTech: value }, { merge: true });
  await batch.commit();
  return { ok: true, soundTech: value };
}

export async function placeLoggedInApplication({ gigId, application, preferredSlotGigIds }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  if (!root) return { applicants: null, rootGigId: null };
  const requested = slots.find((slot) => slot.id === gigId) || root;
  assertNightNotCancelled(slots);
  if (requested.data.applicationsOpen === false || root.data.applicationsOpen === false) {
    const error = new Error("Applications for this gig are closed.");
    error.statusCode = 409;
    error.code = "APPLICATIONS_CLOSED";
    throw error;
  }
  const night = readNight(slots.map((slot) => slotView(slot)));
  if (night.slots.length && night.slots.every((slot) => slot.taken)) {
    const error = new Error("This gig is no longer accepting applications.");
    error.statusCode = 409;
    error.code = "GIG_SLOT_FILLED";
    throw error;
  }
  const existing = night.applications.find((entry) => String(entry.id) === String(application.id));
  let preferred = existing?.preferredSlotGigIds || [];
  if (Array.isArray(preferredSlotGigIds)) {
    const prefCheck = preferenceFromBody({ preferredSlotGigIds }, slots);
    if (prefCheck.error) {
      const error = new Error(prefCheck.error);
      error.statusCode = 400;
      throw error;
    }
    preferred = prefCheck.preferredSlotGigIds;
  }
  const next = {
    ...(existing || {}),
    ...application,
    id: application.id,
    status: existing ? canonicalStatus(existing.status) : "pending",
    preferredSlotGigIds: preferred,
    assignedSlotGigId: existing?.assignedSlotGigId || null,
    timestamp: existing?.timestamp || application.timestamp || new Date().toISOString(),
  };
  await commitApps({ slots, rootId, apps: [next], applicantId: null, privatePatch: null });
  if (!existing && root.data.venueId) {
    await notifyVenueOfNewApplication({
      venueId: root.data.venueId,
      app: next,
      slots: night.slots,
      gig: root.data,
      rootId,
    });
  }
  const stored = await loadPrivateApplications(rootId);
  const list = stored?.applicants || [];
  const lineup = publicLineup(list, rootId);
  const mine = list.find((entry) => String(entry.id) === String(application.id));
  const applicants = mine && !lineup.some((entry) => String(entry.id) === String(mine.id))
    ? [...lineup, mine]
    : lineup;
  return { applicants, rootGigId: rootId };
}

export async function readNightApplications(gigId) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const night = readNight(slots.map((slot) => slotView(slot)));
  return { slots, rootId, applications: night.applications };
}

export async function publishNightApplicants(gigId, applicants) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const list = Array.isArray(applicants) ? applicants : [];
  const writes = projectNight(slots, rootId, list);
  const operational = list.map(operationalApplicant).filter(Boolean);
  const batch = db.batch();
  for (const write of writes) batch.update(write.ref, write.patch);
  batch.set(db.doc(`gigs/${rootId}/private/applications`), {
    gigId: rootId,
    applicants: operational,
  }, { merge: true });
  await batch.commit();
  return { rootId, applicants: operational };
}

export async function writeGuestApplication({ gigId, applicant, preferredSlotGigIds }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const pref = preferenceFromBody({ preferredSlotGigIds }, slots);
  if (pref.error) {
    const error = new Error(pref.error);
    error.statusCode = 400;
    throw error;
  }
  const root = slots.find((slot) => slot.id === rootId);
  if (!root) {
    const error = new Error("Gig not found.");
    error.statusCode = 404;
    throw error;
  }
  assertNightNotCancelled(slots);
  if (root.data.applicationsOpen === false || slots.some((slot) => (
    (slot.id === gigId || pref.preferredSlotGigIds.includes(slot.id)) && slot.data.applicationsOpen === false
  ))) {
    const error = new Error("Applications for this gig are closed.");
    error.statusCode = 409;
    throw error;
  }
  const next = {
    ...applicant,
    id: applicant.id || applicant.applicationId,
    preferredSlotGigIds: pref.preferredSlotGigIds,
    assignedSlotGigId: applicant.assignedSlotGigId || null,
    status: applicant.status || "pending",
  };
  await commitApps({
    slots,
    rootId,
    apps: [next],
    applicantId: next.id,
    privatePatch: guestPrivate(next, rootId),
  });
  const views = sortSlots(slots.map((slot) => ({ ...slotView(slot), applicants: [] })));
  return { rootId, preferredSlotGigIds: pref.preferredSlotGigIds, slots: views };
}

export async function withdrawGuestApplication({ gigId, applicant }) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  const wasAccepted = ["accepted", "confirmed", "paid"].includes(String(applicant.status || "").toLowerCase());
  const freed = applicant.assignedSlotGigId || null;
  const views = readNight(slots.map((slot) => slotView(slot))).slots;
  const next = {
    ...applicant,
    status: "withdrawn",
    withdrawnAt: new Date().toISOString(),
    withdrawnAfterAccept: wasAccepted,
    assignedSlotGigId: null,
    lastSlotGigId: freed || applicant.lastSlotGigId || null,
    updatedAt: new Date().toISOString(),
  };
  await commitApps({
    slots,
    rootId,
    apps: [next],
    applicantId: next.id,
    privatePatch: isGuestApplicant(next) ? guestPrivate(next, rootId) : null,
  });
  if (wasAccepted && (next.artistProfileId || next.linkedArtistId)) {
    await markBookingCancelled({
      profileId: next.artistProfileId || next.linkedArtistId,
      venueId: root?.data?.venueId,
      gigId: rootId,
      date: root?.data?.startDateTime || root?.data?.date || null,
    });
  }
  if (wasAccepted && root) {
    const venue = await loadVenue(root.data.venueId);
    const inbox = await venueInbox(venue);
    next._freedSet = freed ? setName(views, freed) : "";
    const built = await emailForAct({
      kind: "venue-withdraw",
      app: next,
      slots: views,
      venue,
      gig: root.data,
      token: null,
    });
    if (inbox) await queueMail({ to: inbox, message: built.message });
  }
  return next;
}
