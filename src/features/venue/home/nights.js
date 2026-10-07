import { getLocalGigDateTime } from '@services/utils/filtering';
import { readNight, slotGigId } from '@services/utils/nightApplications';
import { gigSlotHasConfirmedArtist } from '../gigs/utils/multiSlotGigGroup';
import { isNewApplicant, nightNeedsAttention } from '../gigs/utils/isNewApplicant';
import { formatClock, slotEnd } from '@features/gig-discovery/guest/guestFormat';

export { isNewApplicant };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function baseGigName(gig) {
  const raw = gig?.eventName || gig?.title || gig?.gigName || 'Gig';
  return String(raw).replace(/\s*\(Set\s+\d+\)\s*$/i, '').trim() || 'Gig';
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function applicantTimestamp(applicant) {
  return toDate(applicant?.appliedAt || applicant?.createdAt || applicant?.timestamp);
}

export function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function nightDate(slots) {
  for (const slot of slots || []) {
    const date = getLocalGigDateTime(slot);
    if (date && !Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function slotStartMinutes(slot) {
  const [hours, minutes] = String(slot?.startTime || '').split(':');
  const h = Number(hours);
  const m = Number(minutes);
  if (!Number.isFinite(h)) return Number.POSITIVE_INFINITY;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function nightTimeRange(slots) {
  const ordered = [...(slots || [])].filter(Boolean).sort((a, b) => slotStartMinutes(a) - slotStartMinutes(b));
  const first = ordered.find((slot) => slot.startTime) || ordered[0];
  const last = [...ordered].reverse().find((slot) => slot.startTime || slot.endTime) || first;
  const start = formatClock(first?.startTime) || '';
  const end = slotEnd(last) || formatClock(last?.endTime) || '';
  if (start && end) return `${start}–${end}`;
  return start || end || '';
}

export function isSlotBooked(slot) {
  return gigSlotHasConfirmedArtist(slot);
}

export function acceptingApplicationsPatch(currentlyAccepting) {
  if (currentlyAccepting) return { applicationsOpen: false };
  return { applicationsOpen: true, applicationsReopenedAt: new Date().toISOString() };
}

export function buildNight(slots, { venueName } = {}) {
  const list = (slots || []).filter((slot) => slot && (slot.gigId || slot.id));
  const night = readNight(list.length ? list : []);
  const ordered = night.slots.length ? night.slots : list;
  const primary = ordered[0] || list[0] || {};
  const date = nightDate(ordered.length ? ordered : list);
  const applications = night.applications || [];
  const freshApps = applications.filter(isNewApplicant);
  const bookedCount = ordered.filter(isSlotBooked).length;
  const reopenedDates = ordered
    .map((slot) => toDate(slot.applicationsReopenedAt))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());
  const latestNew = [...freshApps].sort((a, b) => {
    const aTime = applicantTimestamp(a)?.getTime() || 0;
    const bTime = applicantTimestamp(b)?.getTime() || 0;
    return bTime - aTime;
  })[0] || null;

  return {
    gigId: night.applicationsRootGigId || primary.gigId || primary.id,
    name: baseGigName(primary),
    venueName: venueName || primary.venueName || '',
    venueId: primary.venueId || '',
    date,
    range: nightTimeRange(ordered),
    slots: ordered,
    gigIds: ordered.map((slot) => slotGigId(slot)).filter(Boolean),
    primary,
    applications,
    freshApps,
    fresh: freshApps.length,
    totalApps: applications.length,
    bookedCount,
    setCount: Math.max(ordered.length, list.length, 1),
    open: ordered.length > 0 && ordered.some((slot) => slot.applicationsOpen !== false),
    fullyBooked: ordered.length > 0 && ordered.every(isSlotBooked),
    reopenedAt: reopenedDates[0] || null,
    latestNew,
  };
}

export function groupUpcomingNights(gigs) {
  const list = (gigs || []).filter((gig) => gig && gig.gigId && gig.itemType !== 'venue_hire' && gig.kind !== 'Venue Rental');
  const processed = new Set();
  const groups = [];

  list.forEach((gig) => {
    if (processed.has(gig.gigId)) return;
    const hasSlots = Array.isArray(gig.gigSlots) && gig.gigSlots.length > 0;
    if (!hasSlots) {
      processed.add(gig.gigId);
      groups.push(buildNight([gig]));
      return;
    }
    const slots = [gig];
    const ids = new Set([gig.gigId]);
    processed.add(gig.gigId);
    const queue = [...gig.gigSlots];
    while (queue.length) {
      const slotId = queue.shift();
      if (!slotId || processed.has(slotId) || ids.has(slotId)) continue;
      const slot = list.find((item) => item.gigId === slotId);
      if (!slot) continue;
      slots.push(slot);
      ids.add(slotId);
      processed.add(slotId);
      if (Array.isArray(slot.gigSlots)) {
        slot.gigSlots.forEach((id) => {
          if (!ids.has(id) && !processed.has(id)) queue.push(id);
        });
      }
    }
    groups.push(buildNight(slots));
  });

  return groups;
}

export function isUpcomingNight(night, now = new Date()) {
  if (!night?.date) return false;
  return night.date.getTime() >= startOfDay(now).getTime();
}

export function countNewApplications(gigs, now = new Date()) {
  return groupUpcomingNights(gigs)
    .filter((night) => isUpcomingNight(night, now))
    .reduce((sum, night) => sum + night.fresh, 0);
}

export function selectUpcomingNights(nights, now = new Date()) {
  const upcoming = nights
    .filter((night) => isUpcomingNight(night, now))
    .sort((a, b) => a.date - b.date);
  const horizon = new Date(startOfDay(now).getTime() + 21 * 24 * 60 * 60 * 1000);
  const soon = upcoming.filter((night) => night.date < horizon);
  if (soon.length) return { nights: soon, fallback: false };
  if (upcoming.length) return { nights: upcoming.slice(0, 5), fallback: true };
  return { nights: [], fallback: false };
}

export function attentionNights(nights, now = new Date()) {
  return nights
    .filter((night) => isUpcomingNight(night, now) && nightNeedsAttention(night))
    .sort((a, b) => a.date - b.date);
}

export function weekdayLong(date) {
  return WEEKDAYS_LONG[date.getDay()];
}

export function monthLong(date) {
  return MONTHS_LONG[date.getMonth()];
}

export function longDate(date) {
  if (!date) return '';
  return `${weekdayLong(date)} ${date.getDate()} ${monthLong(date)}`;
}

export function mediumDate(date) {
  if (!date) return '';
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function compactDate(date) {
  if (!date) return '';
  return `${WEEKDAYS[date.getDay()].toUpperCase()} ${date.getDate()} ${MONTHS[date.getMonth()].toUpperCase()}`;
}

export function dateParts(date) {
  if (!date) return { dow: '', day: '', mon: '' };
  return {
    dow: WEEKDAYS[date.getDay()].toUpperCase(),
    day: String(date.getDate()),
    mon: MONTHS[date.getMonth()].toUpperCase(),
  };
}

export function greetingFor(name, now = new Date()) {
  const hour = now.getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  return { phrase: `Good ${part}, ${first}`, first };
}

export function relativeTime(value, now = new Date()) {
  const date = value instanceof Date ? value : toDate(value);
  if (!date) return '';
  const mins = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function clockLabel(date) {
  if (!date) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function shareMessage({ name, venueName, date, url }) {
  const when = date ? mediumDate(date) : 'this date';
  const where = venueName ? ` at ${venueName}` : '';
  return `We're booking acts for ${name || 'a gig'}${where} on ${when}. Apply here: ${url}`;
}

export function applicationsChip(night) {
  if (night.fullyBooked) return { label: 'Fully booked', tone: 'booked' };
  if (!night.open) return { label: 'Closed', tone: 'closed' };
  return { label: 'Open', tone: 'open' };
}

export function reopenedBannerActive(night, now = new Date()) {
  if (!night?.open || !night.reopenedAt) return false;
  return now.getTime() - night.reopenedAt.getTime() < 7 * 24 * 60 * 60 * 1000;
}
