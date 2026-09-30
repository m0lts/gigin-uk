import { useMemo, useState } from 'react';
import { FEATURES } from '../../../../config/features';
import {
  applyBookNewTemplateToGig,
  parseLookingForSelection,
  serializeLookingForSelection,
} from '../bookNewEventTemplateHelpers';

export const NEW_GIG_ROUTE_KEY = 'gigs.newGigRoute';
export const LOOKING_FOR = ['Musician/Band', 'DJ', 'Promoter'];
export const GENRES = ['Jazz', 'Soul', 'Funk', 'Indie', 'Rock', 'Pop', 'Electronic', 'Folk', 'Hip Hop', 'Blues', 'Reggae', 'Classical'];

export function readLastNewGigRoute() {
  try {
    const value = localStorage.getItem(NEW_GIG_ROUTE_KEY);
    if (value === 'quick' || value === 'full' || value === 'wizard') return value;
  } catch { /* ignore */ }
  return 'full';
}

export function writeLastNewGigRoute(route) {
  try { localStorage.setItem(NEW_GIG_ROUTE_KEY, route); } catch { /* ignore */ }
}

export function logGigCreated(detail) {
  const payload = { event: 'gig_created', ...detail };
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    window.dispatchEvent(new CustomEvent('gig_created', { detail: payload }));
  }
  console.info('[analytics] gig_created', payload);
}

