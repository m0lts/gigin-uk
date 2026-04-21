import React, { useMemo, useState, useRef, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import Portal from '../../shared/components/Portal';
import { BookNewEventWizard } from './BookNewEventWizard';
import { BookNewEventListingPreview } from './BookNewEventListingPreview';
import { CalendarIconSolid, CoinsIcon, CoinsIconSolid, TicketIcon, TicketIconLight, NoPaymentIcon, DeleteGigIcon, MoreInformationIcon, ClockIcon, LocationPinIcon, SolidCalendarRotateFullIcon } from '../../shared/ui/extras/Icons';
import { createArtistCRMEntry, getArtistCRMEntries } from '@services/client-side/artistCRM';
import { createVenueHireOpportunitiesBatch, updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { postMultipleGigs, updateGigDocument, inviteToGig } from '@services/api/gigs';
import { saveGigTemplate } from '@services/api/venues';
import { hasVenuePerm } from '@services/utils/permissions';
import { createGigInvite } from '@services/api/gigInvites';
import { getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendGigInvitationMessage } from '@services/client-side/messages';
import { removeVenueRequest, removePreferredDateFromRequest } from '@services/client-side/venues';
import { formatDate } from '@services/utils/dates';
import { InviteMethodsModal } from './InviteMethodsModal';
import { uploadFileWithFallback } from '@services/storage';
import { CopyIcon, TickIcon, DownChevronIcon, UpChevronIcon } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import '@styles/shared/modals.styles.css';
import {
  buildBookNewTemplatePayload,
  applyBookNewTemplateToGig,
  applyBookNewTemplateToGigAddExisting,
  filterBookNewEventTemplatesForVenue,
  templateNameExistsForVenue,
  templateDocId,
} from './bookNewEventTemplateHelpers';

function formatTabDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  return `${day}${suffix} ${format(d, 'MMM')}`;
}

function formatDisplayDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  return `${day}${suffix} ${format(d, 'MMM yyyy')}`;
}

/** Full weekday + date for Create event header pills (e.g. Thursday 11 July 2024). */
function formatHeaderDisplayDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  return format(d, 'EEEE d MMMM yyyy');
}

const GIG_KIND_OPTIONS = ['Live Music', 'Background Music', 'Wedding', 'Open Mic', 'House Party'];

const MUSICIAN_TYPE_OPTIONS = ['Musician/Band', 'DJ'];

/**
 * Resolve the canonical gig `kind` at save time.
 *
 * The user now picks `kind` directly from the "Event kind" select in the
 * wizard's More Options (Live Music or Open Mic). Payment + ticketing are
 * independent and no longer override the label. Legacy non-behavioural
 * labels (Wedding, Background Music, Ticketed Gig) are preserved as-is so
 * older gigs don't silently re-badge. Venue-rental flows
 * (`paymentModel === 'artist_pays_venue'`) skip this entirely — those store
 * `kind: 'Venue Rental'` elsewhere.
 */
// eslint-disable-next-line no-unused-vars
function inferBookNewKind(paymentModel, ticketingModel, storedKind) {
  if (storedKind && storedKind !== 'Venue Rental') return storedKind;
  return 'Live Music';
}

/**
 * Resolve `maxApplicants` for a gig at save time. Only honoured for
 * non-paid bookNew listings — the server's paid acceptance pipeline still
 * auto-declines other applicants on first acceptance, so paid gigs are
 * forced back to 1 to keep behaviour consistent. Open Mic listings are
 * intentionally treated as "unlimited" (return null) to preserve their
 * historical "stays open until venue closes" behaviour. Ticketed Gig and
 * free Live Music carry the venue's chosen value. Always clamps into
 * [1, 10] when a numeric value is returned.
 */
function computeMaxApplicantsForSave(gig, kind) {
  if (kind === 'Open Mic') return null;
  const isNonPaidArtistFlow = (gig?.paymentModel === 'no_fee' || kind === 'Ticketed Gig');
  if (!isNonPaidArtistFlow) return 1;
  const raw = Number(gig?.maxApplicants);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.max(1, Math.min(10, Math.floor(raw)));
}

function formatPoundsInput(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  return `£${digits}`;
}

function getSlotBudgetsFor(gig, slotCount) {
  const arr = gig?.slotBudgets;
  if (Array.isArray(arr) && arr.length >= slotCount) return arr.slice(0, slotCount);
  return Array.from({ length: slotCount }, (_, i) => (arr && arr[i] !== undefined ? arr[i] : '£'));
}

/** Returns payment type per slot: 'tickets' | 'flat_fee' | 'no_payment' | '' (unset). */
function getSlotPaymentTypes(gig, slotCount) {
  const arr = gig?.slotPaymentTypes;
  if (Array.isArray(arr) && arr.length >= slotCount) return arr.slice(0, slotCount);
  return Array.from({ length: slotCount }, (_, i) => (arr && arr[i] !== undefined ? arr[i] : ''));
}

/** Returns invite-only (private) per slot. */
function getSlotInviteOnly(gig, slotCount) {
  const arr = gig?.slotInviteOnly;
  if (Array.isArray(arr) && arr.length >= slotCount) return arr.slice(0, slotCount);
  const legacy = gig?.private === true;
  return Array.from({ length: slotCount }, () => legacy);
}

const defaultGigForDate = () => ({
  startTime: '',
  duration: 60,
  bookingStatus: '',
  slotBookingStatuses: ['unbooked'],
  artistName: '',
  artistNames: [''],
  artistFromCrm: [false],
  extraSlots: [],
  // How many artists can be confirmed for this listing before it auto-closes.
  // Defaults to 1 (today's behaviour). Only applied to non-paid bookNew listings
  // because the paid acceptance pipeline auto-declines other applicants on the
  // server. When > 1 the gig stays open after each acceptance until it fills.
  maxApplicants: 1,
  loadInTime: '',
  soundCheckTime: '',
  gigName: '',
  kind: 'Live Music',
  gigType: 'Musician/Band',
  slotBudgets: ['£'],
  slotPaymentTypes: [''], // '' = not selected; user must choose Tickets, Flat Fee, or No Payment
  slotInviteOnly: [false],
  extraInformation: '',
  private: false,
  soundManager: '',
  techSetup: {
    venueEquipmentSelected: [],
    hiredFromVenue: [],
    bandSetupNotes: '',
    technicalNotes: '',
    technicalStatus: '',
  },
  // Booking mode: 'artist' = book and pay artists, 'rental' = rent out venue
  bookingMode: '',
  rentalStartTime: '',
  rentalEndTime: '',
  rentalTimingNotes: '',
  rentalFee: '£',
  rentalStatus: '', // 'available' | 'confirmed_renter' (must be chosen)
  rentalPrivate: null,
  renterName: '',
  rentalGigId: '',
  // Core details (venue hire); access from / hard curfew use rentalStartTime / rentalEndTime. Capacity is on venue profile.
  rentalCapacity: '',
  // More details – deposit
  rentalDepositRequired: false,
  rentalDepositAmount: '£',
  // More details – documents: default to "Upload a PDF" for house rules
  rentalHouseRulesMode: 'document',
  // Unified "Book an Event" flow (addGigsMode === 'bookNew')
  timingIncludeAccess: false,
  timingAccessTime: '',
  timingIncludeSoundcheck: false,
  timingSoundcheckTime: '',
  timingIncludeMusicStart: false,
  timingMusicStartTime: '',
  timingIncludeMusicStop: false,
  timingMusicStopTime: '',
  timingIncludeVacate: false,
  timingVacateTime: '',
  paymentModel: '', // 'venue_pays_artist' | 'artist_pays_venue' | 'no_fee'
  unifiedFeeAmount: '£',
  ticketingModel: '', // 'venue' | 'artist' | 'free_entry'
  showOnVenueProfile: true,
  moreDetailsSectionOpen: false,
  listingDocEntries: null,
  // --- "auto from venue" tracking for the More details section ---
  // When true, the field should be kept in sync with the currently selected venue.
  // The wizard flips these to false as soon as the user edits the corresponding field,
  // so user customisations are never overwritten by a later venue switch.
  _gigNameAutoFromVenue: true,
  _rentalCapacityAutoFromVenue: true,
  // venueId whose listingDocEntries currently populate this gig. When the selected
  // venue's id differs, the docs are rebuilt from the new venue (preserving per-key
  // `included` toggles the user set).
  _listingDocsVenueId: null,
});

function defaultBookNewGigNameFromVenue(venue) {
  const n = venue?.name != null ? String(venue.name).trim() : '';
  return n ? `Gig at ${n}` : '';
}

function timeToMinutesHHMM(t) {
  if (!t || !String(t).trim()) return null;
  const [h, m] = String(t).trim().split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function diffMinutesEndAfterStart(start, end) {
  const sm = timeToMinutesHHMM(start);
  const em = timeToMinutesHHMM(end);
  if (sm == null || em == null) return 60;
  let d = em - sm;
  if (d <= 0) d += 24 * 60;
  return d;
}

function validateBookNewTimings(gig) {
  const g = gig || {};
  // Multi-slot: the wizard hides music start/stop and drives the timing
  // envelope from slot 0's start + the final slot's duration. Accept that
  // shape instead of demanding the top-level music fields.
  const isMultiSlot = Array.isArray(g.extraSlots) && g.extraSlots.length > 0;
  if (isMultiSlot) {
    const slot0Start = String(g.startTime || '').trim();
    const hasSlot0 = !!slot0Start && Number(g.duration) > 0;
    if (!hasSlot0) {
      return {
        ok: false,
        message: 'Each set needs a start time and a duration.',
      };
    }
    const missingExtra = (g.extraSlots || []).findIndex(
      (s) => !String(s?.startTime || '').trim() || !(Number(s?.duration) > 0),
    );
    if (missingExtra >= 0) {
      return {
        ok: false,
        message: `Set ${missingExtra + 2} is missing a start time or duration.`,
      };
    }
    return { ok: true };
  }
  const hasStart = [g.timingAccessTime, g.timingSoundcheckTime, g.timingMusicStartTime].some((t) => String(t || '').trim());
  const hasEnd = [g.timingMusicStopTime, g.timingVacateTime].some((t) => String(t || '').trim());
  if (!hasStart || !hasEnd) {
    return {
      ok: false,
      message:
        'Add at least one start time (access, soundcheck, or music start) and one end time (music stop or must vacate).',
    };
  }
  return { ok: true };
}

function buildEventTimingsForStorage(gig) {
  const g = gig || {};
  const o = {};
  if (String(g.timingAccessTime || '').trim()) o.accessFrom = g.timingAccessTime.trim();
  if (String(g.timingSoundcheckTime || '').trim()) o.soundcheck = g.timingSoundcheckTime.trim();
  if (String(g.timingMusicStartTime || '').trim()) o.musicStart = g.timingMusicStartTime.trim();
  if (String(g.timingMusicStopTime || '').trim()) o.musicStop = g.timingMusicStopTime.trim();
  if (String(g.timingVacateTime || '').trim()) o.mustVacate = g.timingVacateTime.trim();
  return Object.keys(o).length ? o : undefined;
}

function pickArtistPerformanceStart(gig) {
  const g = gig || {};
  if (String(g.timingMusicStartTime || '').trim()) return g.timingMusicStartTime.trim();
  if (String(g.timingSoundcheckTime || '').trim()) return g.timingSoundcheckTime.trim();
  if (String(g.timingAccessTime || '').trim()) return g.timingAccessTime.trim();
  return '';
}

function pickArtistPerformanceEnd(gig) {
  const g = gig || {};
  if (String(g.timingMusicStopTime || '').trim()) return g.timingMusicStopTime.trim();
  if (String(g.timingVacateTime || '').trim()) return g.timingVacateTime.trim();
  return '';
}

function pickRentalStart(gig) {
  const g = gig || {};
  if (String(g.timingAccessTime || '').trim()) return g.timingAccessTime.trim();
  if (String(g.timingSoundcheckTime || '').trim()) return g.timingSoundcheckTime.trim();
  if (String(g.timingMusicStartTime || '').trim()) return g.timingMusicStartTime.trim();
  return '';
}

function pickRentalEnd(gig) {
  const g = gig || {};
  if (String(g.timingMusicStopTime || '').trim()) return g.timingMusicStopTime.trim();
  if (String(g.timingVacateTime || '').trim()) return g.timingVacateTime.trim();
  return '';
}

function buildListingDocEntriesFromVenue(venue) {
  if (!venue) return [];
  const rows = [];
  const push = (key, title, url) => {
    const u = typeof url === 'string' && url.trim() ? url.trim() : '';
    if (!u) return;
    rows.push({
      key,
      title,
      sourceUrl: u,
      body: '',
      included: true,
    });
  };
  push('terms', 'Venue T&Cs', venue.termsAndConditions);
  push('prs', 'PRS form', venue.prs);
  push('house_rules', 'House rules', venue.houseRulesDocument);
  push('other', 'Other documents', venue.otherDocuments);
  return rows;
}

function normalizeListingDocumentsForApi(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((e) => e && e.included && (String(e.body || '').trim() || (e.sourceUrl && String(e.sourceUrl).trim())))
    .map((e) => ({
      key: e.key,
      title: e.title || 'Document',
      body: String(e.body || '').trim(),
      sourceUrl: e.sourceUrl && String(e.sourceUrl).trim() ? String(e.sourceUrl).trim() : null,
    }));
}

function isBookNewGigComplete(gig) {
  const g = gig || {};
  const t = validateBookNewTimings(g);
  if (!t.ok) return false;
  if (!g.paymentModel) return false;
  if (g.paymentModel !== 'no_fee') {
    // Multi-slot + venue_pays_artist: every slot must have a positive fee.
    const isMultiSlot = Array.isArray(g.extraSlots) && g.extraSlots.length > 0;
    if (isMultiSlot) {
      const slotCount = 1 + g.extraSlots.length;
      const budgets = Array.isArray(g.slotBudgets) ? g.slotBudgets : [];
      for (let i = 0; i < slotCount; i += 1) {
        if (!hasPositiveBudgetValue(budgets[i])) return false;
      }
    } else if (!hasPositiveBudgetValue(g.unifiedFeeAmount)) {
      return false;
    }
  }
  if (!g.ticketingModel) return false;
  return true;
}

/** Add existing event → Book artists: same fields as Book an Event, plus booked name. */
function isAddExistingArtistWizardComplete(gig) {
  const g = gig || {};
  if (!isBookNewGigComplete(g)) return false;
  // addExisting = venue already knows who's booked, so every set needs a name.
  const slotCount = 1 + (Array.isArray(g.extraSlots) ? g.extraSlots.length : 0);
  const names = getArtistNamesForSlots(g, slotCount);
  if (names.length < slotCount) return false;
  return names.every((n) => String(n ?? '').trim().length > 0);
}

/** Get dateIso string from an API gig (for edit mode). */
function getDateIsoFromGig(gig) {
  if (gig?.dateIso && typeof gig.dateIso === 'string') return gig.dateIso;
  const d = gig?.date;
  if (!d) return null;
  const dateObj = typeof d?.toDate === 'function' ? d.toDate() : d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  return format(dateObj, 'yyyy-MM-dd');
}

/** Convert API rental gig (from full page / Firestore) to form gig shape for AddGigsModal. */
function apiRentalGigToFormGig(apiGig) {
  const def = defaultGigForDate();
  const feeCandidates = [apiGig?.budget, apiGig?.rentalFee, apiGig?.hireFee];
  const fee = feeCandidates.find((v) => v != null && String(v).trim() !== '') ?? '';
  const feeRaw = String(fee ?? '').trim();
  const feeDigits = feeRaw.replace(/[^\d]/g, '');
  const feeStr = typeof fee === 'number'
    ? (fee === 0 ? '£0' : `£${fee}`)
    : (feeRaw.toLowerCase() === 'free' || feeDigits === '0' ? '£0' : (feeRaw || '£'));
  const status = apiGig?.rentalStatus ?? (apiGig?.status === 'confirmed' ? 'confirmed_renter' : 'available');
  const hasDocs = Array.isArray(apiGig?.documents) && apiGig.documents.length > 0;
  const firstDocUrl = hasDocs && apiGig.documents[0]?.url ? apiGig.documents[0].url : '';
  const notesInternal = (apiGig?.notesInternal ?? apiGig?.internalNotes ?? '').toString().trim();
  return {
    ...def,
    bookingMode: 'rental',
    gigName: (apiGig?.gigName ?? '').trim() || def.gigName,
    // Accept both legacy and current field names when prefilling edit modal.
    rentalStartTime: (apiGig?.rentalAccessFrom ?? apiGig?.accessFrom ?? apiGig?.startTime ?? '').toString().trim() || '',
    rentalEndTime: (apiGig?.rentalHardCurfew ?? apiGig?.curfew ?? apiGig?.endTime ?? '').toString().trim() || '',
    rentalFee: feeStr,
    rentalStatus: status,
    rentalPrivate: apiGig?.private ?? (status === 'confirmed_renter'),
    renterName: (apiGig?.renterName ?? apiGig?.hirerName ?? '').toString().trim() || '',
    rentalGigId: apiGig?.gigId ?? apiGig?.id ?? apiGig?.rentalGigId ?? '',
    rentalCapacity: (apiGig?.rentalCapacity ?? apiGig?.capacity ?? '').toString().trim() || '',
    rentalDepositRequired: !!(apiGig?.rentalDepositRequired ?? apiGig?.depositRequired),
    rentalDepositAmount: apiGig?.rentalDepositAmount ?? apiGig?.depositAmount ?? '£',
    rentalHouseRulesMode: hasDocs ? 'document' : 'text',
    rentalHouseRulesDocument: firstDocUrl || undefined,
    rentalHouseRules: notesInternal || '',
    soundManager: (apiGig?.soundManager ?? '').toString().trim() || '',
    techSetup: {
      venueEquipmentSelected: Array.isArray(apiGig?.techSetup?.venueEquipmentSelected) ? apiGig.techSetup.venueEquipmentSelected : [],
      hiredFromVenue: Array.isArray(apiGig?.techSetup?.hiredFromVenue) ? apiGig.techSetup.hiredFromVenue : [],
      bandSetupNotes: (apiGig?.techSetup?.bandSetupNotes ?? '').toString().trim() || '',
      technicalNotes: (apiGig?.techSetup?.technicalNotes ?? '').toString().trim() || '',
      technicalStatus: (apiGig?.techSetup?.technicalStatus ?? '').toString().trim() || '',
    },
    // In edit mode we treat any persisted title/capacity as explicit user input.
    _gigNameAutoFromVenue: !((apiGig?.gigName ?? '').toString().trim()),
    _rentalCapacityAutoFromVenue:
      !((apiGig?.rentalCapacity ?? '').toString().trim()) &&
      !((apiGig?.capacity ?? '').toString().trim()),
    _listingDocsVenueId: null,
  };
}

/**
 * Normalise one raw fee value (number, string like "£100", or "Free") into the
 * `£NNN` / `£0` / `£` input format that the wizard's fee fields expect.
 */
function rawFeeToFormFeeAmount(raw) {
  if (raw == null) return '£';
  if (raw === 0) return '£0';
  const s = String(raw).trim();
  if (!s || s === '£') return '£';
  if (s.toLowerCase() === 'free') return '£0';
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return '£';
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return '£';
  return n === 0 ? '£0' : `£${n}`;
}

/**
 * Convert an API artist-booking gig (from Firestore) to form gig shape for the
 * Book-an-Event wizard.
 *
 * Accepts both single-slot gigs and multi-slot groups (as packaged by
 * `Gigs.jsx`/`GigApplications.jsx` with `extraSlots` + `slotBudgets` +
 * `existingGigIds`). For multi-slot input, the returned form gig preserves
 * per-slot timings and budgets so the wizard can render the multi-slot UI,
 * and keeps `existingGigIds` for the update path to re-target each doc.
 */
function apiArtistBookingGigToFormGig(apiGig) {
  const def = defaultGigForDate();

  const hasExtraSlots = Array.isArray(apiGig?.extraSlots) && apiGig.extraSlots.length > 0;
  const existingGigIds = Array.isArray(apiGig?.existingGigIds) ? apiGig.existingGigIds : null;
  const slotCount = 1 + (hasExtraSlots ? apiGig.extraSlots.length : 0);

  // Fee: prefer numeric budgetValue, then slotBudgets[0], then budget string.
  const rawSlotBudget = Array.isArray(apiGig?.slotBudgets) ? apiGig.slotBudgets[0] : null;
  const feeCandidate = apiGig?.budget ?? rawSlotBudget ?? apiGig?.budgetValue;
  const feeRaw = feeCandidate == null ? '' : String(feeCandidate).trim();
  const feeDigits = feeRaw.replace(/[^\d]/g, '');
  const feeNum = feeDigits ? parseInt(feeDigits, 10) : NaN;
  const feeIsZero = feeRaw.toLowerCase() === 'free' || feeDigits === '0' || feeCandidate === 0;
  const unifiedFeeAmount = feeIsZero
    ? '£0'
    : Number.isFinite(feeNum) && feeNum > 0
      ? `£${feeNum}`
      : (feeRaw && feeRaw !== '£' ? feeRaw : '£');

  // Payment model: prefer explicit paymentModel; else infer from kind + fee.
  const kind = apiGig?.kind || 'Live Music';
  let paymentModel = apiGig?.paymentModel;
  if (!paymentModel) {
    if (kind === 'Open Mic' || kind === 'Ticketed Gig' || feeIsZero) paymentModel = 'no_fee';
    else paymentModel = 'venue_pays_artist';
  }

  // Ticketing model: prefer explicit ticketingModel; else infer from kind.
  let ticketingModel = apiGig?.ticketingModel;
  if (!ticketingModel) {
    if (kind === 'Ticketed Gig') ticketingModel = 'artist';
    else if (kind === 'Open Mic') ticketingModel = 'free_entry';
    else ticketingModel = 'venue';
  }

  // Event timings: prefer persisted eventTimings object, else derive from startDateTime + duration.
  const et = apiGig?.eventTimings || {};
  const timingAccessTime = String(et.accessFrom || apiGig?.loadInTime || '').trim();
  const timingSoundcheckTime = String(et.soundcheck || apiGig?.soundCheckTime || '').trim();
  let timingMusicStartTime = String(et.musicStart || '').trim();
  let timingMusicStopTime = String(et.musicStop || '').trim();
  const timingVacateTime = String(et.mustVacate || '').trim();
  if (!timingMusicStartTime) {
    const sdt = apiGig?.startDateTime;
    const startDateObj = sdt ? (typeof sdt?.toDate === 'function' ? sdt.toDate() : new Date(sdt)) : null;
    if (startDateObj && !isNaN(startDateObj.getTime())) {
      const hh = String(startDateObj.getHours()).padStart(2, '0');
      const mm = String(startDateObj.getMinutes()).padStart(2, '0');
      timingMusicStartTime = `${hh}:${mm}`;
      const dur = Number(apiGig?.duration);
      if (Number.isFinite(dur) && dur > 0 && !timingMusicStopTime) {
        const endDate = new Date(startDateObj.getTime() + dur * 60000);
        const eh = String(endDate.getHours()).padStart(2, '0');
        const em = String(endDate.getMinutes()).padStart(2, '0');
        timingMusicStopTime = `${eh}:${em}`;
      }
    }
  }

  const listingDocEntries = Array.isArray(apiGig?.listingDocEntries) ? apiGig.listingDocEntries : null;
  const extraInformation = String(apiGig?.extraInformation ?? apiGig?.description ?? '').trim();

  // Multi-slot: slot 0 uses the primary gig's startTime/duration. Slot budgets
  // are normalised into the form's `£N` string format. Slot names collapse to
  // the shared set of names passed in on the converted gig.
  const primarySlotStart = String(apiGig?.startTime ?? '').trim() || timingMusicStartTime;
  const primarySlotDurationNum = Number(apiGig?.duration);
  const primarySlotDuration = Number.isFinite(primarySlotDurationNum) && primarySlotDurationNum > 0
    ? primarySlotDurationNum
    : (timingMusicStartTime && timingMusicStopTime
      ? diffMinutesEndAfterStart(timingMusicStartTime, timingMusicStopTime)
      : 60);
  const normalisedExtraSlots = hasExtraSlots
    ? apiGig.extraSlots.map((s) => ({
      startTime: String(s?.startTime ?? '').trim(),
      duration: Number.isFinite(Number(s?.duration)) && Number(s.duration) > 0 ? Number(s.duration) : 60,
    }))
    : [];
  const rawSlotBudgets = Array.isArray(apiGig?.slotBudgets) ? apiGig.slotBudgets : null;
  const normalisedSlotBudgets = rawSlotBudgets && rawSlotBudgets.length >= slotCount
    ? rawSlotBudgets.slice(0, slotCount).map(rawFeeToFormFeeAmount)
    : Array.from({ length: slotCount }, () => unifiedFeeAmount);

  return {
    ...def,
    bookingMode: 'artist',
    kind,
    gigType: apiGig?.gigType || def.gigType,
    gigName: (apiGig?.gigName ?? '').toString().trim(),
    extraInformation,
    paymentModel,
    unifiedFeeAmount,
    ticketingModel,
    timingAccessTime,
    timingSoundcheckTime,
    timingMusicStartTime,
    timingMusicStopTime,
    timingVacateTime,
    showOnVenueProfile: apiGig?.private == null ? true : !apiGig.private,
    rentalCapacity: (apiGig?.capacity ?? apiGig?.rentalCapacity ?? '').toString().trim(),
    artistName: (apiGig?.artistName ?? '').toString(),
    artistNames: (() => {
      if (Array.isArray(apiGig?.artistNames)) return apiGig.artistNames.slice(0, slotCount);
      // Fall back to the confirmed applicant on the primary doc so
      // single-slot addExisting edits prefill the per-set Artist input.
      const confirmedFromApplicants = (() => {
        const apps = Array.isArray(apiGig?.applicants) ? apiGig.applicants : [];
        const confirmed = apps.find((a) => a?.status === 'confirmed' && (a?.name ?? '').toString().trim());
        return confirmed?.name ?? '';
      })();
      const fallback = apiGig?.artistName ?? confirmedFromApplicants ?? '';
      return Array.from({ length: slotCount }, () => fallback);
    })(),
    soundManager: (apiGig?.soundManager ?? '').toString().trim(),
    techSetup: {
      venueEquipmentSelected: Array.isArray(apiGig?.techSetup?.venueEquipmentSelected) ? apiGig.techSetup.venueEquipmentSelected : [],
      hiredFromVenue: Array.isArray(apiGig?.techSetup?.hiredFromVenue) ? apiGig.techSetup.hiredFromVenue : [],
      bandSetupNotes: (apiGig?.techSetup?.bandSetupNotes ?? '').toString().trim(),
      technicalNotes: (apiGig?.techSetup?.technicalNotes ?? '').toString().trim(),
      technicalStatus: (apiGig?.techSetup?.technicalStatus ?? '').toString().trim(),
    },
    listingDocEntries,
    maxApplicants: (() => {
      const raw = Number(apiGig?.maxApplicants);
      return Number.isFinite(raw) && raw >= 1 ? Math.min(10, Math.floor(raw)) : 1;
    })(),
    // Multi-slot data — re-used by the wizard's per-slot UI and by the update
    // path to target each existing gig doc by id.
    startTime: primarySlotStart,
    duration: primarySlotDuration,
    extraSlots: normalisedExtraSlots,
    slotBudgets: normalisedSlotBudgets,
    existingGigIds: existingGigIds || (apiGig?.gigId ? [apiGig.gigId] : null),
    // In edit mode, treat persisted values as user-set to prevent venue-switch clobber.
    _gigNameAutoFromVenue: !((apiGig?.gigName ?? '').toString().trim()),
    _rentalCapacityAutoFromVenue: !((apiGig?.capacity ?? apiGig?.rentalCapacity ?? '').toString().trim()),
    _listingDocsVenueId: listingDocEntries ? (apiGig?.venueId ?? null) : null,
  };
}

/** Build techSetup payload for API (only non-empty fields). */
function buildTechSetupPayload(techSetup) {
  if (!techSetup || typeof techSetup !== 'object') return undefined;
  const v = techSetup.venueEquipmentSelected;
  const h = techSetup.hiredFromVenue;
  const venueEquipmentSelected = Array.isArray(v) && v.length > 0 ? v : undefined;
  const hiredFromVenue = Array.isArray(h) && h.length > 0 ? h : undefined;
  const bandSetupNotes = (techSetup.bandSetupNotes ?? '').toString().trim() || undefined;
  const technicalNotes = (techSetup.technicalNotes ?? '').toString().trim() || undefined;
  const technicalStatus = (techSetup.technicalStatus ?? '').toString().trim() || undefined;
  if (!venueEquipmentSelected && !hiredFromVenue && !bandSetupNotes && !technicalNotes && !technicalStatus) return undefined;
  return {
    ...(venueEquipmentSelected && { venueEquipmentSelected }),
    ...(hiredFromVenue && { hiredFromVenue }),
    ...(bandSetupNotes && { bandSetupNotes }),
    ...(technicalNotes && { technicalNotes }),
    ...(technicalStatus && { technicalStatus }),
  };
}

/** Returns artist names array with one entry per slot; fills from artistNames or legacy artistName. */
function getArtistNamesForSlots(gig, slotCount) {
  const names = gig?.artistNames;
  if (Array.isArray(names) && names.length >= slotCount) return names.slice(0, slotCount);
  const fallback = gig?.artistName ?? '';
  return Array.from({ length: slotCount }, (_, i) => (names && names[i] !== undefined ? names[i] : fallback));
}

/** Returns whether each slot's artist was selected from CRM (contact book). */
function getArtistFromCrmForSlots(gig, slotCount) {
  const fromCrm = gig?.artistFromCrm;
  if (Array.isArray(fromCrm) && fromCrm.length >= slotCount) return fromCrm.slice(0, slotCount);
  return Array.from({ length: slotCount }, () => false);
}

/** Returns booking status per slot; falls back to legacy gig.bookingStatus for first slot if no slotBookingStatuses. */
function getSlotBookingStatuses(gig, slotCount) {
  const statuses = gig?.slotBookingStatuses;
  if (Array.isArray(statuses) && statuses.length >= slotCount) return statuses.slice(0, slotCount);
  const legacy = gig?.bookingStatus ?? '';
  return Array.from({ length: slotCount }, (_, i) => (i === 0 && legacy ? legacy : (statuses?.[i] ?? 'unbooked')));
}

function addMinutesToTime(timeStr, minutesToAdd) {
  if (!timeStr || !String(timeStr).trim()) return '';
  const [h, m] = String(timeStr).trim().split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const base = new Date(0, 0, 0, h, Number.isFinite(m) ? m : 0);
  base.setMinutes(base.getMinutes() + (Number(minutesToAdd) || 0));
  return base.toTimeString().slice(0, 5);
}

/** Earliest valid HH:MM for slot `index` (after previous slot ends); empty if not computable. */
function minStartTimeAfterPreviousSlot(slots, index) {
  if (index <= 0 || !slots?.length) return '';
  const prev = slots[index - 1];
  const prevStart = String(prev?.startTime ?? '').trim();
  const prevDur = Number(prev?.duration) || 0;
  if (!prevStart || prevDur <= 0) return '';
  return addMinutesToTime(prevStart, prevDur);
}

/** True when this slot starts before the previous slot has finished (both slots fully timed). */
function isArtistSlotStartBeforePreviousEnds(slots, index) {
  if (index <= 0 || !slots || index >= slots.length) return false;
  const minOk = minStartTimeAfterPreviousSlot(slots, index);
  const curStart = String(slots[index]?.startTime ?? '').trim();
  const curDur = Number(slots[index]?.duration) || 0;
  if (!minOk || !curStart || curDur <= 0) return false;
  return curStart < minOk;
}

/** First slot index (≥1) with invalid ordering, or null. */
function getFirstArtistSlotChronologyViolation(gig) {
  if (gig?.bookingMode !== 'artist') return null;
  const slots = [
    { startTime: gig.startTime ?? '', duration: gig.duration },
    ...(gig.extraSlots || []).map((s) => ({ startTime: s?.startTime ?? '', duration: s?.duration })),
  ];
  for (let i = 1; i < slots.length; i++) {
    if (isArtistSlotStartBeforePreviousEnds(slots, i)) return i;
  }
  return null;
}

const getHours = (duration) => Math.floor((Number(duration) || 0) / 60);
const getMinutes = (duration) => (Number(duration) || 0) % 60;

const VALID_PAYMENT_TYPES = ['tickets', 'flat_fee', 'no_payment'];
const hasPositiveBudgetValue = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0;
};

