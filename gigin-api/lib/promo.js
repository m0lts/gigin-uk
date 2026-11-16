/** Promo asked of an accepted guest. Dates are London calendar days, YYYY-MM-DD. */

export function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (value._seconds || value.seconds) return new Date((value._seconds || value.seconds) * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function londonDayKey(value) {
  const date = value instanceof Date || (value && typeof value !== "string" && value.toDate) ? asDate(value) : asDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(key, days) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/**
 * The later of (gig − 14 days) and (acceptance + 3 days),
 * and never after the day before the gig.
 */
export function promoDueKey(gigDate, acceptedAt) {
  const gig = londonDayKey(gigDate);
  if (!gig) return "";
  const accepted = londonDayKey(acceptedAt) || gig;
  const fromGig = addDays(gig, -14);
  const fromAccept = addDays(accepted, 3);
  const later = fromAccept > fromGig ? fromAccept : fromGig;
  const cap = addDays(gig, -1);
  return later > cap ? cap : later;
}

export function promoReminderKey(dueKey) {
  return dueKey ? addDays(dueKey, -3) : "";
}

export function formatPromoDay(key) {
  if (!key) return "";
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function promoMissingParts(promo) {
  const missing = [];
  if (!String(promo?.bio || "").trim()) missing.push("a bio");
  const photos = Array.isArray(promo?.photos) ? promo.photos.filter((item) => item?.path || item?.url) : [];
  if (!photos.length) missing.push("a photo");
  const track = promo?.track;
  if (!(track?.path || String(track?.url || "").trim())) missing.push("a track");
  return missing;
}

export function promoIsIncomplete(promo) {
  return promoMissingParts(promo).length > 0;
}

const BOOKED = new Set(["accepted", "confirmed", "paid"]);

function listed(parts) {
  const items = (parts || []).filter(Boolean);
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "Maya needs a photo and a track by Thu 26 Nov." */
export function promoMissingSentence(rows) {
  return (rows || []).filter((row) => row?.name && row.missing?.length).map((row) => {
    const due = row.dueLabel ? ` by ${row.dueLabel}` : "";
    return `${row.name} needs ${listed(row.missing)}${due}.`;
  }).join(" ");
}

/** Night line, then one line of each booked act's bio. An empty set stays unannounced. */
export function promoCaption({ title, acts }) {
  const lines = [];
  if (title) lines.push(String(title));
  for (const act of acts || []) {
    if (!act?.booked) {
      lines.push("The act is still to be announced.");
      continue;
    }
    const bio = String(act.bio || "").split(/\n/).map((line) => line.trim()).find(Boolean);
    if (bio) lines.push(act.name ? `${act.name}: ${bio}` : bio);
  }
  return lines.join("\n");
}

export function promoReminderCopy({ firstName, venueName, gigName, dueLabel, manageUrl, bookerName, bookerPhotoUrl }) {
  const when = dueLabel ? ` by ${dueLabel}` : "";
  const need = `${venueName || "The venue"} still needs a bio, a photo and a track for ${gigName || "the gig"}${when}.`;
  return {
    subject: `Your promo for ${gigName || "the gig"} is due ${dueLabel || "soon"}`,
    preheader: `${venueName || "The venue"} still needs a bio, a photo and a track${when}.`,
    eyebrow: "PROMO",
    heading: "Send your promo",
    paras: [`Hi ${firstName || "there"},`, need],
    button: ["Send your promo", manageUrl],
    buttonDark: true,
    bookerName: bookerName || "",
    bookerPhotoUrl: bookerPhotoUrl || "",
    footer: `Sent by Gigin for ${venueName || "the venue"}.`,
  };
}

export function safeZipName(name) {
  return String(name || "file").replace(/[^\w.\-]+/g, "-").replace(/^\.+/, "").slice(0, 80) || "file";
}

function promoFilePath(path, applicationId) {
  const value = String(path || "");
  if (!applicationId || value.includes("..") || value.includes("\\")) return false;
  return value.startsWith(`guest-applications/${applicationId}/`);
}

/** Text file plus any stored photos and track. Links stay in the text file. */
export function promoZipPlan(acts) {
  const entries = [];
  for (const act of acts || []) {
    const folder = safeZipName(act.name || "act");
    const lines = [act.name || "Act"];
    lines.push(act.bio ? `Bio:\n${act.bio}` : "Bio: not sent");
    if (act.videoUrl) lines.push(`Video: ${act.videoUrl}`);
    if (act.played) lines.push(`Played: ${act.played}`);
    if (act.track?.url && !act.track?.path) lines.push(`Track: ${act.track.url}`);
    entries.push({ name: `${folder}/promo.txt`, text: `${lines.join("\n")}\n` });
    (act.photos || []).forEach((photo, index) => {
      if (!promoFilePath(photo?.path, act.id)) return;
      entries.push({ name: `${folder}/${index + 1}-${safeZipName(photo.name || "photo")}`, path: photo.path });
    });
    if (promoFilePath(act.track?.path, act.id)) {
      entries.push({ name: `${folder}/track-${safeZipName(act.track.name || "track")}`, path: act.track.path });
    }
  }
  return entries;
}

/** Booked acts that still owe a bio, a photo, or a track. */
export function bookedPromoWaiting(acts) {
  return (acts || []).filter((act) => {
    if (!BOOKED.has(String(act?.status || "").toLowerCase())) return false;
    if (!act?.assignedSlotGigId) return false;
    return promoIsIncomplete(act?.promo);
  }).length;
}

export function promoEditable(gigDate, now = new Date()) {
  const gig = londonDayKey(gigDate);
  if (!gig) return true;
  return londonDayKey(now) <= gig;
}

export function promoReminderDue({ gigDate, acceptedAt, promo, reminderSentAt, todayKey, status, cancelled }) {
  if (cancelled) return false;
  const state = String(status || "").toLowerCase();
  if (!["accepted", "confirmed", "paid"].includes(state)) return false;
  if (reminderSentAt) return false;
  if (!promoIsIncomplete(promo)) return false;
  const due = promoDueKey(gigDate, acceptedAt);
  if (!due || !todayKey || due < todayKey) return false;
  return promoReminderKey(due) === todayKey;
}

function httpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

/** Shape and consent check. File bytes are checked separately. */
export function preparePromo(body, { contactName, email, now = new Date() } = {}) {
  if (body?.permission !== true) return { error: "Tick the permission box before you send." };
  const bio = String(body?.bio || "").trim().slice(0, 600);
  if (!bio) return { error: "Add a short bio." };
  const photos = Array.isArray(body?.photos) ? body.photos : [];
  if (photos.length < 1 || photos.length > 4) return { error: "Add between 1 and 4 photos." };
  const track = body?.track || {};
  const trackUrl = String(track.url || "").trim().slice(0, 300);
  const trackPath = String(track.path || "").trim();
  if (!trackPath && !trackUrl) return { error: "Add a track or a link to one." };
  if (trackUrl && !httpUrl(trackUrl)) return { error: "Track link must start with http:// or https://." };
  const videoUrl = String(body?.videoUrl || "").trim().slice(0, 300);
  if (videoUrl && !httpUrl(videoUrl)) return { error: "Video link must start with http:// or https://." };
  const played = String(body?.played || "").trim().slice(0, 300);
  const at = now.toISOString();
  return {
    promo: {
      bio,
      played,
      videoUrl: videoUrl || "",
      submittedAt: at,
    },
    photos,
    track: trackPath
      ? { path: trackPath, name: track.name, size: track.size, contentType: track.contentType }
      : { url: trackUrl },
    permission: {
      name: String(contactName || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      at,
    },
  };
}

const LINEUP_INSTRUMENTS = new Set(["Vocals", "Guitar", "Bass", "Double bass", "Drums", "Keys", "Sax", "Violin", "Other"]);

/** People from the promo page. Blank rows stay so the form can start with one. */
export function lineupRows(members) {
  if (!Array.isArray(members)) return [];
  return members.slice(0, 12).map((member) => ({
    name: String(member?.name || "").trim().slice(0, 80),
    instruments: (Array.isArray(member?.instruments) ? member.instruments : [])
      .map((item) => String(item || "").trim())
      .filter((item) => LINEUP_INSTRUMENTS.has(item))
      .slice(0, 8),
  }));
}

export function soundRequest(value) {
  return String(value || "").trim().slice(0, 300);
}
