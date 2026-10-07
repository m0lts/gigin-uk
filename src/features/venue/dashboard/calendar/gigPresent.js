import {
  formatDateKey,
  gigBookingState,
  gigMatchesFilter,
  gigNeedsAction,
  isVenueHireGroup,
} from './calendarRange';
import { isNewApplicant } from '@features/venue/gigs/utils/isNewApplicant';

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const STATUS_STYLE = {
  confirmed: { dot: 'oklch(0.66 0.14 150)', text: 'oklch(0.45 0.11 150)', bg: 'oklch(0.95 0.04 150)', label: 'Confirmed' },
  awaiting: { dot: 'oklch(0.72 0.15 70)', text: 'oklch(0.48 0.11 60)', bg: 'oklch(0.95 0.05 80)', label: 'Awaiting payment' },
  negotiating: { dot: 'oklch(0.62 0.13 260)', text: 'oklch(0.45 0.12 260)', bg: 'oklch(0.95 0.03 260)', label: 'Negotiating' },
  open: { dot: '#B8AFA6', text: '#5E5750', bg: '#F1EEEA', label: 'Open for applications' },
  hire: { dot: 'oklch(0.62 0.12 300)', text: 'oklch(0.45 0.11 300)', bg: 'oklch(0.95 0.03 300)', label: 'Venue hire' },
  played: { dot: '#B8B8B8', text: '#6B7280', bg: '#F3F4F6', label: 'Played' },
  closed: { dot: '#B8B8B8', text: '#6B7280', bg: '#F3F4F6', label: 'Closed' },
};

const SET_DOT = {
  booked: 'oklch(0.66 0.14 150)',
  awaiting: 'oklch(0.72 0.15 70)',
  negotiating: 'oklch(0.62 0.13 260)',
  open: '#FF6C4B',
};