function isGigValid(gig) {
  if (gig?.bookingMode === 'rental') {
    const start = (gig?.rentalStartTime ?? '').toString().trim();
    const end = (gig?.rentalEndTime ?? '').toString().trim();
    const feeDigits = String(gig?.rentalFee ?? '').replace(/[^\d]/g, '');
    if (!start) return false;
    if (!end) return false;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) return false;
    const startMinutes = sh * 60 + (Number.isFinite(sm) ? sm : 0);
    const endMinutes = eh * 60 + (Number.isFinite(em) ? em : 0);
    if (!(endMinutes > startMinutes)) return false;
    if (!feeDigits) return false;
    const status = gig.rentalStatus;
    if (status !== 'available' && status !== 'confirmed_renter') return false;
    if (status === 'available' && typeof gig.rentalPrivate !== 'boolean') return false;
    if (gig.rentalDepositRequired) {
      const depositDigits = String(gig.rentalDepositAmount ?? '').replace(/[^\d]/g, '');
      if (!depositDigits) return false;
    }
    return true;
  }
  if (gig?.bookingMode !== 'artist') return false;
  const startTime = (gig?.startTime ?? '').toString().trim();
  const duration = gig?.duration;
  const hasStartTime = startTime.length > 0;
  const hasDuration = duration != null && duration !== '' && Number(duration) > 0;
  const slotCount = 1 + (gig?.extraSlots?.length || 0);
  const slotStatuses = getSlotBookingStatuses(gig, slotCount);
  const artistNames = getArtistNamesForSlots(gig, slotCount);
  const paymentTypes = getSlotPaymentTypes(gig, slotCount);
  const slotBudgets = getSlotBudgetsFor(gig, slotCount);
  const paymentValid = paymentTypes.every((pt, i) => (
    VALID_PAYMENT_TYPES.includes(pt) || (!pt && hasPositiveBudgetValue(slotBudgets[i]))
  ));
  const bookingValid = slotStatuses.every((status, i) => {
    if (status !== 'unbooked' && status !== 'confirmed') return false;
    if (status === 'confirmed' && !(artistNames[i] ?? '').trim()) return false;
    return true;
  });
  if (getFirstArtistSlotChronologyViolation(gig) !== null) return false;
  return hasStartTime && hasDuration && paymentValid && bookingValid;
}

/** Returns the first missing field key for this gig, or null if valid. */
function getFirstMissingField(gig) {
  const g = gig || {};
  if (!g.bookingMode) return 'bookingMode';
  if (g.bookingMode === 'rental') {
    const start = (g.rentalStartTime ?? '').toString().trim();
    const end = (g.rentalEndTime ?? '').toString().trim();
    const feeDigits = String(g.rentalFee ?? '').replace(/[^\d]/g, '');
    if (!start) return 'rentalStartTime';
    if (!end) return 'rentalEndTime';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) return 'rentalStartTime';
    const startMinutes = sh * 60 + (Number.isFinite(sm) ? sm : 0);
    const endMinutes = eh * 60 + (Number.isFinite(em) ? em : 0);
    if (!(endMinutes > startMinutes)) return 'rentalEndTime';
    if (!feeDigits) return 'rentalFee';
    const status = g.rentalStatus;
    if (status !== 'available' && status !== 'confirmed_renter') return 'rentalStatus';
    if (status === 'available' && typeof g.rentalPrivate !== 'boolean') return 'rentalPrivate';
    if (status === 'confirmed_renter' && !(g.renterName ?? '').toString().trim()) return 'renterName';
    if (g.rentalDepositRequired) {
      const depositDigits = String(g.rentalDepositAmount ?? '').replace(/[^\d]/g, '');
      if (!depositDigits) return 'rentalDepositAmount';
    }
    return null;
  }
  const startTime = (g.startTime ?? '').toString().trim();
  const duration = g.duration;
  const slotCount = 1 + (g.extraSlots?.length || 0);
  const slotStatuses = getSlotBookingStatuses(g, slotCount);
  const artistNames = getArtistNamesForSlots(g, slotCount);
  const paymentTypes = getSlotPaymentTypes(g, slotCount);
  const slotBudgets = getSlotBudgetsFor(g, slotCount);
  if (!startTime) return 'startTime';
  if (duration == null || duration === '' || Number(duration) <= 0) return 'duration';
  const paymentIdx = paymentTypes.findIndex((pt, i) => !VALID_PAYMENT_TYPES.includes(pt) && !(pt === '' && hasPositiveBudgetValue(slotBudgets[i])));
  if (paymentIdx >= 0) return { payment: paymentIdx };
  const bookingIdx = slotStatuses.findIndex((s) => s !== 'unbooked' && s !== 'confirmed');
  if (bookingIdx >= 0) return { booking: bookingIdx };
  const artistIdx = slotStatuses.findIndex((s, i) => s === 'confirmed' && !(artistNames[i] ?? '').trim());
  if (artistIdx >= 0) return { artistName: artistIdx };
  const chronoIdx = getFirstArtistSlotChronologyViolation(g);
  if (chronoIdx !== null) return { slotStartOrder: chronoIdx };
  return null;
}