function minutesOf(time) {
  if (!time || !String(time).trim()) return null;
  const [h, m] = String(time).trim().split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function durationBetween(start, end) {
  const a = minutesOf(start);
  const b = minutesOf(end);
  if (a == null || b == null) return 60;
  let d = b - a;
  if (d <= 0) d += 24 * 60;
  return d;
}

export function addMinutes(time, minutes) {
  const base = minutesOf(time);
  if (base == null) return '';
  const total = base + Number(minutes || 0);
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function feeDigits(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  return digits;
}

export function feeLabel(value) {
  const digits = feeDigits(value);
  return digits === '' ? '' : `£${digits}`;
}

export function emptyDraft(seed = {}) {
  return {
    kind: 'find',
    templateId: '',
    dates: [],
    start: '',
    end: '',
    loadIn: null,
    soundcheck: null,
    vacateBy: null,
    sets: [],
    pay: FEATURES.payments ? 'fee' : 'none',
    fee: '',
    tickets: FEATURES.ticketing ? 'free' : 'free',
    title: '',
    description: '',
    lookingFor: ['Musician/Band'],
    genres: [],
    showOnProfile: true,
    artistId: '',
    artistName: '',
    paidVia: 'outside',
    note: '',
    publishListing: true,
    offerArtistIds: [],
    ...seed,
  };
}

function setsFromGig(gig) {
  const extras = Array.isArray(gig.extraSlots) ? gig.extraSlots : [];
  const budgets = Array.isArray(gig.slotBudgets) ? gig.slotBudgets : [];
  const firstEnd = gig.timingMusicStopTime
    || (gig.startTime && gig.duration ? addMinutes(gig.startTime, gig.duration) : '');
  const rows = [{
    start: gig.timingMusicStartTime || gig.startTime || '',
    end: firstEnd,
    fee: feeDigits(budgets[0] ?? gig.unifiedFeeAmount),
  }];
  extras.forEach((slot, index) => {
    rows.push({
      start: slot.startTime || '',
      end: slot.startTime && slot.duration ? addMinutes(slot.startTime, slot.duration) : '',
      fee: feeDigits(budgets[index + 1]),
    });
  });
  return rows;
}

export function applyTemplateToDraft(draft, template) {
  if (!template) return { ...draft, templateId: '' };
  const applied = applyBookNewTemplateToGig({
    timingAccessTime: '',
    timingSoundcheckTime: '',
    timingMusicStartTime: '',
    timingMusicStopTime: '',
    timingVacateTime: '',
    extraInformation: '',
    paymentModel: '',
    unifiedFeeAmount: '£',
    ticketingModel: '',
    showOnVenueProfile: true,
    gigName: '',
    gigType: 'Musician/Band',
    startTime: '',
    duration: 60,
    extraSlots: [],
    slotBudgets: ['£'],
  }, template);
  const rows = setsFromGig(applied);
  const tickets = applied.ticketingModel === 'venue'
    ? 'venue'
    : applied.ticketingModel === 'artist'
      ? 'artist'
      : 'free';
  return {
    ...draft,
    templateId: template.templateId || template.id || '',
    start: rows[0]?.start || draft.start,
    end: rows[0]?.end || draft.end,
    loadIn: applied.timingAccessTime || null,
    soundcheck: applied.timingSoundcheckTime || null,
    vacateBy: applied.timingVacateTime || null,
    sets: rows.length > 1 ? rows : [],
    fee: rows[0]?.fee || feeDigits(applied.unifiedFeeAmount),
    pay: applied.paymentModel === 'no_fee' ? 'none' : 'fee',
    tickets,
    title: applied.gigName || draft.title,
    description: applied.extraInformation || '',
    lookingFor: parseLookingForSelection(applied.gigType),
    showOnProfile: applied.showOnVenueProfile !== false,
  };
}

export function activeSets(draft) {
  if (Array.isArray(draft.sets) && draft.sets.length > 1) return draft.sets;
  return [{ start: draft.start, end: draft.end, fee: draft.fee }];
}

export function draftToFormGig(draft, venue) {
  const rows = activeSets(draft);
  const first = rows[0] || {};
  const start = first.start || '';
  const end = first.end || '';
  const extraSlots = rows.slice(1).map((row) => ({
    startTime: row.start || '',
    duration: durationBetween(row.start, row.end),
  }));
  const noFee = !FEATURES.payments || draft.pay === 'none' || draft.paidVia === 'none';
  const budgets = rows.map((row) => (noFee ? '£' : `£${feeDigits(row.fee)}`));
  const tickets = !FEATURES.ticketing
    ? 'free_entry'
    : draft.tickets === 'venue'
      ? 'venue'
      : draft.tickets === 'artist'
        ? 'artist'
        : 'free_entry';
  const venueName = venue?.name ? String(venue.name).trim() : '';
  const title = String(draft.title || '').trim() || (venueName ? `Gig at ${venueName}` : 'Gig');
  const booked = draft.kind === 'booked';
  const names = rows.map(() => booked ? (draft.artistName || '') : '');
  return {
    bookingMode: 'artist',
    startTime: start,
    duration: durationBetween(start, end),
    extraSlots,
    slotBudgets: budgets,
    unifiedFeeAmount: budgets[0] || '£',
    paymentModel: noFee ? 'no_fee' : 'venue_pays_artist',
    ticketingModel: tickets,
    timingMusicStartTime: start,
    timingMusicStopTime: end,
    timingAccessTime: draft.loadIn || '',
    timingSoundcheckTime: draft.soundcheck || '',
    timingVacateTime: draft.vacateBy || '',
    gigName: title,
    extraInformation: String(draft.description || '').slice(0, 250),
    gigType: serializeLookingForSelection(draft.lookingFor),
    genre: draft.genres || [],
    showOnVenueProfile: booked ? false : !!draft.showOnProfile,
    kind: 'Live Music',
    artistNames: names,
    artistName: booked ? (draft.artistName || '') : '',
    listingDocEntries: null,
    rentalCapacity: '',
    noteToArtist: draft.note || '',
  };
}

export function readiness(draft) {
  const find = draft.kind !== 'booked';
  const times = !!(draft.dates?.length && draft.start && draft.end);
  const feeOk = !FEATURES.payments || draft.pay === 'none' || feeDigits(draft.fee) !== '' || (draft.sets.length > 1 && draft.sets.every((set) => feeDigits(set.fee) !== ''));
  const titleOk = !!String(draft.title || '').trim();
  const artistOk = !!String(draft.artistName || '').trim();
  const feeRow = FEATURES.payments
    ? [{ id: 'fee', label: find ? 'Fee' : 'Agreed fee', ok: feeOk, tone: 'Required', section: find ? 'fee' : 'who' }]
    : [];
  const rows = find
    ? [
      { id: 'when', label: 'Date and times', ok: times, tone: 'Required', section: 'when' },
      ...feeRow,
      { id: 'title', label: 'Title', ok: titleOk, tone: 'Required', section: 'listing' },
      { id: 'description', label: 'Description', ok: !!String(draft.description || '').trim(), tone: 'Recommended', section: 'listing' },
      { id: 'looking', label: "Who you're looking for", ok: (draft.lookingFor || []).length > 0, tone: 'Recommended', section: 'listing' },
    ]
    : [
      { id: 'when', label: 'Date and times', ok: times, tone: 'Required', section: 'when' },
      { id: 'artist', label: 'Artist', ok: artistOk, tone: 'Required', section: 'who' },
      ...feeRow,
    ];
  const required = rows.filter((row) => row.tone === 'Required');
  return {
    rows,
    done: required.filter((row) => row.ok).length,
    total: required.length,
    ready: required.every((row) => row.ok),
    firstMissing: required.find((row) => !row.ok)?.section || null,
  };
}

export function useNewGigDraft(seed) {
  const [draft, setDraft] = useState(() => emptyDraft(seed));
  const check = useMemo(() => readiness(draft), [draft]);
  const patch = (partial) => setDraft((current) => ({ ...current, ...partial }));
  return { draft, setDraft, patch, check };
}
