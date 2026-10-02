/* eslint-disable */
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";
import { earliestFlush, planFlush, planRecipientWindow } from "./applicationEmailPlan.js";

const ORIGIN = process.env.PUBLIC_APP_URL || "https://giginmusic.com";
const LOGO = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";
const FROM = "Gigin <notifications@giginmusic.com>";
const ZONE = "Europe/London";

export async function ingestNewApplicants(gigId, applicantIds) {
  const ids = [...new Set((applicantIds || []).filter(Boolean))];
  if (!gigId || !ids.length) return;
  const gigRef = db.collection("gigs").doc(gigId);
  const preview = await gigRef.get();
  if (!preview.exists) return;
  const gig = { gigId, ...preview.data() };
  const recipients = await loadRecipients(gig.venueId);
  if (!recipients.length) return;
  const context = await loadNightContext(gig, ids);
  await commitWindow(gigRef, recipients, ids, context, false);
}

export async function flushDueApplicationEmails() {
  const snap = await db.collection("gigs")
    .where("applicationEmailWindow._flushAt", "<=", Timestamp.now())
    .limit(40)
    .get();
  for (const doc of snap.docs) {
    try {
      await flushGig(doc.id, doc.data() || {});
    } catch (error) {
      console.error("Application email flush failed", doc.id, error);
    }
  }
}

async function flushGig(gigId, data) {
  const gigRef = db.collection("gigs").doc(gigId);
  const windows = readWindows(data.applicationEmailWindow);
  const queued = [...new Set(Object.values(windows).flatMap((entry) => entry.queued || []))];
  if (!queued.length) {
    await gigRef.update({ applicationEmailWindow: FieldValue.delete() }).catch(() => {});
    return;
  }
  const recipients = await loadRecipients(data.venueId);
  const context = await loadNightContext({ gigId, ...data }, queued);
  await commitWindow(gigRef, recipients, [], context, true);
}

async function commitWindow(gigRef, recipients, applicantIds, context, flushing) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(gigRef);
    if (!snap.exists) return;
    const current = snap.data() || {};
    const viewed = viewedIds(current);
    const windows = readWindows(current.applicationEmailWindow);
    const now = Date.now();
    const mails = [];
    const known = new Map(recipients.map((recipient) => [recipient.uid, recipient]));
    const uids = flushing ? Object.keys(windows) : recipients.map((recipient) => recipient.uid);
    for (const uid of uids) {
      const recipient = known.get(uid);
      if (!recipient) {
        if (flushing) delete windows[uid];
        continue;
      }
      const plan = flushing
        ? planFlush({ now, window: windows[uid], viewedIds: viewed })
        : planRecipientWindow({ now, window: windows[uid], applicantIds, viewedIds: viewed });
      if (plan.window) windows[uid] = plan.window;
      else delete windows[uid];
      for (const send of plan.sends) {
        const mail = renderMail(context, send, recipient);
        if (mail) mails.push(mail);
      }
    }
    writeWindows(tx, gigRef, windows);
    mails.forEach((mail) => tx.set(db.collection("mail").doc(), mail));
  });
}

function writeWindows(tx, ref, windows) {
  const stored = {};
  for (const [uid, entry] of Object.entries(windows)) {
    if (!entry) continue;
    stored[uid] = { until: entry.until, queued: entry.queued || [] };
  }
  const flushAt = earliestFlush(stored);
  if (!Object.keys(stored).length) {
    tx.update(ref, { applicationEmailWindow: FieldValue.delete() });
    return;
  }
  if (flushAt) stored._flushAt = Timestamp.fromMillis(flushAt);
  tx.update(ref, { applicationEmailWindow: stored });
}

function readWindows(raw) {
  const windows = {};
  if (!raw || typeof raw !== "object") return windows;
  for (const [uid, entry] of Object.entries(raw)) {
    if (uid === "_flushAt" || !entry || typeof entry !== "object") continue;
    windows[uid] = {
      until: toMillis(entry.until),
      queued: Array.isArray(entry.queued) ? entry.queued.filter(Boolean) : [],
    };
  }
  return windows;
}