export function AddGigsModal({
  onClose,
  venues = [],
  user,
  refreshGigs,
  initialDateIso,
  editGigData,
  addGigsMode,
  templates = [],
  refreshTemplates,
  bookNewTemplateToApply = null,
  onBookNewTemplateConsumed,
  buildingForMusician = false,
  buildingForMusicianData = null,
  setBuildingForMusician,
  setBuildingForMusicianData,
  requestId = null,
  setRequestId,
  setRequests,
  preferredDate = null,
  setPreferredDate,
}) {
  // A gig is in edit mode when we have editGigData with a known shape. We
  // accept venue-hire (rental) and both single- and multi-slot artist-booking
  // gigs. Multi-slot edits rely on `existingGigIds` being set on editGigData
  // (packaged by Gigs.jsx / GigApplications.jsx) so the update path can
  // retarget each Firestore doc.
  const isVenueHireEdit = !!(
    editGigData &&
    (editGigData.kind === 'Venue Rental' ||
      editGigData.bookingMode === 'rental' ||
      editGigData.bookingMode === 'venue_hire' ||
      editGigData.itemType === 'venue_hire')
  );
  const isArtistBookingEdit = !!(
    editGigData &&
    editGigData.gigId &&
    !isVenueHireEdit
  );
  const isEditMode = isVenueHireEdit || isArtistBookingEdit;
  const editDateIso = isEditMode ? getDateIsoFromGig(editGigData) : null;
  // When building a gig for a specific musician, a preferredDate coming from
  // the originating screen (message / request / profile) is pre-selected and
  // the musician's venue (if attached to the request) becomes the default.
  const buildForMusicianActive = !!(buildingForMusician && buildingForMusicianData);
  const buildForMusicianIso = (() => {
    if (!buildForMusicianActive || !preferredDate) return null;
    try {
      const d = preferredDate instanceof Date ? preferredDate : new Date(preferredDate);
      if (isNaN(d.getTime())) return null;
      return format(d, 'yyyy-MM-dd');
    } catch { return null; }
  })();
  const initialIso = editDateIso || initialDateIso || buildForMusicianIso;
  /** When editing an already confirmed venue hire (manually confirmed), show only from "Venue access & timings" down. */
  const effectiveRentalStatus =
    editGigData?.rentalStatus ?? (editGigData?.status === 'confirmed' ? 'confirmed_renter' : 'available');
  const hasRenterName = !!((editGigData?.renterName ?? editGigData?.hirerName ?? '').toString().trim());
  const isEditManuallyConfirmed =
    isVenueHireEdit && (effectiveRentalStatus === 'confirmed_renter' || hasRenterName);

  const [step, setStep] = useState(() => (initialIso ? 'details' : 'dates'));
  const [bookNewTimingError, setBookNewTimingError] = useState(null);
  const [month, setMonth] = useState(() => {
    if (initialIso) {
      const d = new Date(initialIso + 'T12:00:00');
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });
  const [selectedDates, setSelectedDates] = useState(() => (initialIso ? [initialIso] : []));
  const [gigsByDate, setGigsByDate] = useState(() => {
    if (isEditMode && editDateIso && editGigData) {
      const mapped = isVenueHireEdit
        ? apiRentalGigToFormGig(editGigData)
        : apiArtistBookingGigToFormGig(editGigData);
      return { [editDateIso]: mapped };
    }
    if (initialIso) {
      const base = defaultGigForDate();
      if (buildForMusicianActive) {
        // Gig is being built for a specific artist: default to a private
        // invite-only listing, seed the musician type, and carry their genres
        // through for downstream discovery, even though the wizard itself
        // doesn't expose a genre input.
        return {
          [initialIso]: {
            ...base,
            gigType: buildingForMusicianData?.type || base.gigType,
            genre: Array.isArray(buildingForMusicianData?.genres) ? buildingForMusicianData.genres : [],
            showOnVenueProfile: false,
            private: true,
          },
        };
      }
      return { [initialIso]: base };
    }
    return {};
  });
  const [activeTab, setActiveTab] = useState(initialIso || null);
  const [venueId, setVenueId] = useState(() => {
    if (isEditMode && editGigData?.venueId) return editGigData.venueId;
    if (buildForMusicianActive) {
      const bfmVid = buildingForMusicianData?.venueId;
      if (bfmVid && venues.some((v) => v.venueId === bfmVid)) return bfmVid;
    }
    const tplVid = bookNewTemplateToApply?.venueId;
    if (tplVid && venues.some((v) => v.venueId === tplVid)) return tplVid;
    return venues[0]?.venueId || '';
  });
  const [addingToCrm, setAddingToCrm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [focusInvalidField, setFocusInvalidField] = useState(null);
  const [invalidFieldHighlight, setInvalidFieldHighlight] = useState(null);
  const [invalidFieldHighlightTab, setInvalidFieldHighlightTab] = useState(null);
  const [showMoreDetails, setShowMoreDetails] = useState(() => isEditMode);
  const [myArtists, setMyArtists] = useState([]);
  const [openArtistDropdownForSlot, setOpenArtistDropdownForSlot] = useState(null);
  const [expandedSlotsByDate, setExpandedSlotsByDate] = useState({});
  const [artistSlotCountByDate, setArtistSlotCountByDate] = useState(() => {
    // Multi-slot edits: seed the per-date slot count from the packaged
    // existingGigIds / extraSlots so the wizard's slot controls and the
    // per-slot update loop agree on how many slots there are on first render.
    if (isEditMode && isArtistBookingEdit && editDateIso && editGigData) {
      const ids = Array.isArray(editGigData.existingGigIds) ? editGigData.existingGigIds : [];
      const extras = Array.isArray(editGigData.extraSlots) ? editGigData.extraSlots : [];
      const count = Math.max(ids.length, 1 + extras.length, 1);
      return { [editDateIso]: count };
    }
    return {};
  });
  const [modalHasScroll, setModalHasScroll] = useState(false);
  const [hasCopiedRentalLink, setHasCopiedRentalLink] = useState(false);
  const [showSaveBookNewTemplateModal, setShowSaveBookNewTemplateModal] = useState(false);
  const [templateSaveNameInput, setTemplateSaveNameInput] = useState('');
  const [savingBookNewTemplate, setSavingBookNewTemplate] = useState(false);
  const [showUseBookNewTemplateModal, setShowUseBookNewTemplateModal] = useState(false);
  const [showApplyBookNewTemplateScopeModal, setShowApplyBookNewTemplateScopeModal] = useState(false);
  const [pendingApplyBookNewTemplate, setPendingApplyBookNewTemplate] = useState(null);
  const [showBookNewListingPreview, setShowBookNewListingPreview] = useState(false);
  /** After a template is applied in this modal session, show success styling on the CTA (modal remount resets). */
  const [bookNewTemplateAppliedInSession, setBookNewTemplateAppliedInSession] = useState(false);
  /**
   * When building for a musician without a Gigin profile, we open the
   * InviteMethodsModal inline. Keeping the state local avoids coupling to
   * Dashboard-level invite state.
   */
  const [inlineInviteMethods, setInlineInviteMethods] = useState(null);
  const artistDropdownRef = useRef(null);

  const modalBodyRef = useRef(null);
  const startTimeInputRef = useRef(null);
  const durationSelectRef = useRef(null);
  const slotBookingRefs = useRef([]);
  const slotPaymentRefs = useRef([]);
  const artistNameInputRefs = useRef([]);

  const sortedDates = useMemo(() => [...selectedDates].sort(), [selectedDates]);

  const bookNewTemplatesForVenue = useMemo(() => {
    const list = filterBookNewEventTemplatesForVenue(templates, venueId);
    return [...list].sort((a, b) =>
      String(a.templateName || '').localeCompare(String(b.templateName || ''), undefined, { sensitivity: 'base' })
    );
  }, [templates, venueId]);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.venueId === venueId),
    [venues, venueId]
  );

  useEffect(() => {
    if (addGigsMode !== 'bookNew' || step !== 'details') {
      setShowBookNewListingPreview(false);
    }
  }, [addGigsMode, step]);

  useEffect(() => {
    setHasCopiedRentalLink(false);
  }, [activeTab, step]);

  const getDocFileName = (fileOrUrl, venueUrl) => {
    if (fileOrUrl && typeof fileOrUrl === 'object' && fileOrUrl.name) {
      return fileOrUrl.name;
    }
    const url = typeof fileOrUrl === 'string' ? fileOrUrl : venueUrl;
    if (!url || typeof url !== 'string') return '';
    try {
      // Strip query string first so we don't include ?alt=media&token=...
      const [base] = url.split('?');
      // Firebase storage URLs usually have the encoded path after `/o/`
      const encodedPath = base.includes('/o/') ? base.split('/o/')[1] : base;
      const decodedPath = decodeURIComponent(encodedPath);
      const parts = decodedPath.split('/');
      return parts[parts.length - 1] || '';
    } catch {
      return '';
    }
  };

  const openDocumentInNewTab = (fileOrUrl, venueUrl) => {
    const source = fileOrUrl || venueUrl;
    if (!source) return;
    if (typeof source === 'string') {
      window.open(source, '_blank', 'noopener');
      return;
    }
    if (typeof File !== 'undefined' && source instanceof File) {
      const blobUrl = URL.createObjectURL(source);
      window.open(blobUrl, '_blank', 'noopener');
    }
  };

  // Default rental house rules to venue's house rules document when venue has one and gig hasn't set one
  useEffect(() => {
    if (!activeTab || !selectedVenue?.houseRulesDocument) return;
    const gig = gigsByDate[activeTab] || defaultGigForDate();
    if (
      gig.bookingMode === 'rental' &&
      gig.rentalHouseRulesMode !== 'text' &&
      !gig.rentalHouseRulesDocument
    ) {
      updateGig(activeTab, {
        rentalHouseRulesMode: 'document',
        rentalHouseRulesDocument: selectedVenue.houseRulesDocument,
      });
    }
  }, [activeTab, selectedVenue?.houseRulesDocument, gigsByDate[activeTab]]);

  // Default terms & conditions and PRS from venue when gig doesn't have them
  useEffect(() => {
    if (!activeTab || selectedVenue == null) return;
    const gig = gigsByDate[activeTab] || defaultGigForDate();
    if (gig.bookingMode !== 'rental') return;
    const updates = {};
    if (!gig.rentalTermsAndConditions && selectedVenue.termsAndConditions) {
      updates.rentalTermsAndConditions = selectedVenue.termsAndConditions;
    }
    if (!gig.rentalPrs && selectedVenue.prs) {
      updates.rentalPrs = selectedVenue.prs;
    }
    if (Object.keys(updates).length) {
      updateGig(activeTab, updates);
    }
  }, [activeTab, selectedVenue?.termsAndConditions, selectedVenue?.prs, gigsByDate[activeTab]]);

  useEffect(() => {
    if (!activeTab || !focusInvalidField) return;
    const timer = setTimeout(() => {
      let ref = null;
      if (focusInvalidField === 'startTime') ref = startTimeInputRef.current;
      else if (focusInvalidField === 'duration') ref = durationSelectRef.current;
      else if (focusInvalidField && typeof focusInvalidField === 'object' && focusInvalidField.booking !== undefined)
        ref = slotBookingRefs.current[focusInvalidField.booking]?.querySelector('button');
      else if (focusInvalidField && typeof focusInvalidField === 'object' && focusInvalidField.artistName !== undefined)
        ref = artistNameInputRefs.current[focusInvalidField.artistName];
      else if (focusInvalidField && typeof focusInvalidField === 'object' && focusInvalidField.payment !== undefined)
        ref = slotPaymentRefs.current[focusInvalidField.payment]?.querySelector('button');
      else if (focusInvalidField && typeof focusInvalidField === 'object' && focusInvalidField.slotStartOrder !== undefined) {
        ref = document.getElementById(`add-gigs-slot-start-time-${activeTab}-${focusInvalidField.slotStartOrder}`);
      }
      ref?.focus?.();
      setFocusInvalidField(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab, focusInvalidField]);

  useEffect(() => {
    if (invalidFieldHighlight === 'booking' && activeTab) {
      const gig = gigsByDate[activeTab] || defaultGigForDate();
      const slotCount = 1 + (gig.extraSlots?.length || 0);
      const statuses = getSlotBookingStatuses(gig, slotCount);
      if (statuses.every((s) => s === 'confirmed' || s === 'unbooked')) {
        setInvalidFieldHighlight(null);
        setInvalidFieldHighlightTab(null);
      }
    }
    if (invalidFieldHighlight && typeof invalidFieldHighlight === 'object' && invalidFieldHighlight.payment !== undefined && activeTab) {
      const gig = gigsByDate[activeTab] || defaultGigForDate();
      const slotCount = 1 + (gig.extraSlots?.length || 0);
      const paymentTypes = getSlotPaymentTypes(gig, slotCount);
      if (paymentTypes.every((pt) => VALID_PAYMENT_TYPES.includes(pt))) {
        setInvalidFieldHighlight(null);
        setInvalidFieldHighlightTab(null);
      }
    }
    const rentalFields = ['rentalDepositAmount'];
    if (invalidFieldHighlight && rentalFields.includes(invalidFieldHighlight) && activeTab) {
      const gig = gigsByDate[activeTab] || defaultGigForDate();
      if (gig.bookingMode === 'rental' && getFirstMissingField(gig) === null) {
        setInvalidFieldHighlight(null);
        setInvalidFieldHighlightTab(null);
      }
    }
    if (invalidFieldHighlight && typeof invalidFieldHighlight === 'object' && invalidFieldHighlight.slotStartOrder !== undefined && activeTab) {
      const gig = gigsByDate[activeTab] || defaultGigForDate();
      if (getFirstArtistSlotChronologyViolation(gig) === null) {
        setInvalidFieldHighlight(null);
        setInvalidFieldHighlightTab(null);
      }
    }
  }, [activeTab, gigsByDate, invalidFieldHighlight]);

  useEffect(() => {
    if (!user?.uid || step !== 'details') return;
    let cancelled = false;
    (async () => {
      try {
        const entries = await getArtistCRMEntries(user.uid);
        if (!cancelled) setMyArtists(entries || []);
      } catch (err) {
        console.error('Error loading My Artists:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, step]);


  useEffect(() => {
    if (openArtistDropdownForSlot === null) return;
    const handleClickOutside = (e) => {
      if (artistDropdownRef.current?.contains(e.target)) return;
      setOpenArtistDropdownForSlot(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openArtistDropdownForSlot]);

  function getStartDateTime(dateIso, startTime) {
    const timeStr = String(startTime ?? '').trim();
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(dateIso + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    d.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
    return d;
  }

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = monthStart.getDay();
  const padArray = Array.from({ length: startPad }, (_, i) => null);

  const toggleDate = (iso) => {
    setSelectedDates((prev) => {
      const set = new Set(prev);
      if (set.has(iso)) set.delete(iso);
      else set.add(iso);
      return Array.from(set);
    });
  };

  const goNext = () => {
    const venue = venues.find((v) => v.venueId === venueId);
    const autoGigName = addGigsMode === 'bookNew' ? defaultBookNewGigNameFromVenue(venue) : '';
    const tpl = addGigsMode === 'bookNew' ? bookNewTemplateToApply : null;
    const byDate = {};
    selectedDates.forEach((iso) => {
      let g = gigsByDate[iso] || defaultGigForDate();
      if (autoGigName && !String(g.gigName ?? '').trim()) {
        g = { ...g, gigName: autoGigName };
      }
      if (tpl) {
        g = applyBookNewTemplateToGig(g, tpl);
      }
      byDate[iso] = g;
    });
    setGigsByDate(byDate);
    const firstIso = [...selectedDates].sort()[0];
    setActiveTab(firstIso || null);
    if (addGigsMode === 'bookNew') {
      setBookNewTimingError(null);
    }
    if (tpl) {
      onBookNewTemplateConsumed?.();
      setBookNewTemplateAppliedInSession(true);
    }
    setStep('details');
  };

  // Unified venue-change effect for the More-details section.
  // While on the details step (bookNew or addExisting), whenever the selected venue
  // changes we refresh the three auto-from-venue fields on every pending gig:
  //   - gigName           (bookNew only; only while _gigNameAutoFromVenue === true)
  //   - rentalCapacity    (cleared while _rentalCapacityAutoFromVenue === true, so
  //                        the display/submit fallback uses the new venue's capacity)
  //   - listingDocEntries (rebuilt from the new venue whenever _listingDocsVenueId
  //                        differs, preserving the user's per-doc `included` toggles
  //                        by matching on doc `key`)
  // Fields the user has typed into (flag flipped to false) are left untouched.
  useEffect(() => {
    if (step !== 'details') return;
    const needsVenueAutoFields = addGigsMode === 'bookNew' || addGigsMode === 'addExisting';
    if (!needsVenueAutoFields) return;
    const venue = selectedVenue;
    if (!venue) return;
    const venueId = venue.venueId ?? null;
    const autoGigName = addGigsMode === 'bookNew' ? defaultBookNewGigNameFromVenue(venue) : '';

    setGigsByDate((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const iso of Object.keys(next)) {
        const gig = next[iso];
        if (!gig) continue;
        let patched = gig;

        if (
          addGigsMode === 'bookNew' &&
          gig._gigNameAutoFromVenue === true &&
          autoGigName &&
          String(gig.gigName ?? '') !== autoGigName
        ) {
          patched = { ...patched, gigName: autoGigName };
        }

        if (
          gig._rentalCapacityAutoFromVenue === true &&
          String(gig.rentalCapacity ?? '').trim() !== ''
        ) {
          patched = { ...patched, rentalCapacity: '' };
        }

        if (gig._listingDocsVenueId !== venueId || !Array.isArray(gig.listingDocEntries)) {
          const fresh = buildListingDocEntriesFromVenue(venue);
          const prevByKey = new Map();
          if (Array.isArray(gig.listingDocEntries)) {
            for (const d of gig.listingDocEntries) {
              if (d && d.key) prevByKey.set(d.key, d);
            }
          }
          const merged = fresh.map((d) => {
            const prevEntry = prevByKey.get(d.key);
            if (prevEntry && typeof prevEntry.included === 'boolean') {
              return { ...d, included: prevEntry.included };
            }
            return d;
          });
          patched = { ...patched, listingDocEntries: merged, _listingDocsVenueId: venueId };
        }

        if (patched !== gig) {
          next[iso] = patched;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [addGigsMode, step, selectedVenue?.venueId, selectedVenue?.name]);

  const removeDate = (iso) => {
    setSelectedDates((prev) => prev.filter((d) => d !== iso));
    setGigsByDate((prev) => {
      const next = { ...prev };
      delete next[iso];
      return next;
    });
    if (activeTab === iso) {
      const remaining = sortedDates.filter((d) => d !== iso);
      setActiveTab(remaining[0] || null);
    }
  };

  const updateGig = (iso, updates) => {
    setGigsByDate((prev) => ({
      ...prev,
      [iso]: { ...(prev[iso] || defaultGigForDate()), ...updates },
    }));
  };

  const setSlotInviteOnly = (iso, slotIndex, value) => {
    setGigsByDate((prev) => {
      const gig = prev[iso] || defaultGigForDate();
      const slotCount = 1 + (gig.extraSlots?.length || 0);
      const inviteOnly = getSlotInviteOnly(gig, slotCount);
      if (slotIndex < 0 || slotIndex >= inviteOnly.length) return prev;
      const next = [...inviteOnly];
      next[slotIndex] = !!value;
      return { ...prev, [iso]: { ...gig, slotInviteOnly: next } };
    });
  };

  const setSlotPaymentType = (iso, slotIndex, type) => {
    setGigsByDate((prev) => {
      const gig = prev[iso] || defaultGigForDate();
      const slotCount = 1 + (gig.extraSlots?.length || 0);
      const paymentTypes = getSlotPaymentTypes(gig, slotCount);
      const budgets = getSlotBudgetsFor(gig, slotCount);
      if (slotIndex < 0 || slotIndex >= paymentTypes.length) return prev;
      const nextPaymentTypes = [...paymentTypes];
      nextPaymentTypes[slotIndex] = type;
      const nextBudgets = [...budgets];
      if (type === 'tickets' || type === 'no_payment') nextBudgets[slotIndex] = '£';
      return {
        ...prev,
        [iso]: { ...gig, slotPaymentTypes: nextPaymentTypes, slotBudgets: nextBudgets },
      };
    });
  };

  function recalcSlotsFrom(slots, fromIdx) {
    const next = [...slots];
    for (let i = fromIdx + 1; i < next.length; i++) {
      const prev = next[i - 1];
      const end = addMinutesToTime(prev?.startTime ?? '', Number(prev?.duration) || 0);
      next[i] = { ...next[i], startTime: end || (next[i]?.startTime ?? '') };
    }
    return next;
  }

  const allSlotsFor = (iso) => {
    const gig = gigsByDate[iso] || defaultGigForDate();
    return [
      { startTime: gig.startTime ?? '', duration: gig.duration },
      ...(gig.extraSlots || []).map((s) => ({ startTime: s?.startTime ?? '', duration: s?.duration })),
    ];
  };

  const handleSlotStartTimeChange = (iso, index, value) => {
    setGigsByDate((prev) => {
      const gig = prev[iso] || defaultGigForDate();
      const slots = [
        { startTime: gig.startTime ?? '', duration: gig.duration },
        ...(gig.extraSlots || []).map((s) => ({ startTime: s?.startTime ?? '', duration: s?.duration })),
      ];
      if (index === 0) {
        slots[0] = { ...slots[0], startTime: value };
      } else {
        slots[index] = { ...(slots[index] || {}), startTime: value };
      }
      const recalc = recalcSlotsFrom(slots, index);
      const base = recalc[0];
      const extra = recalc.slice(1);
      return {
        ...prev,
        [iso]: { ...gig, startTime: base.startTime, duration: base.duration, extraSlots: extra },
      };
    });
  };

  const handleSlotDurationChange = (iso, index, durationMinutes) => {
    setGigsByDate((prev) => {
      const gig = prev[iso] || defaultGigForDate();
      const slots = [
        { startTime: gig.startTime ?? '', duration: gig.duration },
        ...(gig.extraSlots || []).map((s) => ({ startTime: s?.startTime ?? '', duration: s?.duration })),
      ];
      if (index === 0) {
        slots[0] = { ...slots[0], duration: durationMinutes };
      } else {
        slots[index] = { ...(slots[index] || {}), duration: durationMinutes };
      }
      const recalc = recalcSlotsFrom(slots, index);
      const base = recalc[0];
      const extra = recalc.slice(1);
      return {
        ...prev,
        [iso]: { ...gig, startTime: base.startTime, duration: base.duration, extraSlots: extra },
      };
    });
  };

  const addGigSlot = (iso) => {
    const slots = allSlotsFor(iso);
    const last = slots[slots.length - 1];
    const nextStart = addMinutesToTime(last?.startTime ?? '', Number(last?.duration) || 60);
    const gig = gigsByDate[iso] || defaultGigForDate();
    const slotCount = 1 + (gig.extraSlots?.length || 0);
    const artistNames = getArtistNamesForSlots(gig, slotCount);
    const artistFromCrm = getArtistFromCrmForSlots(gig, slotCount);
    const slotBudgets = getSlotBudgetsFor(gig, slotCount);
    const slotPaymentTypes = getSlotPaymentTypes(gig, slotCount);
    const slotInviteOnly = getSlotInviteOnly(gig, slotCount);
    const slotBookingStatuses = getSlotBookingStatuses(gig, slotCount);
    updateGig(iso, {
      extraSlots: [...(gig.extraSlots || []), { startTime: nextStart, duration: 60 }],
      artistNames: [...artistNames, ''],
      artistFromCrm: [...artistFromCrm, false],
      slotBudgets: [...slotBudgets, '£'],
      slotPaymentTypes: [...slotPaymentTypes, ''],
      slotInviteOnly: [...slotInviteOnly, false],
      slotBookingStatuses: [...slotBookingStatuses, 'unbooked'],
    });
  };

  const removeGigSlot = (iso, extraSlotIndex) => {
    const gig = gigsByDate[iso] || defaultGigForDate();
    const extra = (gig.extraSlots || []).filter((_, i) => i !== extraSlotIndex);
    const slotCount = 1 + (gig.extraSlots?.length || 0);
    const artistNames = getArtistNamesForSlots(gig, slotCount);
    const artistFromCrm = getArtistFromCrmForSlots(gig, slotCount);
    const slotBudgets = getSlotBudgetsFor(gig, slotCount);
    const slotPaymentTypes = getSlotPaymentTypes(gig, slotCount);
    const slotBookingStatuses = getSlotBookingStatuses(gig, slotCount);
    const newArtistNames = artistNames.filter((_, i) => i !== extraSlotIndex + 1);
    const newArtistFromCrm = artistFromCrm.filter((_, i) => i !== extraSlotIndex + 1);
    const newSlotBudgets = slotBudgets.filter((_, i) => i !== extraSlotIndex + 1);
    const slotInviteOnly = getSlotInviteOnly(gig, slotCount);
    const newSlotPaymentTypes = slotPaymentTypes.filter((_, i) => i !== extraSlotIndex + 1);
    const newSlotInviteOnly = slotInviteOnly.filter((_, i) => i !== extraSlotIndex + 1);
    const newSlotBookingStatuses = slotBookingStatuses.filter((_, i) => i !== extraSlotIndex + 1);
    updateGig(iso, {
      extraSlots: extra,
      artistNames: newArtistNames.length ? newArtistNames : [''],
      artistFromCrm: newArtistFromCrm.length ? newArtistFromCrm : [false],
      slotBudgets: newSlotBudgets.length ? newSlotBudgets : ['£'],
      slotPaymentTypes: newSlotPaymentTypes.length ? newSlotPaymentTypes : [''],
      slotInviteOnly: newSlotInviteOnly.length ? newSlotInviteOnly : [false],
      slotBookingStatuses: newSlotBookingStatuses.length ? newSlotBookingStatuses : ['unbooked'],
    });
    const newSlotCount = 1 + extra.length;
    setArtistSlotCountByDate((prev) => ({ ...prev, [iso]: newSlotCount }));
  };

  const setArtistSlotCount = (iso, nextCountRaw) => {
    let desired = parseInt(nextCountRaw, 10);
    if (!Number.isFinite(desired) || desired < 1) {
      setArtistSlotCountByDate((prev) => ({ ...prev, [iso]: '' }));
      return;
    }
    if (desired > 10) desired = 10;
    setArtistSlotCountByDate((prev) => ({ ...prev, [iso]: desired }));

    setGigsByDate((prev) => {
      const gig = prev[iso] || defaultGigForDate();
      const slots = [
        { startTime: gig.startTime ?? '', duration: gig.duration },
        ...(gig.extraSlots || []).map((s) => ({ startTime: s?.startTime ?? '', duration: s?.duration })),
      ];
      const current = slots.length;
      if (desired === current) return prev;

      let nextSlots = slots;
      if (desired > current) {
        while (nextSlots.length < desired) {
          const last = nextSlots[nextSlots.length - 1] || { startTime: '', duration: 60 };
          const nextStart = addMinutesToTime(last.startTime ?? '', Number(last.duration) || 60);
          nextSlots = [...nextSlots, { startTime: nextStart, duration: 60 }];
        }
      } else {
        nextSlots = nextSlots.slice(0, desired);
      }

      const newBase = nextSlots[0] || { startTime: '', duration: undefined };
      const newExtra = nextSlots.slice(1);

      const oldCount = 1 + (gig.extraSlots?.length || 0);
      const artistNamesOld = getArtistNamesForSlots(gig, oldCount);
      const artistFromCrmOld = getArtistFromCrmForSlots(gig, oldCount);
      const slotBudgetsOld = getSlotBudgetsFor(gig, oldCount);
      const slotPaymentTypesOld = getSlotPaymentTypes(gig, oldCount);
      const slotInviteOnlyOld = getSlotInviteOnly(gig, oldCount);
      const slotBookingStatusesOld = getSlotBookingStatuses(gig, oldCount);

      const newCount = nextSlots.length;
      const artistNames = Array.from({ length: newCount }, (_, i) => artistNamesOld[i] ?? '');
      const artistFromCrm = Array.from({ length: newCount }, (_, i) => artistFromCrmOld[i] ?? false);
      const slotBudgets = Array.from({ length: newCount }, (_, i) => slotBudgetsOld[i] ?? '£');
      const slotPaymentTypes = Array.from({ length: newCount }, (_, i) => slotPaymentTypesOld[i] ?? '');
      const slotInviteOnly = Array.from({ length: newCount }, (_, i) => slotInviteOnlyOld[i] ?? false);
      const slotBookingStatuses = Array.from({ length: newCount }, (_, i) => slotBookingStatusesOld[i] ?? 'unbooked');

      return {
        ...prev,
        [iso]: {
          ...gig,
          startTime: newBase.startTime,
          duration: newBase.duration,
          extraSlots: newExtra,
          artistNames,
          artistFromCrm,
          slotBudgets,
          slotPaymentTypes,
          slotInviteOnly,
          slotBookingStatuses,
        },
      };
    });
  };

  const setSlotBookingStatus = (iso, index, value) => {
    const gig = gigsByDate[iso] || defaultGigForDate();
    const slotCount = 1 + (gig.extraSlots?.length || 0);
    const slotBookingStatuses = getSlotBookingStatuses(gig, slotCount);
    const next = [...slotBookingStatuses];
    next[index] = value;
    updateGig(iso, { slotBookingStatuses: next });
  };

  const setSlotBudget = (iso, index, value) => {
    const gig = gigsByDate[iso] || defaultGigForDate();
    const slotCount = 1 + (gig.extraSlots?.length || 0);
    const slotBudgets = getSlotBudgetsFor(gig, slotCount);
    const next = [...slotBudgets];
    next[index] = formatPoundsInput(value);
    updateGig(iso, { slotBudgets: next });
  };

  const setSlotArtistName = (iso, slotIndex, value) => {
    const gig = gigsByDate[iso] || defaultGigForDate();
    const slotCount = 1 + (gig.extraSlots?.length || 0);
    const artistNames = getArtistNamesForSlots(gig, slotCount);
    const next = [...artistNames];
    next[slotIndex] = value;
    updateGig(iso, { artistNames: next });
  };

  const setSlotArtistFromCrm = (iso, slotIndex, value) => {
    const gig = gigsByDate[iso] || defaultGigForDate();
    const slotCount = 1 + (gig.extraSlots?.length || 0);
    const artistFromCrm = getArtistFromCrmForSlots(gig, slotCount);
    const next = [...artistFromCrm];
    next[slotIndex] = value;
    updateGig(iso, { artistFromCrm: next });
  };

  const clearSlotArtist = (iso, slotIndex) => {
    setSlotArtistName(iso, slotIndex, '');
    setSlotArtistFromCrm(iso, slotIndex, false);
    setOpenArtistDropdownForSlot(null);
  };

  const isSlotExpanded = (iso, index) => {
    const entry = expandedSlotsByDate[iso];
    if (!entry) return false;
    return !!entry[index];
  };

  const toggleSlotExpanded = (iso, index) => {
    setExpandedSlotsByDate((prev) => {
      const current = prev[iso] || {};
      return {
        ...prev,
        [iso]: { ...current, [index]: !current[index] },
      };
    });
  };

  const applyGigSettingsToAll = () => {
    if (!activeTab) return;
    const sourceGig = gigsByDate[activeTab] || defaultGigForDate();
    setGigsByDate((prev) => {
      const next = { ...prev };
      sortedDates.forEach((iso) => {
        if (iso === activeTab) return;
        const { rentalGigId, ...rest } = sourceGig;
        next[iso] = { ...rest, rentalGigId: '' };
      });
      return next;
    });
    toast.success('Applied gig settings to all selected dates.');
  };

  const handleAddToContactBook = async (iso, slotIndex) => {
    const gig = gigsByDate[iso] || defaultGigForDate();
    const slotCount = 1 + (gig?.extraSlots?.length || 0);
    const artistNames = getArtistNamesForSlots(gig, slotCount);
    const name = (artistNames[slotIndex] ?? '').trim();
    if (!name || !user?.uid) return;
    setAddingToCrm(true);
    try {
      await createArtistCRMEntry(user.uid, { name });
      toast.success(`Added "${name}" to your Contact Book.`);
      setSlotArtistFromCrm(iso, slotIndex, true);
      setOpenArtistDropdownForSlot(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add to Contact Book.');
    } finally {
      setAddingToCrm(false);
    }
  };

  const handleSubmitClick = () => {
    if (venues.length > 0 && !venueId) {
      toast.error('Please select a venue.');
      return;
    }
    if (!venueId || !hasVenuePerm(venues, venueId, 'gigs.create')) {
      toast.error("You don't have permission to create gigs for this venue.");
      return;
    }
    if (!canSubmit) {
      if (addGigsMode === 'bookNew') {
        const firstInvalidIso = sortedDates.find(
          (iso) => !isBookNewGigComplete(gigsByDate[iso] || defaultGigForDate())
        );
        if (firstInvalidIso) {
          setActiveTab(firstInvalidIso);
          const gig = gigsByDate[firstInvalidIso] || defaultGigForDate();
          const tv = validateBookNewTimings(gig);
          if (!tv.ok) {
            setBookNewTimingError(tv.message);
            toast.error(tv.message);
            return;
          }
          if (!gig.paymentModel || (gig.paymentModel !== 'no_fee' && !hasPositiveBudgetValue(gig.unifiedFeeAmount))) {
            toast.error('Choose a payment model and enter a valid fee where required.');
            return;
          }
          if (!gig.ticketingModel) {
            toast.error('Select who handles ticketing.');
            return;
          }
        }
        return;
      }
      const firstInvalidIso = sortedDates.find(
        (iso) => !isGigValidWithMode(gigsByDate[iso] || defaultGigForDate())
      );
      if (firstInvalidIso) {
        const gig = gigsByDate[firstInvalidIso] || defaultGigForDate();
        if (addGigsMode === 'addExisting') {
          setActiveTab(firstInvalidIso);
          const tv = validateBookNewTimings(gig);
          if (!tv.ok) {
            setBookNewTimingError(tv.message);
            toast.error(tv.message);
            return;
          }
          if (!gig.paymentModel || (gig.paymentModel !== 'no_fee' && !hasPositiveBudgetValue(gig.unifiedFeeAmount))) {
            toast.error('Choose a payment model and enter a valid fee where required.');
            return;
          }
          if (!gig.ticketingModel) {
            toast.error('Select who handles ticketing.');
            return;
          }
          {
            const slotCountForValidation = 1 + (Array.isArray(gig.extraSlots) ? gig.extraSlots.length : 0);
            const names = getArtistNamesForSlots(gig, slotCountForValidation);
            const missingIdx = names.findIndex((n) => !String(n ?? '').trim());
            if (missingIdx >= 0) {
              toast.error(
                slotCountForValidation > 1
                  ? `Enter the artist for Set ${missingIdx + 1}.`
                  : 'Enter who you have booked.'
              );
              return;
            }
          }
          return;
        }
        const missing = getFirstMissingFieldWithMode(gig);
        setActiveTab(firstInvalidIso);
        setFocusInvalidField(missing);
        setInvalidFieldHighlight(missing);
        setInvalidFieldHighlightTab(firstInvalidIso);
        const isSlotOrderInvalid = missing && typeof missing === 'object' && missing.slotStartOrder !== undefined;
        if (isSlotOrderInvalid) {
          const n = missing.slotStartOrder;
          toast.error(
            `Set ${n + 1} must start at or after set ${n} ends. Adjust the start times so sets don't overlap.`
          );
        } else if (firstInvalidIso === activeTab) {
          const isPaymentMissing = missing && typeof missing === 'object' && missing.payment !== undefined;
          toast.info(isPaymentMissing
            ? 'Please select a payment option (Tickets, Flat Fee, or No Payment) for each slot.'
            : `Please complete the details for ${formatTabDate(firstInvalidIso)}.`);
        }
      }
      return;
    }
    handleAddGigs();
  };

  /**
   * After a gig is created while "building for a musician", run the full
   * invite + request-cleanup pipeline against the first gig doc. Returns
   * `{ inviteMethodsOpened }` so the caller can decide whether to keep the
   * modal mounted until InviteMethodsModal finishes.
   *
   * Create an invite record, attach the musician to the applicants array, and
   * either
   * dispatch an in-app invite (Gigin profile) or open InviteMethodsModal for
   * off-platform contact methods. Finally, prune the date off the originating
   * request (or remove the request entirely).
   */
  const runBuildForMusicianFollowup = async (firstGigDoc) => {
    if (!buildForMusicianActive || !firstGigDoc) return { inviteMethodsOpened: false };
    const musicianData = buildingForMusicianData || {};
    const venueToSend = venues.find((v) => (v.id || v.venueId) === venueId);
    if (!hasVenuePerm(venues, venueId, 'gigs.invite')) {
      toast.error('You do not have permission to invite musicians to gigs at this venue.');
      return { inviteMethodsOpened: false };
    }

    let createdInvite = null;
    const isPrivateListing = firstGigDoc.private === true;
    if (isPrivateListing && musicianData.id) {
      try {
        createdInvite = await createGigInvite({
          gigId: firstGigDoc.gigId,
          expiresAt: null,
          artistId: musicianData.crmEntryId ? null : musicianData.id,
          crmEntryId: musicianData.crmEntryId || null,
          artistName: musicianData.name || null,
        });
      } catch (error) {
        console.error('Error creating invite document:', error);
        toast.error('Failed to create invite document. The gig was created but you may need to create the invite manually.');
      }
    }

    if (musicianData.id) {
      try {
        const now = new Date();
        const applicant = {
          id: musicianData.id,
          timestamp: now,
          fee: firstGigDoc.budget || '£0',
          status: 'pending',
          invited: true,
          viewed: false,
          ...(createdInvite?.inviteId ? { inviteId: createdInvite.inviteId } : {}),
          ...(createdInvite?.expiresAt ? { inviteExpiresAt: createdInvite.expiresAt } : {}),
        };
        const currentApplicants = Array.isArray(firstGigDoc.applicants) ? firstGigDoc.applicants : [];
        const alreadyIncluded = currentApplicants.some((a) => a?.id === musicianData.id);
        if (!alreadyIncluded) {
          await updateGigDocument({
            gigId: firstGigDoc.gigId,
            action: 'gigs.update',
            updates: { applicants: [...currentApplicants, applicant] },
          });
        }
      } catch (error) {
        console.error('Error adding applicant to gig:', error);
      }
    }

    let musicianProfile = null;
    let hasGiginProfile = false;
    if (musicianData.id) {
      try {
        musicianProfile = await getMusicianProfileByMusicianId(musicianData.id);
        hasGiginProfile = !!(musicianProfile && musicianProfile.userId);
      } catch (error) {
        console.error('Error fetching musician profile:', error);
      }
    }

    let inviteMethodsOpened = false;
    if (hasGiginProfile && musicianProfile) {
      if (!musicianProfile.musicianId) musicianProfile.musicianId = musicianProfile.id || musicianData.id;
      try {
        const res = await inviteToGig({ gigId: firstGigDoc.gigId, musicianProfile });
        if (!res?.success) {
          if (res?.code === 'permission-denied') toast.error('You don\u2019t have permission to invite musicians for this venue.');
          else if (res?.code === 'failed-precondition') toast.error('This gig is missing required venue info.');
          else toast.error('Error inviting musician. Do you have permission to invite musicians to gigs at this venue?');
        } else {
          const { conversationId } = await getOrCreateConversation({
            musicianProfile,
            gigData: firstGigDoc,
            venueProfile: venueToSend,
            type: 'invitation',
          });
          const isTicketedOrOpenMic = firstGigDoc.kind === 'Ticketed Gig' || firstGigDoc.kind === 'Open Mic';
          const venueName = venueToSend?.name || firstGigDoc?.venue?.venueName || '';
          const accountName = venueToSend?.accountName || user?.name || '';
          const dateLabel = firstGigDoc.date ? formatDate(firstGigDoc.date, 'long') : '';
          const feeSuffix = isTicketedOrOpenMic ? '' : ` for ${firstGigDoc.budget || '£0'}`;
          await sendGigInvitationMessage(conversationId, {
            senderId: user?.uid,
            text: `${accountName} has invited ${musicianProfile.name} to play at their gig at ${venueName}${dateLabel ? ` on the ${dateLabel}` : ''}${feeSuffix}.`,
          });
        }
      } catch (error) {
        console.error('inviteToGig pipeline failed:', error);
      }
    } else {
      const artistData = {
        name: musicianData.name,
        email: musicianData.email || null,
        phone: musicianData.phone || null,
        instagram: musicianData.instagram || null,
        facebook: musicianData.facebook || null,
        other: musicianData.other || null,
      };
      setInlineInviteMethods({ gig: firstGigDoc, artist: artistData, venue: venueToSend });
      inviteMethodsOpened = true;
    }

    if (requestId) {
      try {
        if (preferredDate) {
          const targetDate = preferredDate instanceof Date ? preferredDate : new Date(preferredDate);
          if (setRequests) {
            setRequests((prev = []) =>
              prev.map((req) => {
                if (req.id !== requestId) return req;
                const preferredDates = req.preferredDates || [];
                if (!Array.isArray(preferredDates) || preferredDates.length === 0) return req;
                const updatedDates = preferredDates.filter((dateItem) => {
                  try {
                    const d = dateItem?.toDate?.() || (dateItem?._seconds || dateItem?.seconds
                      ? new Date(((dateItem?._seconds || dateItem?.seconds) * 1000) + ((dateItem?._nanoseconds || dateItem?.nanoseconds || 0) / 1e6))
                      : new Date(dateItem));
                    return !(d instanceof Date) || isNaN(d.getTime()) || d.getTime() !== targetDate.getTime();
                  } catch { return true; }
                });
                return { ...req, preferredDates: updatedDates.length > 0 ? updatedDates : null };
              }),
            );
          }
          await removePreferredDateFromRequest(requestId, preferredDate);
        } else {
          await removeVenueRequest(requestId);
          if (setRequests) setRequests((prev = []) => prev.map((req) => (req.id === requestId ? { ...req, removed: true } : req)));
        }
      } catch (error) {
        console.error('Failed to update originating request:', error);
      }
    }

    return { inviteMethodsOpened };
  };

  const handleAddGigs = async () => {
    const getBudgetValue = (b) => {
      const n = parseInt(String(b ?? '').replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) ? n : 0;
    };
    const formatPounds = (n) => (n === 0 ? '£' : `£${Number(n).toLocaleString('en-GB')}`);

    if (isEditMode && editGigData?.gigId && sortedDates.length === 1) {
      const dateIso = sortedDates[0];
      const gig = gigsByDate[dateIso] || defaultGigForDate();

      // Artist-booking edit — persist via updateGigDocument. Handles both
      // single-slot gigs and multi-slot groups. Each existing Firestore doc
      // is updated in place: shared fields (kind, title, payment model,
      // ticketing, description, visibility, capacity, documents, tech setup)
      // get the same values across all slots; per-slot fields (startTime,
      // duration, startDateTime, budget) pick up the slot-specific value and
      // the gigName gains a "(Set N)" suffix for slots after the first when
      // more than one slot is present. Slot count is locked in edit mode
      // today — adding / removing slots belongs to a future change because
      // the API surface for that is doc-level create/delete.
      if (gig.bookingMode === 'artist') {
        setSubmitting(true);
        try {
          const timingsCheck = validateBookNewTimings(gig);
          if (!timingsCheck.ok) {
            setBookNewTimingError(timingsCheck.message);
            toast.error(timingsCheck.message);
            setSubmitting(false);
            return;
          }
          const slotsForValidation = allSlotsFor(dateIso) || [];
          const multiSlotEdit = slotsForValidation.length > 1;
          // Multi-slot: override musicStart/musicStop in eventTimings to span
          // the first slot's start to the last slot's end. The wizard hides
          // those inputs and drives the envelope from per-slot timings.
          const eventTimings = (() => {
            const base = buildEventTimingsForStorage(gig) || {};
            if (multiSlotEdit) {
              const firstStart = (slotsForValidation[0]?.startTime ?? '').toString();
              const lastSlot = slotsForValidation[slotsForValidation.length - 1];
              const lastStart = (lastSlot?.startTime ?? '').toString();
              const lastDuration = Number(lastSlot?.duration) || 0;
              const lastEnd = lastStart ? addMinutesToTime(lastStart, lastDuration) : '';
              if (firstStart) base.musicStart = firstStart;
              if (lastEnd) base.musicStop = lastEnd;
            }
            return Object.keys(base).length ? base : undefined;
          })();
          const privateListing = !gig.showOnVenueProfile;
          const capacityFromForm = parseInt(String(gig.rentalCapacity ?? '').replace(/[^\d]/g, ''), 10);
          const capacityToSave = Number.isFinite(capacityFromForm) && capacityFromForm > 0 ? capacityFromForm : null;
          const listingDocs = normalizeListingDocumentsForApi(gig.listingDocEntries);
          const inferredKind = inferBookNewKind(gig.paymentModel, gig.ticketingModel, gig.kind);
          const techSetupPayload = buildTechSetupPayload(gig.techSetup);
          const soundManagerVal = String(gig.soundManager ?? '').trim();
          const baseGigName = String(gig.gigName ?? '').trim();

          const existingIds = Array.isArray(editGigData?.existingGigIds) && editGigData.existingGigIds.length > 0
            ? editGigData.existingGigIds
            : [editGigData.gigId];
          const slotsRow = allSlotsFor(dateIso) || [];
          // If the wizard was used single-slot, fall back to top-level music
          // start/stop for slot 0 since `startTime`/`duration` may be empty.
          const fallbackStart = pickArtistPerformanceStart(gig);
          const fallbackEnd = pickRentalEnd(gig);
          const fallbackDuration = fallbackStart && fallbackEnd
            ? diffMinutesEndAfterStart(fallbackStart, fallbackEnd)
            : undefined;
          const slotCount = Math.max(existingIds.length, slotsRow.length, 1);
          const slotBudgetsArr = getSlotBudgetsFor(gig, slotCount);
          const slotArtistNamesArr = getArtistNamesForSlots(gig, slotCount);

          // Detect addExisting-origin records: private + confirmed manual
          // applicant (no id/artistId). For those, re-write the applicants
          // array per slot from the form's edited artist names so renaming a
          // set's booked artist actually persists. Public-listing gigs don't
          // get their applicants rewritten here to avoid nuking real
          // applications from musicians.
          const firstApplicants = Array.isArray(editGigData?.applicants) ? editGigData.applicants : [];
          const isAddExistingEdit = editGigData?.private === true
            && firstApplicants.some((a) => a?.status === 'confirmed' && !a?.id && !a?.artistId);

          const isMultiSlotSave = slotCount > 1;
          // Update each existing doc. If slot count has drifted (shouldn't
          // today because the UI locks it in edit mode), we skip orphaned
          // entries with a warning rather than silently losing data.
          const updatePromises = existingIds.map((gigId, slotIndex) => {
            const slot = slotsRow[slotIndex];
            const slotStart = (slot?.startTime ?? '').toString().trim() || (slotIndex === 0 ? fallbackStart : '');
            const slotDurNum = Number(slot?.duration);
            const slotDuration = Number.isFinite(slotDurNum) && slotDurNum > 0
              ? slotDurNum
              : (slotIndex === 0 && fallbackDuration ? fallbackDuration : undefined);
            const startDateTime = slotStart ? getStartDateTime(dateIso, slotStart) : undefined;
            // Single-slot edits write to unifiedFeeAmount (not slotBudgets),
            // so fall back to it when the slot budget is the '£' placeholder.
            const rawSlotBudget = slotBudgetsArr[slotIndex];
            const isPlaceholder = rawSlotBudget == null || rawSlotBudget === '' || rawSlotBudget === '£';
            const slotBudgetRaw = isPlaceholder && !isMultiSlotSave
              ? (gig.unifiedFeeAmount ?? '£')
              : rawSlotBudget ?? '£';
            const feeValue = gig.paymentModel === 'no_fee' ? 0 : getBudgetValue(slotBudgetRaw);
            const feeText = gig.paymentModel === 'no_fee' ? '£' : formatPounds(feeValue);
            const suffixedName = baseGigName
              ? (slotCount > 1 ? `${baseGigName} (Set ${slotIndex + 1})` : baseGigName)
              : undefined;

            const serializedSlotBudgets = slotBudgetsArr.map((b, i) => {
              if (gig.paymentModel === 'no_fee') return '£';
              const placeholder = b == null || b === '' || b === '£';
              const effective = placeholder && !isMultiSlotSave && i === 0 ? gig.unifiedFeeAmount : b;
              return formatPounds(getBudgetValue(effective));
            });
            const slotArtistName = String(slotArtistNamesArr[slotIndex] ?? '').trim();
            const slotApplicantsUpdate = isAddExistingEdit
              ? (slotArtistName ? [{ status: 'confirmed', name: slotArtistName }] : [])
              : undefined;
            const updates = {
              gigName: suffixedName,
              kind: inferredKind,
              gigType: gig.gigType || undefined,
              paymentModel: gig.paymentModel || undefined,
              ticketingModel: gig.ticketingModel || undefined,
              budget: feeText,
              budgetValue: feeValue,
              slotBudgets: serializedSlotBudgets,
              // addExisting records stay private; public-listing edits honour
              // the wizard's "Show on venue profile" toggle via privateListing.
              private: isAddExistingEdit ? true : privateListing,
              extraInformation: String(gig.extraInformation ?? '').trim(),
              eventTimings: eventTimings ?? null,
              ...(startDateTime && { startDateTime }),
              ...(slotDuration && { duration: slotDuration }),
              ...(slotStart && { startTime: slotStart }),
              capacity: capacityToSave,
              listingDocEntries: listingDocs,
              ...(soundManagerVal && { soundManager: soundManagerVal }),
              ...(techSetupPayload && { techSetup: techSetupPayload }),
              ...(slotApplicantsUpdate !== undefined && { applicants: slotApplicantsUpdate }),
              maxApplicants: computeMaxApplicantsForSave(gig, inferredKind),
            };
            return updateGigDocument({
              gigId,
              action: 'gigs.update',
              updates,
            });
          });

          await Promise.all(updatePromises);
          toast.success(slotCount > 1 ? 'Gig sets updated.' : 'Gig updated.');
          refreshGigs?.();
          onClose();
        } catch (err) {
          console.error(err);
          toast.error(err?.message || 'Failed to update gig.');
        } finally {
          setSubmitting(false);
        }
        return;
      }

      if (gig.bookingMode !== 'rental') return;
      setSubmitting(true);
      try {
        const rentalStart = String(gig.rentalStartTime ?? '').trim();
        const rentalEnd = String(gig.rentalEndTime ?? '').trim();
        const feeValue = getBudgetValue(gig.rentalFee ?? '£');
        const feeText = formatPounds(feeValue);
        const rentalStatus = gig.rentalStatus === 'confirmed_renter' ? 'confirmed' : 'open';
        const rentalDepositRequired = !!gig.rentalDepositRequired;
        const rentalDepositAmount = rentalDepositRequired ? formatPounds(getBudgetValue(gig.rentalDepositAmount ?? '£')) : undefined;
        const selectedVenue = venues?.find((v) => v.venueId === venueId);
        // Use only the value from the modal (form) as source of truth for capacity
        const capacityFromForm = parseInt(String(gig.rentalCapacity ?? '').replace(/[^\d]/g, ''), 10);
        const capacityToSave = Number.isFinite(capacityFromForm) && capacityFromForm > 0 ? capacityFromForm : null;

        const isVenueHire = editGigData?.itemType === 'venue_hire';

        if (isVenueHire) {
          const hireStatus = gig.rentalStatus === 'confirmed_renter' ? 'confirmed' : 'available';
          const houseRulesMode = gig.rentalHouseRulesMode === 'document' ? 'document' : 'text';
          let documentsUpdate = [];
          let notesInternalUpdate = '';
          if (houseRulesMode === 'document') {
            const docSource = gig.rentalHouseRulesDocument;
            if (typeof docSource === 'string' && docSource) {
              documentsUpdate = [{ url: docSource }];
            } else if (docSource && typeof docSource === 'object' && docSource.name) {
              const url = await uploadFileWithFallback(docSource, `venues/${venueId}/documents`);
              if (url) documentsUpdate = [{ url }];
            }
          } else {
            notesInternalUpdate = String(gig.rentalHouseRules ?? '').trim() || '';
          }
          const hireUpdates = {
            startTime: rentalStart || undefined,
            endTime: rentalEnd || undefined,
            accessFrom: rentalStart || undefined,
            curfew: rentalEnd || undefined,
            hireFee: feeText || undefined,
            status: hireStatus,
            private: gig.rentalStatus === 'confirmed_renter' ? true : !!gig.rentalPrivate,
            hirerName: (String(gig.renterName ?? '').trim()) || undefined,
            depositRequired: rentalDepositRequired,
            depositAmount: rentalDepositAmount || undefined,
            date: dateIso ? new Date(dateIso + 'T12:00:00') : undefined,
            capacity: capacityToSave,
            documents: documentsUpdate,
            notesInternal: notesInternalUpdate,
            ...(String(gig.soundManager ?? '').trim() && { soundManager: String(gig.soundManager).trim() }),
            ...(buildTechSetupPayload(gig.techSetup) && { techSetup: buildTechSetupPayload(gig.techSetup) }),
          };
          await updateVenueHireOpportunity(editGigData.gigId, hireUpdates);
        } else {
          const updates = {
            gigName: (String(gig.gigName ?? '').trim()) || undefined,
            rentalAccessFrom: rentalStart || undefined,
            rentalHardCurfew: rentalEnd || undefined,
            rentalCapacity: capacityToSave,
            rentalDepositRequired,
            ...(rentalDepositAmount && { rentalDepositAmount }),
            renterName: (String(gig.renterName ?? '').trim()) || undefined,
            private: gig.rentalStatus === 'confirmed_renter' ? true : !!gig.rentalPrivate,
            status: rentalStatus,
            budget: feeText,
            budgetValue: feeValue,
          };
          await updateGigDocument({
            gigId: editGigData.gigId,
            action: 'gigs.update',
            updates,
          });
        }
        toast.success('Event updated.');
        refreshGigs?.();
        onClose();
      } catch (err) {
        console.error(err);
        toast.error(err?.message || 'Failed to update event.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!venueId || !hasVenuePerm(venues, venueId, 'gigs.create')) return;
    setSubmitting(true);
    try {
      const gigDocuments = [];
      const hireOpportunities = [];
      const selectedVenue = venues.find((v) => v.venueId === venueId);
      const coords = selectedVenue?.coordinates;
      const hasCoords = Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number';
      const geopoint = hasCoords ? { latitude: coords[1], longitude: coords[0] } : null;

      for (const dateIso of sortedDates) {
        const gig = gigsByDate[dateIso] || defaultGigForDate();

        if (addGigsMode === 'bookNew') {
          const venue = selectedVenue;
          const extraInformation = String(gig.extraInformation ?? '').trim() || undefined;
          // When artist-booking multi-slot, override musicStart/musicStop in
          // eventTimings to span the first slot's start to the last slot's
          // end — the wizard hides those inputs and drives the envelope from
          // per-slot timings instead.
          const eventTimings = (() => {
            const base = buildEventTimingsForStorage(gig) || {};
            if (gig.paymentModel !== 'artist_pays_venue') {
              const slotsRow = allSlotsFor(dateIso) || [];
              if (slotsRow.length > 1) {
                const firstStart = (slotsRow[0]?.startTime ?? '').toString();
                const lastSlot = slotsRow[slotsRow.length - 1];
                const lastStart = (lastSlot?.startTime ?? '').toString();
                const lastDuration = Number(lastSlot?.duration) || 0;
                const lastEnd = lastStart ? addMinutesToTime(lastStart, lastDuration) : '';
                if (firstStart) base.musicStart = firstStart;
                if (lastEnd) base.musicStop = lastEnd;
              }
            }
            return Object.keys(base).length ? base : undefined;
          })();
          const listingDocs = normalizeListingDocumentsForApi(gig.listingDocEntries);
          const ticketingResponsibility = gig.ticketingModel;
          const privateListing = !gig.showOnVenueProfile;
          const capacityFromFormBn = parseInt(String(gig.rentalCapacity ?? '').replace(/[^\d]/g, ''), 10);
          const capacityFromVenueBn = parseInt(String(selectedVenue?.capacity ?? '').replace(/[^\d]/g, ''), 10);
          const capacityNumBn = Number.isFinite(capacityFromFormBn) && capacityFromFormBn > 0
            ? capacityFromFormBn
            : (Number.isFinite(capacityFromVenueBn) && capacityFromVenueBn > 0 ? capacityFromVenueBn : undefined);
          const gigTypeBn = gig.gigType || 'Musician/Band';
          // For artist-booking rows, reverse-infer kind from payment+ticketing so
          // Open Mic / Ticketed Gig are labelled correctly without an explicit
          // picker. Venue-rental rows keep Live Music-ish `kind` as display-only.
          const kindBn = gig.paymentModel === 'artist_pays_venue'
            ? (gig.kind || 'Live Music')
            : inferBookNewKind(gig.paymentModel, gig.ticketingModel, gig.kind);

          if (gig.paymentModel === 'artist_pays_venue') {
            const rentalStart = pickRentalStart(gig);
            const rentalEnd = pickRentalEnd(gig);
            const startDateTime = getStartDateTime(dateIso, rentalStart);
            const feeValueBn = getBudgetValue(gig.unifiedFeeAmount ?? '£');
            const feeTextBn = formatPounds(feeValueBn);
            const hireTitle = String(gig.gigName ?? '').trim() || (venue ? `${venue.name} For Hire` : 'Venue hire');
            hireOpportunities.push({
              venueId,
              createdByUserId: user?.uid ?? '',
              date: startDateTime,
              startDateTime,
              startTime: rentalStart,
              endTime: rentalEnd,
              accessFrom: rentalStart || null,
              curfew: rentalEnd || null,
              hireFee: feeTextBn,
              ...(capacityNumBn != null && { capacity: capacityNumBn }),
              depositRequired: false,
              depositAmount: null,
              documents: [],
              notesInternal: '',
              status: 'available',
              hirerType: 'none',
              hirerName: null,
              performers: [],
              private: privateListing,
              ticketingResponsibility,
              listingDocuments: listingDocs,
              eventTimings,
              gigName: hireTitle,
              kind: kindBn,
              gigType: gigTypeBn,
              extraInformation,
            });
          } else {
            // Artist-booking bookNew create — supports 1..N slots. Each slot
            // becomes its own gig doc; when slotCount > 1 the gigName gets a
            // "(Set N)" suffix and slot-specific start/duration/budget pick up
            // the per-slot values from the wizard (`extraSlots` + slotBudgets).
            const slotsRow = allSlotsFor(dateIso) || [];
            const multiSlot = slotsRow.length > 1;
            const effectiveSlots = multiSlot
              ? slotsRow
              : [{
                startTime: pickArtistPerformanceStart(gig),
                duration: diffMinutesEndAfterStart(
                  pickArtistPerformanceStart(gig),
                  pickArtistPerformanceEnd(gig),
                ),
              }];
            const slotCountForFees = Math.max(effectiveSlots.length, 1);
            const slotBudgetsArr = getSlotBudgetsFor(gig, slotCountForFees);
            const slotPayType = gig.paymentModel === 'no_fee' ? 'no_payment' : 'flat_fee';
            const loadInBn = String(gig.timingAccessTime || '').trim()
              ? gig.timingAccessTime.trim()
              : undefined;
            const soundCheckBn = String(gig.timingSoundcheckTime || '').trim()
              ? gig.timingSoundcheckTime.trim()
              : undefined;
            const baseArtistTitle = String(gig.gigName ?? '').trim() || (venue ? `Gig at ${venue.name}` : 'Gig');

            effectiveSlots.forEach((slot, slotIndex) => {
              const startTimeBn = (slot?.startTime ?? '').toString().trim();
              const durationBn = Number.isFinite(Number(slot?.duration)) && Number(slot.duration) > 0
                ? Number(slot.duration)
                : 60;
              const slotGigId = uuidv4();
              // In single-slot mode the wizard only writes to `unifiedFeeAmount`,
              // not `slotBudgets`, so fall back to it when the slot entry is
              // the default '£' placeholder.
              const rawSlotBudget = slotBudgetsArr[slotIndex];
              const isPlaceholder = rawSlotBudget == null || rawSlotBudget === '' || rawSlotBudget === '£';
              const slotBudgetRaw = isPlaceholder && !multiSlot
                ? (gig.unifiedFeeAmount ?? '£')
                : rawSlotBudget ?? '£';
              const feeValueBn = slotPayType === 'flat_fee' ? getBudgetValue(slotBudgetRaw) : 0;
              const slotBudgetTextBn = formatPounds(feeValueBn);
              const startDateTimeBn = startTimeBn ? getStartDateTime(dateIso, startTimeBn) : undefined;
              const artistTitle = multiSlot ? `${baseArtistTitle} (Set ${slotIndex + 1})` : baseArtistTitle;
              gigDocuments.push({
                gigId: slotGigId,
                venueId,
                ...(startDateTimeBn && { date: startDateTimeBn, startDateTime: startDateTimeBn }),
                ...(startTimeBn && { startTime: startTimeBn }),
                duration: durationBn,
                bookingMode: 'artist',
                ...(geopoint && { geopoint }),
                ...(loadInBn && { loadInTime: loadInBn }),
                ...(soundCheckBn && { soundCheckTime: soundCheckBn }),
                ...(extraInformation && { extraInformation }),
                private: privateListing,
                createdAt: new Date(),
                status: 'open',
                complete: true,
                gigName: artistTitle,
                kind: kindBn,
                gigType: gigTypeBn,
                genre: Array.isArray(gig.genre) ? gig.genre : (gig.genre || ''),
                technicalInformation: extraInformation || '',
                createdBy: user?.uid ?? '',
                accountName: user?.name ?? '',
                budget: slotBudgetTextBn,
                budgetValue: feeValueBn,
                applicants: [],
                ticketingResponsibility,
                eventTimings,
                listingDocuments: listingDocs,
                ...(capacityNumBn != null && { capacity: capacityNumBn }),
                maxApplicants: computeMaxApplicantsForSave(gig, kindBn),
              });
            });
          }
          continue;
        }

        if (addGigsMode === 'addExisting') {
          const venue = selectedVenue;
          const bookedName = String(getArtistNamesForSlots(gig, 1)[0] ?? '').trim();
          const extraInformation = String(gig.extraInformation ?? '').trim() || undefined;
          const eventTimings = buildEventTimingsForStorage(gig);
          const listingDocs = normalizeListingDocumentsForApi(gig.listingDocEntries);
          const ticketingResponsibility = gig.ticketingModel;
          const capacityFromFormBn = parseInt(String(gig.rentalCapacity ?? '').replace(/[^\d]/g, ''), 10);
          const capacityFromVenueBn = parseInt(String(selectedVenue?.capacity ?? '').replace(/[^\d]/g, ''), 10);
          const capacityNumBn = Number.isFinite(capacityFromFormBn) && capacityFromFormBn > 0
            ? capacityFromFormBn
            : (Number.isFinite(capacityFromVenueBn) && capacityFromVenueBn > 0 ? capacityFromVenueBn : undefined);
          const gigTypeBn = gig.gigType || 'Musician/Band';
          const kindBn = gig.paymentModel === 'artist_pays_venue'
            ? (gig.kind || 'Live Music')
            : inferBookNewKind(gig.paymentModel, gig.ticketingModel, gig.kind);

          if (gig.paymentModel === 'artist_pays_venue') {
            const rentalStart = pickRentalStart(gig);
            const rentalEnd = pickRentalEnd(gig);
            const startDateTime = getStartDateTime(dateIso, rentalStart);
            const feeValueBn = getBudgetValue(gig.unifiedFeeAmount ?? '£');
            const feeTextBn = formatPounds(feeValueBn);
            const hireTitle = String(gig.gigName ?? '').trim() || (venue ? `${venue.name} For Hire` : 'Venue hire');
            hireOpportunities.push({
              venueId,
              createdByUserId: user?.uid ?? '',
              date: startDateTime,
              startDateTime,
              startTime: rentalStart,
              endTime: rentalEnd,
              accessFrom: rentalStart || null,
              curfew: rentalEnd || null,
              hireFee: feeTextBn,
              ...(capacityNumBn != null && { capacity: capacityNumBn }),
              depositRequired: false,
              depositAmount: null,
              documents: [],
              notesInternal: '',
              status: 'confirmed',
              hirerType: bookedName ? 'manual' : 'none',
              hirerName: bookedName || null,
              performers: [],
              private: true,
              ticketingResponsibility,
              listingDocuments: listingDocs,
              eventTimings,
              gigName: hireTitle,
              kind: kindBn,
              gigType: gigTypeBn,
              extraInformation,
            });
          } else {
            // Artist-booking addExisting — supports single and multi-set.
            // Each set becomes its own private Firestore gig doc with the
            // per-set artist pre-seeded as a confirmed applicant. Single-set
            // inputs fall back to the top-level music timings via
            // pickArtistPerformance{Start,End} so wizards that only wrote
            // timingMusic* still persist cleanly.
            const slots = [
              { startTime: gig.startTime ?? '', duration: gig.duration },
              ...(gig.extraSlots || []).map((s) => ({ startTime: s?.startTime ?? '', duration: s?.duration })),
            ];
            const slotCount = slots.length;
            const isMultiSlot = slotCount > 1;
            const artistNamesArr = getArtistNamesForSlots(gig, slotCount);
            const slotBudgetsArr = getSlotBudgetsFor(gig, slotCount);
            const fallbackStart = pickArtistPerformanceStart(gig);
            const fallbackEnd = pickArtistPerformanceEnd(gig);
            const fallbackDuration = fallbackStart && fallbackEnd
              ? diffMinutesEndAfterStart(fallbackStart, fallbackEnd)
              : undefined;
            const loadInBn = String(gig.timingAccessTime || '').trim()
              ? gig.timingAccessTime.trim()
              : undefined;
            const soundCheckBn = String(gig.timingSoundcheckTime || '').trim()
              ? gig.timingSoundcheckTime.trim()
              : undefined;
            const baseTitle = String(gig.gigName ?? '').trim() || (venue ? `Gig at ${venue.name}` : 'Gig');

            const validIndices = [];
            for (let i = 0; i < slots.length; i++) {
              const st = String(slots[i]?.startTime ?? '').trim();
              const du = Number(slots[i]?.duration);
              const hasTiming = st && du > 0;
              const hasFallback = i === 0 && fallbackStart && fallbackDuration && fallbackDuration > 0;
              if (hasTiming || hasFallback) validIndices.push(i);
            }
            const groupIds = validIndices.map(() => uuidv4());

            let groupIdx = 0;
            for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
              let startTime = String(slots[slotIndex]?.startTime ?? '').trim();
              let duration = Number(slots[slotIndex]?.duration);
              if ((!startTime || !(duration > 0)) && slotIndex === 0 && fallbackStart && fallbackDuration) {
                startTime = fallbackStart;
                duration = fallbackDuration;
              }
              if (!startTime || !(duration > 0)) continue;
              const slotGigId = groupIds[groupIdx];
              const gigSlotsForThis = groupIds.length > 1 ? groupIds.filter((id) => id !== slotGigId) : undefined;
              const artistName = isMultiSlot
                ? (artistNamesArr[slotIndex] ?? '').trim()
                : (artistNamesArr[slotIndex] ?? bookedName ?? '').toString().trim();
              const applicantsBn = artistName ? [{ status: 'confirmed', name: artistName }] : [];
              const startDateTimeBn = getStartDateTime(dateIso, startTime);
              const gigName = slotIndex === 0 ? baseTitle : `${baseTitle} (Set ${slotIndex + 1})`;
              const slotPayTypeBn = gig.paymentModel === 'no_fee' ? 'no_payment' : 'flat_fee';
              const rawSlotBudget = slotBudgetsArr[slotIndex];
              const isPlaceholder = rawSlotBudget == null || rawSlotBudget === '' || rawSlotBudget === '£';
              const slotBudgetRaw = isPlaceholder && !isMultiSlot
                ? (gig.unifiedFeeAmount ?? '£')
                : (rawSlotBudget ?? '£');
              const feeValueBn = slotPayTypeBn === 'flat_fee' ? getBudgetValue(slotBudgetRaw) : 0;
              const slotBudgetTextBn = formatPounds(feeValueBn);
              gigDocuments.push({
                gigId: slotGigId,
                ...(gigSlotsForThis != null && { gigSlots: gigSlotsForThis }),
                venueId,
                date: startDateTimeBn,
                startDateTime: startDateTimeBn,
                startTime,
                duration,
                bookingMode: 'artist',
                ...(geopoint && { geopoint }),
                ...(loadInBn && { loadInTime: loadInBn }),
                ...(soundCheckBn && { soundCheckTime: soundCheckBn }),
                ...(extraInformation && { extraInformation }),
                private: true,
                createdAt: new Date(),
                status: 'open',
                complete: true,
                gigName,
                kind: kindBn,
                gigType: gigTypeBn,
                genre: Array.isArray(gig.genre) ? gig.genre : (gig.genre || ''),
                technicalInformation: extraInformation || '',
                createdBy: user?.uid ?? '',
                accountName: user?.name ?? '',
                budget: slotBudgetTextBn,
                budgetValue: feeValueBn,
                applicants: applicantsBn,
                ticketingResponsibility,
                eventTimings,
                listingDocuments: listingDocs,
                ...(capacityNumBn != null && { capacity: capacityNumBn }),
              });
              groupIdx++;
            }
          }
          continue;
        }

        const bookingMode = gig.bookingMode === 'rental' ? 'rental' : 'artist';
        const venue = selectedVenue;
        const baseGigName = String(gig.gigName ?? '').trim() || (venue ? (bookingMode === 'rental' ? `${venue.name} For Hire` : `Gig at ${venue.name}`) : 'Gig');
        const extraInformation = String(gig.extraInformation ?? '').trim() || undefined;
        const gigType = gig.gigType || 'Musician/Band';
        const loadInTime = String(gig.loadInTime ?? '').trim() || undefined;
        const soundCheckTime = String(gig.soundCheckTime ?? '').trim() || undefined;

        if (bookingMode === 'rental') {
          const rentalStart = String(gig.rentalStartTime ?? '').trim();
          const rentalEnd = String(gig.rentalEndTime ?? '').trim();
          const rentalTimingNotes = String(gig.rentalTimingNotes ?? '').trim() || undefined;
          const startDateTime = getStartDateTime(dateIso, rentalStart);
          const feeRaw = gig.rentalFee ?? '£';
          const feeValue = getBudgetValue(feeRaw);
          const feeText = formatPounds(feeValue);
          const effectiveRental =
            addGigsMode === 'bookNew' ? 'available' : addGigsMode === 'addExisting' ? 'confirmed_renter' : (gig.rentalStatus ?? 'available');
          const rentalStatus = effectiveRental === 'confirmed_renter' ? 'confirmed' : 'available';
          const privateRental =
            effectiveRental === 'confirmed_renter' ? true : !!gig.rentalPrivate;

          const rentalHouseRulesMode =
            gig.rentalHouseRulesMode === 'document' ? 'document' : 'text';
          const rentalHouseRulesText = String(gig.rentalHouseRules ?? '').trim() || undefined;
          let rentalHouseRulesDocumentUrl = '';
          if (rentalHouseRulesMode === 'document') {
            const docSource = gig.rentalHouseRulesDocument;
            rentalHouseRulesDocumentUrl =
              typeof docSource === 'string' && docSource
                ? docSource
                : await uploadFileWithFallback(
                    docSource,
                    `venues/${venueId}/documents`
                  );
          }

          const rentalDepositRequired = !!gig.rentalDepositRequired;
          const rentalDepositAmount = rentalDepositRequired ? formatPounds(getBudgetValue(gig.rentalDepositAmount ?? '£')) : undefined;
          // Capacity: form value, or venue default when creating (so venue profile capacity is saved and shows in Gig details)
          const capacityFromForm = parseInt(String(gig.rentalCapacity ?? '').replace(/[^\d]/g, ''), 10);
          const capacityFromVenue = parseInt(String(selectedVenue?.capacity ?? '').replace(/[^\d]/g, ''), 10);
          const capacityNum = Number.isFinite(capacityFromForm) && capacityFromForm > 0
            ? capacityFromForm
            : (Number.isFinite(capacityFromVenue) && capacityFromVenue > 0 ? capacityFromVenue : undefined);
          hireOpportunities.push({
            venueId,
            createdByUserId: user?.uid ?? '',
            date: startDateTime,
            startDateTime,
            startTime: rentalStart,
            endTime: rentalEnd,
            accessFrom: rentalStart || null,
            curfew: rentalEnd || null,
            hireFee: feeText,
            ...(capacityNum != null && { capacity: capacityNum }),
            depositRequired: rentalDepositRequired,
            depositAmount: rentalDepositAmount ?? null,
            documents: rentalHouseRulesMode === 'document' && rentalHouseRulesDocumentUrl ? [{ url: rentalHouseRulesDocumentUrl }] : [],
            notesInternal: rentalHouseRulesMode === 'text' ? (rentalHouseRulesText || '') : '',
            status: rentalStatus,
            hirerType: gig.renterName && effectiveRental === 'confirmed_renter' ? 'manual' : 'none',
            hirerName: gig.renterName && effectiveRental === 'confirmed_renter' ? String(gig.renterName).trim() : null,
            performers: [],
            private: privateRental,
            ...(String(gig.soundManager ?? '').trim() && { soundManager: String(gig.soundManager).trim() }),
            ...(buildTechSetupPayload(gig.techSetup) && { techSetup: buildTechSetupPayload(gig.techSetup) }),
          });
        } else {
          const slots = [
            { startTime: gig.startTime ?? '', duration: gig.duration },
            ...(gig.extraSlots || []).map((s) => ({ startTime: s?.startTime ?? '', duration: s?.duration })),
          ];
          const slotCount = slots.length;
          const artistNames = getArtistNamesForSlots(gig, slotCount);
          const slotBookingStatuses = getSlotBookingStatuses(gig, slotCount);
          const slotBudgetsArr = getSlotBudgetsFor(gig, slotCount);
          const slotPaymentTypesArr = getSlotPaymentTypes(gig, slotCount);
          // Same as venue hire: form rentalCapacity, else venue profile (shows in gig details)
          const capacityFromFormArtist = parseInt(String(gig.rentalCapacity ?? '').replace(/[^\d]/g, ''), 10);
          const capacityFromVenueArtist = parseInt(String(selectedVenue?.capacity ?? '').replace(/[^\d]/g, ''), 10);
          const capacityNumArtist = Number.isFinite(capacityFromFormArtist) && capacityFromFormArtist > 0
            ? capacityFromFormArtist
            : (Number.isFinite(capacityFromVenueArtist) && capacityFromVenueArtist > 0 ? capacityFromVenueArtist : undefined);

          // Collect valid slot indices and pre-generate gigIds so we can set gigSlots for grouping on the calendar
          const validSlots = [];
          let slotIndex = 0;
          for (const slot of slots) {
            const startTime = String(slot?.startTime ?? '').trim();
            const duration = Number(slot?.duration);
            if (startTime && duration > 0) validSlots.push(slotIndex);
            slotIndex++;
          }
          const groupIds = validSlots.map(() => uuidv4());

          slotIndex = 0;
          let groupIdx = 0;
          for (const slot of slots) {
            const startTime = String(slot?.startTime ?? '').trim();
            const duration = Number(slot?.duration);
            if (!startTime || !(duration > 0)) {
              slotIndex++;
              continue;
            }
            const slotGigId = groupIds[groupIdx];
            const gigSlotsForThis = groupIds.length > 1 ? groupIds.filter((id) => id !== slotGigId) : undefined;
            const artistName = (artistNames[slotIndex] ?? '').trim();
            const effectiveSlotConfirmed =
              addGigsMode === 'bookNew' ? false : addGigsMode === 'addExisting' ? true : (slotBookingStatuses[slotIndex] === 'confirmed');
            const applicants = effectiveSlotConfirmed && artistName
              ? [{ status: 'confirmed', name: artistName }]
              : [];
            const startDateTime = getStartDateTime(dateIso, startTime);
            const gigName = slotIndex === 0 ? baseGigName : `${baseGigName} (Set ${slotIndex + 1})`;
            const rawSlotPayType = slotPaymentTypesArr[slotIndex];
            const inferredFlatFee = !VALID_PAYMENT_TYPES.includes(rawSlotPayType) && hasPositiveBudgetValue(slotBudgetsArr[slotIndex]);
            const slotPayType = VALID_PAYMENT_TYPES.includes(rawSlotPayType)
              ? rawSlotPayType
              : (inferredFlatFee ? 'flat_fee' : 'no_payment');
            const slotKind = gig.kind || 'Live Music';
            const slotBudgetRaw = slotPayType === 'flat_fee' ? (slotBudgetsArr[slotIndex] ?? '£') : '£';
            const slotBudgetValue = slotPayType === 'flat_fee' ? getBudgetValue(slotBudgetRaw) : 0;
            const slotBudgetText = formatPounds(slotBudgetValue);
            gigDocuments.push({
              gigId: slotGigId,
              ...(gigSlotsForThis != null && { gigSlots: gigSlotsForThis }),
              venueId,
              date: startDateTime,
              startDateTime,
              startTime,
              duration,
              bookingMode: 'artist',
              ...(geopoint && { geopoint }),
              ...(loadInTime && { loadInTime }),
              ...(soundCheckTime && { soundCheckTime }),
              ...(extraInformation && { extraInformation }),
              private: (getSlotInviteOnly(gig, slotCount)[slotIndex] ?? false),
              createdAt: new Date(),
              status: 'open',
              complete: true,
            gigName,
            kind: slotKind,
            gigType,
                genre: Array.isArray(gig.genre) ? gig.genre : (gig.genre || ''),
            technicalInformation: extraInformation || '',
              createdBy: user?.uid ?? '',
              accountName: user?.name ?? '',
              budget: slotBudgetText,
              budgetValue: slotBudgetValue,
              applicants,
              ...(String(gig.soundManager ?? '').trim() && { soundManager: String(gig.soundManager).trim() }),
              ...(buildTechSetupPayload(gig.techSetup) && { techSetup: buildTechSetupPayload(gig.techSetup) }),
              ...(capacityNumArtist != null && { capacity: capacityNumArtist }),
            });
            groupIdx++;
            slotIndex++;
          }
        }
      }

      if (hireOpportunities.length > 0) {
        await createVenueHireOpportunitiesBatch(hireOpportunities);
        toast.success(`Added ${hireOpportunities.length} venue hire opportunity${hireOpportunities.length === 1 ? '' : 'ies'}.`);
        refreshGigs?.();
        onClose();
        setSubmitting(false);
        return;
      }

      if (gigDocuments.length === 0) {
        setSubmitting(false);
        return;
      }

      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const maxRetries = 5;
      const retryDelays = [2000, 4000, 6000, 8000, 10000];
      let lastErr;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await postMultipleGigs({ venueId, gigDocuments });
          // For "build for musician" flows we run the invite pipeline against
          // the first created gig doc. If no Gigin profile is found the helper
          // opens InviteMethodsModal inline; in that case we keep the outer
          // modal mounted so the inline one has a host and only close when the
          // user finishes the invite-methods step.
          let keepOpenForInviteMethods = false;
          if (buildForMusicianActive && gigDocuments.length > 0) {
            const followup = await runBuildForMusicianFollowup(gigDocuments[0]);
            keepOpenForInviteMethods = !!followup?.inviteMethodsOpened;
          }
          toast.success(`Added ${gigDocuments.length} gig${gigDocuments.length === 1 ? '' : 's'}.`);
          refreshGigs?.();
          if (!keepOpenForInviteMethods) onClose();
          setSubmitting(false);
          return;
        } catch (err) {
          lastErr = err;
          const is429 = err?.message?.includes('Too Many Requests') || err?.status === 429;
          if (is429 && attempt < maxRetries) {
            const waitMs = retryDelays[attempt] ?? 10000;
            toast.info(`Too many requests — retrying in ${waitMs / 1000} seconds…`, { autoClose: Math.min(waitMs, 5000) });
            await delay(waitMs);
            continue;
          }
          break;
        }
      }
      console.error(lastErr);
      const is429 = lastErr?.message?.includes('Too Many Requests') || lastErr?.status === 429;
      toast.error(is429 ? 'Too many requests. Please wait a few minutes and try again.' : (lastErr?.message || 'Failed to add gigs.'));
    } finally {
      setSubmitting(false);
    }
  };

  const currentGig = activeTab ? gigsByDate[activeTab] : null;
  const currentSlotCount = activeTab ? (allSlotsFor(activeTab) || []).length : 0;

  const currentBookingMode = (() => {
    const mode = currentGig?.bookingMode;
    return mode === 'artist' || mode === 'rental' ? mode : null;
  })();

  /** When addGigsMode is set, override displayed/used status so we don't show the status toggles. */
  const displayRentalStatus =
    addGigsMode === 'bookNew'
      ? 'available'
      : addGigsMode === 'addExisting'
        ? 'confirmed_renter'
        : (currentGig?.rentalStatus ?? 'available');

  const getEffectiveSlotStatus = (index) => {
    const slotCount = (allSlotsFor(activeTab) || []).length;
    if (addGigsMode === 'bookNew') return 'unbooked';
    if (addGigsMode === 'addExisting') return 'confirmed';
    return getSlotBookingStatuses(currentGig, slotCount)[index];
  };

  const houseRulesMode =
    currentGig?.rentalHouseRulesMode === 'document' ? 'document' : 'text';

  const currentArtistSlotCount =
    activeTab && currentBookingMode === 'artist'
      ? artistSlotCountByDate[activeTab] ?? ''
      : '';

  const hasArtistSlots =
    currentBookingMode === 'artist' && Number(currentArtistSlotCount) >= 1;

  useEffect(() => {
    const el = modalBodyRef.current;
    if (!el) return;
    const checkScroll = () => {
      setModalHasScroll(el.scrollHeight > el.clientHeight + 1);
    };
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [step, currentBookingMode, activeTab, gigsByDate, showMoreDetails, artistSlotCountByDate, expandedSlotsByDate]);

  const isGigValidWithMode = (gig) => {
    const g = gig || defaultGigForDate();
    if (!addGigsMode) return isGigValid(g);
    if (addGigsMode === 'addExisting') {
      return isAddExistingArtistWizardComplete(g);
    }
    if (g.bookingMode === 'rental') {
      const effectiveRental = addGigsMode === 'bookNew' ? 'available' : 'confirmed_renter';
      const virtualRental = {
        ...g,
        rentalStatus: effectiveRental,
        ...(addGigsMode === 'bookNew' && { rentalPrivate: g.rentalPrivate ?? false }),
      };
      return isGigValid(virtualRental);
    }
    if (g.bookingMode === 'artist') {
      const slotCount = 1 + (g.extraSlots?.length || 0);
      const effectiveStatus = addGigsMode === 'bookNew' ? 'unbooked' : 'confirmed';
      const artistNames = getArtistNamesForSlots(g, slotCount);
      const paymentTypes = getSlotPaymentTypes(g, slotCount);
      const slotBudgets = getSlotBudgetsFor(g, slotCount);
      const paymentValid = paymentTypes.every((pt, i) => (
        VALID_PAYMENT_TYPES.includes(pt) || (!pt && hasPositiveBudgetValue(slotBudgets[i]))
      ));
      const startTime = (g.startTime ?? '').toString().trim();
      const hasDuration = g.duration != null && g.duration !== '' && Number(g.duration) > 0;
      if (!startTime || !hasDuration || !paymentValid) return false;
      if (getFirstArtistSlotChronologyViolation(g) !== null) return false;
      if (effectiveStatus === 'unbooked') return true;
      return artistNames.length >= 1 && artistNames.every((name) => (name ?? '').toString().trim().length > 0);
    }
    return isGigValid(g);
  };

  const getFirstMissingFieldWithMode = (gig) => {
    const g = gig || defaultGigForDate();
    if (!addGigsMode) return getFirstMissingField(g);
    if (addGigsMode === 'addExisting') {
      return null;
    }
    if (g.bookingMode === 'rental') {
      const virtual = {
        ...g,
        rentalStatus: addGigsMode === 'bookNew' ? 'available' : 'confirmed_renter',
        ...(addGigsMode === 'bookNew' && { rentalPrivate: g.rentalPrivate ?? false }),
      };
      return getFirstMissingField(virtual);
    }
    if (g.bookingMode === 'artist') {
      const slotCount = 1 + (g.extraSlots?.length || 0);
      const virtual = {
        ...g,
        slotBookingStatuses: addGigsMode === 'bookNew'
          ? Array.from({ length: slotCount }, () => 'unbooked')
          : Array.from({ length: slotCount }, () => 'confirmed'),
      };
      return getFirstMissingField(virtual);
    }
    return getFirstMissingField(g);
  };

  const canSubmit =
    sortedDates.length > 0 &&
    sortedDates.every((iso) => {
      const g = gigsByDate[iso] || defaultGigForDate();
      if (addGigsMode === 'bookNew') return isBookNewGigComplete(g);
      return isGigValidWithMode(g);
    });

  const isMultipleGigs = sortedDates.length > 1;

  const submitButtonLabel = useMemo(() => {
    if (addGigsMode === 'bookNew') {
      if (isEditMode) return 'Update event';
      return isMultipleGigs ? 'Create events' : 'Create event';
    }
    if (!activeTab) return isMultipleGigs ? 'Add/Book Gigs' : 'Add/Book a Gig';
    if (addGigsMode === 'addExisting') {
      return isMultipleGigs ? 'Add Gigs' : 'Add Gig';
    }
    if (!isMultipleGigs && currentBookingMode === 'rental') return isEditMode ? 'Update Gig' : (addGigsMode === 'addExisting' ? 'Add Gig' : 'List Gig');
    if (isMultipleGigs && !canSubmit) return 'Next Gig';
    const gig = gigsByDate[activeTab] || defaultGigForDate();
    const slotCount = 1 + (gig.extraSlots?.length || 0);
    const statuses = getSlotBookingStatuses(gig, slotCount);
    const anyConfirmed = statuses.some((s) => s === 'confirmed');
    const allUnbooked = statuses.length > 0 && statuses.every((s) => s === 'unbooked');
    if (anyConfirmed) return isMultipleGigs ? 'Add Gigs' : 'Add Gig';
    if (allUnbooked) return currentBookingMode === 'rental' ? (isMultipleGigs ? 'List Gigs' : 'List Gig') : (isMultipleGigs ? 'Book Gigs' : 'Book a Gig');
    return currentBookingMode === 'rental' ? (isMultipleGigs ? 'List Gigs' : 'List Gig') : (isMultipleGigs ? 'Add/Book Gigs' : 'Add/Book a Gig');
  }, [activeTab, gigsByDate, isMultipleGigs, currentBookingMode, canSubmit, isEditMode, addGigsMode]);

  const submitButtonBusyLabel = useMemo(() => {
    if (addGigsMode === 'bookNew') return isEditMode ? 'Updating…' : 'Creating…';
    if (!activeTab) return 'Adding…';
    if (addGigsMode === 'addExisting') return 'Adding…';
    if (currentBookingMode === 'rental') return isEditMode ? 'Updating…' : (addGigsMode === 'addExisting' ? 'Adding…' : 'Listing…');
    const gig = gigsByDate[activeTab] || defaultGigForDate();
    const slotCount = 1 + (gig.extraSlots?.length || 0);
    const statuses = getSlotBookingStatuses(gig, slotCount);
    const anyConfirmed = statuses.some((s) => s === 'confirmed');
    return anyConfirmed ? 'Adding…' : 'Booking…';
  }, [activeTab, gigsByDate, isMultipleGigs, currentBookingMode, isEditMode, addGigsMode]);

  const applyBookNewTemplateToDates = (template, dateIsos, templateApplyMode = 'bookNew') => {
    if (!template || !Array.isArray(dateIsos)) return;
    const applyFn = templateApplyMode === 'addExisting' ? applyBookNewTemplateToGigAddExisting : applyBookNewTemplateToGig;
    setGigsByDate((prev) => {
      const next = { ...prev };
      for (const iso of dateIsos) {
        if (!iso) continue;
        const g = next[iso] || defaultGigForDate();
        next[iso] = applyFn(g, template);
      }
      return next;
    });
    setBookNewTimingError(null);
    setBookNewTemplateAppliedInSession(true);
  };

  const bookNewTemplateApplyMode = addGigsMode === 'addExisting' ? 'addExisting' : 'bookNew';

  const handleSaveBookNewTemplate = async () => {
    const name = templateSaveNameInput.trim();
    if (!name || !venueId || !activeTab || addGigsMode !== 'bookNew') return;
    if (templateNameExistsForVenue(templates, venueId, name, null)) {
      toast.error('A template with this name already exists for this venue.');
      return;
    }
    const gig = gigsByDate[activeTab];
    if (!gig) return;
    setSavingBookNewTemplate(true);
    try {
      const templateId = uuidv4();
      const payload = buildBookNewTemplatePayload(gig, venueId, templateId, name);
      await saveGigTemplate({ templateData: payload });
      await refreshTemplates?.();
      toast.success('Template saved');
      setShowSaveBookNewTemplateModal(false);
      setTemplateSaveNameInput('');
    } catch (err) {
      if (err.status === 409) {
        toast.error(err.payload?.message || err.message || 'A template with this name already exists.');
      } else {
        toast.error('Failed to save template');
      }
    } finally {
      setSavingBookNewTemplate(false);
    }
  };

  const handleUseBookNewTemplateClick = (template) => {
    if (!template) return;
    if (sortedDates.length > 1) {
      setShowUseBookNewTemplateModal(false);
      setPendingApplyBookNewTemplate(template);
      setShowApplyBookNewTemplateScopeModal(true);
    } else {
      applyBookNewTemplateToDates(template, sortedDates, bookNewTemplateApplyMode);
      toast.success('Template applied');
      setShowUseBookNewTemplateModal(false);
    }
  };

  const handleConfirmApplyBookNewTemplateScope = (allDates) => {
    const tpl = pendingApplyBookNewTemplate;
    if (!tpl) return;
    const isos = allDates ? sortedDates : (activeTab ? [activeTab] : []);
    applyBookNewTemplateToDates(tpl, isos, bookNewTemplateApplyMode);
    toast.success(allDates ? 'Template applied to all dates' : 'Template applied');
    setShowApplyBookNewTemplateScopeModal(false);
    setPendingApplyBookNewTemplate(null);
  };

  const previewOpen = showBookNewListingPreview && addGigsMode === 'bookNew' && step === 'details' && !!activeTab;

  return (
    <Portal>
      {inlineInviteMethods && (
        <InviteMethodsModal
          artist={inlineInviteMethods.artist}
          gigData={inlineInviteMethods.gig}
          venue={inlineInviteMethods.venue}
          user={user}
          onClose={() => {
            setInlineInviteMethods(null);
            if (setBuildingForMusician) setBuildingForMusician(false);
            if (setBuildingForMusicianData) setBuildingForMusicianData(null);
            if (setRequestId) setRequestId(null);
            if (setPreferredDate) setPreferredDate(null);
            onClose();
          }}
          onEmailSent={() => {
            setInlineInviteMethods(null);
            if (setBuildingForMusician) setBuildingForMusician(false);
            if (setBuildingForMusicianData) setBuildingForMusicianData(null);
            if (setRequestId) setRequestId(null);
            if (setPreferredDate) setPreferredDate(null);
            onClose();
          }}
        />
      )}
      <div
        className={`modal add-gigs-modal${previewOpen ? ' add-gigs-modal--with-listing-preview' : ''}`}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-gigs-title"
      >
        <div
          className={`add-gigs-modal-layout-row${previewOpen ? ' add-gigs-modal-layout-row--split' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="modal-content add-gigs-modal-content">
          <div className="add-gigs-modal-header">
            <div className="add-gigs-modal-header-top">
              <div className="add-gigs-modal-title-wrap">
                <h2 id="add-gigs-title" className="add-gigs-modal-title">
                  {isEditMode
                    ? 'Edit Event'
                    : buildForMusicianActive
                      ? `Build event for ${buildingForMusicianData?.name || 'artist'}`
                      : isMultipleGigs
                        ? 'Create Events'
                        : 'Create event'}
                </h2>
                {buildForMusicianActive && !isEditMode && (
                  <p className="add-gigs-modal-subtitle">
                    This listing will be private — only {buildingForMusicianData?.name || 'the invited artist'} can apply.
                  </p>
                )}
              </div>
              <button type="button" className="btn close tertiary" onClick={onClose}>
                Close <span aria-hidden="true">×</span>
              </button>
            </div>
            {step === 'details' && !isEditManuallyConfirmed && sortedDates.length >= 2 && (
              <div className="add-gigs-modal-header-tabs-row">
                <div className="add-gigs-tabs add-gigs-modal-header-date-tabs">
                  {sortedDates.map((iso) => {
                    const g = gigsByDate[iso] || defaultGigForDate();
                    const gigValid = addGigsMode === 'bookNew'
                      ? isBookNewGigComplete(g)
                      : isGigValidWithMode(g);
                    return (
                      <div
                        key={iso}
                        className={`add-gigs-tab ${activeTab === iso ? 'add-gigs-tab--active' : ''} ${gigValid ? 'add-gigs-tab--complete' : ''}`}
                      >
                        <button type="button" className="add-gigs-tab-btn" onClick={() => setActiveTab(iso)}>
                          {gigValid && <TickIcon />}
                          {formatTabDate(iso)}
                        </button>
                        <button
                          type="button"
                          className="add-gigs-tab-remove"
                          onClick={() => removeDate(iso)}
                          aria-label={`Remove date ${formatTabDate(iso)}`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                {sortedDates.length >= 2 && addGigsMode !== 'bookNew' && (addGigsMode === 'addExisting' || currentBookingMode) && (
                  <div className="add-gigs-apply-all-wrap add-gigs-apply-all-wrap--in-modal-header">
                    <button
                      type="button"
                      className="btn tertiary add-gigs-apply-all-btn add-gigs-apply-all-btn--inline"
                      onClick={applyGigSettingsToAll}
                    >
                      Apply gig settings to all
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={`add-gigs-modal-body ${isEditManuallyConfirmed ? 'add-gigs-modal-body--edit-confirmed' : ''}`.trim()} ref={modalBodyRef}>
          {step === 'dates' && (
            <>
              {venues.length > 1 && (
                <div className="add-gigs-field">
                  <label>Venue</label>
                  <select
                    className="select add-gigs-filter-select add-gigs-venue-select"
                    value={venueId}
                    onChange={(e) => setVenueId(e.target.value)}
                    disabled={!!bookNewTemplateToApply && addGigsMode === 'bookNew'}
                  >
                    {venues.map((v) => (
                      <option key={v.venueId} value={v.venueId}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="add-gigs-calendar-header">
                <button type="button" className="btn icon tertiary" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month">
                  ‹
                </button>
                <span className="add-gigs-month-label">{format(month, 'MMMM yyyy')}</span>
                <button type="button" className="btn icon tertiary" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
                  ›
                </button>
              </div>
              <div className="add-gigs-weekdays">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d} className="add-gigs-weekday">{d}</span>
                ))}
              </div>
              <div className="add-gigs-grid">
                {padArray.map((_, i) => (
                  <div key={`pad-${i}`} className="add-gigs-day add-gigs-day--pad" />
                ))}
                {days.map((d) => {
                  const iso = format(d, 'yyyy-MM-dd');
                  const selected = selectedDates.includes(iso);
                  const isCurrentMonth = isSameMonth(d, month);
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={`add-gigs-day ${selected ? 'add-gigs-day--selected' : ''} ${!isCurrentMonth ? 'add-gigs-day--other' : ''}`}
                      onClick={() => isCurrentMonth && toggleDate(iso)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
              <p className="add-gigs-hint">Click dates to select. Selected: {selectedDates.length}</p>
            </>
          )}

          {step === 'details' && (
            <div className="add-gigs-details-step">
              {!isEditManuallyConfirmed && activeTab && (
              <div className="add-gigs-sticky-date-bar">
                <div className="add-gigs-sticky-date-bar-inner">
                  <div
                    className={`add-gigs-date-venue-header-row${
                      venues.length > 0 ? ' add-gigs-date-venue-header-row--two-cols' : ''
                    }`}
                  >
                    <div className="add-gigs-field add-gigs-header-field-pill">
                      <label className="add-gigs-header-field-label" htmlFor={`add-gigs-header-date-${activeTab}`}>Date</label>
                      <button
                        id={`add-gigs-header-date-${activeTab}`}
                        type="button"
                        className="add-gigs-header-pill add-gigs-header-pill--date"
                        onClick={() => setStep('dates')}
                        aria-label="Change date"
                      >
                        <span className="add-gigs-header-pill-icon" aria-hidden="true">
                          <CalendarIconSolid />
                        </span>
                        <span className="add-gigs-header-pill-value">{formatHeaderDisplayDate(activeTab)}</span>
                      </button>
                    </div>
                    {venues.length > 0 && (
                      <div className="add-gigs-field add-gigs-header-field-pill">
                        <label className="add-gigs-header-field-label" htmlFor="add-gigs-venue-select-details">Venue</label>
                        <div className="add-gigs-header-pill add-gigs-header-pill--venue">
                          <span className="add-gigs-header-pill-icon" aria-hidden="true">
                            <LocationPinIcon />
                          </span>
                          <select
                            id="add-gigs-venue-select-details"
                            className="add-gigs-header-venue-select"
                            value={venueId}
                            onChange={(e) => setVenueId(e.target.value)}
                            required
                            aria-required="true"
                          >
                            {venues.map((v) => (
                              <option key={v.venueId} value={v.venueId}>{v.name}</option>
                            ))}
                          </select>
                          <span className="add-gigs-header-pill-chevron" aria-hidden="true">
                            <DownChevronIcon />
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {(addGigsMode === 'bookNew' || addGigsMode === 'addExisting') && venueId && bookNewTemplatesForVenue.length > 0 && (
                    <div className="add-gigs-book-new-use-template-row">
                      <button
                        type="button"
                        className={`btn tertiary add-gigs-book-new-use-template-btn${bookNewTemplateAppliedInSession ? ' add-gigs-book-new-use-template-btn--used' : ''}`}
                        disabled={bookNewTemplateAppliedInSession}
                        onClick={() => setShowUseBookNewTemplateModal(true)}
                        aria-label={bookNewTemplateAppliedInSession ? 'Template used' : 'Use a Template'}
                      >
                        <SolidCalendarRotateFullIcon />
                        <span>{bookNewTemplateAppliedInSession ? 'Template used' : 'Use a Template'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              )}

              {activeTab && currentGig && (
                <div className="add-gigs-panel">
                  {addGigsMode === 'bookNew' && (
                    <BookNewEventWizard
                      variant="bookNew"
                      activeTab={activeTab}
                      currentGig={currentGig}
                      selectedVenue={selectedVenue}
                      patchGig={(updates) => updateGig(activeTab, updates)}
                      bookNewTimingError={bookNewTimingError}
                      onClearTimingError={() => setBookNewTimingError(null)}
                      onOpenSaveTemplateModal={() => {
                        setTemplateSaveNameInput('');
                        setShowSaveBookNewTemplateModal(true);
                      }}
                      listingPreviewOpen={showBookNewListingPreview}
                      onToggleListingPreview={() => setShowBookNewListingPreview((v) => !v)}
                      isEditMode={isEditMode}
                      allSlotsForActive={activeTab ? allSlotsFor(activeTab) : []}
                      slotBudgetsForActive={activeTab ? getSlotBudgetsFor(
                        gigsByDate[activeTab] || defaultGigForDate(),
                        (allSlotsFor(activeTab) || []).length || 1,
                      ) : []}
                      onSlotCountChange={(count) => activeTab && setArtistSlotCount(activeTab, count)}
                      onSlotStartChange={(index, value) => activeTab && handleSlotStartTimeChange(activeTab, index, value)}
                      onSlotDurationChange={(index, value) => activeTab && handleSlotDurationChange(activeTab, index, value)}
                      onSlotBudgetChange={(index, value) => activeTab && setSlotBudget(activeTab, index, value)}
                      onRemoveExtraSlot={(extraIndex) => activeTab && removeGigSlot(activeTab, extraIndex)}
                      onAddSlot={() => activeTab && addGigSlot(activeTab)}
                    />
                  )}
                  {addGigsMode !== 'bookNew' && (
                  <>
                  {!isEditManuallyConfirmed && addGigsMode !== 'addExisting' && (
                    <div className="add-gigs-booking-mode">
                      <button
                        type="button"
                        className={`btn add-gigs-booking-mode-btn ${currentBookingMode === 'rental' ? 'primary' : 'tertiary'}`}
                        onClick={() => updateGig(activeTab, { bookingMode: 'rental' })}
                      >
                        <span className="add-gigs-booking-mode-btn-title">Hire out venue</span>
                        <span className="add-gigs-booking-mode-btn-desc">I want to rent the space to a promoter, organiser, artist</span>
                      </button>
                      <button
                        type="button"
                        className={`btn add-gigs-booking-mode-btn ${currentBookingMode === 'artist' ? 'primary' : 'tertiary'}`}
                        onClick={() => updateGig(activeTab, { bookingMode: 'artist' })}
                      >
                        <span className="add-gigs-booking-mode-btn-title">Book artists</span>
                        <span className="add-gigs-booking-mode-btn-desc">I want to organise and book (and pay) the artist lineup</span>
                      </button>
                    </div>
                  )}

                  {addGigsMode === 'addExisting' && (
                    <BookNewEventWizard
                      variant="addExisting"
                      showTemplateAndListingPreview={false}
                      activeTab={activeTab}
                      currentGig={currentGig}
                      selectedVenue={selectedVenue}
                      patchGig={(updates) => updateGig(activeTab, updates)}
                      bookNewTimingError={bookNewTimingError}
                      onClearTimingError={() => setBookNewTimingError(null)}
                      isEditMode={isEditMode}
                      allSlotsForActive={activeTab ? allSlotsFor(activeTab) : []}
                      slotBudgetsForActive={activeTab ? getSlotBudgetsFor(
                        gigsByDate[activeTab] || defaultGigForDate(),
                        (allSlotsFor(activeTab) || []).length || 1,
                      ) : []}
                      slotArtistNamesForActive={activeTab ? getArtistNamesForSlots(
                        gigsByDate[activeTab] || defaultGigForDate(),
                        (allSlotsFor(activeTab) || []).length || 1,
                      ) : []}
                      onSlotCountChange={(count) => activeTab && setArtistSlotCount(activeTab, count)}
                      onSlotStartChange={(index, value) => activeTab && handleSlotStartTimeChange(activeTab, index, value)}
                      onSlotDurationChange={(index, value) => activeTab && handleSlotDurationChange(activeTab, index, value)}
                      onSlotBudgetChange={(index, value) => activeTab && setSlotBudget(activeTab, index, value)}
                      onSlotArtistNameChange={(index, value) => activeTab && setSlotArtistName(activeTab, index, value)}
                      onRemoveExtraSlot={(extraIndex) => activeTab && removeGigSlot(activeTab, extraIndex)}
                      onAddSlot={() => activeTab && addGigSlot(activeTab)}
                    />
                  )}
                  {currentBookingMode === 'artist' && addGigsMode !== 'addExisting' && (
                    <>
                  <div className="add-gigs-field add-gigs-artist-count">
                    <label className="label add-gigs-section-heading">Number of sets</label>
                    <div className="add-gigs-artist-count-pills" role="tablist" aria-label="Number of sets">
                      {[1, 2, 3].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`btn tertiary add-gigs-artist-count-pill ${currentArtistSlotCount === count ? 'add-gigs-artist-count-pill--active' : ''}`}
                          onClick={() => activeTab && setArtistSlotCount(activeTab, count)}
                        >
                          {count}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`btn tertiary add-gigs-artist-count-pill ${currentArtistSlotCount >= 4 ? 'add-gigs-artist-count-pill--active' : ''}`}
                        onClick={() => activeTab && setArtistSlotCount(activeTab, 4)}
                      >
                        4+
                      </button>
                    </div>
                  </div>
                  {hasArtistSlots && (
                  <div className="add-gigs-gig-slots-wrap">
                    <div className="add-gigs-gig-slots">
                    {(() => {
                      const slotsRow = allSlotsFor(activeTab) || [];
                      const slotCount = slotsRow.length;
                      return slotsRow.map((slot, index) => {
                      const slotPaymentType = (getSlotPaymentTypes(currentGig, slotCount)[index] ?? 'no_payment');
                      const effectiveSlotStatus = getEffectiveSlotStatus(index);
                      const slotArtistName = (getArtistNamesForSlots(currentGig, slotCount)[index] ?? '').trim();
                      const hasCoreTiming = !!(slot.startTime ?? '').toString().trim() && Number(slot.duration) > 0;
                      const paymentValid = VALID_PAYMENT_TYPES.includes(slotPaymentType);
                      const bookingValid =
                        (effectiveSlotStatus === 'unbooked') ||
                        (effectiveSlotStatus === 'confirmed' && !!slotArtistName);
                      const slotComplete = hasCoreTiming && paymentValid && bookingValid;
                      const expanded = true;
                      const startTimeInputId = `add-gigs-slot-start-time-${activeTab}-${index}`;
                      const slotStartOverlapsPrevious = isArtistSlotStartBeforePreviousEnds(slotsRow, index);
                      return (
                      <div key={index} className="add-gigs-gig-slot">
                        <div className="add-gigs-slot-header">
                          <div className="add-gigs-slot-header-main">
                            <h4 className="add-gigs-slot-title">{`Set ${index + 1}`}</h4>
                          </div>
                          <div className="add-gigs-slot-header-actions">
                            {index !== 0 && (
                              <button
                                type="button"
                                className="btn small add-gigs-remove-slot-btn"
                                onClick={() => removeGigSlot(activeTab, index - 1)}
                              >
                                <DeleteGigIcon />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="add-gigs-slot-time-row">
                          <div className="add-gigs-field">
                            <label className="label">Start Time</label>
                            <div
                              className={`add-gigs-slot-time-input-wrap${slotStartOverlapsPrevious ? ' add-gigs-slot-time-input-wrap--invalid' : ''}`}
                            >
                              <button
                                type="button"
                                className="add-gigs-slot-time-picker-btn"
                                onClick={() => {
                                  const input = document.getElementById(startTimeInputId);
                                  if (!input) return;
                                  if (typeof input.showPicker === 'function') {
                                    input.showPicker();
                                  } else {
                                    input.focus();
                                    input.click();
                                  }
                                }}
                                aria-label="Open time picker"
                              >
                                <ClockIcon className="add-gigs-slot-time-input-icon" />
                              </button>
                              <input
                                id={startTimeInputId}
                                ref={index === 0 ? startTimeInputRef : undefined}
                                type="time"
                                className="input add-gigs-slot-time-input"
                                value={slot.startTime ?? ''}
                                onChange={(e) => handleSlotStartTimeChange(activeTab, index, e.target.value)}
                                aria-invalid={
                                  Boolean(
                                    (index === 0 && !(currentGig.startTime ?? '').toString().trim()) ||
                                    slotStartOverlapsPrevious
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="add-gigs-field">
                            <label className="label">Duration</label>
                            <select
                              ref={index === 0 ? durationSelectRef : undefined}
                              className="select add-gigs-slot-duration-select"
                              value={Number(slot.duration) || 60}
                              onChange={(e) =>
                                handleSlotDurationChange(activeTab, index, Number(e.target.value) || 60)
                              }
                              aria-invalid={index === 0 && !(currentGig.duration != null && Number(currentGig.duration) > 0)}
                            >
                              {[30, 45, 60, 75, 90, 120, 150, 180, 240].map((mins) => (
                                <option key={mins} value={mins}>{`${mins} mins`}</option>
                              ))}
                            </select>
                          </div>
                          <div
                            className={`add-gigs-field add-gigs-slot-payment-method ${invalidFieldHighlightTab === activeTab && typeof invalidFieldHighlight === 'object' && invalidFieldHighlight?.payment === index ? 'add-gigs-slot-payment-method--invalid' : ''}`}
                            ref={(el) => { slotPaymentRefs.current[index] = el; }}
                          >
                            <label className="label">Payment Type</label>
                            <div className="add-gigs-payment-selections add-gigs-payment-selections--segmented">
                              <button
                                type="button"
                                className={`add-gigs-payment-card add-gigs-payment-card--segment ${slotPaymentType === 'flat_fee' ? 'add-gigs-payment-card--selected' : ''}`}
                                onClick={() => setSlotPaymentType(activeTab, index, 'flat_fee')}
                              >
                                <span className="add-gigs-payment-card-text">Flat Fee</span>
                              </button>
                              <button
                                type="button"
                                className={`add-gigs-payment-card add-gigs-payment-card--segment ${slotPaymentType === 'no_payment' ? 'add-gigs-payment-card--selected' : ''}`}
                                onClick={() => setSlotPaymentType(activeTab, index, 'no_payment')}
                              >
                                <span className="add-gigs-payment-card-text">No Fee</span>
                              </button>
                              <button
                                type="button"
                                className={`add-gigs-payment-card add-gigs-payment-card--segment ${slotPaymentType === 'tickets' ? 'add-gigs-payment-card--selected' : ''}`}
                                onClick={() => setSlotPaymentType(activeTab, index, 'tickets')}
                              >
                                <span className="add-gigs-payment-card-text">Tickets</span>
                              </button>
                            </div>
                            {slotPaymentType === 'tickets' && (
                              <p className="add-gigs-slot-disclaimer">Ticket sales and revenue split to be agreed with the Artist.</p>
                            )}
                          </div>
                          {slotPaymentType === 'flat_fee' && (
                            <div className="add-gigs-field add-gigs-flat-fee-field">
                              <label className="label">Flat Fee Amount</label>
                              <div className="add-gigs-slot-payment-row add-gigs-slot-payment-row--full">
                                <input
                                  type="text"
                                  className="input"
                                  placeholder="£"
                                  value={getSlotBudgetsFor(currentGig, (allSlotsFor(activeTab) || []).length)[index] ?? '£'}
                                  onChange={(e) => setSlotBudget(activeTab, index, e.target.value)}
                                  autoComplete="off"
                                />
                              </div>
                            </div>
                          )}
                          {getEffectiveSlotStatus(index) === 'unbooked' && (
                            <div className="add-gigs-field add-gigs-invite-only add-gigs-invite-only--slot">
                              <div className="add-gigs-invite-only-row">
                                <span className="add-gigs-invite-only-label">
                                  Hide gig slot from venue profile
                                </span>
                                <label className="gigs-toggle-switch">
                                  <input
                                    type="checkbox"
                                    id={`add-gigs-invite-only-${activeTab}-${index}`}
                                    checked={getSlotInviteOnly(currentGig, slotCount)[index] ?? false}
                                    onChange={(e) => setSlotInviteOnly(activeTab, index, e.target.checked)}
                                  />
                                  <span className="gigs-toggle-slider" />
                                </label>
                              </div>
                              <p className="add-gigs-invite-only-text">
                                {getSlotInviteOnly(currentGig, slotCount)[index]
                                  ? 'This gig will not show on your venue profile, and only those with the private gig link will be able to apply'
                                  : 'With the toggle left off, the gig will be discoverable to artists to apply'}
                              </p>
                            </div>
                          )}
                          {!addGigsMode && (
                          <div className="add-gigs-field add-gigs-slot-booking" ref={(el) => { slotBookingRefs.current[index] = el; }}>
                            <label className="label">Booking</label>
                            <div
                              className={`add-gigs-booking-options ${invalidFieldHighlightTab === activeTab && typeof invalidFieldHighlight === 'object' && invalidFieldHighlight?.booking === index ? 'add-gigs-booking-options--invalid' : ''}`}
                            >
                              <button
                                type="button"
                                className={`btn ${getSlotBookingStatuses(currentGig, (allSlotsFor(activeTab) || []).length)[index] === 'confirmed' ? 'primary' : 'tertiary'}`}
                                onClick={() => setSlotBookingStatus(activeTab, index, 'confirmed')}
                              >
                                Artist Confirmed
                              </button>
                              <button
                                type="button"
                                className={`btn ${getSlotBookingStatuses(currentGig, (allSlotsFor(activeTab) || []).length)[index] === 'unbooked' ? 'primary' : 'tertiary'}`}
                                onClick={() => setSlotBookingStatus(activeTab, index, 'unbooked')}
                              >
                                Not yet booked
                              </button>
                            </div>
                          </div>
                          )}
                          {getEffectiveSlotStatus(index) === 'confirmed' && (
                            <div
                              className={`add-gigs-field add-gigs-artist-name-wrap${addGigsMode === 'addExisting' ? ' add-gigs-artist-name-wrap--existing-event' : ''}`}
                              ref={openArtistDropdownForSlot === index ? artistDropdownRef : undefined}
                            >
                              <label className="label">Artist name</label>
                              <div className="add-gigs-artist-row add-gigs-artist-row--inline">
                                {(() => {
                                  const slotCount = (allSlotsFor(activeTab) || []).length;
                                  const name = (getArtistNamesForSlots(currentGig, slotCount)[index] ?? '').trim();
                                  const fromCrm = getArtistFromCrmForSlots(currentGig, slotCount)[index];
                                  if (fromCrm && name) {
                                    return (
                                      <span className="add-gigs-artist-selected">
                                        <span className="add-gigs-artist-selected-name">{name}</span>
                                        <button
                                          type="button"
                                          className="add-gigs-artist-selected-remove"
                                          onClick={() => clearSlotArtist(activeTab, index)}
                                          aria-label="Remove artist"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    );
                                  }
                                  return (
                                    <>
                                      <input
                                        ref={(el) => { artistNameInputRefs.current[index] = el; }}
                                        type="text"
                                        className="input"
                                        placeholder="Artist name"
                                        value={getArtistNamesForSlots(currentGig, slotCount)[index] ?? ''}
                                        onChange={(e) => setSlotArtistName(activeTab, index, e.target.value)}
                                        onFocus={() => setOpenArtistDropdownForSlot(index)}
                                        aria-invalid={getEffectiveSlotStatus(index) === 'confirmed' && !name}
                                        aria-expanded={openArtistDropdownForSlot === index}
                                        aria-haspopup="listbox"
                                      />
                                      {name && !fromCrm && (
                                        <button
                                          type="button"
                                          className="btn secondary"
                                          onClick={() => handleAddToContactBook(activeTab, index)}
                                          disabled={addingToCrm}
                                        >
                                          Add to Contact Book
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              {(() => {
                                const slotCount = (allSlotsFor(activeTab) || []).length;
                                const fromCrm = getArtistFromCrmForSlots(currentGig, slotCount)[index];
                                const q = (getArtistNamesForSlots(currentGig, slotCount)[index] ?? '').trim().toLowerCase();
                                const filtered = q
                                  ? myArtists.filter((e) => (e.name || '').toLowerCase().includes(q))
                                  : myArtists;
                                const showDropdown =
                                  openArtistDropdownForSlot === index &&
                                  !fromCrm &&
                                  (filtered.length > 0 || (q === '' && myArtists.length === 0));
                                if (!showDropdown) return null;
                                return (
                                  <ul
                                    className="add-gigs-artist-dropdown"
                                    role="listbox"
                                  >
                                    {filtered.length === 0 ? (
                                      <li className="add-gigs-artist-dropdown-item add-gigs-artist-dropdown-item--muted">
                                        No artists in My Artists
                                      </li>
                                    ) : (
                                      filtered.map((entry) => (
                                        <li
                                          key={entry.id}
                                          role="option"
                                          className="add-gigs-artist-dropdown-item"
                                          onClick={() => {
                                            setSlotArtistName(activeTab, index, entry.name || '');
                                            setSlotArtistFromCrm(activeTab, index, true);
                                            setOpenArtistDropdownForSlot(null);
                                          }}
                                        >
                                          {entry.name || '—'}
                                        </li>
                                      ))
                                    )}
                                  </ul>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                    })()}
                  </div>
                  <div className="add-gigs-add-slot-box">
                    <button
                      type="button"
                      className="btn tertiary add-gigs-add-slot-btn"
                      onClick={() => activeTab && setArtistSlotCount(activeTab, Number(currentArtistSlotCount || 1) + 1)}
                    >
                      + Add Another Set
                    </button>
                  </div>
                  </div>
                  )}
                  </>
                  )}

                  {currentBookingMode === 'rental' && addGigsMode !== 'addExisting' && (
                    <div className="add-gigs-rental-panel">
                      <div className="add-gigs-field add-gigs-booker-times-row add-gigs-rental-top-row">
                        {!isEditManuallyConfirmed && displayRentalStatus === 'confirmed_renter' && (
                          <div className="add-gigs-booker-times-col add-gigs-booker-col">
                            <label className="label add-gigs-section-heading">Name of Booker</label>
                            <input
                              type="text"
                              className="input"
                              value={currentGig?.renterName ?? ''}
                              onChange={(e) => updateGig(activeTab, { renterName: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="add-gigs-booker-times-col add-gigs-times-col add-gigs-rental-times-field">
                          <div className="add-gigs-rental-times-wrap">
                            <div className="add-gigs-rental-time-block">
                              <label className="label add-gigs-section-heading">Access from</label>
                              <input
                                type="time"
                                className="input add-gigs-rental-time-input"
                                value={currentGig?.rentalStartTime ?? ''}
                                onChange={(e) => updateGig(activeTab, { rentalStartTime: e.target.value })}
                              />
                            </div>
                            <div className="add-gigs-rental-times-connector" aria-hidden="true" />
                            <div className="add-gigs-rental-time-block">
                              <label className="label add-gigs-section-heading">Music stop by</label>
                              <input
                                type="time"
                                className="input add-gigs-rental-time-input"
                                value={currentGig?.rentalEndTime ?? ''}
                                onChange={(e) => updateGig(activeTab, { rentalEndTime: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                        {isEditManuallyConfirmed && currentBookingMode === 'rental' && (
                          <div className="add-gigs-booker-times-col add-gigs-hire-fee-col">
                            <label className="label add-gigs-section-heading">Hire fee</label>
                            <div className="add-gigs-rental-price-row">
                              <div className="add-gigs-slot-payment-row add-gigs-rental-price-input">
                                <input
                                  type="text"
                                  className="input"
                                  placeholder="£"
                                  value={currentGig?.rentalFee ?? '£'}
                                  onChange={(e) => updateGig(activeTab, { rentalFee: formatPoundsInput(e.target.value) })}
                                  autoComplete="off"
                                />
                              </div>
                              <button
                                type="button"
                                className="btn tertiary add-gigs-free-price-btn"
                                onClick={() => updateGig(activeTab, { rentalFee: formatPoundsInput('0') })}
                              >
                                Free
                              </button>
                            </div>
                          </div>
                        )}
                        {!isEditManuallyConfirmed && currentBookingMode === 'rental' && (
                          <div className="add-gigs-rental-fee-deposit-row">
                            <div className="add-gigs-booker-times-col add-gigs-hire-fee-col">
                              <label className="label add-gigs-section-heading">Hire fee</label>
                              <div className="add-gigs-rental-price-row">
                                <div className="add-gigs-slot-payment-row add-gigs-rental-price-input">
                                  <input
                                    type="text"
                                    className="input"
                                    placeholder="£"
                                    value={currentGig?.rentalFee ?? '£'}
                                    onChange={(e) => updateGig(activeTab, { rentalFee: formatPoundsInput(e.target.value) })}
                                    autoComplete="off"
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn tertiary add-gigs-free-price-btn"
                                  onClick={() => updateGig(activeTab, { rentalFee: formatPoundsInput('0') })}
                                >
                                  Free
                                </button>
                              </div>
                            </div>
                            <div className="add-gigs-booker-times-col add-gigs-deposit-col">
                              <label className="label add-gigs-section-heading">Deposit required</label>
                              <div className="add-gigs-deposit-controls">
                                <div className="add-gigs-deposit-options">
                                  <button
                                    type="button"
                                    className={`btn tertiary add-gigs-deposit-option-btn ${(currentGig?.rentalDepositRequired ?? false) === true ? 'add-gigs-deposit-option-btn--selected' : ''}`}
                                    onClick={() => updateGig(activeTab, { rentalDepositRequired: true })}
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn tertiary add-gigs-deposit-option-btn ${(currentGig?.rentalDepositRequired ?? false) === false ? 'add-gigs-deposit-option-btn--selected' : ''}`}
                                    onClick={() => updateGig(activeTab, { rentalDepositRequired: false })}
                                  >
                                    No
                                  </button>
                                </div>
                                {currentGig?.rentalDepositRequired && (
                                  <div className={`add-gigs-deposit-amount-wrap ${invalidFieldHighlightTab === activeTab && invalidFieldHighlight === 'rentalDepositAmount' ? 'add-gigs-field--invalid' : ''}`}>
                                    <input
                                      type="text"
                                      className="input add-gigs-deposit-amount-input"
                                      placeholder="£"
                                      value={currentGig?.rentalDepositAmount ?? '£'}
                                      onChange={(e) => updateGig(activeTab, { rentalDepositAmount: formatPoundsInput(e.target.value) })}
                                      autoComplete="off"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {!isEditManuallyConfirmed && addGigsMode !== 'addExisting' && currentBookingMode === 'artist' && (
                          <div className="add-gigs-booker-times-col add-gigs-hire-fee-col">
                            <label className="label add-gigs-section-heading">Price</label>
                            <div className="add-gigs-rental-price-row">
                              <div className="add-gigs-slot-payment-row add-gigs-rental-price-input">
                                <input
                                  type="text"
                                  className="input"
                                  placeholder="£"
                                  value={currentGig?.rentalFee ?? '£'}
                                  onChange={(e) => updateGig(activeTab, { rentalFee: formatPoundsInput(e.target.value) })}
                                  autoComplete="off"
                                />
                              </div>
                              <button
                                type="button"
                                className="btn tertiary add-gigs-free-price-btn"
                                onClick={() => updateGig(activeTab, { rentalFee: formatPoundsInput('0') })}
                              >
                                Free
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {currentBookingMode && addGigsMode !== 'addExisting' && (
                    <div className="add-gigs-more-details">
                      <div className="add-gigs-more-details-divider" />
                      <button
                        type="button"
                        className="add-gigs-more-details-header"
                        onClick={() => setShowMoreDetails((v) => !v)}
                        aria-expanded={showMoreDetails}
                      >
                        <span className="add-gigs-more-details-label">More details (optional)</span>
                        {showMoreDetails ? <UpChevronIcon /> : <DownChevronIcon />}
                      </button>
                      <div className="add-gigs-more-details-divider add-gigs-more-details-divider--below" />
                      {showMoreDetails && activeTab && (
                        <div className="add-gigs-extra-timings">
                          {addGigsMode !== 'addExisting' && (
                            <div className="add-gigs-field add-gigs-field--full">
                              <label className="label add-gigs-more-details-field-label">Gig listing title</label>
                              <input
                                type="text"
                                className="input add-gigs-input-no-border"
                                placeholder="e.g. Friday Night Live"
                                value={(currentGig?.gigName ?? '').trim() || (selectedVenue ? (currentBookingMode === 'rental' ? `${selectedVenue.name} For Hire` : `Gig at ${selectedVenue.name}`) : 'Gig')}
                                onChange={(e) => updateGig(activeTab, { gigName: e.target.value })}
                              />
                            </div>
                          )}
                          <div className="add-gigs-event-type-ticketing-row">
                            <div className="add-gigs-event-type-ticketing-col">
                              <div className="add-gigs-rental-more-group">
                                <div className="add-gigs-field">
                                  <label className="label add-gigs-more-details-field-label" htmlFor={`add-gigs-event-type-${activeTab}`}>Event type</label>
                                  <select
                                    id={`add-gigs-event-type-${activeTab}`}
                                    className="select add-gigs-filter-select add-gigs-select-no-border"
                                    value={currentGig?.kind ?? 'Live Music'}
                                    onChange={(e) => updateGig(activeTab, { kind: e.target.value })}
                                  >
                                    {GIG_KIND_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                          {currentBookingMode === 'artist' && (
                            <>
                              <div className="add-gigs-field">
                                <label className="label add-gigs-more-details-field-label" htmlFor={`add-gigs-musician-type-${activeTab}`}>Type of Artist</label>
                                <select
                                  id={`add-gigs-musician-type-${activeTab}`}
                                  className="select add-gigs-filter-select add-gigs-select-no-border"
                                  value={currentGig?.gigType ?? 'Musician/Band'}
                                  onChange={(e) => updateGig(activeTab, { gigType: e.target.value })}
                                >
                                  {MUSICIAN_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="add-gigs-load-soundcheck-row add-gigs-field--full">
                                <div className="add-gigs-field">
                                  <label className="label add-gigs-more-details-field-label" htmlFor={`add-gigs-load-in-${activeTab}`}>Load in time</label>
                                  <input
                                    id={`add-gigs-load-in-${activeTab}`}
                                    type="time"
                                    className="input"
                                    value={currentGig?.loadInTime ?? ''}
                                    onChange={(e) => updateGig(activeTab, { loadInTime: e.target.value })}
                                  />
                                </div>
                                <div className="add-gigs-field">
                                  <label className="label add-gigs-more-details-field-label" htmlFor={`add-gigs-sound-check-${activeTab}`}>Sound check time</label>
                                  <input
                                    id={`add-gigs-sound-check-${activeTab}`}
                                    type="time"
                                    className="input"
                                    value={currentGig?.soundCheckTime ?? ''}
                                    onChange={(e) => updateGig(activeTab, { soundCheckTime: e.target.value })}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                          {addGigsMode !== 'addExisting' && (
                            <div className="add-gigs-field add-gigs-field--full">
                              <label className="label add-gigs-more-details-field-label">Description</label>
                              <textarea
                              className="input add-gigs-input-no-border"
                              placeholder="Describe the kind of event you’re looking for, the vibe, and any key requirements or arrangements…"
                              value={currentGig?.extraInformation ?? ''}
                              onChange={(e) => updateGig(activeTab, { extraInformation: e.target.value })}
                              maxLength={250}
                              rows={3}
                              />
                            </div>
                          )}

                          {(currentBookingMode === 'rental' || currentBookingMode === 'artist') && (
                            <div className="add-gigs-rental-details-wrap">
                              <div className="add-gigs-rental-more-group add-gigs-age-capacity-row">
                                <div className="add-gigs-age-capacity-col">
                                  <div className="add-gigs-field">
                                    <label className="label add-gigs-more-details-field-label" htmlFor={`add-gigs-capacity-${activeTab}`}>Capacity</label>
                                    <input
                                      id={`add-gigs-capacity-${activeTab}`}
                                      type="text"
                                      className="input add-gigs-input-no-border"
                                      placeholder="e.g. 200"
                                      value={
                                        (currentGig?.rentalCapacity != null && String(currentGig.rentalCapacity).trim() !== '')
                                          ? currentGig.rentalCapacity
                                          : (selectedVenue?.capacity ?? '')
                                      }
                                      onChange={(e) => updateGig(activeTab, { rentalCapacity: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  </>
                  )}
                </div>
              )}
            </div>
          )}
          </div>

          <div
            className={`add-gigs-actions add-gigs-actions--footer ${modalHasScroll ? 'add-gigs-actions--footer--shadow' : ''}`}
          >
            {step === 'details' ? (
              <>
                {addGigsMode === 'bookNew' ? (
                  <>
                    <button
                      type="button"
                      className="btn tertiary"
                      onClick={() => setStep('dates')}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={handleSubmitClick}
                      disabled={submitting}
                    >
                      {submitting ? submitButtonBusyLabel : submitButtonLabel}
                    </button>
                  </>
                ) : (
                  <>
                    {!initialDateIso && (
                      <button type="button" className="btn tertiary" onClick={() => setStep('dates')}>
                        Back
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn primary"
                      onClick={handleSubmitClick}
                      disabled={submitting}
                    >
                      {submitting ? submitButtonBusyLabel : submitButtonLabel}
                    </button>
                  </>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn primary"
                onClick={goNext}
                disabled={selectedDates.length === 0}
              >
                Next
              </button>
            )}
          </div>
        </div>
        {previewOpen && (
          <BookNewEventListingPreview
            gig={gigsByDate[activeTab] || defaultGigForDate()}
            venue={selectedVenue}
            dateIso={activeTab}
            onClose={() => setShowBookNewListingPreview(false)}
          />
        )}
        </div>
      </div>

      {showSaveBookNewTemplateModal && addGigsMode === 'bookNew' && (
        <div
          className="add-gigs-submodal-overlay"
          onClick={() => !savingBookNewTemplate && setShowSaveBookNewTemplateModal(false)}
          role="presentation"
        >
          <div
            className="add-gigs-submodal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="add-gigs-save-template-title"
          >
            <h3 id="add-gigs-save-template-title" className="add-gigs-submodal-title">
              Save as template
            </h3>
            <div className="add-gigs-field">
              <label className="label" htmlFor="add-gigs-book-new-template-name">
                Template name
              </label>
              <input
                id="add-gigs-book-new-template-name"
                type="text"
                className="input"
                value={templateSaveNameInput}
                onChange={(e) => setTemplateSaveNameInput(e.target.value)}
                placeholder="e.g. Friday jazz night"
                disabled={savingBookNewTemplate}
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <div className="add-gigs-submodal-actions">
              <button
                type="button"
                className="btn tertiary"
                disabled={savingBookNewTemplate}
                onClick={() => setShowSaveBookNewTemplateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={savingBookNewTemplate || !templateSaveNameInput.trim()}
                onClick={handleSaveBookNewTemplate}
              >
                {savingBookNewTemplate ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUseBookNewTemplateModal && (addGigsMode === 'bookNew' || addGigsMode === 'addExisting') && (
        <div
          className="add-gigs-submodal-overlay"
          onClick={() => setShowUseBookNewTemplateModal(false)}
          role="presentation"
        >
          <div
            className="add-gigs-submodal add-gigs-submodal--wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="add-gigs-use-template-title"
          >
            <div className="add-gigs-submodal-header">
              <h3 id="add-gigs-use-template-title" className="add-gigs-submodal-title">
                Use a Template
              </h3>
              <button
                type="button"
                className="btn tertiary add-gigs-submodal-close"
                onClick={() => setShowUseBookNewTemplateModal(false)}
              >
                Close <span aria-hidden="true">×</span>
              </button>
            </div>
            <ul className="add-gigs-book-new-template-pill-list">
              {bookNewTemplatesForVenue.map((t) => {
                const tid = templateDocId(t);
                const displayName = t.templateName || 'Untitled';
                return (
                  <li key={tid} className="add-gigs-book-new-template-pill-item">
                    <button
                      type="button"
                      className="add-gigs-book-new-template-pill"
                      onClick={() => handleUseBookNewTemplateClick(t)}
                      aria-label={`Use a Template: ${displayName}`}
                      title={`Use “${displayName}”`}
                    >
                      <span className="add-gigs-book-new-template-pill-label">{displayName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {showApplyBookNewTemplateScopeModal && pendingApplyBookNewTemplate && (
        <div
          className="add-gigs-submodal-overlay"
          onClick={() => {
            setShowApplyBookNewTemplateScopeModal(false);
            setPendingApplyBookNewTemplate(null);
          }}
          role="presentation"
        >
          <div
            className="add-gigs-submodal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="add-gigs-apply-template-scope-title"
          >
            <h3 id="add-gigs-apply-template-scope-title" className="add-gigs-submodal-title">
              Apply template
            </h3>
            <p className="add-gigs-submodal-hint">
              Apply &ldquo;{pendingApplyBookNewTemplate.templateName || 'Untitled'}&rdquo; to which dates?
            </p>
            <div className="add-gigs-submodal-actions add-gigs-submodal-actions--stack">
              <button
                type="button"
                className="btn primary"
                onClick={() => handleConfirmApplyBookNewTemplateScope(false)}
              >
                This date only ({activeTab ? formatTabDate(activeTab) : ''})
              </button>
              <button
                type="button"
                className="btn tertiary"
                onClick={() => handleConfirmApplyBookNewTemplateScope(true)}
              >
                All dates ({sortedDates.length})
              </button>
              <button
                type="button"
                className="btn tertiary"
                onClick={() => {
                  setShowApplyBookNewTemplateScopeModal(false);
                  setPendingApplyBookNewTemplate(null);
                  setShowUseBookNewTemplateModal(true);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Portal>
  );
}
