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
  const booked = (slot?.applicants || []).some((applicant) => ['confirmed', 'paid', 'accepted'].includes(applicant?.status));
  return booked ? 'booked' : 'open';
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
  const jesus = isJesusCollege(venue, gig);
  return {
    name: venue?.bookerDisplayName || (jesus ? 'Jez' : 'The booker'),
    role: venue?.bookerRole || (jesus ? 'booker' : ''),
  };
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