function viewedIds(gig) {
  const ids = new Set();
  for (const applicant of gig.applicants || []) {
    if (applicant?.id && applicant.viewed === true) ids.add(applicant.id);
  }
  return ids;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (Number.isFinite(value.seconds)) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function loadRecipients(venueId) {
  if (!venueId) return [];
  const venueSnap = await db.doc(`venueProfiles/${venueId}`).get();
  if (!venueSnap.exists) return [];
  const venue = venueSnap.data() || {};
  const ids = new Set([venue.createdBy, venue.userId].filter(Boolean));
  const members = await db.collection(`venueProfiles/${venueId}/members`).get();
  members.forEach((doc) => {
    const data = doc.data() || {};
    if (data.status && data.status !== "active") return;
    if (data.permissions?.["gigs.applications.manage"]) ids.add(doc.id);
  });
  const recipients = [];
  for (const uid of ids) {
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) continue;
    const user = userSnap.data() || {};
    if (user.emailNewApplications === false) continue;
    if (typeof user.email !== "string" || !user.email.includes("@")) continue;
    recipients.push({ uid, email: user.email, venueName: venue.name || "your venue" });
  }
  return recipients;
}

async function loadNightContext(gig, applicantIds) {
  const slots = await loadSlots(gig);
  const venueName = await venueNameFor(gig.venueId);
  const people = [];
  for (const id of applicantIds) {
    const stub = (gig.applicants || []).find((applicant) => applicant?.id === id) || { id };
    people.push(await enrichApplicant(gig.gigId, stub, slots));
  }
  const allIds = new Set();
  slots.forEach((slot) => (slot.applicants || []).forEach((applicant) => {
    if (applicant?.id) allIds.add(applicant.id);
  }));
  return {
    gigId: gig.gigId,
    name: baseName(gig),
    venueName,
    date: toDate(gig.startDateTime || gig.date),
    range: timeRange(slots),
    oneSet: slots.length < 2,
    slots,
    booked: slots.filter(slotBooked).length,
    totalSets: Math.max(slots.length, 1),
    totalApps: allIds.size || (gig.applicants || []).length,
    people: new Map(people.map((person) => [person.id, person])),
  };
}

async function loadSlots(gig) {
  const ids = new Set([gig.gigId, ...(gig.gigSlots || [])].filter(Boolean));
  const slots = [];
  for (const id of ids) {
    if (id === gig.gigId) {
      slots.push(gig);
      continue;
    }
    const snap = await db.collection("gigs").doc(id).get();
    if (snap.exists) slots.push({ gigId: id, ...snap.data() });
  }
  return slots.sort((a, b) => startMinutes(a) - startMinutes(b));
}

async function venueNameFor(venueId) {
  if (!venueId) return "";
  const snap = await db.doc(`venueProfiles/${venueId}`).get();
  return snap.exists ? (snap.data()?.name || "") : "";
}

async function enrichApplicant(gigId, stub, slots) {
  const guest = stub.type === "guest" || stub.guest === true;
  let extra = {};
  if (guest) {
    const priv = await db.doc(`gigs/${gigId}/guestApplicants/${stub.id}`).get();
    extra = priv.exists ? priv.data() || {} : {};
  } else {
    const profile = await db.doc(`artistProfiles/${stub.id}`).get();
    extra = profile.exists ? profile.data() || {} : {};
  }
  const members = Array.isArray(extra.members) ? extra.members.length : null;
  const kind = firstText(stub.kind, extra.kind, extra.musicianType, extra.actType);
  const town = firstText(stub.town, extra.town, extra.city, extra.basedIn, extra.locationLabel, extra.address?.city);
  const note = String(extra.note || extra.applicationMessage || stub.note || stub.applicationMessage || "").trim();
  return {
    id: stub.id,
    name: stub.name || stub.artistName || extra.name || extra.actName || "New act",
    guest,
    kind,
    town,
    members,
    note,
    photo: extra.photoUrl || extra.photo?.url || extra.picture || extra.heroMedia?.url || "",
    preferred: Array.isArray(stub.preferredSlotGigIds) ? stub.preferredSlotGigIds : (Array.isArray(extra.preferredSlotGigIds) ? extra.preferredSlotGigIds : []),
    at: toDate(stub.appliedAt || stub.createdAt || stub.timestamp || extra.appliedAt),
    slots,
  };
}

