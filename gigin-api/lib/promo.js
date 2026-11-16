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

export function promoIsIncomplete(promo) {
  const bio = String(promo?.bio || "").trim();
  const photos = Array.isArray(promo?.photos) ? promo.photos.filter((item) => item?.path || item?.url) : [];
  const track = promo?.track;
  const hasTrack = Boolean(track?.path || String(track?.url || "").trim());
  return !bio || photos.length === 0 || !hasTrack;
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
