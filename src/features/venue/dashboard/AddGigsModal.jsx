import React, { useMemo, useState, useRef, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import Portal from '../../shared/components/Portal';
import { CalendarIconSolid, CoinsIcon, CoinsIconSolid, TicketIcon, TicketIconLight, NoPaymentIcon, DeleteGigIcon, MoreInformationIcon, ClockIcon } from '../../shared/ui/extras/Icons';
import { createArtistCRMEntry, getArtistCRMEntries } from '@services/client-side/artistCRM';
import { createVenueHireOpportunitiesBatch, updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { postMultipleGigs, updateGigDocument } from '@services/api/gigs';
import { hasVenuePerm } from '@services/utils/permissions';
import { uploadFileWithFallback } from '@services/storage';
import { CopyIcon, TickIcon, DownChevronIcon, UpChevronIcon } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import '@styles/shared/modals.styles.css';

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

const GIG_KIND_OPTIONS = ['Live Music', 'Background Music', 'Wedding', 'Open Mic', 'House Party'];

const MUSICIAN_TYPE_OPTIONS = ['Musician/Band', 'DJ'];

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
});

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

export function AddGigsModal({ onClose, venues = [], user, refreshGigs, initialDateIso, editGigData, addGigsMode }) {
  const isEditMode = !!(
    editGigData &&
    (editGigData.kind === 'Venue Rental' ||
      editGigData.bookingMode === 'rental' ||
      editGigData.bookingMode === 'venue_hire' ||
      editGigData.itemType === 'venue_hire')
  );
  const editDateIso = isEditMode ? getDateIsoFromGig(editGigData) : null;
  const initialIso = editDateIso || initialDateIso;
  /** When editing an already confirmed venue hire (manually confirmed), show only from "Venue access & timings" down. */
  const effectiveRentalStatus =
    editGigData?.rentalStatus ?? (editGigData?.status === 'confirmed' ? 'confirmed_renter' : 'available');
  const isVenueHireEdit =
    isEditMode &&
    (editGigData?.itemType === 'venue_hire' ||
      editGigData?.bookingMode === 'venue_hire' ||
      editGigData?.bookingMode === 'rental');
  const hasRenterName = !!((editGigData?.renterName ?? editGigData?.hirerName ?? '').toString().trim());
  const isEditManuallyConfirmed =
    isVenueHireEdit && (effectiveRentalStatus === 'confirmed_renter' || hasRenterName);

  const [step, setStep] = useState(() => (initialIso ? 'details' : 'dates'));
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
      return { [editDateIso]: apiRentalGigToFormGig(editGigData) };
    }
    return initialIso ? { [initialIso]: defaultGigForDate() } : {};
  });
  const [activeTab, setActiveTab] = useState(initialIso || null);
  const [venueId, setVenueId] = useState(() => (isEditMode && editGigData?.venueId) ? editGigData.venueId : (venues[0]?.venueId || ''));
  const [addingToCrm, setAddingToCrm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [focusInvalidField, setFocusInvalidField] = useState(null);
  const [invalidFieldHighlight, setInvalidFieldHighlight] = useState(null);
  const [invalidFieldHighlightTab, setInvalidFieldHighlightTab] = useState(null);
  const [showMoreDetails, setShowMoreDetails] = useState(() => isEditMode);
  const [myArtists, setMyArtists] = useState([]);
  const [openArtistDropdownForSlot, setOpenArtistDropdownForSlot] = useState(null);
  const [expandedSlotsByDate, setExpandedSlotsByDate] = useState({});
  const [artistSlotCountByDate, setArtistSlotCountByDate] = useState({});
  const [modalHasScroll, setModalHasScroll] = useState(false);
  const [hasCopiedRentalLink, setHasCopiedRentalLink] = useState(false);
  const artistDropdownRef = useRef(null);

  const modalBodyRef = useRef(null);
  const startTimeInputRef = useRef(null);
  const durationSelectRef = useRef(null);
  const slotBookingRefs = useRef([]);
  const slotPaymentRefs = useRef([]);
  const artistNameInputRefs = useRef([]);

  const sortedDates = useMemo(() => [...selectedDates].sort(), [selectedDates]);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.venueId === venueId),
    [venues, venueId]
  );
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
    const byDate = {};
    selectedDates.forEach((iso) => {
      byDate[iso] = gigsByDate[iso] || defaultGigForDate();
    });
    setGigsByDate(byDate);
    const firstIso = [...selectedDates].sort()[0];
    setActiveTab(firstIso || null);
    setStep('details');
  };

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
    if (initialDateIso && venues.length > 0 && !venueId) {
      toast.error('Please select a venue.');
      return;
    }
    if (!venueId || !hasVenuePerm(venues, venueId, 'gigs.create')) {
      toast.error("You don't have permission to create gigs for this venue.");
      return;
    }
    if (!canSubmit) {
      const firstInvalidIso = sortedDates.find(
        (iso) => !isGigValidWithMode(gigsByDate[iso] || defaultGigForDate())
      );
      if (firstInvalidIso) {
        const gig = gigsByDate[firstInvalidIso] || defaultGigForDate();
        const missing = getFirstMissingFieldWithMode(gig);
        setActiveTab(firstInvalidIso);
        setFocusInvalidField(missing);
        setInvalidFieldHighlight(missing);
        setInvalidFieldHighlightTab(firstInvalidIso);
        const isSlotOrderInvalid = missing && typeof missing === 'object' && missing.slotStartOrder !== undefined;
        if (isSlotOrderInvalid) {
          const n = missing.slotStartOrder;
          toast.error(
            `Artist slot ${n + 1} must start at or after slot ${n} ends. Adjust the start times so sets don't overlap.`
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

  const handleAddGigs = async () => {
    const getBudgetValue = (b) => {
      const n = parseInt(String(b ?? '').replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) ? n : 0;
    };
    const formatPounds = (n) => (n === 0 ? '£' : `£${Number(n).toLocaleString('en-GB')}`);

    if (isEditMode && editGigData?.gigId && sortedDates.length === 1) {
      const dateIso = sortedDates[0];
      const gig = gigsByDate[dateIso] || defaultGigForDate();
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
            genre: '',
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
          toast.success(`Added ${gigDocuments.length} gig${gigDocuments.length === 1 ? '' : 's'}.`);
          refreshGigs?.();
          onClose();
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
    sortedDates.every((iso) => isGigValidWithMode(gigsByDate[iso] || defaultGigForDate()));

  const isMultipleGigs = sortedDates.length > 1;

  const submitButtonLabel = useMemo(() => {
    if (!activeTab) return isMultipleGigs ? 'Add/Book Gigs' : 'Add/Book a Gig';
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
    if (!activeTab) return 'Adding…';
    if (currentBookingMode === 'rental') return isEditMode ? 'Updating…' : (addGigsMode === 'addExisting' ? 'Adding…' : 'Listing…');
    const gig = gigsByDate[activeTab] || defaultGigForDate();
    const slotCount = 1 + (gig.extraSlots?.length || 0);
    const statuses = getSlotBookingStatuses(gig, slotCount);
    const anyConfirmed = statuses.some((s) => s === 'confirmed');
    return anyConfirmed ? 'Adding…' : 'Booking…';
  }, [activeTab, gigsByDate, isMultipleGigs, currentBookingMode, isEditMode, addGigsMode]);

  return (
    <Portal>
      <div className="modal add-gigs-modal" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="add-gigs-title">
        <div className="modal-content add-gigs-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="add-gigs-modal-header">
            <div className="add-gigs-modal-title-wrap">
              <h2 id="add-gigs-title" className="add-gigs-modal-title">{isEditMode ? 'Edit Event' : 'Create event'}</h2>
            </div>
            <button type="button" className="btn close tertiary" onClick={onClose}>
              Close
            </button>
          </div>
          <div className={`add-gigs-modal-body ${isEditManuallyConfirmed ? 'add-gigs-modal-body--edit-confirmed' : ''}`.trim()} ref={modalBodyRef}>
          {step === 'dates' && (
            <>
              {venues.length > 1 && (
                <div className="add-gigs-field">
                  <label>Venue</label>
                  <select className="select add-gigs-filter-select add-gigs-venue-select" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
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
              {!isEditManuallyConfirmed && (
              <div className="add-gigs-sticky-date-bar">
                <div className="add-gigs-sticky-date-bar-inner">
                  {sortedDates.length === 1 ? (
                    <div className="add-gigs-date-venue-row">
                      <div className="add-gigs-field add-gigs-date-field">
                        <label>Date</label>
                        <div className="add-gigs-date-row">
                          <span className="add-gigs-date-value">{formatDisplayDate(activeTab)}</span>
                          <button
                            type="button"
                            className="btn icon tertiary add-gigs-date-picker-btn"
                            onClick={() => setStep('dates')}
                            aria-label="Pick a different date"
                          >
                            <CalendarIconSolid />
                          </button>
                        </div>
                      </div>
                      {initialDateIso && venues.length > 0 && (
                        <div className="add-gigs-field add-gigs-venue-field">
                          <label htmlFor="add-gigs-venue-select-details">Venue</label>
                          <select
                            id="add-gigs-venue-select-details"
                            className="select add-gigs-filter-select add-gigs-venue-select"
                            value={venueId}
                            onChange={(e) => setVenueId(e.target.value)}
                            required
                            aria-required="true"
                          >
                            {venues.map((v) => (
                              <option key={v.venueId} value={v.venueId}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="add-gigs-tabs">
                      {sortedDates.map((iso) => {
                        const gigValid = isGigValid(gigsByDate[iso] || defaultGigForDate());
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
                  )}
                </div>
                {sortedDates.length >= 2 && currentBookingMode && (
                  <div className="add-gigs-apply-all-wrap">
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

              {activeTab && currentGig && (
                <div className="add-gigs-panel">
                  {!isEditManuallyConfirmed && (
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

                  {currentBookingMode === 'artist' && (
                    <>
                  <div className="add-gigs-field add-gigs-artist-count">
                    <label className="label add-gigs-section-heading">Number of artist slots</label>
                    <div className="add-gigs-artist-count-pills" role="tablist" aria-label="Number of artist slots">
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
                            <h4 className="add-gigs-slot-title">{`Artist Slot ${index + 1}`}</h4>
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
                      + Add Another Artist Slot
                    </button>
                  </div>
                  </div>
                  )}
                  </>
                  )}

                  {currentBookingMode === 'rental' && (
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
                        {!isEditManuallyConfirmed && addGigsMode === 'addExisting' && currentBookingMode === 'rental' && (
                          <div className="add-gigs-field add-gigs-rental-fee-deposit-row add-gigs-rental-second-row">
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
                        {!isEditManuallyConfirmed && addGigsMode !== 'addExisting' && currentBookingMode === 'rental' && (
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
                  {currentBookingMode && (
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
                              <label className="label add-gigs-more-details-field-label">Event name</label>
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
                                <label className="label add-gigs-more-details-field-label" htmlFor={`add-gigs-musician-type-${activeTab}`}>Type of musician</label>
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
                </div>
              )}
            </div>
          )}
          </div>

          <div className={`add-gigs-actions add-gigs-actions--footer ${modalHasScroll ? 'add-gigs-actions--footer--shadow' : ''}`}>
            {step === 'details' ? (
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
      </div>
    </Portal>
  );
}
