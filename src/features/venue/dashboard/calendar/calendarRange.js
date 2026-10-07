import { isNewApplicant } from '@features/venue/gigs/utils/isNewApplicant';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeekMonday(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonthsKeepingDay(date, months) {
  const day = date.getDate();
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

export function visibleRange(view, cursor) {
  if (view === 'week') {
    const start = startOfWeekMonday(cursor);
    return { start, end: addDays(start, 6) };
  }
  if (view === 'season') {
    const start = startOfWeekMonday(cursor);
    return { start, end: addDays(start, 83) };
  }
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  return { start, end };
}

function shortDate(date, withYear) {
  const label = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  return withYear ? `${label} ${date.getFullYear()}` : label;
}

export function rangeTitle(view, cursor) {
  if (view === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const { start, end } = visibleRange(view, cursor);
  const sameYear = start.getFullYear() === end.getFullYear();
  if (view === 'week' && start.getMonth() === end.getMonth() && sameYear) {
    return `${start.getDate()}\u2013${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${shortDate(start, !sameYear)} \u2013 ${shortDate(end, true)}`;
}

export function stepCursor(view, cursor, direction) {
  if (view === 'month') return addMonthsKeepingDay(cursor, direction);
  if (view === 'week') return addDays(cursor, direction * 7);
  return addDays(cursor, direction * 28);
}

function applicantsOf(slot) {
  return Array.isArray(slot?.applicants) ? slot.applicants : [];
}

export function isVenueHireGroup(group) {
  const gig = group?.primaryGig;
  return group?.itemType === 'venue_hire'
    || gig?.itemType === 'venue_hire'
    || gig?.kind === 'Venue Rental'
    || gig?.bookingMode === 'rental';
}

function isNegotiatingApplicant(applicant, gig) {
  if (!applicant) return false;
  if (applicant.status === 'pending' && (applicant.conversationId || (applicant.proposedFee && gig?.budgetValue && applicant.proposedFee !== gig.budgetValue))) {
    return true;
  }
  return applicant.status === 'accepted' && !!applicant.conversationId;
}

/** Booking state used by the calendar filters. Past dates keep their booking state. */
export function gigBookingState(group) {
  const slots = group?.allGigs?.length ? group.allGigs : [group?.primaryGig].filter(Boolean);
  if (!slots.length) return 'open';
  const hire = isVenueHireGroup(group);
  const slotConfirmed = (slot) => {
    if (hire && slot?.renterName && String(slot.renterName).trim()) return true;
    const id = slot?.gigId || slot?.id;
    return applicantsOf(slot).some((applicant) => {
      const status = String(applicant?.status || '').toLowerCase();
      if (status === 'confirmed' || status === 'paid') {
        return !applicant.assignedSlotGigId || applicant.assignedSlotGigId === id;
      }
      return status === 'accepted' && applicant.assignedSlotGigId === id;
    });
  };
  if (slots.every(slotConfirmed)) return 'confirmed';
  if (slots.some((slot) => applicantsOf(slot).some((applicant) => applicant?.status === 'accepted'))) return 'awaiting';
  if (slots.some((slot) => applicantsOf(slot).some((applicant) => isNegotiatingApplicant(applicant, slot)))) return 'negotiating';
  return 'open';
}

export function gigNeedsAction(group, now) {
  const gig = group?.primaryGig;
  if (!gig?.dateTime || !(gig.dateTime > now)) return false;
  const slots = group.allGigs?.length ? group.allGigs : [gig];
  const newApplicants = slots.reduce((sum, slot) => (
    sum + applicantsOf(slot).filter(isNewApplicant).length
  ), 0);
  const state = gigBookingState(group);
  return newApplicants > 0 || state === 'awaiting' || state === 'negotiating';
}

export function gigMatchesFilter(group, filter, now) {
  if (!filter || filter === 'all') return true;
  const state = gigBookingState(group);
  if (filter === 'awaiting') return state === 'awaiting';
  if (filter === 'confirmed') return state === 'confirmed';
  if (filter === 'attention') return gigNeedsAction(group, now);
  return true;
}

export function gigsInRange(groups, view, cursor) {
  const { start, end } = visibleRange(view, cursor);
  const from = formatDateKey(start);
  const to = formatDateKey(end);
  return (Array.isArray(groups) ? groups : []).filter((group) => {
    const iso = group?.primaryGig?.dateIso;
    return iso && iso >= from && iso <= to;
  });
}

export function filterCounts(groups, view, cursor, now) {
  const inRange = gigsInRange(groups, view, cursor);
  return {
    all: inRange.length,
    attention: inRange.filter((group) => gigNeedsAction(group, now)).length,
    awaiting: inRange.filter((group) => gigBookingState(group) === 'awaiting').length,
    confirmed: inRange.filter((group) => gigBookingState(group) === 'confirmed').length,
  };
}