function renderMail(context, send, recipient) {
  const people = send.applicantIds.map((id) => context.people.get(id)).filter(Boolean);
  if (!people.length) return null;
  const built = people.length === 1 || send.kind === "single"
    ? singleEmail(context, people[0], recipient)
    : batchEmail(context, people, recipient);
  return {
    to: recipient.email,
    from: FROM,
    message: built,
  };
}

function singleEmail(context, person, recipient) {
  const when = mediumDate(context.date);
  const subject = `${person.name} applied for ${when}`;
  const preference = preferenceLine(person, context);
  const preheader = preheaderFor(person, context, preference);
  const act = actLine(person);
  const rows = [
    ["Night", [context.name, when, context.range].filter(Boolean).join(" · ")],
    context.oneSet ? null : ["Preferred set", preference || "No preference"],
    act ? ["Act", act] : null,
    ["Sets booked", `${context.booked} of ${context.totalSets}`],
  ].filter(Boolean);
  const review = `${ORIGIN}/venues/dashboard/gigs/gig-applications?gigId=${encodeURIComponent(context.gigId)}&applicant=${encodeURIComponent(person.id)}`;
  const note = person.note ? truncate(person.note, 280) : "";
  const heading = `${person.name} applied to play ${context.name}`;
  const footnote = `${context.totalApps} application${context.totalApps === 1 ? "" : "s"} so far for this night.`;
  const text = [
    heading,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    note ? `\nTheir note\n“${note}”` : "",
    "",
    `Review application: ${review}`,
    footnote,
    "",
    footerText(recipient.venueName),
  ].filter((line) => line !== null).join("\n");
  const html = shell({
    preheader,
    eyebrow: "NEW APPLICATION",
    heading,
    body: `${facts(rows)}${note ? noteBlock(note) : ""}`,
    button: "Review application",
    href: review,
    footnote,
    venueName: recipient.venueName,
  });
  return { subject, text, html };
}

function batchEmail(context, people, recipient) {
  const when = mediumDate(context.date);
  const count = people.length;
  const subject = `${count} new applications for ${when}`;
  const preheader = nameList(people.map((person) => person.name), context.name);
  const heading = `${count} new applications for ${context.name}`;
  const sub = [when, context.range, `${context.booked} of ${context.totalSets} sets booked`].filter(Boolean).join(" · ");
  const review = `${ORIGIN}/venues/dashboard/gigs/gig-applications?gigId=${encodeURIComponent(context.gigId)}&filter=new`;
  const shown = people.slice(0, 8);
  const more = people.length - shown.length;
  const footnote = `${context.totalApps} application${context.totalApps === 1 ? "" : "s"} so far for this night.`;
  const text = [
    heading,
    sub,
    "",
    ...shown.map((person) => {
      const pref = context.oneSet ? "" : (preferenceLine(person, context) || "No preference");
      return `${person.name}${person.guest ? " (Guest)" : " (On Gigin)"}${pref ? ` · ${pref}` : ""}`;
    }),
    more > 0 ? `+ ${more} more` : "",
    "",
    `Review ${count} applications: ${review}`,
    footnote,
    "",
    footerText(recipient.venueName),
  ].filter(Boolean).join("\n");
  const html = shell({
    preheader,
    eyebrow: `${count} NEW APPLICATION${count === 1 ? "" : "S"}`,
    heading,
    sub,
    body: batchList(shown, more, context),
    button: `Review ${count} application${count === 1 ? "" : "s"}`,
    href: review,
    footnote,
    venueName: recipient.venueName,
  });
  return { subject, text, html };
}