export function clockMinutes(time) {
  if (!time || !String(time).trim()) return null;
  const [h, m] = String(time).trim().split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function formatClock(totalMinutes) {
  const mins = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function endMinutes(startTime, durationMinutes) {
  const start = clockMinutes(startTime);
  if (start == null) return null;
  const duration = Number(durationMinutes);
  if (!(duration > 0)) return null;
  return start + duration;
}

function displayTime(time) {
  const mins = clockMinutes(time);
  return mins == null ? '' : formatClock(mins);
}

function applicantName(applicant, applicantNames) {
  if (!applicant) return '';
  return applicant.profileName
    || applicant.name
    || applicant.musicianName
    || applicant.artistName
    || (applicant.id && applicantNames?.[applicant.id])
    || '';
}

function isNegotiating(applicant, gig) {
  if (!applicant) return false;
  if (applicant.status === 'pending' && (applicant.conversationId || (applicant.proposedFee && gig?.budgetValue && applicant.proposedFee !== gig.budgetValue))) {
    return true;
  }
  return applicant.status === 'accepted' && !!applicant.conversationId;
}

function slotKind(slot) {
  const apps = slot?.applicants || [];
  if (apps.some((applicant) => applicant?.status === 'confirmed' || applicant?.status === 'paid')) return 'booked';
  if (apps.some((applicant) => applicant?.status === 'accepted')) return 'awaiting';
  if (apps.some((applicant) => isNegotiating(applicant, slot))) return 'negotiating';
  return 'open';
}

function slotArtist(slot, kind, applicantNames) {
  const apps = slot?.applicants || [];
  if (kind === 'booked') {
    const confirmed = apps.find((applicant) => applicant?.status === 'confirmed' || applicant?.status === 'paid');
    return applicantName(confirmed, applicantNames);
  }
  if (kind === 'awaiting' || kind === 'negotiating') {
    const person = apps.find((applicant) => (
      kind === 'awaiting' ? applicant?.status === 'accepted' : isNegotiating(applicant, slot)
    ));
    return applicantName(person, applicantNames);
  }
  return '';
}

export function dateLabel(dateIso) {
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const weekday = WEEKDAYS[(date.getDay() + 6) % 7];
  return `${weekday} ${String(date.getDate()).padStart(2, '0')} ${MONTHS_SHORT[date.getMonth()]}`;
}

export function dayNumberLabel(date) {
  if (date.getDate() === 1) return `1 ${MONTHS_SHORT[date.getMonth()]}`;
  return String(date.getDate());
}

export function presentGig(group, { applicantNames = {}, now = new Date(), hireApplicationCounts = {} } = {}) {
  const primary = group?.primaryGig || {};
  const slots = (group?.allGigs?.length ? group.allGigs : [primary]).filter(Boolean);
  const hire = isVenueHireGroup(group);
  const booking = gigBookingState(group);
  const todayKey = formatDateKey(now);
  const past = !!primary.dateIso && primary.dateIso < todayKey;
  const visual = hire ? 'hire' : booking;
  const style = STATUS_STYLE[visual] || STATUS_STYLE.open;
  const title = String(primary.eventName || primary.title || primary.gigName || (hire ? 'Venue hire' : 'Gig'))
    .replace(/\s*\(Set\s+\d+\)\s*$/i, '')
    .trim() || (hire ? 'Venue hire' : 'Gig');

  const sets = slots
    .slice()
    .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
    .map((slot, index) => {
      const kind = hire ? (booking === 'confirmed' ? 'booked' : 'open') : slotKind(slot);
      const artist = hire ? '' : slotArtist(slot, kind, applicantNames);
      const start = displayTime(slot.startTime || slot.rentalAccessFrom) || displayTime(primary.startTime);
      const endMin = endMinutes(slot.startTime || primary.startTime, slot.duration);
      const end = slot.rentalHardCurfew || slot.endTime || slot.curfew || (endMin == null ? '' : formatClock(endMin));
      return {
        index: index + 1,
        start,
        end: displayTime(end) || end,
        kind,
        artist,
        apps: (slot.applicants || []).length,
        dot: SET_DOT[kind] || SET_DOT.open,
      };
    });

  const start = displayTime(primary.startTime || primary.rentalAccessFrom) || sets[0]?.start || '';
  const last = sets[sets.length - 1];
  const end = displayTime(primary.rentalHardCurfew || primary.endTime) || last?.end || '';
  const startMin = clockMinutes(start);
  let endMin = clockMinutes(end);
  if (startMin != null && endMin != null && endMin <= startMin) endMin += 1440;
  if (endMin == null && startMin != null) endMin = startMin + 120;

  const bookedCount = hire
    ? (booking === 'confirmed' ? 1 : 0)
    : sets.filter((set) => set.kind === 'booked' || set.kind === 'awaiting').length;
  const setCount = hire ? 1 : Math.max(sets.length, 1);
  const apps = hire
    ? (hireApplicationCounts[primary.gigId] ?? hireApplicationCounts[primary.hireSpaceId] ?? 0)
    : slots.reduce((sum, slot) => sum + ((slot.applicants || []).length), 0);
  const fresh = hire
    ? 0
    : slots.reduce((sum, slot) => (
      sum + (slot.applicants || []).filter(isNewApplicant).length
    ), 0);

  const negotiating = sets.find((set) => set.kind === 'negotiating' && set.artist);
  const withName = negotiating?.artist || '';
  const hirer = (primary.renterName && String(primary.renterName).trim()) || '';
  const openForApps = !hire && sets.some((set) => set.kind === 'open' || set.kind === 'negotiating') || (hire && booking !== 'confirmed');

  let sub = '';
  if (hire) sub = hirer ? `Hired · ${hirer}` : (apps ? `${apps} application${apps === 1 ? '' : 's'}` : 'Venue hire');
  else if (sets.length > 1) sub = `${bookedCount}/${sets.length} sets booked`;
  else if (withName && booking === 'negotiating') sub = `Offer · ${withName}`;
  else if (sets[0]?.artist && (sets[0].kind === 'booked' || sets[0].kind === 'awaiting')) sub = sets[0].artist;
  else sub = `${apps} application${apps === 1 ? '' : 's'}`;

  let seasonLabel = sub;
  if (hire) seasonLabel = 'Venue hire';
  else if (booking === 'negotiating' && withName) seasonLabel = `Offer · ${withName}`;
  else if (bookedCount >= setCount && sets.some((set) => set.artist)) {
    seasonLabel = sets.map((set) => set.artist).filter(Boolean).join(', ') || sub;
  } else if (bookedCount === 0) seasonLabel = `Open · ${apps} app${apps === 1 ? '' : 's'}`;
  else seasonLabel = `${bookedCount}/${setCount} · ${apps} app${apps === 1 ? '' : 's'}`;

  const needsAction = gigNeedsAction(group, now);
  let action = null;
  if (needsAction) {
    if (booking === 'awaiting') action = { text: 'Awaiting payment', dot: STATUS_STYLE.awaiting.dot, color: STATUS_STYLE.awaiting.text };
    else if (booking === 'negotiating') action = { text: `Counter-offer from ${withName || 'artist'}`, dot: STATUS_STYLE.negotiating.dot, color: STATUS_STYLE.negotiating.text };
    else action = { text: `${fresh} new application${fresh === 1 ? '' : 's'}`, dot: '#FF6C4B', color: '#B5462C' };
  }

  const visibility = hire ? 'Private' : (primary.private ? 'Invite only' : 'Public');

  return {
    id: String(primary.gigId || primary.hireSpaceId || title),
    group,
    dateIso: primary.dateIso || '',
    title,
    start,
    end,
    startMin: startMin ?? 20 * 60,
    endMin: endMin ?? (startMin ?? 20 * 60) + 120,
    status: visual,
    booking,
    style,
    sets: hire && hirer
      ? [{ index: 1, start, end, kind: 'booked', artist: hirer, dot: STATUS_STYLE.hire.dot, hired: true }]
      : sets,
    bookedCount,
    setCount,
    apps,
    fresh,
    sub,
    seasonLabel,
    private: !!primary.private,
    past,
    hire,
    hirer,
    withName,
    needsAction,
    action,
    openForApps: !!openForApps && booking !== 'confirmed',
    visibility,
    notes: primary.notes || '',
    soundManager: primary.soundManager || '',
    deposit: hireDeposit(primary),
    balance: hireBalance(primary),
  };
}

function hireDeposit(gig) {
  const hasDeposit = gig.rentalDepositRequired === true || gig.depositRequired === true || (gig.depositAmount != null && gig.depositAmount !== '');
  if (!hasDeposit) return '—';
  const paid = gig.depositStatus === 'paid' || gig.depositPaid === true;
  const amount = gig.depositAmount != null && gig.depositAmount !== '' ? ` · £${gig.depositAmount}` : '';
  return `${paid ? 'Paid' : 'Unpaid'}${amount}`;
}

function hireBalance(gig) {
  const raw = String(gig.hireFee ?? gig.rentalFee ?? gig.budget ?? '').trim();
  if (!raw || raw.toLowerCase() === 'free') return '—';
  const paid = gig.hireFeePaid === true;
  const amount = /^£/.test(raw) ? raw : `£${raw}`;
  return `${paid ? 'Paid' : 'Due'} · ${amount}`;
}

export function gigMatches(gig, filter, now) {
  return gigMatchesFilter(gig.group, filter, now);
}

export function attentionScore(gig) {
  if (gig.booking === 'awaiting') return 3;
  if (gig.booking === 'negotiating') return 2;
  if (gig.fresh > 0) return 1;
  return 0;
}

export function monthCells(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const cells = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const date = new Date(year, month, 1 - offset + i);
    cells.push({
      key: formatDateKey(date),
      date,
      inMonth: date.getMonth() === month,
    });
  }
  return cells;
}

export { MONTHS_TITLE, MONTHS_SHORT };
