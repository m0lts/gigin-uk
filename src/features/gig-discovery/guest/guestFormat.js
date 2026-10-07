import { slotTaken } from '../../../services/utils/nightApplications.js';

export { slotTaken };

export function slotDate(slot) {
  const raw = slot?.startDateTime || slot?.date;
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (raw.seconds || raw._seconds) return new Date((raw.seconds || raw._seconds) * 1000);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatGigDay(slot) {
  const date = slotDate(slot);
  if (!date) return 'DATE TO BE CONFIRMED';
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${pick('weekday')} ${pick('day')} ${pick('month')} ${pick('year')}`.toUpperCase();
}

export function formatShortDay(slot) {
  const date = slotDate(slot);
  if (!date) return 'the night';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatClock(time) {
  if (!time) return '';
  const [hours, minutes] = String(time).split(':');
  if (!hours) return String(time);
  return `${hours.padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}`;
}

export function slotEnd(slot) {
  if (slot?.endTime) return formatClock(slot.endTime);
  if (!slot?.startTime || slot.duration == null) return '';
  const [hours, minutes] = String(slot.startTime).split(':').map(Number);
  if (!Number.isFinite(hours)) return '';
  const total = hours * 60 + (minutes || 0) + Number(slot.duration);
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function slotState(slot) {
  const date = slotDate(slot);
  if (date && date.getTime() < Date.now()) return 'played';
  return slotTaken(slot) ? 'booked' : 'open';
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

const LAUNCH_VENUE_IDS = new Set(['a622f269-1866-44f8-b3f0-bb9ca38eeefe']);

export function isJesusCollege(venue, gig) {
  const venueId = venue?.venueId || venue?.id || gig?.venueId || gig?.venue?.venueId || '';
  if (LAUNCH_VENUE_IDS.has(venueId)) return true;
  const name = `${venue?.name || ''} ${gig?.venue?.venueName || ''}`.toLowerCase();
  if (name.includes('jesus college')) return true;
  const place = [
    venue?.address?.city,
    venue?.address?.line1,
    venue?.address?.addressLine1,
    typeof venue?.address === 'string' ? venue.address : '',
    gig?.venue?.address,
  ].filter(Boolean).join(' ').toLowerCase();
  const shortName = `${venue?.name || gig?.venue?.venueName || ''}`.trim().toLowerCase();
  return shortName === 'jbar' && (place.includes('cambridge') || place.includes('jesus'));
}

export function isGuestApplyGig(gig, venue) {
  if (!gig) return false;
  if (gig.itemType === 'venue_hire' || gig.bookingMode === 'rental' || gig.kind === 'Venue Rental') return false;
  if (gig.guestApplications === true || venue?.guestApplications === true) return true;
  return isJesusCollege(venue, gig);
}

export function bookerLine(venue, gig) {
  const owner = firstName(venue?.accountName);
  const venueName = String(venue?.name || venue?.venueName || gig?.venue?.venueName || gig?.venueName || '').trim();
  return {
    name: owner || venueName || 'the venue',
    role: String(venue?.bookerRole || '').trim(),
  };
}

export function preferenceReview(slots, ids) {
  const names = (ids || []).map((id) => {
    const index = (slots || []).findIndex((slot) => (slot.gigId || slot.id) === id);
    return index >= 0 ? `Set ${index + 1}` : null;
  }).filter(Boolean);
  if (!names.length) return 'No preference';
  if (names.length === 1) return `Prefers ${names[0]}`;
  if (names.length === 2) return `Prefers ${names[0]} or ${names[1]}`;
  return `Prefers ${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

export function setCountLabel(count) {
  const words = ['', 'One set', 'Two sets', 'Three sets', 'Four sets', 'Five sets'];
  return words[count] || `${count} sets`;
}

export function rememberApplication(gigId, token) {
  const value = `${gigId}:${token}`;
  try { sessionStorage.setItem('guestApplicationLink', value); } catch { /* ignore */ }
  try { localStorage.setItem('guestApplicationLink', value); } catch { /* ignore */ }
}

export function rememberedApplication(gigIds) {
  let raw = '';
  try {
    raw = localStorage.getItem('guestApplicationLink') || sessionStorage.getItem('guestApplicationLink') || '';
  } catch { /* ignore */ }
  const splitAt = raw.indexOf(':');
  if (splitAt < 0) return null;
  const gigId = raw.slice(0, splitAt);
  const token = raw.slice(splitAt + 1);
  if (!token || !(gigIds || []).includes(gigId)) return null;
  return { gigId, token };
}

export function forgetApplication(gigId, token) {
  const drop = (storage) => {
    const raw = storage.getItem('guestApplicationLink') || '';
    const splitAt = raw.indexOf(':');
    if (splitAt < 0) return;
    const storedGigId = raw.slice(0, splitAt);
    const storedToken = raw.slice(splitAt + 1);
    if (storedGigId !== gigId && storedToken !== token) return;
    storage.removeItem('guestApplicationLink');
  };
  try { drop(localStorage); } catch { /* ignore */ }
  try { drop(sessionStorage); } catch { /* ignore */ }
}

export function keepRememberedApplication({ status, httpStatus } = {}) {
  if (httpStatus === 404 || httpStatus === 410) return false;
  if (status === 'withdrawn') return false;
  return true;
}

export function icsForSet({ title, start, end, location, description, uid, sequence = 0 }) {
  const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gigin//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    uid ? `UID:${uid}` : '',
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${title}`,
    location ? `LOCATION:${location}` : '',
    description ? `DESCRIPTION:${description}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  return body;
}

export function photoUrl(venue) {
  const photo = venue?.photos?.[0] || venue?.photo;
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  return photo.url || photo.src || '';
}

export function draftKey(gigId, inviteId) {
  return `guest-apply:${gigId}:${inviteId || 'public'}`;
}

export function readDraft(gigId, inviteId) {
  try {
    const raw = localStorage.getItem(draftKey(gigId, inviteId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeDraft(gigId, inviteId, draft) {
  try {
    localStorage.setItem(draftKey(gigId, inviteId), JSON.stringify(draft));
  } catch { /* the phone may be out of space */ }
}

export function clearDraft(gigId, inviteId) {
  try { localStorage.removeItem(draftKey(gigId, inviteId)); } catch { /* ignore */ }
}