function shell({ preheader, eyebrow, heading, sub, body, button, href, footnote, venueName }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F6F7F9;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F7F9;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #E5E7EB;border-radius:16px;">
          <tr><td style="padding:28px 24px 0;">
            <img src="${LOGO}" alt="gigin." height="24" style="display:block;border:0;height:24px;width:auto;">
          </td></tr>
          <tr><td style="padding:20px 24px 0;font-family:Geist, -apple-system, 'Segoe UI', Arial, sans-serif;">
            <div style="font-family:'Geist Mono', ui-monospace, Menlo, monospace;font-size:12px;font-weight:500;letter-spacing:.06em;color:#B5462C;">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:8px 0 0;font-size:22px;line-height:28px;font-weight:600;color:#0F1115;">${escapeHtml(heading)}</h1>
            ${sub ? `<p style="margin:8px 0 0;font-size:14.5px;line-height:1.5;color:#4B5160;">${escapeHtml(sub)}</p>` : ""}
          </td></tr>
          <tr><td style="padding:20px 24px 0;font-family:Geist, -apple-system, 'Segoe UI', Arial, sans-serif;">${body}</td></tr>
          <tr><td align="center" style="padding:20px 24px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td align="center" bgcolor="#FF6C4B" style="border-radius:10px;">
                <a href="${href}" style="display:inline-block;min-width:220px;padding:14px 22px;font-family:Geist, -apple-system, 'Segoe UI', Arial, sans-serif;font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;text-align:center;border-radius:10px;">${escapeHtml(button)}</a>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 24px 28px;font-family:Geist, -apple-system, 'Segoe UI', Arial, sans-serif;font-size:13.5px;line-height:1.5;color:#6B7280;">${escapeHtml(footnote)}</td></tr>
        </table>
        <div style="max-width:600px;margin-top:14px;font-family:Geist, -apple-system, 'Segoe UI', Arial, sans-serif;font-size:12px;line-height:1.5;color:#6B7280;">
          You're getting this because you book gigs for ${escapeHtml(venueName || "your venue")} on Gigin.
          <a href="${ORIGIN}/venues/dashboard/my-venues" style="color:#6B7280;">Change email settings</a><br>
          Gigin · giginmusic.com
        </div>
      </td></tr>
    </table>
  </body></html>`;
}

function facts(rows) {
  const inner = rows.map(([label, value], index) => `
    <tr>
      <td style="padding:10px 0;border-top:${index ? "1px solid #E5E7EB" : "0"};font-size:14.5px;color:#6B7280;width:116px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-top:${index ? "1px solid #E5E7EB" : "0"};font-size:14.5px;font-weight:500;color:#0F1115;">${escapeHtml(value)}</td>
    </tr>`).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F7F9;border-radius:12px;padding:6px 16px;"><tr><td style="padding:6px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${inner}</table></td></tr></table>`;
}

function noteBlock(note) {
  return `<p style="margin:16px 0 6px;font-size:13px;color:#6B7280;">Their note</p>
    <p style="margin:0;font-size:15.5px;line-height:1.55;color:#0F1115;">“${escapeHtml(note)}”</p>`;
}

function batchList(people, more, context) {
  const rows = people.map((person, index) => {
    const pref = context.oneSet ? "" : (preferenceLine(person, context) || "No preference");
    const tag = person.guest
      ? `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border:1px solid #E5E7EB;border-radius:4px;font-size:11.5px;font-weight:500;color:#4B5160;background:#fff;">Guest</span>`
      : `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;font-size:11.5px;font-weight:500;color:#3d7a52;background:#eef8f1;">✓ On Gigin</span>`;
    const photo = person.photo && /^https?:\/\//.test(person.photo)
      ? `<img src="${escapeHtml(person.photo)}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border-radius:50%;object-fit:cover;">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:#2A2E36;color:#fff;font-size:12px;font-weight:600;line-height:36px;text-align:center;">${escapeHtml(initials(person.name))}</div>`;
    return `<tr>
      <td style="padding:12px 14px;border-top:${index ? "1px solid #E5E7EB" : "0"};">
        <table role="presentation" width="100%"><tr>
          <td width="36" valign="middle">${photo}</td>
          <td style="padding-left:10px;font-family:Geist, -apple-system, 'Segoe UI', Arial, sans-serif;">
            <div style="font-size:15px;font-weight:600;color:#0F1115;">${escapeHtml(person.name)}${tag}</div>
            ${pref ? `<div style="font-size:13.5px;color:#4B5160;margin-top:2px;">${escapeHtml(pref)}</div>` : ""}
          </td>
          <td align="right" valign="middle" style="font-family:'Geist Mono', ui-monospace, Menlo, monospace;font-size:12px;color:#6B7280;white-space:nowrap;">${escapeHtml(clock(person.at))}</td>
        </tr></table>
      </td>
    </tr>`;
  }).join("");
  const extra = more > 0 ? `<tr><td style="padding:12px 14px;border-top:1px solid #E5E7EB;font-size:13.5px;color:#4B5160;">+ ${more} more</td></tr>` : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E5E7EB;border-radius:12px;">${rows}${extra}</table>`;
}

function preferenceLine(person, context) {
  if (context.oneSet) return "";
  const ids = person.preferred || [];
  if (!ids.length) return "No preference";
  const labels = ids.map((id) => {
    const index = context.slots.findIndex((slot) => (slot.gigId || slot.id) === id);
    if (index < 0) return "";
    const slot = context.slots[index];
    const start = clockString(slot.startTime);
    const end = endClock(slot);
    const range = start && end ? ` · ${start}–${end}` : "";
    return `Set ${index + 1}${ids.length === 1 ? range : ""}`;
  }).filter(Boolean);
  if (!labels.length) return "No preference";
  if (labels.length === 1) return labels[0].startsWith("Prefers") ? labels[0] : labels[0];
  return labels.join(" or ");
}

function preheaderFor(person, context, preference) {
  const who = [person.kind, person.town ? `from ${person.town}` : ""].filter(Boolean).join(" ");
  if (context.oneSet) return who || person.name;
  if (!person.preferred?.length) return ["No preference", who].filter(Boolean).join(" · ");
  const set = preference.replace(/ · .+$/, "");
  return [`Prefers ${set}`, who].filter(Boolean).join(" · ");
}

function actLine(person) {
  const members = Number.isFinite(person.members) && person.members > 0
    ? `${person.members} ${person.members === 1 ? "member" : "members"}`
    : "";
  return [person.kind, members, person.town].filter(Boolean).join(" · ");
}

function nameList(names, gigName) {
  const clean = names.filter(Boolean);
  if (clean.length <= 3) {
    const joined = clean.length <= 1 ? (clean[0] || "Someone") : `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
    return `${joined} applied for ${gigName}.`;
  }
  return `${clean.slice(0, 3).join(", ")} and ${clean.length - 3} others applied for ${gigName}.`;
}

function footerText(venueName) {
  return `You're getting this because you book gigs for ${venueName || "your venue"} on Gigin. Change email settings: ${ORIGIN}/venues/dashboard/my-venues\nGigin · giginmusic.com`;
}

function baseName(gig) {
  return String(gig.eventName || gig.title || gig.gigName || "Gig").replace(/\s*\(Set\s+\d+\)\s*$/i, "").trim() || "Gig";
}

function slotBooked(slot) {
  if (slot.bookedApplicantId) return true;
  return (slot.applicants || []).some((applicant) => ["confirmed", "accepted", "paid"].includes(String(applicant?.status || "").toLowerCase()));
}

function startMinutes(slot) {
  const [hours, minutes] = String(slot.startTime || "").split(":");
  const h = Number(hours);
  if (!Number.isFinite(h)) return Number.POSITIVE_INFINITY;
  return h * 60 + (Number(minutes) || 0);
}

function timeRange(slots) {
  const ordered = [...slots].filter((slot) => slot.startTime).sort((a, b) => startMinutes(a) - startMinutes(b));
  if (!ordered.length) return "";
  const start = clockString(ordered[0].startTime);
  const end = endClock(ordered[ordered.length - 1]);
  return start && end ? `${start}–${end}` : start;
}

function endClock(slot) {
  if (slot.endTime) return clockString(slot.endTime);
  if (!slot.startTime || slot.duration == null) return "";
  const total = startMinutes(slot) + Number(slot.duration);
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function clockString(value) {
  const [hours, minutes] = String(value || "").split(":");
  if (!hours) return "";
  return `${hours.padStart(2, "0")}:${(minutes || "00").padStart(2, "0")}`;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") return value.toDate();
  const millis = toMillis(value);
  return millis ? new Date(millis) : null;
}

function mediumDate(date) {
  if (!date) return "the night";
  const parts = partsFor(date);
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

function clock(date) {
  if (!date) return "";
  const parts = partsFor(date);
  return `${parts.hour}:${parts.minute}`;
}

function partsFor(date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

function truncate(value, max) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}
