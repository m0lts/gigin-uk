import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Portal from '@features/shared/components/Portal';
import { useAuth } from '@hooks/useAuth';
import { createArtistCRMEntry, getArtistCRMEntries } from '@services/client-side/artistCRM';
import { getArtistProfileById } from '@services/client-side/artists';
import { getGigPrivateBundle, updateGigDocument } from '@services/api/gigs';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { getOrCreateConversation } from '@services/api/conversations';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { getMostRecentMessage, sendGigInvitationMessage } from '@services/client-side/messages';
import { sendGigDeclinedEmail, sendGigInviteEmail } from '@services/client-side/emails';
import { updateDeclinedApplicationMessage } from '@services/api/messages';
import { hasVenuePerm } from '@services/utils/permissions';
import { getLocalGigDateTime } from '@services/utils/filtering';
import { formatDate } from '@services/utils/dates';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { FEATURES } from '../../../../../config/features';
import { LoadingSpinner } from '@features/shared/ui/loading/Loading';
import { AddPerformersButton, AddPerformersModal } from '@features/venue/components/AddPerformersButtonAndModal';
import { AddToContactsModal } from '@features/venue/components/AddToContactsModal';
import { ContactDetailsModal } from '@features/venue/components/ContactDetailsModal';
import { ApplicantTechSetupModal } from '@features/venue/components/ApplicantTechSetupModal';
import { InviteArtistPromoterTile } from '@features/venue/components/InviteArtistPromoterTile';
import { SendGigDetailsTile } from '@features/venue/components/SendGigDetailsTile';
import { VenueHireTechSetupMainCard } from '@features/venue/gigs/components/VenueHireTechSetupMainCard';
import { GigApplications } from '@features/venue/dashboard/GigApplications';
import { buildGuestTechRider, computeCompatibility } from '@services/utils/techRiderCompatibility';
import { GigMediaPanel } from '@features/venue/gigs/components/GigMediaPanel';
import {
  isArtistBookingNightFullyBooked,
} from '@features/venue/gigs/utils/multiSlotGigGroup';
import { buildVenueHireGigSummaryProgrammeTimeLabel, formatVenueHireTimeDisplay } from '@features/venue/gigs/utils/venueHireGigDetailsTimings';
import {
  CloseIcon,
  DocumentsIcon,
  DownChevronIcon,
  DownloadIcon,
  EyeIcon,
  InviteIconSolid,
  MessageIcon,
  MicrophoneIcon,
  NewTabIcon,
  PencilIcon,
  PlusIcon,
  TechRiderIcon,
  SettingsIcon,
  TickIcon,
  UpChevronIcon,
} from '@features/shared/ui/extras/Icons';
import '@styles/host/invite-and-share-modal.styles.css';
import '@styles/host/venue-gig-page.styles.css';

function normalizeCloseBookingAfterAcceptedCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, Math.floor(n));
}

function clockToMinutes(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const [hours, minutes] = text.split(':').map(Number);
  if (!Number.isFinite(hours)) return null;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function formatClock(value) {
  if (clockToMinutes(value) == null) return '';
  const formatted = formatVenueHireTimeDisplay(value);
  return formatted === '—' ? '' : formatted;
}

function setEndMinutes(startTime, duration) {
  const start = clockToMinutes(startTime);
  const length = Number(duration);
  if (start == null || !(length > 0)) return null;
  return (start + length) % (24 * 60);
}

function slotFeeText(slot) {
  if (!slot || slot.kind === 'Ticketed Gig' || slot.kind === 'Open Mic') return null;
  const raw = slot.budget
    || (slot.budgetValue != null && slot.budgetValue !== '' ? `£${slot.budgetValue}` : '')
    || slot.hireFee
    || '';
  const budget = String(raw).trim();
  if (!budget) return null;
  if (budget === '£0' || budget === '£') return 'No fee';
  const numeric = budget.replace(/[^0-9.]/g, '');
  if (numeric && parseFloat(numeric) > 0) {
    const amount = parseFloat(numeric);
    return Number.isInteger(amount) ? `£${amount}` : `£${numeric}`;
  }
  return budget;
}

function freshSlotDoc(slot, gigs) {
  const id = slot?.gigId || slot?.id;
  const fresh = id && Array.isArray(gigs) ? gigs.find((gig) => gig.gigId === id) : null;
  return fresh ? { ...slot, ...fresh, gigId: id } : slot;
}

function setStatusKey(slot) {
  const applicants = Array.isArray(slot?.applicants) ? slot.applicants : [];
  if (applicants.some((applicant) => applicant?.status === 'confirmed' || applicant?.status === 'paid')) return 'booked';
  if (applicants.some((applicant) => applicant?.status === 'accepted' || applicant?.status === 'payment processing')) return 'awaiting';
  return 'open';
}

function readStoredTime(rawGig, eventKey, ...fallbacks) {
  const timings = rawGig?.eventTimings;
  const fromEvent = timings && typeof timings === 'object' && !Array.isArray(timings) ? timings[eventKey] : null;
  for (const value of [fromEvent, ...fallbacks]) {
    const formatted = formatClock(value);
    if (formatted) return formatted;
  }
  return '';
}

const SET_STATUS_LABEL = {
  open: 'Open for applications',
  awaiting: 'Awaiting payment',
  booked: 'Booked',
};

/** Ops rows plus one set per slot, sorted by time. Unset timings are omitted. */
function buildRunningOrder(rawGig, slots, gigs) {
  const items = [];
  const pushOps = (key, label, time) => {
    if (!time) return;
    items.push({ kind: 'ops', key, label, time, minutes: clockToMinutes(time) });
  };

  pushOps('load-in', 'Load-in', readStoredTime(rawGig, 'accessFrom', rawGig?.loadInTime, rawGig?.accessFrom));
  pushOps('sound-check', 'Sound check', readStoredTime(rawGig, 'soundcheck', rawGig?.soundCheckTime));
  pushOps('doors', 'Doors', readStoredTime(rawGig, 'doors', rawGig?.doorsTime, rawGig?.doors));

  const setRows = (Array.isArray(slots) ? slots : []).filter(Boolean).map((slot, index) => {
    const doc = freshSlotDoc(slot, gigs);
    const start = formatClock(doc?.startTime);
    const endMinutes = setEndMinutes(doc?.startTime, doc?.duration);
    const end = endMinutes == null ? '' : formatClock(`${Math.floor(endMinutes / 60)}:${endMinutes % 60}`);
    const status = setStatusKey(doc);
    const applicants = Array.isArray(doc?.applicants) ? doc.applicants : [];
    const newCount = status === 'open'
      ? applicants.filter((applicant) => applicant && !applicant.viewed && applicant.invited !== true).length
      : 0;
    return {
      kind: 'set',
      key: doc?.gigId || `set-${index + 1}`,
      label: `Set ${index + 1}`,
      time: start || '—',
      minutes: clockToMinutes(doc?.startTime),
      range: start && end ? `${start}\u2013${end}` : (start || '—'),
      endMinutes,
      fee: slotFeeText(doc),
      applications: applicants.length,
      newCount,
      status,
    };
  });

  setRows.forEach((set, index) => {
    const previous = setRows[index - 1];
    if (previous && previous.endMinutes != null && set.minutes != null && set.minutes > previous.endMinutes) {
      items.push({
        kind: 'ops',
        key: `break-${index}`,
        label: 'Break',
        time: formatClock(`${Math.floor(previous.endMinutes / 60)}:${previous.endMinutes % 60}`),
        minutes: previous.endMinutes,
      });
    }
    items.push(set);
  });

  pushOps('curfew', 'Curfew', readStoredTime(rawGig, 'mustVacate', rawGig?.curfew, rawGig?.rentalHardCurfew));

  const timed = items.filter((item) => item.minutes != null);
  const untimed = items.filter((item) => item.minutes == null);
  timed.sort((a, b) => {
    if (a.minutes !== b.minutes) return a.minutes - b.minutes;
    if (a.kind !== b.kind) return a.kind === 'ops' ? -1 : 1;
    return 0;
  });
  return [...timed, ...untimed];
}

function SlotBodyMount({ gigId, onMount }) {
  const ref = useCallback((node) => {
    onMount(gigId, node);
  }, [gigId, onMount]);
  return <div ref={ref} />;
}

function RunningOrder({ rawGig, slots, gigs, onSlotBodyMount }) {
  const items = buildRunningOrder(rawGig, slots, gigs);
  if (!items.length) return null;
  return (
    <ol className="venue-gig-running" aria-label="Running order">
      {items.map((item, index) => {
        const position = `${index === 0 ? ' is-first' : ''}${index === items.length - 1 ? ' is-last' : ''}`;
        return (
          <li
            key={item.key}
            className={`venue-gig-running__item venue-gig-running__item--${item.kind}${position}`}
          >
            <span className="venue-gig-running__time">{item.time}</span>
            <span className="venue-gig-running__track" aria-hidden="true">
              <span className="venue-gig-running__line" />
              <span className={`venue-gig-running__dot venue-gig-running__dot--${item.kind === 'set' ? item.status : 'ops'}`} />
            </span>
            <div className="venue-gig-running__body">
              {item.kind === 'ops' ? (
                <p className="venue-gig-running__ops">{item.label}</p>
              ) : (
                <article className="venue-gig-running__card">
                  <div className="venue-gig-running__card-head">
                    <span className="venue-gig-running__card-title">
                      <span className="venue-gig-running__set-name">{item.label}</span>
                      <span className="venue-gig-running__range">{item.range}</span>
                      {item.fee ? <span className="venue-gig-running__fee">{item.fee}</span> : null}
                    </span>
                    <span className="venue-gig-running__card-meta">
                      <span className="venue-gig-running__apps">
                        {item.applications} application{item.applications === 1 ? '' : 's'}
                      </span>
                      {item.newCount > 0 ? (
                        <span className="venue-gig-running__new">{item.newCount} new</span>
                      ) : null}
                      <span className={`venue-gig-running__pill venue-gig-running__pill--${item.status}`}>
                        <span className="venue-gig-running__pill-dot" />
                        {SET_STATUS_LABEL[item.status]}
                      </span>
                    </span>
                  </div>
                  <SlotBodyMount gigId={item.key} onMount={onSlotBodyMount} />
                </article>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function slotTimeRangeLabel(slotGig) {
  if (!slotGig?.startTime) return '—';
  const start = slotGig.startTime;
  const dur = slotGig.duration;
  if (dur == null || dur === '' || Number(dur) <= 0) return start;
  const [hours, minutes] = start.split(':').map(Number);
  const totalMins = (hours || 0) * 60 + (minutes || 0) + Number(dur);
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  const end = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  return `${start} – ${end}`;
}

/**
 * Unified gig details panel for both venue-hire and artist-booking gigs.
 *
 * Venue hire: hirer booked tile (same chrome as artist-booking booked tiles) when there is a
 * booker, then Performers + Applications + Tech setup. hireState: 'available' | 'pending' | 'confirmed'.
 *
 * Artist booking (open): reuses the same card chrome — an Invite/Fill-this-slot tile, a
 * Performers card (manual + confirmed performers), and the legacy GigApplications
 * rendered inside the card layout. The tech setup card is hidden in this pass; we'll
 * bring it back once we decide what it should look like for artist bookings.
 *
 * Performers: only show "On Gigin" when performer is actually linked to a Gigin profile.
 */
export function GigDetailsPanel({
  normalisedGig,
  rawGig,
  setGigInfo,
  gigs,
  venues,
  venueProfile,
  refreshGigs,
  setShowAddGigsModal,
  setAddGigsEditData,
  setAddGigsMode,
  refreshStripe,
  customerDetails,
  copyToClipboard,
  showInvitesModal,
  setShowInvitesModal,
  addPerformersTrigger,
  onAddPerformersOpened,
  onCopyBookingLink,
  bookingLinkUrl,
  applicationsInviteOnly,
  onApplicationsVisibilityChange,
  venueHireSwapApplicationsAndGigDetails = false,
  venueHireApplicationsPortalContainer,
  onVenueHireGigDetailsPortalMount,
  onInviteArtist,
  /** Sum of applicants across all slots (multi-set artist bookings). */
  artistBookingApplicantsTotalCount,
  /** Merged slot docs for multi-set artist bookings (same order as sidebar / normalised gig). */
  artistBookingSlotGigs,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [linkCopied, setLinkCopied] = useState(false);
  const [crmEntries, setCrmEntries] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [hireApplications, setHireApplications] = useState([]);
  const [hireApplicationsLoading, setHireApplicationsLoading] = useState(false);
  const [showEditBookerModal, setShowEditBookerModal] = useState(false);
  const [editBookerName, setEditBookerName] = useState('');
  const [savingBooker, setSavingBooker] = useState(false);
  const [showAddPerformersModal, setShowAddPerformersModal] = useState(false);
  const [addPerformerQuery, setAddPerformerQuery] = useState('');
  const [addPerformerShowCrmList, setAddPerformerShowCrmList] = useState(false);
  const [addPerformerSelectedIds, setAddPerformerSelectedIds] = useState([]);
  const [addPerformerSaving, setAddPerformerSaving] = useState(false);
  /** When set, Add Performers modal is in edit mode for this performer index. */
  const [editingPerformerIndex, setEditingPerformerIndex] = useState(null);
  const [showAddToContactsModal, setShowAddToContactsModal] = useState(false);
  /** Index in performerItems for the performer we're adding to contacts (to link contactId after save). */
  const [addToContactsPerformerIndex, setAddToContactsPerformerIndex] = useState(null);
  const [addToContactsSaving, setAddToContactsSaving] = useState(false);
  /** CRM entry id for the Contact details modal (performers who are in contacts). */
  const [contactModalEntryId, setContactModalEntryId] = useState(null);
  /** For confirmed venue hires: whether the booker applications tile is expanded. */
  const [showApplicationsTile, setShowApplicationsTile] = useState(false);
  /** Venue hire: same invite UI as the former top-of-page tile, opened from Applications empty state. */
  const [showVenueHireInviteModal, setShowVenueHireInviteModal] = useState(false);
  /** Venue hire Applications tile: settings dropdown open state (cog menu). */
  const [showApplicationsSettingsMenu, setShowApplicationsSettingsMenu] = useState(false);
  /** Venue hire: “closing booking after N applications” controls behind the Applications tile cog. */
  const [showApplicationsBookingLimitSettings, setShowApplicationsBookingLimitSettings] = useState(false);
  /** Portal targets for each set card body in the running order. */
  const runningOrderSlotElsRef = useRef({});
  const [runningOrderSlotEpoch, setRunningOrderSlotEpoch] = useState(0);
  const setRunningOrderSlotEl = useCallback((gigId, node) => {
    if (!gigId) return;
    const map = runningOrderSlotElsRef.current;
    if (node) {
      if (map[gigId] === node) return;
      map[gigId] = node;
    } else if (map[gigId]) {
      delete map[gigId];
    } else {
      return;
    }
    setRunningOrderSlotEpoch((epoch) => epoch + 1);
  }, []);
  const runningOrderSlotEls = useMemo(
    () => ({ ...runningOrderSlotElsRef.current }),
    [runningOrderSlotEpoch]
  );
  /** Venue hire: Gigin hirer profile for the booked tile (photo, tech rider). */
  const [venueHireBookerProfile, setVenueHireBookerProfile] = useState(null);

  const sortedArtistBookingSlotGigs = useMemo(() => {
    if (!Array.isArray(artistBookingSlotGigs) || artistBookingSlotGigs.length < 2) return [];
    return [...artistBookingSlotGigs].sort((a, b) => {
      if (!a?.startTime || !b?.startTime) return 0;
      const [aH, aM] = a.startTime.split(':').map(Number);
      const [bH, bM] = b.startTime.split(':').map(Number);
      return (aH * 60 + (aM || 0)) - (bH * 60 + (bM || 0));
    });
  }, [artistBookingSlotGigs]);

  /** Every set in the night has a booked act (multi-set uses sibling docs; anchor status can stay "open"). */
  const isArtistBookingFullyBooked = useMemo(
    () =>
      isArtistBookingNightFullyBooked({
        normalisedGig,
        rawGig,
        artistBookingSlotGigs,
        gigs,
      }),
    [normalisedGig, rawGig, artistBookingSlotGigs, gigs]
  );

  /** Invite from Contacts: which contact we're currently inviting; and which we've already invited. */
  const [invitingContactId, setInvitingContactId] = useState(null);
  const [invitedContactIds, setInvitedContactIds] = useState(new Set());
  /** Invite by Email: input value and sending state. */
  const [emailInviteInput, setEmailInviteInput] = useState('');
  const [emailInviteSending, setEmailInviteSending] = useState(false);
  const [emailInviteError, setEmailInviteError] = useState('');
  /** Applications: tech rider modal (artist profile for selected applicant). */
  const [applicationsTechRiderProfile, setApplicationsTechRiderProfile] = useState(null);
  const [applicationsTechRiderLoading, setApplicationsTechRiderLoading] = useState(false);
  /** Applications: which conversation we're accepting (to show loading). */
  const [acceptingApplicationConvId, setAcceptingApplicationConvId] = useState(null);
  /** Applications: which conversation we're declining (to show loading). */
  const [decliningApplicationConvId, setDecliningApplicationConvId] = useState(null);
  /** Applications: conversation ids we've declined this session (show "Declined" instead of Accept/Decline). */
  const [declinedApplicationConvIds, setDeclinedApplicationConvIds] = useState(() => new Set());
  /** Applications: artist profile (name, picture) per conversation id, from getArtistProfileById. */
  const [applicationProfiles, setApplicationProfiles] = useState({});
  /** Applications: most recent application message body per conversation id (for tile preview). */
  const [applicationMessagePreviews, setApplicationMessagePreviews] = useState({});
  const closeBookingAfterAcceptedCount = React.useMemo(
    () => normalizeCloseBookingAfterAcceptedCount(rawGig?.closeBookingAfterAcceptedCount),
    [rawGig?.closeBookingAfterAcceptedCount]
  );
  const [draftCloseCount, setDraftCloseCount] = useState(closeBookingAfterAcceptedCount);
  const [bookingLimitSaving, setBookingLimitSaving] = useState(false);
  const [bookingLimitEditing, setBookingLimitEditing] = useState(false);
  const applicationsSettingsMenuRef = useRef(null);
  /** Internal notes draft for main-column tile (artist booking); null = use rawGig. */
  const [gigPageInternalNotesDraft, setGigPageInternalNotesDraft] = useState(null);
  const [gigPageInternalNotesSaving, setGigPageInternalNotesSaving] = useState(false);
  /** When true, notes tile shows textarea + Save / Discard (add or edit flow). */
  const [gigPageInternalNotesComposing, setGigPageInternalNotesComposing] = useState(false);
  const [soundEngineerDraft, setSoundEngineerDraft] = useState(null);
  const [soundEngineerSaving, setSoundEngineerSaving] = useState(false);
  const [soundEngineerComposing, setSoundEngineerComposing] = useState(false);
  const [privateBundle, setPrivateBundle] = useState(null);
  const privateSlotKey = [rawGig?.gigId, ...(Array.isArray(rawGig?.gigSlots) ? rawGig.gigSlots : [])].filter(Boolean).join(',');

  useEffect(() => {
    const ids = privateSlotKey ? privateSlotKey.split(',') : [];
    if (!ids.length) {
      setPrivateBundle(null);
      return undefined;
    }
    let cancelled = false;
    getGigPrivateBundle(ids).then((result) => {
      if (cancelled) return;
      const gigs = result?.gigs || {};
      const guests = {};
      Object.values(gigs).forEach((entry) => Object.assign(guests, entry?.guests || {}));
      setPrivateBundle({ ...(gigs[rawGig?.gigId] || {}), guests });
    }).catch((err) => {
      console.error(err);
    });
    return () => { cancelled = true; };
  }, [privateSlotKey, rawGig?.gigId]);
  const [showConfirmManualModal, setShowConfirmManualModal] = useState(false);
  const [confirmManualName, setConfirmManualName] = useState('');
  const [confirmManualAddToContacts, setConfirmManualAddToContacts] = useState(false);
  const [confirmManualPickedCrmId, setConfirmManualPickedCrmId] = useState(null);
  const [confirmManualSaving, setConfirmManualSaving] = useState(false);
  const [confirmManualDropdownOpen, setConfirmManualDropdownOpen] = useState(false);

  useEffect(() => {
    if (!bookingLimitEditing) {
      setDraftCloseCount(closeBookingAfterAcceptedCount);
    }
  }, [closeBookingAfterAcceptedCount, bookingLimitEditing]);

  useEffect(() => {
    if (addPerformersTrigger) {
      setShowAddPerformersModal(true);
      onAddPerformersOpened?.();
    }
  }, [addPerformersTrigger, onAddPerformersOpened]);

  useEffect(() => {
    setGigPageInternalNotesComposing(false);
    setGigPageInternalNotesDraft(null);
    setSoundEngineerComposing(false);
    setSoundEngineerDraft(null);
  }, [rawGig?.gigId]);

  const canUpdate = rawGig?.venueId && hasVenuePerm(venues, rawGig.venueId, 'gigs.update');

  const hasAnyConfirmedApplicants = React.useMemo(
    () =>
      Array.isArray(rawGig?.applicants) &&
      rawGig.applicants.some((a) => ['confirmed', 'paid'].includes(a?.status)),
    [rawGig?.applicants]
  );

  const gigDateTimeForEdit = rawGig ? getLocalGigDateTime(rawGig) : null;

  const showConfirmGigManuallyLink = React.useMemo(() => {
    if (normalisedGig?.bookingMode !== 'artist_booking') return false;
    if (!['open', 'confirmed'].includes(normalisedGig?.status || '')) return false;
    if (rawGig?.status === 'closed') return false;
    if (!rawGig?.venueId) return false;
    if (!hasVenuePerm(venues, rawGig.venueId, 'gigs.update')) return false;
    if (!hasVenuePerm(venues, rawGig.venueId, 'gigs.applications.manage')) return false;
    if (!gigDateTimeForEdit || gigDateTimeForEdit.getTime() <= Date.now()) return false;
    if (hasAnyConfirmedApplicants) return false;
    return true;
  }, [normalisedGig?.bookingMode, normalisedGig?.status, rawGig, venues, hasAnyConfirmedApplicants, gigDateTimeForEdit]);

  const showEditManualBookedLink = React.useMemo(() => {
    if (normalisedGig?.bookingMode !== 'artist_booking') return false;
    if (!['open', 'confirmed'].includes(normalisedGig?.status || '')) return false;
    if (rawGig?.status === 'closed') return false;
    if (!rawGig?.venueId) return false;
    if (!hasVenuePerm(venues, rawGig.venueId, 'gigs.update')) return false;
    if (!hasVenuePerm(venues, rawGig.venueId, 'gigs.applications.manage')) return false;
    if (!gigDateTimeForEdit || gigDateTimeForEdit.getTime() <= Date.now()) return false;
    return true;
  }, [normalisedGig?.bookingMode, normalisedGig?.status, rawGig, venues, gigDateTimeForEdit]);

  const filteredConfirmManualCrm = React.useMemo(() => {
    const q = (confirmManualName || '').trim().toLowerCase();
    if (q.length < 1) return [];
    return (crmEntries || []).filter((e) => (e.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [confirmManualName, crmEntries]);

  const openConfirmManualModal = useCallback((manualApplicant = null) => {
    const existingName = (
      manualApplicant?.name ||
      manualApplicant?.artistName ||
      ''
    ).trim();
    setConfirmManualName(existingName);
    setConfirmManualAddToContacts(false);
    setConfirmManualPickedCrmId(null);
    setConfirmManualDropdownOpen(Boolean(existingName));
    setShowConfirmManualModal(true);
  }, []);

  const handleConfirmManualSave = useCallback(async () => {
    const name = (confirmManualName || '').trim();
    if (!name) {
      toast.error('Enter a name.');
      return;
    }
    if (!rawGig?.gigId || !hasVenuePerm(venues, rawGig.venueId, 'gigs.applications.manage')) {
      toast.error('You do not have permission to manage applications.');
      return;
    }
    setConfirmManualSaving(true);
    try {
      const existingApplicants = Array.isArray(rawGig?.applicants) ? rawGig.applicants : [];
      const updatedApplicants = existingApplicants.map((app) =>
        ['confirmed', 'accepted', 'paid'].includes(app?.status) ? { ...app, status: 'declined' } : app
      );
      updatedApplicants.push({
        id: `manual-${Date.now()}`,
        name,
        artistName: name,
        status: 'confirmed',
        sentBy: 'venue',
        manual: true,
      });
      await updateGigDocument({
        gigId: rawGig.gigId,
        action: 'gigs.update',
        updates: { applicants: updatedApplicants },
      });
      toast.success('Gig confirmed manually.');
      if (confirmManualAddToContacts && !confirmManualPickedCrmId && user?.uid) {
        try {
          await createArtistCRMEntry(user.uid, { name });
          const entries = await getArtistCRMEntries(user.uid);
          setCrmEntries(entries);
          toast.success('Added to My Contacts.');
        } catch (e) {
          console.error(e);
          toast.error('Could not add to contacts.');
        }
      }
      setGigInfo?.((prev) => (prev ? { ...prev, applicants: updatedApplicants } : null));
      refreshGigs?.();
      setShowConfirmManualModal(false);
      setConfirmManualName('');
      setConfirmManualAddToContacts(false);
      setConfirmManualPickedCrmId(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to confirm gig.');
    } finally {
      setConfirmManualSaving(false);
    }
  }, [
    confirmManualName,
    confirmManualAddToContacts,
    confirmManualPickedCrmId,
    rawGig,
    venues,
    user?.uid,
    setGigInfo,
    refreshGigs,
  ]);

  const bookedBy = normalisedGig?.bookedBy || {};
  const bookerName = bookedBy.name || (rawGig?.renterName && String(rawGig.renterName).trim()) || (rawGig?.hirerName && String(rawGig.hirerName).trim()) || null;
  const isBookerGigin = bookedBy.type === 'gigin';
  const rentalStatus = rawGig?.rentalStatus;
  const hireStatus = rawGig?.status;
  const isConfirmedRental = rentalStatus === 'confirmed_renter' || hireStatus === 'confirmed';

  /** 'available' = no hirer yet; 'confirmed' = has booker (manual or confirmed rental). Manually entered bookers always show as Confirmed. */
  const hireState = !bookerName ? 'available' : (isConfirmedRental || !isBookerGigin) ? 'confirmed' : 'pending';

  useEffect(() => {
    if (normalisedGig?.bookingMode === 'artist_booking' && isArtistBookingFullyBooked) {
      setShowApplicationsTile(false);
    }
    if (rawGig?.itemType === 'venue_hire' && hireState === 'confirmed') {
      setShowApplicationsTile(false);
    }
  }, [rawGig?.gigId, normalisedGig?.bookingMode, rawGig?.itemType, hireState, isArtistBookingFullyBooked]);

  const showApplicationsVisibility =
    canUpdate && applicationsInviteOnly != null && onApplicationsVisibilityChange;

  const renderVenueProfileVisibilityTile = () => {
    if (!showApplicationsVisibility) return null;
    if (normalisedGig?.bookingMode === 'artist_booking' && isArtistBookingFullyBooked) return null;
    if (rawGig?.itemType === 'venue_hire' && hireState === 'confirmed') return null;
    const visibleOnProfile = !applicationsInviteOnly;
    return (
      <div className="gig-details-tile gig-details-venue-profile-visibility-tile">
        <div className="gig-details-venue-profile-visibility-tile__left">
          <span className="gig-details-venue-profile-visibility-tile__icon-wrap" aria-hidden>
            <EyeIcon />
          </span>
          <div className="gig-details-venue-profile-visibility-tile__copy">
            <h3 className="gig-details-tile__title">Visible on venue profile</h3>
            <p className="gig-details-venue-profile-visibility-tile__description">
              When on, artists and promoters can find this gig on your venue profile to apply
            </p>
          </div>
        </div>
        <label className="gig-details-venue-profile-visibility-tile__switch gigs-toggle-switch">
          <input
            type="checkbox"
            checked={visibleOnProfile}
            onChange={(e) => onApplicationsVisibilityChange(!e.target.checked)}
            aria-label="Visible on venue profile"
          />
          <span className="gigs-toggle-slider" />
        </label>
      </div>
    );
  };

  /** For confirmed Gigin booker: the conversation with them (for Message button). */
  const bookerConversation = React.useMemo(() => {
    if (!isBookerGigin || !rawGig?.hirerUserId || !Array.isArray(hireApplications) || hireApplications.length === 0) return null;
    return hireApplications.find((conv) => {
      const applicant = conv?.accountNames?.find((a) => a?.role === 'band') || conv?.accountNames?.find((a) => a?.role === 'musician');
      return applicant?.participantId === rawGig.hirerUserId;
    }) || null;
  }, [isBookerGigin, rawGig?.hirerUserId, hireApplications]);

  const performerItems = normalisedGig?.performers?.items || [];
  const performerCount = performerItems.length;

  useEffect(() => {
    if (!user?.uid) return;
    setCrmLoading(true);
    getArtistCRMEntries(user.uid)
      .then((entries) => setCrmEntries(entries || []))
      .catch(() => setCrmEntries([]))
      .finally(() => setCrmLoading(false));
  }, [user?.uid]);

  const crmNamesById = React.useMemo(() => {
    const map = {};
    (crmEntries || []).forEach((e) => { if (e.id) map[e.id] = e.name || 'Unknown'; });
    return map;
  }, [crmEntries]);

  const performerContactIds = React.useMemo(
    () => new Set(performerItems.filter((p) => p.contactId).map((p) => p.contactId)),
    [performerItems]
  );
  const availableCrmEntries = (crmEntries || []).filter((e) => !e.id || !performerContactIds.has(e.id));
  const queryLower = (addPerformerQuery || '').trim().toLowerCase();
  const filteredCrmEntries = queryLower
    ? availableCrmEntries.filter((e) => (e.name || '').toLowerCase().includes(queryLower))
    : availableCrmEntries;

  const isVenueHire = rawGig?.itemType === 'venue_hire';
  const hireId = rawGig?.id ?? rawGig?.gigId;
  const venueForHire = venues?.find((v) => v.venueId === rawGig?.venueId);

  /** Send gig details (venue hire): show until accepted hirers/applicants reach `closeBookingAfterAcceptedCount`. */
  const showVenueHireSendGigDetailsTile = React.useMemo(() => {
    if (!isVenueHire || !hireId) return false;
    if (!bookingLinkUrl || hireApplicationsLoading) return false;

    const limit = closeBookingAfterAcceptedCount;
    const applicants = Array.isArray(rawGig?.applicants) ? rawGig.applicants : [];
    const confirmedFromApplicants = applicants.filter((a) =>
      ['confirmed', 'accepted', 'paid'].includes(a?.status)
    ).length;

    const hirerAccepted =
      hireState === 'confirmed' &&
      !!bookerName &&
      (isConfirmedRental || rawGig?.hirerType === 'manual' || !!rawGig?.hirerUserId);

    const acceptedCount =
      confirmedFromApplicants > 0 ? confirmedFromApplicants : hirerAccepted ? 1 : 0;

    return acceptedCount < limit;
  }, [
    isVenueHire,
    hireId,
    bookingLinkUrl,
    hireApplicationsLoading,
    closeBookingAfterAcceptedCount,
    rawGig?.applicants,
    hireState,
    bookerName,
    isConfirmedRental,
    rawGig?.hirerType,
    rawGig?.hirerUserId,
  ]);

  useEffect(() => {
    if (!isVenueHire || !rawGig?.hirerUserId || !isBookerGigin) {
      setVenueHireBookerProfile(null);
      return;
    }
    let cancelled = false;
    getArtistProfileById(rawGig.hirerUserId)
      .then((p) => {
        if (!cancelled) setVenueHireBookerProfile(p || null);
      })
      .catch(() => {
        if (!cancelled) setVenueHireBookerProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isVenueHire, rawGig?.hirerUserId, isBookerGigin]);

  const saveGigPageInternalNotes = useCallback(async (value) => {
    if (!canUpdate) return;
    setGigPageInternalNotesSaving(true);
    try {
      const now = new Date().toISOString();
      if (isVenueHire && hireId) {
        await updateVenueHireOpportunity(hireId, { notesInternal: value || '', internalNotesLastEdited: now });
        setGigInfo?.((prev) => (prev
          ? { ...prev, notesInternal: value || '', internalNotes: value || null, internalNotesLastEdited: now }
          : null));
      } else if (rawGig?.gigId) {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { internalNotes: value || null, internalNotesLastEdited: now },
        });
        setGigInfo?.((prev) => (prev ? { ...prev, internalNotes: value || null, internalNotesLastEdited: now } : null));
      } else {
        return;
      }
      refreshGigs?.();
      setGigPageInternalNotesDraft(null);
      setGigPageInternalNotesComposing(false);
      toast.success('Notes saved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save notes.');
    } finally {
      setGigPageInternalNotesSaving(false);
    }
  }, [isVenueHire, hireId, rawGig?.gigId, canUpdate, setGigInfo, refreshGigs]);

  const saveSoundEngineer = useCallback(async (name, contact) => {
    if (!canUpdate) return;
    setSoundEngineerSaving(true);
    try {
      const now = new Date().toISOString();
      const updates = {
        soundEngineerName: name || null,
        soundEngineerContact: contact || null,
        soundEngineerLastEdited: now,
      };
      if (isVenueHire && hireId) {
        await updateVenueHireOpportunity(hireId, updates);
      } else if (rawGig?.gigId) {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates,
        });
      } else {
        return;
      }
      setPrivateBundle((prev) => ({
        ...(prev || {}),
        soundEngineerName: name || null,
        soundEngineerContact: contact || null,
        soundEngineerLastEdited: now,
      }));
      refreshGigs?.();
      setSoundEngineerDraft(null);
      setSoundEngineerComposing(false);
      toast.success('Sound engineer saved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save sound engineer.');
    } finally {
      setSoundEngineerSaving(false);
    }
  }, [isVenueHire, hireId, rawGig?.gigId, canUpdate, setGigInfo, refreshGigs]);

  const renderGigPageInternalNotesTileBody = () => {
    const savedRaw = rawGig?.internalNotes ?? rawGig?.notesInternal ?? '';
    const savedStr = savedRaw != null ? String(savedRaw) : '';
    const hasSavedNote = savedStr.trim().length > 0;

    if (!canUpdate) {
      return <p className="gig-details-tile__readonly">{savedStr || '—'}</p>;
    }

    const discardCompose = () => {
      setGigPageInternalNotesDraft(null);
      setGigPageInternalNotesComposing(false);
    };

    const startAdd = () => {
      setGigPageInternalNotesDraft('');
      setGigPageInternalNotesComposing(true);
    };

    const startEdit = () => {
      setGigPageInternalNotesDraft(savedStr);
      setGigPageInternalNotesComposing(true);
    };

    const discardSavedNote = () => {
      if (!window.confirm('Remove this note?')) return;
      void saveGigPageInternalNotes('');
    };

    if (gigPageInternalNotesComposing) {
      const textareaVal = gigPageInternalNotesDraft !== null ? gigPageInternalNotesDraft : '';
      return (
        <>
          <textarea
            className="input gig-details-tile__notes-input"
            value={textareaVal}
            onChange={(e) => setGigPageInternalNotesDraft(e.target.value)}
            placeholder="Write any notes for you and your team about this gig"
            rows={4}
            disabled={gigPageInternalNotesSaving}
            autoFocus
          />
          <div className="gig-details-tile__notes-actions">
            <button
              type="button"
              className="btn tertiary"
              onClick={discardCompose}
              disabled={gigPageInternalNotesSaving}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const v = gigPageInternalNotesDraft !== null ? gigPageInternalNotesDraft : '';
                void saveGigPageInternalNotes(v.trim() || '');
              }}
              disabled={gigPageInternalNotesSaving}
            >
              {gigPageInternalNotesSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      );
    }

    if (!hasSavedNote) {
      return (
        <button type="button" className="btn secondary gig-details-tile__notes-add" onClick={startAdd}>
          <PlusIcon />
          Add note
        </button>
      );
    }

    return (
      <>
        <p className="gig-details-tile__readonly">{savedStr}</p>
        {rawGig?.internalNotesLastEdited ? (
          <p className="gig-details-tile__edited">
            Last edited {formatDate(rawGig.internalNotesLastEdited, 'short')}
          </p>
        ) : null}
        <div className="gig-details-tile__notes-actions">
          <button type="button" className="btn tertiary" onClick={discardSavedNote}>
            Discard
          </button>
          <button type="button" className="btn secondary" onClick={startEdit}>
            Edit
          </button>
        </div>
      </>
    );
  };

  const renderSoundEngineerTileBody = () => {
    const savedName = privateBundle?.soundEngineerName != null ? String(privateBundle.soundEngineerName) : '';
    const savedContact = privateBundle?.soundEngineerContact != null ? String(privateBundle.soundEngineerContact) : '';
    const hasSaved = savedName.trim().length > 0 || savedContact.trim().length > 0;
    const draft = soundEngineerDraft || { name: '', contact: '' };

    if (!canUpdate) {
      return (
        <>
          <p className="gig-details-tile__readonly">{savedName || '—'}</p>
          {savedContact ? <p className="gig-details-tile__readonly">{savedContact}</p> : null}
        </>
      );
    }

    const discardCompose = () => {
      setSoundEngineerDraft(null);
      setSoundEngineerComposing(false);
    };

    if (soundEngineerComposing) {
      return (
        <>
          <label className="label" htmlFor="gig-sound-engineer-name">Name</label>
          <input
            id="gig-sound-engineer-name"
            className="input"
            value={draft.name}
            onChange={(e) => setSoundEngineerDraft({ ...draft, name: e.target.value })}
            placeholder="Sound engineer name"
            disabled={soundEngineerSaving}
            autoFocus
          />
          <label className="label" htmlFor="gig-sound-engineer-contact">Contact</label>
          <input
            id="gig-sound-engineer-contact"
            className="input"
            value={draft.contact}
            onChange={(e) => setSoundEngineerDraft({ ...draft, contact: e.target.value })}
            placeholder="Phone or email"
            disabled={soundEngineerSaving}
          />
          <div className="gig-details-tile__notes-actions">
            <button type="button" className="btn tertiary" onClick={discardCompose} disabled={soundEngineerSaving}>
              Discard
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => { void saveSoundEngineer(draft.name.trim(), draft.contact.trim()); }}
              disabled={soundEngineerSaving}
            >
              {soundEngineerSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      );
    }

    if (!hasSaved) {
      return (
        <button
          type="button"
          className="btn secondary gig-details-tile__notes-add"
          onClick={() => {
            setSoundEngineerDraft({ name: '', contact: '' });
            setSoundEngineerComposing(true);
          }}
        >
          <PlusIcon />
          Add sound engineer
        </button>
      );
    }

    return (
      <>
        <p className="gig-details-tile__readonly">{savedName || '—'}</p>
        {savedContact ? <p className="gig-details-tile__readonly">{savedContact}</p> : null}
        {privateBundle?.soundEngineerLastEdited ? (
          <p className="gig-details-tile__edited">
            Last edited {formatDate(privateBundle.soundEngineerLastEdited, 'short')}
          </p>
        ) : null}
        <div className="gig-details-tile__notes-actions">
          <button
            type="button"
            className="btn tertiary"
            onClick={() => {
              if (!window.confirm('Remove this sound engineer?')) return;
              void saveSoundEngineer('', '');
            }}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setSoundEngineerDraft({ name: savedName, contact: savedContact });
              setSoundEngineerComposing(true);
            }}
          >
            Edit
          </button>
        </div>
      </>
    );
  };

  const renderSoundEngineerAndNotesTiles = () => (
    <div className="gig-details-tile-row">
      <div className="gig-details-tile gig-details-tile--half">
        <div className="fill-this-slot__header fill-this-slot__header--invite-promoter">
          <PencilIcon />
          <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter">Sound engineer</h3>
        </div>
        {renderSoundEngineerTileBody()}
      </div>
      <div className="gig-details-tile gig-details-tile--internal-notes gig-details-tile--half">
        <div className="fill-this-slot__header fill-this-slot__header--invite-promoter">
          <PencilIcon />
          <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter">Additional notes</h3>
        </div>
        {renderGigPageInternalNotesTileBody()}
      </div>
    </div>
  );

  /** Listing docs from the wizard; venue-hire legacy `documents` URLs map into the same row shape. */
  const combinedListingDocuments = React.useMemo(() => {
    if (Array.isArray(rawGig?.listingDocuments) && rawGig.listingDocuments.length > 0) {
      return rawGig.listingDocuments;
    }
    if (Array.isArray(rawGig?.documents) && rawGig.documents.length > 0) {
      return rawGig.documents.map((d, i) => ({
        key: d.url || `doc-${i}`,
        title: d.name || 'Document',
        sourceUrl: d.url,
        signed: d.signed,
      }));
    }
    return [];
  }, [rawGig?.listingDocuments, rawGig?.documents]);

  const venueDisplayName = venueForHire?.accountName || venueForHire?.name || rawGig?.venue?.venueName || 'this venue';

  const saveCloseBookingAfterAcceptedCount = useCallback(
    async (nextRaw) => {
      const n = normalizeCloseBookingAfterAcceptedCount(nextRaw);
      if (!hireId || !canUpdate) return false;
      const current = normalizeCloseBookingAfterAcceptedCount(rawGig?.closeBookingAfterAcceptedCount);
      if (n === current) return false;
      setBookingLimitSaving(true);
      try {
        await updateVenueHireOpportunity(hireId, { closeBookingAfterAcceptedCount: n });
        setGigInfo((prev) => (prev ? { ...prev, closeBookingAfterAcceptedCount: n } : null));
        refreshGigs?.();
        return true;
      } catch (e) {
        console.error(e);
        toast.error('Failed to save booking limit.');
        setDraftCloseCount(current);
        return false;
      } finally {
        setBookingLimitSaving(false);
      }
    },
    [hireId, canUpdate, rawGig?.closeBookingAfterAcceptedCount, setGigInfo, refreshGigs]
  );

  const openBookingLimitEdit = useCallback(() => {
    setDraftCloseCount(closeBookingAfterAcceptedCount);
    setBookingLimitEditing(true);
  }, [closeBookingAfterAcceptedCount]);

  const cancelBookingLimitEdit = useCallback(() => {
    setDraftCloseCount(closeBookingAfterAcceptedCount);
    setBookingLimitEditing(false);
  }, [closeBookingAfterAcceptedCount]);

  const commitBookingLimitEdit = useCallback(async () => {
    const n = normalizeCloseBookingAfterAcceptedCount(draftCloseCount);
    const current = normalizeCloseBookingAfterAcceptedCount(rawGig?.closeBookingAfterAcceptedCount);
    if (n === current) {
      setBookingLimitEditing(false);
      return;
    }
    const saved = await saveCloseBookingAfterAcceptedCount(n);
    if (saved) setBookingLimitEditing(false);
  }, [draftCloseCount, rawGig?.closeBookingAfterAcceptedCount, saveCloseBookingAfterAcceptedCount]);

  const bumpBookingLimitDraft = useCallback((delta) => {
    if (bookingLimitSaving) return;
    setDraftCloseCount((prev) => normalizeCloseBookingAfterAcceptedCount(prev + delta));
  }, [bookingLimitSaving]);

  const toggleApplicationsBookingLimitSettings = useCallback(() => {
    setShowApplicationsBookingLimitSettings((prev) => {
      if (prev) cancelBookingLimitEdit();
      return !prev;
    });
  }, [cancelBookingLimitEdit]);

  useEffect(() => {
    if (!showApplicationsSettingsMenu) return undefined;
    const onDocMouseDown = (e) => {
      const root = applicationsSettingsMenuRef.current;
      if (root && !root.contains(e.target)) {
        setShowApplicationsSettingsMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showApplicationsSettingsMenu]);

  const inviteContactToHire = useCallback(
    async (entry) => {
      if (!bookingLinkUrl || !entry?.id) return;
      setInvitingContactId(entry.id);
      try {
        const hireDate = normalisedGig?.dateLabel || (rawGig?.date && formatDate(rawGig.date, 'short')) || '';

        if (entry.artistId) {
          const artistProfile = await getArtistProfileById(entry.artistId);
          if (!artistProfile) {
            toast.error('Artist profile not found.');
            return;
          }
          const musicianProfile = {
            musicianId: artistProfile.id,
            id: artistProfile.id,
            name: artistProfile.name,
            genres: artistProfile.genres || [],
            musicianType: 'Musician/Band',
            musicType: artistProfile.genres || [],
            bandProfile: false,
            userId: artistProfile.userId,
          };
          const gigDataForConv = { ...rawGig, gigId: hireId, itemType: 'venue_hire' };
          const { conversationId } = await getOrCreateConversation({
            musicianProfile,
            gigData: gigDataForConv,
            venueProfile: venueForHire,
            type: 'invitation',
          });
          const messageText = `${venueDisplayName} invited you to apply to their venue hire on ${hireDate} at ${venueDisplayName}.`;
          await sendGigInvitationMessage(conversationId, { senderId: user.uid, text: messageText });
          setInvitedContactIds((prev) => new Set(prev).add(entry.id));
          toast.success(`Gigin invite sent to ${artistProfile.name}`);
          refreshGigs?.();
          return;
        }

        const email = (entry.email || '').trim();
        if (!email) {
          toast.error('This contact has no email. Add one in My Contacts.');
          return;
        }
        await sendGigInviteEmail({
          to: email,
          userName: user?.name || venueForHire?.accountName || 'The venue',
          venueName: venueDisplayName,
          date: hireDate,
          gigLink: bookingLinkUrl,
          expiresAt: null,
        });
        setInvitedContactIds((prev) => new Set(prev).add(entry.id));
        toast.success(`Invitation sent to ${entry.name || email}`);
        refreshGigs?.();
      } catch (err) {
        console.error(err);
        toast.error('Failed to send invitation.');
      } finally {
        setInvitingContactId(null);
      }
    },
    [bookingLinkUrl, hireId, rawGig, normalisedGig?.dateLabel, user?.uid, venueForHire, venueDisplayName, refreshGigs]
  );

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sendInviteByEmail = useCallback(async () => {
    const email = (emailInviteInput || '').trim().toLowerCase();
    if (!email) {
      setEmailInviteError('Enter an email address.');
      return;
    }
    if (!emailRegex.test(email)) {
      setEmailInviteError('Enter a valid email address.');
      return;
    }
    if (!bookingLinkUrl) return;
    setEmailInviteError('');
    setEmailInviteSending(true);
    try {
      const hireDate = normalisedGig?.dateLabel || (rawGig?.date && formatDate(rawGig.date, 'short')) || '';
      await sendGigInviteEmail({
        to: email,
        userName: user?.name || venueForHire?.accountName || 'The venue',
        venueName: venueDisplayName,
        date: hireDate,
        gigLink: bookingLinkUrl,
        expiresAt: null,
      });
      toast.success(`Invitation sent to ${email}`);
      setEmailInviteInput('');
      refreshGigs?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to send invitation.');
    } finally {
      setEmailInviteSending(false);
    }
  }, [emailInviteInput, bookingLinkUrl, normalisedGig?.dateLabel, rawGig?.date, user?.name, venueForHire?.accountName, venueDisplayName, refreshGigs]);

  useEffect(() => {
    if (!isVenueHire || !hireId || !user?.uid) {
      setHireApplications([]);
      return;
    }
    setHireApplicationsLoading(true);
    getConversationsByParticipantAndGigId(hireId, user.uid)
      .then((conversations) => {
        const list = conversations || [];
        setHireApplications(list);
        try {
          localStorage.setItem(`gigin-hire-seen-${hireId}`, String(list.length));
        } catch (_) {}
      })
      .catch(() => setHireApplications([]))
      .finally(() => setHireApplicationsLoading(false));
  }, [isVenueHire, hireId, user?.uid]);

  const handleSaveBooker = async () => {
    const name = (editBookerName || '').trim();
    if (!hireId && !rawGig?.gigId) return;
    if (!canUpdate) return;
    setSavingBooker(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { hirerName: name || null });
        setGigInfo((prev) => (prev ? { ...prev, hirerName: name || null, renterName: name || null } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { renterName: name || null },
        });
        setGigInfo((prev) => (prev ? { ...prev, renterName: name || null } : null));
      }
      refreshGigs?.();
      toast.success(name ? 'Hirer updated.' : 'Hirer cleared.');
      setShowEditBookerModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setSavingBooker(false);
    }
  };

  const getCurrentPerformersForSave = useCallback(() => {
    const list = rawGig?.performers && Array.isArray(rawGig.performers) ? rawGig.performers : null;
    if (list && list.length > 0) return list.map((p) => ({ ...p }));
    const ids = rawGig?.bookedPerformerIds || [];
    const names = rawGig?.bookedPerformerNames || [];
    const fromIds = ids.map((id) => ({ source: 'manual', displayName: crmNamesById[id] || '', contactId: id }));
    const fromNames = names.map((displayName) => ({ source: 'manual', displayName }));
    return [...fromIds, ...fromNames];
  }, [rawGig, crmNamesById]);

  const handleAddPerformerFromTextBox = async () => {
    const name = (addPerformerQuery || '').trim();
    if (!name || (!hireId && !rawGig?.gigId) || !canUpdate) return;
    const current = getCurrentPerformersForSave();
    if (current.some((p) => (p.displayName || '').trim() === name)) {
      toast.info('That performer is already on the gig.');
      return;
    }
    setAddPerformerSaving(true);
    try {
      const newPerformers = [...current, { source: 'manual', displayName: name }];
      const newNames = newPerformers.filter((p) => p.source === 'manual' && !p.contactId).map((p) => p.displayName);
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { performers: newPerformers });
        setGigInfo((prev) => (prev ? { ...prev, performers: newPerformers, bookedPerformerNames: newNames } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { performers: newPerformers, bookedPerformerNames: newNames },
        });
        setGigInfo((prev) => (prev ? { ...prev, performers: newPerformers, bookedPerformerNames: newNames } : null));
      }
      refreshGigs?.();
      toast.success(`Added ${name}.`);
      setAddPerformerQuery('');
      setShowAddPerformersModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add performer.');
    } finally {
      setAddPerformerSaving(false);
    }
  };

  const handleAddSelectedFromCrmList = async () => {
    if (addPerformerSelectedIds.length === 0 || (!hireId && !rawGig?.gigId) || !canUpdate) return;
    const current = getCurrentPerformersForSave();
    const toAdd = addPerformerSelectedIds
      .map((id) => {
        const entry = crmEntries.find((e) => e.id === id);
        return entry ? { source: 'manual', displayName: entry.name || '', contactId: id } : null;
      })
      .filter(Boolean);
    const newPerformers = [...current];
    toAdd.forEach((p) => {
      if (!newPerformers.some((existing) => existing.contactId === p.contactId)) newPerformers.push(p);
    });
    const newIds = newPerformers.filter((p) => p.contactId).map((p) => p.contactId);
    setAddPerformerSaving(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { performers: newPerformers });
        setGigInfo((prev) => (prev ? { ...prev, performers: newPerformers, bookedPerformerIds: newIds } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { performers: newPerformers, bookedPerformerIds: newIds },
        });
        setGigInfo((prev) => (prev ? { ...prev, performers: newPerformers, bookedPerformerIds: newIds } : null));
      }
      refreshGigs?.();
      toast.success(`Added ${toAdd.length} performer(s).`);
      setShowAddPerformersModal(false);
      setAddPerformerSelectedIds([]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add performers.');
    } finally {
      setAddPerformerSaving(false);
    }
  };

  const openEditBooker = () => {
    setEditBookerName(bookerName || '');
    setShowEditBookerModal(true);
  };

  const handleSaveEditPerformer = async (newName) => {
    if (editingPerformerIndex == null || !newName || (!hireId && !rawGig?.gigId) || !canUpdate) return;
    const current = getCurrentPerformersForSave();
    if (editingPerformerIndex < 0 || editingPerformerIndex >= current.length) return;
    const updated = current.map((p, i) =>
      i === editingPerformerIndex ? { ...p, displayName: newName } : p
    );
    setAddPerformerSaving(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { performers: updated });
        setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { performers: updated },
        });
        setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
      }
      refreshGigs?.();
      toast.success('Performer updated.');
      setShowAddPerformersModal(false);
      setAddPerformerQuery('');
      setEditingPerformerIndex(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update performer.');
    } finally {
      setAddPerformerSaving(false);
    }
  };

  const handleRemovePerformer = async () => {
    if (editingPerformerIndex == null || (!hireId && !rawGig?.gigId) || !canUpdate) return;
    const current = getCurrentPerformersForSave();
    if (editingPerformerIndex < 0 || editingPerformerIndex >= current.length) return;
    const updated = current.filter((_, i) => i !== editingPerformerIndex);
    setAddPerformerSaving(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { performers: updated });
        setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { performers: updated },
        });
        setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
      }
      refreshGigs?.();
      toast.success('Performer removed.');
      setShowAddPerformersModal(false);
      setAddPerformerQuery('');
      setEditingPerformerIndex(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove performer.');
    } finally {
      setAddPerformerSaving(false);
    }
  };

  const handleAddToContactsSave = async (data) => {
    if (!user?.uid || !data.name?.trim()) return;
    setAddToContactsSaving(true);
    try {
      const entryId = await createArtistCRMEntry(user.uid, {
        name: data.name.trim(),
        email: data.email || null,
        phone: data.phone || null,
        instagram: data.instagram || null,
        facebook: data.facebook || null,
        other: data.other || null,
      });
      toast.success('Added to contacts.');
      setShowAddToContactsModal(false);
      const performerIndex = addToContactsPerformerIndex;
      setAddToContactsPerformerIndex(null);
      if (performerIndex != null && performerIndex >= 0 && (hireId || rawGig?.gigId) && canUpdate) {
        const current = getCurrentPerformersForSave();
        if (performerIndex < current.length) {
          const updated = current.map((p, i) =>
            i === performerIndex ? { ...p, contactId: entryId, displayName: data.name.trim() } : p
          );
          if (isVenueHire) {
            await updateVenueHireOpportunity(hireId, { performers: updated });
            setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
          } else {
            await updateGigDocument({
              gigId: rawGig.gigId,
              action: 'gigs.update',
              updates: { performers: updated },
            });
            setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
          }
          refreshGigs?.();
        }
      }
      const entries = await getArtistCRMEntries(user.uid);
      setCrmEntries(entries);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add to contacts.');
    } finally {
      setAddToContactsSaving(false);
    }
  };

  const copyBookingLink = async () => {
    if (!bookingLinkUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bookingLinkUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = bookingLinkUrl;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
      toast.success('Link copied to clipboard');
    } catch (err) {
      console.error(err);
      toast.error("Couldn't copy link");
    }
  };

  /** Get the applicant (band/musician) account from a venue-hire conversation. */
  const getApplicantFromConversation = useCallback((conv) => {
    if (!conv?.accountNames) return null;
    return (
      conv.accountNames.find((a) => a?.role === 'band') ||
      conv.accountNames.find((a) => a?.role === 'musician') ||
      null
    );
  }, []);

  /** Fetch artist profiles for all applications so we display canonical name and photo. */
  useEffect(() => {
    if (!hireApplications?.length) {
      setApplicationProfiles({});
      return;
    }
    let cancelled = false;
    const byConvId = {};
    Promise.all(
      hireApplications.map(async (conv) => {
        const applicant = conv.accountNames?.find((a) => a?.role === 'band') || conv.accountNames?.find((a) => a?.role === 'musician');
        const participantId = applicant?.participantId;
        if (!participantId) return { convId: conv.id, profile: null };
        try {
          const profile = await getArtistProfileById(participantId);
          return { convId: conv.id, profile };
        } catch {
          return { convId: conv.id, profile: null };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      results.forEach(({ convId, profile }) => {
        if (profile) {
          const picture = profile.picture || profile.heroMedia?.url || null;
          byConvId[convId] = { name: profile.name, picture };
        }
      });
      setApplicationProfiles(byConvId);
    });
    return () => { cancelled = true; };
  }, [hireApplications]);

  useEffect(() => {
    const list = hireApplications ?? [];
    if (!list.length) {
      setApplicationMessagePreviews({});
      return;
    }
    let cancelled = false;
    Promise.all(
      list.map(async (conv) => {
        const msg = await getMostRecentMessage(conv.id, 'application');
        const text =
          msg?.text != null && String(msg.text).trim() !== ''
            ? String(msg.text).trim()
            : null;
        return { convId: conv.id, text };
      })
    ).then((results) => {
      if (cancelled) return;
      const next = {};
      results.forEach(({ convId, text }) => {
        next[convId] = text;
      });
      setApplicationMessagePreviews(next);
    });
    return () => {
      cancelled = true;
    };
  }, [hireApplications]);

  const handleAcceptApplication = useCallback(
    async (conv) => {
      if (!hireId || !canUpdate) return;
      const applicant = getApplicantFromConversation(conv);
      const profileData = applicationProfiles[conv.id];
      const name = (profileData?.name || applicant?.accountName || conv?.artistName || '').trim() || null;
      const participantId = applicant?.participantId || null;
      setAcceptingApplicationConvId(conv.id);
      try {
        const updates = {
          hirerName: name,
          hirerUserId: participantId || undefined,
          hirerType: participantId ? 'gigin_user' : 'manual',
          status: 'confirmed',
          ...(participantId ? { acceptedApplicantId: participantId } : {}),
        };
        if (participantId && venueProfile?.techRider) {
          try {
            const artistProfile = await getArtistProfileById(participantId);
            if (artistProfile?.techRider?.isComplete && artistProfile?.techRider?.lineup?.length > 0) {
              const compat = computeCompatibility(artistProfile.techRider, venueProfile.techRider);
              const usingVenueEquipment = (compat.providedByVenue || []).map((i) => i?.label ?? i).filter(Boolean);
              const hiringFromVenue = (compat.hireableEquipment || []).map((i) =>
                typeof i === 'string' ? { label: i } : { label: i?.label || i, ...(i?.hireFee != null ? { hireFee: i.hireFee } : {}) }
              );
              const needsDiscussion = (compat.needsDiscussion || []).map((i) => {
                const label = i?.label ?? i ?? '';
                const note = i?.note && String(i.note).trim() ? ` — ${i.note}` : '';
                return typeof label === 'string' ? `${label}${note}` : String(label);
              }).filter(Boolean);
              updates.techSetup = {
                usingVenueEquipment,
                hiringFromVenue,
                needsDiscussion,
                compatibilityStatus: needsDiscussion.length > 0 ? 'missing_required' : (hiringFromVenue.length > 0 ? 'compatible_with_hired' : 'fully_compatible'),
              };
            }
          } catch (_) {
            // Non-fatal: accept without tech setup
          }
        }
        await updateVenueHireOpportunity(hireId, updates);
        setGigInfo((prev) =>
          prev ? { ...prev, hirerName: name, renterName: name, rentalStatus: 'confirmed_renter', ...(updates.techSetup ? { techSetup: updates.techSetup } : {}) } : null
        );

        // Auto-decline all other applicants (slot booked with another booker)
        const acceptedParticipantId = participantId;
        const otherConvs = hireApplications.filter((c) => {
          const app = getApplicantFromConversation(c);
          return app?.participantId !== acceptedParticipantId;
        });
        const declinedIds = [];
        for (const otherConv of otherConvs) {
          try {
            const appMessage = await getMostRecentMessage(otherConv.id, 'application');
            if (appMessage?.id) {
              await updateDeclinedApplicationMessage({
                conversationId: otherConv.id,
                originalMessageId: appMessage.id,
                senderId: user.uid,
                userRole: 'venue',
              });
            }
            const otherApplicant = getApplicantFromConversation(otherConv);
            const otherParticipantId = otherApplicant?.participantId || null;
            const otherProfileData = applicationProfiles[otherConv.id] || (otherParticipantId ? await getArtistProfileById(otherParticipantId).catch(() => null) : null);
            const otherMusicianProfileData = otherProfileData
              ? { id: otherProfileData.id, name: otherProfileData.name, email: otherProfileData.email || null, bandProfile: false }
              : { id: otherParticipantId, name: otherApplicant?.accountName || otherConv?.artistName || 'Artist', email: null, bandProfile: false };
            const gigDataForEmail = {
              venue: { venueName: venueDisplayName },
              startDateTime: rawGig?.startDateTime ?? rawGig?.date ?? normalisedGig?.startDateTime,
            };
            await sendGigDeclinedEmail({
              userRole: 'venue',
              venueProfile: venueForHire || null,
              musicianProfile: otherMusicianProfileData,
              gigData: gigDataForEmail,
              declineType: 'application',
              profileType: otherMusicianProfileData?.bandProfile ? 'band' : 'artist',
            });
            declinedIds.push(otherConv.id);
          } catch (e) {
            console.error('Failed to auto-decline application', otherConv.id, e);
          }
        }
        if (declinedIds.length > 0) {
          setDeclinedApplicationConvIds((prev) => new Set([...prev, ...declinedIds]));
        }

        refreshGigs?.();
        toast.success('Application accepted. This slot is now booked.');
      } catch (err) {
        console.error(err);
        toast.error('Failed to accept application.');
      } finally {
        setAcceptingApplicationConvId(null);
      }
    },
    [hireId, canUpdate, getApplicantFromConversation, applicationProfiles, venueProfile, setGigInfo, refreshGigs, hireApplications, user?.uid, venueForHire, venueDisplayName, rawGig, normalisedGig]
  );

  const handleDeclineApplication = useCallback(
    async (conv) => {
      if (!hireId || !canUpdate) return;
      const applicant = getApplicantFromConversation(conv);
      const participantId = applicant?.participantId || null;
      setDecliningApplicationConvId(conv.id);
      try {
        const applicationMessage = await getMostRecentMessage(conv.id, 'application');
        if (applicationMessage?.id) {
          await updateDeclinedApplicationMessage({
            conversationId: conv.id,
            originalMessageId: applicationMessage.id,
            senderId: user.uid,
            userRole: 'venue',
          });
        }
        const profileData = applicationProfiles[conv.id] || (participantId ? await getArtistProfileById(participantId).catch(() => null) : null);
        const musicianProfileData = profileData
          ? { id: profileData.id, name: profileData.name, email: profileData.email || null, bandProfile: false }
          : { id: participantId, name: applicant?.accountName || conv?.artistName || 'Artist', email: null, bandProfile: false };
        const gigDataForEmail = {
          venue: { venueName: venueDisplayName },
          startDateTime: rawGig?.startDateTime ?? rawGig?.date ?? normalisedGig?.startDateTime,
        };
        await sendGigDeclinedEmail({
          userRole: 'venue',
          venueProfile: venueForHire || null,
          musicianProfile: musicianProfileData,
          gigData: gigDataForEmail,
          declineType: 'application',
          profileType: musicianProfileData?.bandProfile ? 'band' : 'artist',
        });
        setDeclinedApplicationConvIds((prev) => new Set(prev).add(conv.id));
        refreshGigs?.();
        toast.success('Application declined.');
      } catch (err) {
        console.error(err);
        toast.error('Failed to decline application.');
      } finally {
        setDecliningApplicationConvId(null);
      }
    },
    [hireId, canUpdate, getApplicantFromConversation, applicationProfiles, user?.uid, venueForHire, venueDisplayName, rawGig, normalisedGig, refreshGigs]
  );

  const openTechRiderForApplication = useCallback(async (participantId) => {
    if (!participantId) return;
    setApplicationsTechRiderLoading(true);
    try {
      const profile = await getArtistProfileById(participantId);
      if (profile?.techRider?.isComplete && profile?.techRider?.lineup?.length > 0) {
        setApplicationsTechRiderProfile(profile);
      } else {
        toast.info('No tech spec available.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not load tech spec.');
    } finally {
      setApplicationsTechRiderLoading(false);
    }
  }, []);

  const renderApplicationsBookingLimitBlock = () => {
    if (!isVenueHire || !hireId) return null;

    const singleLabel = 'Closing booking after 1 application is accepted';
    const multiLabel = (x) => `Closing booking after ${x} applications are accepted`;

    if (!canUpdate) {
      return (
        <div className="venue-hire-confirmed-panel__applications-booking-limit venue-hire-confirmed-panel__applications-booking-limit--readonly">
          <p className="venue-hire-confirmed-panel__applications-booking-limit-readonly">
            {closeBookingAfterAcceptedCount <= 1 ? singleLabel : multiLabel(closeBookingAfterAcceptedCount)}
          </p>
        </div>
      );
    }

    const persistedLabel =
      closeBookingAfterAcceptedCount <= 1 ? singleLabel : multiLabel(closeBookingAfterAcceptedCount);

    if (!bookingLimitEditing) {
      return (
        <div className="venue-hire-confirmed-panel__applications-booking-limit">
          <p className="venue-hire-confirmed-panel__applications-booking-limit-inline">
            <span className="venue-hire-confirmed-panel__applications-booking-limit-label">
              {persistedLabel}{' '}
            </span>
            <button
              type="button"
              className="venue-hire-confirmed-panel__applications-booking-limit-change"
              onClick={openBookingLimitEdit}
              disabled={bookingLimitSaving}
            >
              Change
            </button>
          </p>
        </div>
      );
    }

    const bookingLimitLabelId = 'venue-hire-booking-limit-label';

    return (
      <div className="venue-hire-confirmed-panel__applications-booking-limit">
        <div className="venue-hire-confirmed-panel__applications-booking-limit-row venue-hire-confirmed-panel__applications-booking-limit-row--multi">
          <span className="venue-hire-confirmed-panel__applications-booking-limit-label" id={bookingLimitLabelId}>
            {multiLabel(draftCloseCount)}
          </span>
          <div
            className="venue-hire-confirmed-panel__applications-booking-limit-stepper"
            role="group"
            aria-labelledby={bookingLimitLabelId}
          >
            <button
              type="button"
              className="venue-hire-confirmed-panel__applications-booking-limit-step"
              onClick={() => bumpBookingLimitDraft(-1)}
              disabled={bookingLimitSaving || draftCloseCount <= 1}
              aria-label="Decrease accepted applications before close"
            >
              −
            </button>
            <input
              type="number"
              className="venue-hire-confirmed-panel__applications-booking-limit-input"
              min={1}
              max={99}
              value={draftCloseCount}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (Number.isNaN(v)) return;
                setDraftCloseCount(normalizeCloseBookingAfterAcceptedCount(v));
              }}
              disabled={bookingLimitSaving}
              aria-label="Accepted applications before booking closes"
            />
            <button
              type="button"
              className="venue-hire-confirmed-panel__applications-booking-limit-step"
              onClick={() => bumpBookingLimitDraft(1)}
              disabled={bookingLimitSaving || draftCloseCount >= 99}
              aria-label="Increase accepted applications before close"
            >
              +
            </button>
          </div>
        </div>
        <div className="venue-hire-confirmed-panel__applications-booking-limit-actions">
          <button
            type="button"
            className="btn secondary venue-hire-confirmed-panel__applications-booking-limit-save"
            onClick={() => void commitBookingLimitEdit()}
            disabled={bookingLimitSaving}
          >
            {bookingLimitSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="btn tertiary venue-hire-confirmed-panel__applications-booking-limit-cancel"
            onClick={cancelBookingLimitEdit}
            disabled={bookingLimitSaving}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const renderApplicationsSettingsCogMenu = () => {
    const isVenueHireMenu = Boolean(isVenueHire && hireId);
    const isArtistBookingMenu = Boolean(!isVenueHire && showConfirmGigManuallyLink);
    if (!isVenueHireMenu && !isArtistBookingMenu) return null;
    const showAddManuallyOption = isVenueHireMenu
      ? hireState === 'available' && canUpdate
      : showConfirmGigManuallyLink;
    const showPreviewOption = Boolean(bookingLinkUrl);
    return (
      <div className="venue-hire-confirmed-panel__applications-settings-wrap" ref={applicationsSettingsMenuRef}>
        <button
          type="button"
          className="venue-hire-confirmed-panel__applications-booking-settings-btn"
          onClick={() => setShowApplicationsSettingsMenu((v) => !v)}
          aria-expanded={showApplicationsSettingsMenu}
          aria-haspopup="true"
          aria-label="Applications settings"
          title="Applications settings"
        >
          <SettingsIcon />
        </button>
        {showApplicationsSettingsMenu ? (
          <div className="venue-hire-confirmed-panel__applications-settings-menu" onClick={(e) => e.stopPropagation()}>
            {isVenueHireMenu ? (
              <button
                type="button"
                className="venue-hire-confirmed-panel__applications-settings-item"
                onClick={() => {
                  toggleApplicationsBookingLimitSettings();
                  setShowApplicationsSettingsMenu(false);
                }}
              >
                {showApplicationsBookingLimitSettings ? 'Hide booking close settings' : 'Booking close settings'}
              </button>
            ) : null}
            {showPreviewOption ? (
              <button
                type="button"
                className="venue-hire-confirmed-panel__applications-settings-item"
                onClick={() => {
                  window.open(bookingLinkUrl, '_blank', 'noopener,noreferrer');
                  setShowApplicationsSettingsMenu(false);
                }}
              >
                Preview gig details <NewTabIcon />
              </button>
            ) : null}
            {showAddManuallyOption ? (
              <button
                type="button"
                className="venue-hire-confirmed-panel__applications-settings-item"
                onClick={() => {
                  if (isVenueHireMenu) openEditBooker();
                  else openConfirmManualModal();
                  setShowApplicationsSettingsMenu(false);
                }}
              >
                Add manually
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  /** Same structure as `GigApplications` card layout empty state (artist booking). */
  const renderVenueHireApplicationsEmptyState = () => {
    return (
      <div className="venue-gig-applications-empty">
        <h3 className="venue-gig-applications-empty__title">No applications yet</h3>
        <p className="venue-gig-applications-empty__body">
          Send the gig details to artists and promoters, or manually enter who is booked.
        </p>
      </div>
    );
  };

  /** Confirmed venue hire: collapsible applications (sidebar when layout swap; else below Documents/Notes). */
  const renderVenueHireConfirmedApplicationsCard = () => {
    if (!(isVenueHire && hireId && hireState === 'confirmed')) return null;
    return (
      <>
        {showVenueHireSendGigDetailsTile ? (
          <SendGigDetailsTile
            bookingLinkUrl={bookingLinkUrl}
            onCopyLink={copyBookingLink}
            linkCopied={linkCopied}
            onInviteArtist={() => setShowVenueHireInviteModal(true)}
            showInviteButton={canUpdate}
          />
        ) : null}
        <div className="venue-hire-confirmed-card venue-hire-confirmed-panel__applications gig-details-tile">
        <div className="venue-hire-confirmed-panel__applications-top">
          <button
            type="button"
            className="venue-hire-confirmed-panel__applications-header"
            onClick={() => setShowApplicationsTile((v) => !v)}
            aria-expanded={showApplicationsTile}
          >
            <span className="venue-hire-confirmed-panel__applications-header-inner">
              <span className="fill-this-slot__header fill-this-slot__header--invite-promoter">
                <MessageIcon />
                <span className="fill-this-slot__title fill-this-slot__title--invite-promoter venue-hire-confirmed-panel__applications-title">
                  Applications ({hireApplicationsLoading ? '…' : hireApplications.length})
                </span>
              </span>
              {showApplicationsTile ? <UpChevronIcon className="venue-hire-confirmed-panel__see-applications-chevron" aria-hidden /> : <DownChevronIcon className="venue-hire-confirmed-panel__see-applications-chevron" aria-hidden />}
            </span>
          </button>
          {renderApplicationsSettingsCogMenu()}
        </div>
        {showApplicationsBookingLimitSettings ? renderApplicationsBookingLimitBlock() : null}
        {showApplicationsTile && (
          <div className="venue-hire-confirmed-panel__applications-body">
            {hireApplicationsLoading ? (
              <p className="venue-hire-confirmed-card__empty-text">Loading…</p>
            ) : hireApplications.length === 0 ? (
              renderVenueHireApplicationsEmptyState()
            ) : (
              <div className="venue-hire-application-tiles">
                {hireApplications.map((conv) => {
                  const applicant = getApplicantFromConversation(conv);
                  const profileData = applicationProfiles[conv.id];
                  const name = (profileData?.name || applicant?.accountName || conv?.artistName || 'Artist').trim() || 'Artist';
                  const photoUrl = profileData?.picture || applicant?.musicianImg || applicant?.accountImg;
                  const participantId = applicant?.participantId;
                  const isBooker = participantId && rawGig?.hirerUserId && participantId === rawGig.hirerUserId;
                  const isDeclinedOther = !isBooker;
                  return (
                    <div key={conv.id} className="venue-hire-application-tile">
                      <div className="venue-hire-application-tile__photo">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="venue-hire-application-tile__img" />
                        ) : (
                          <MicrophoneIcon />
                        )}
                      </div>
                      <div className="venue-hire-application-tile__main">
                        <div className="venue-hire-application-tile__identity">
                          <span className="venue-hire-application-tile__name">{name}</span>
                          {applicationMessagePreviews[conv.id] ? (
                            <p className="venue-hire-application-tile__message">{applicationMessagePreviews[conv.id]}</p>
                          ) : null}
                        </div>
                        <div className="venue-hire-application-tile__actions">
                          {participantId && (
                            <button
                              type="button"
                              className="btn tertiary venue-hire-application-tile__btn"
                              onClick={() => openTechRiderForApplication(participantId)}
                              disabled={applicationsTechRiderLoading}
                            >
                              <TechRiderIcon /> Tech setup
                            </button>
                          )}
                          {participantId && (
                            <button
                              type="button"
                              className="btn tertiary venue-hire-application-tile__btn"
                              onClick={(e) => openInNewTab(`/artist/${participantId}`, e)}
                            >
                              <NewTabIcon /> View profile
                            </button>
                          )}
                          {FEATURES.chat && (
                          <button
                            type="button"
                            className="btn secondary venue-hire-application-tile__btn"
                            onClick={() => navigate(`/venues/dashboard/messages?conversationId=${conv.id}`)}
                          >
                            Message
                          </button>
                          )}
                          {isBooker && (
                            <span className="venue-gig-page__hire-booking-pill venue-gig-page__hire-booking-pill--confirmed">Confirmed</span>
                          )}
                          {isDeclinedOther && (
                            <span className="venue-hire-application-tile__status venue-hire-application-tile__status--declined">Declined</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      </>
    );
  };

  const renderVenueHireApplications = () => (
      <>
        {venueHireSwapApplicationsAndGigDetails && isVenueHire && hireId && hireState === 'confirmed'
          ? renderVenueHireConfirmedApplicationsCard()
          : null}
        {isVenueHire && hireId && hireState !== 'confirmed' && (
          <>
            {showVenueHireSendGigDetailsTile ? (
              <SendGigDetailsTile
                bookingLinkUrl={bookingLinkUrl}
                onCopyLink={copyBookingLink}
                linkCopied={linkCopied}
                onInviteArtist={() => setShowVenueHireInviteModal(true)}
                showInviteButton={canUpdate}
              />
            ) : null}
            <div className="venue-hire-confirmed-card venue-hire-confirmed-panel__applications gig-details-tile">
            <div className="venue-hire-confirmed-panel__applications-top">
              <div className="venue-hire-confirmed-panel__applications-title-row">
                <div className="venue-hire-confirmed-panel__applications-title-block fill-this-slot__header fill-this-slot__header--invite-promoter">
                  <MessageIcon />
                  <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter">
                    Applications ({hireApplicationsLoading ? '…' : hireApplications.length})
                  </h3>
                </div>
              </div>
              {renderApplicationsSettingsCogMenu()}
            </div>
            {showApplicationsBookingLimitSettings ? renderApplicationsBookingLimitBlock() : null}
            {hireApplicationsLoading ? (
              <p className="venue-hire-confirmed-card__empty-text">Loading…</p>
            ) : hireApplications.length === 0 ? (
              renderVenueHireApplicationsEmptyState()
            ) : (
              <div className="venue-hire-application-tiles">
                {hireApplications.map((conv) => {
                  const applicant = getApplicantFromConversation(conv);
                  const profileData = applicationProfiles[conv.id];
                  const name = (profileData?.name || applicant?.accountName || conv?.artistName || 'Artist').trim() || 'Artist';
                  const photoUrl = profileData?.picture || applicant?.musicianImg || applicant?.accountImg;
                  const participantId = applicant?.participantId;
                  const isAccepting = acceptingApplicationConvId === conv.id;
                  return (
                    <div key={conv.id} className="venue-hire-application-tile">
                      <div className="venue-hire-application-tile__photo">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="venue-hire-application-tile__img" />
                        ) : (
                          <MicrophoneIcon />
                        )}
                      </div>
                      <div className="venue-hire-application-tile__main">
                        <div className="venue-hire-application-tile__identity">
                          <span className="venue-hire-application-tile__name">{name}</span>
                          {applicationMessagePreviews[conv.id] ? (
                            <p className="venue-hire-application-tile__message">{applicationMessagePreviews[conv.id]}</p>
                          ) : null}
                        </div>
                        <div className="venue-hire-application-tile__actions">
                          {participantId && (
                            <button
                              type="button"
                              className="btn tertiary venue-hire-application-tile__btn"
                              onClick={() => openTechRiderForApplication(participantId)}
                              disabled={applicationsTechRiderLoading}
                            >
                              <TechRiderIcon /> Tech setup
                            </button>
                          )}
                          {participantId && (
                            <button
                              type="button"
                              className="btn tertiary venue-hire-application-tile__btn"
                              onClick={(e) => openInNewTab(`/artist/${participantId}`, e)}
                            >
                              <NewTabIcon /> View profile
                            </button>
                          )}
                          {FEATURES.chat && (
                          <button
                            type="button"
                            className="btn secondary venue-hire-application-tile__btn"
                            onClick={() => navigate(`/venues/dashboard/messages?conversationId=${conv.id}`)}
                          >
                            Message
                          </button>
                          )}
                          {declinedApplicationConvIds.has(conv.id) ? (
                            <span className="venue-hire-application-tile__status venue-hire-application-tile__status--declined">Declined</span>
                          ) : (
                            <>
                              {canUpdate && (
                                <button
                                  type="button"
                                  className="btn accept venue-hire-application-tile__btn"
                                  onClick={() => handleAcceptApplication(conv)}
                                  disabled={isAccepting}
                                >
                                  {isAccepting ? 'Accepting…' : 'Accept'}
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn danger venue-hire-application-tile__btn"
                                onClick={() => handleDeclineApplication(conv)}
                                disabled={decliningApplicationConvId === conv.id}
                              >
                                {decliningApplicationConvId === conv.id ? (
                                  <><LoadingSpinner width={14} height={14} /> Declining…</>
                                ) : (
                                  'Decline'
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>
        )}
        {renderVenueProfileVisibilityTile()}
      </>
  );

  // Artist-booking gigs (both open and confirmed) render a slimmed-down variant of
  // the hire panel: no "Booked by" card (the venue is the booker), an invite tile on
  // top when the gig is still open, a Performers card once anyone's confirmed/added,
  // the Applications card (collapsible when confirmed, like venue-hire confirmed), and
  // the same Tech Setup card used for hires.
  const renderConfirmedActRequirements = () => {
    const slots = sortedArtistBookingSlotGigs.length
      ? sortedArtistBookingSlotGigs
      : (artistBookingSlotGigs?.length ? artistBookingSlotGigs : [rawGig].filter(Boolean));
    const booked = ['confirmed', 'accepted', 'paid', 'payment processing'];
    const acts = [];
    slots.forEach((slot) => {
      (slot?.applicants || []).forEach((applicant) => {
        if (!booked.includes(applicant?.status)) return;
        acts.push({ slot, applicant });
      });
    });
    if (!acts.length) return null;
    return (
      <section className="gig-details-tile">
        <div className="fill-this-slot__header fill-this-slot__header--invite-promoter">
          <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter">Who is playing</h3>
        </div>
        {acts.map(({ slot, applicant }) => {
          const guest = applicant?.type === 'guest' || applicant?.guest === true;
          const name = applicant.name || applicant.artistName || 'Act';
          const compat = guest
            ? computeCompatibility(buildGuestTechRider(applicant), venueForHire?.techRider)
            : null;
          const discussion = (compat?.needsDiscussion || []).map((item) => item.label).filter(Boolean);
          return (
            <div key={`${slot?.gigId || 'slot'}-${applicant.id}`} style={{ padding: '12px 0', borderTop: '1px solid #E5E7EB' }}>
              <strong>{name}</strong>
              <span> · {slotTimeRangeLabel(slot)}</span>
              {guest ? (
                <>
                  <p>Needs from the venue: {(applicant.needs || []).join(', ') || 'None listed'}</p>
                  <p>Bringing: {(applicant.bringOwn || []).join(', ') || 'Nothing listed'}</p>
                  {applicant.note ? <p>Note: {applicant.note}</p> : null}
                  <p>{discussion.length ? `Needs a conversation: ${discussion.join(', ')}` : 'Compatible with the venue kit'}</p>
                </>
              ) : (
                <p>
                  {applicant.techSetup?.compatibilityStatus
                    ? `Tech: ${String(applicant.techSetup.compatibilityStatus).split('_').join(' ')}`
                    : 'No tech rider on this application.'}
                </p>
              )}
            </div>
          );
        })}
      </section>
    );
  };

  const bookingMode = normalisedGig?.bookingMode;
  const status = normalisedGig?.status;
  const isArtistBooking = bookingMode === 'artist_booking' && (status === 'open' || status === 'confirmed');
  if (isArtistBooking) {

    return (
      <>
        <div className="venue-hire-confirmed-panel gig-details-main">
          <RunningOrder
            rawGig={rawGig}
            slots={
              sortedArtistBookingSlotGigs.length
                ? sortedArtistBookingSlotGigs
                : (artistBookingSlotGigs?.length ? artistBookingSlotGigs : [rawGig])
            }
            gigs={gigs}
            onSlotBodyMount={setRunningOrderSlotEl}
          />
          {renderConfirmedActRequirements()}
          <GigMediaPanel gigId={rawGig?.gigId} media={privateBundle?.media || []} hasShareLink={Boolean(privateBundle?.hasShareLink)} canUpdate={canUpdate} />
          <GigApplications
            rawGig={rawGig}
            guestPrivate={privateBundle?.guests || {}}
            setGigInfo={setGigInfo}
            skipHeader
            useCardLayout
            showInvitesModalFromParent={showInvitesModal}
            setShowInvitesModalFromParent={setShowInvitesModal}
            gigs={gigs}
            venues={venues}
            refreshGigs={refreshGigs}
            setShowAddGigsModal={setShowAddGigsModal}
            setAddGigsEditData={setAddGigsEditData}
            setAddGigsMode={setAddGigsMode}
            refreshStripe={refreshStripe}
            customerDetails={customerDetails}
            copyToClipboard={copyToClipboard}
            onInviteArtist={!isArtistBookingFullyBooked ? onInviteArtist : undefined}
            onOpenConfirmGigManually={showConfirmGigManuallyLink ? openConfirmManualModal : undefined}
            onEditManualBooked={showEditManualBookedLink ? openConfirmManualModal : undefined}
            runningOrderSlotTargets={runningOrderSlotEls}
          />
          {renderSoundEngineerAndNotesTiles()}
        </div>

        {applicationsTechRiderProfile && (
          <ApplicantTechSetupModal
            techRider={applicationsTechRiderProfile.techRider}
            artistName={applicationsTechRiderProfile.name}
            venueTechRider={venueForHire?.techRider || null}
            application={isArtistBookingFullyBooked && rawGig?.techSetup ? { techSetup: rawGig.techSetup } : null}
            onClose={() => setApplicationsTechRiderProfile(null)}
          />
        )}

        {showConfirmManualModal && (
          <Portal>
            <div
              className="modal cancel-gig venue-gig-confirm-manual-modal-overlay"
              onClick={() => !confirmManualSaving && setShowConfirmManualModal(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="venue-gig-confirm-manual-title"
            >
              <div
                className="modal-content venue-gig-confirm-manual-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="venue-gig-page__invite-artist-modal-head">
                  <h3 id="venue-gig-confirm-manual-title" className="venue-gig-page__invite-artist-modal-title">
                    Confirm gig manually
                  </h3>
                  <button
                    type="button"
                    className="btn tertiary venue-gig-page__invite-artist-modal-close"
                    onClick={() => !confirmManualSaving && setShowConfirmManualModal(false)}
                    aria-label="Close"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <p className="venue-gig-confirm-manual-modal__intro">
                  Add the artist or promoter who booked this gig outside Gigin. You can pick from My Contacts or type a new name.
                </p>
                <div className="venue-gig-confirm-manual-modal__field">
                  <label className="label" htmlFor="venue-gig-confirm-manual-name">
                    Artist or promoter name
                  </label>
                  <div className="venue-gig-confirm-manual-modal__name-wrap">
                    <input
                      id="venue-gig-confirm-manual-name"
                      type="text"
                      className="input"
                      value={confirmManualName}
                      onChange={(e) => {
                        setConfirmManualName(e.target.value);
                        setConfirmManualPickedCrmId(null);
                        setConfirmManualDropdownOpen(true);
                      }}
                      onFocus={() => setConfirmManualDropdownOpen(true)}
                      placeholder="Search contacts or type a name"
                      autoComplete="off"
                      disabled={confirmManualSaving}
                    />
                    {confirmManualDropdownOpen && filteredConfirmManualCrm.length > 0 && (
                      <ul className="venue-gig-confirm-manual-modal__dropdown" role="listbox">
                        {filteredConfirmManualCrm.map((entry) => (
                          <li key={entry.id} role="option">
                            <button
                              type="button"
                              className="venue-gig-confirm-manual-modal__dropdown-btn"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setConfirmManualName(entry.name || '');
                                setConfirmManualPickedCrmId(entry.id);
                                setConfirmManualDropdownOpen(false);
                              }}
                            >
                              <span className="venue-gig-confirm-manual-modal__dropdown-name">{entry.name || 'Unknown'}</span>
                              {entry.email ? (
                                <span className="venue-gig-confirm-manual-modal__dropdown-sub">{entry.email}</span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {!confirmManualPickedCrmId ? (
                  <label className="venue-gig-confirm-manual-modal__checkbox label">
                    <input
                      type="checkbox"
                      checked={confirmManualAddToContacts}
                      onChange={(e) => setConfirmManualAddToContacts(e.target.checked)}
                      disabled={confirmManualSaving}
                    />
                    <span>Add to My Contacts</span>
                  </label>
                ) : null}
                <div className="venue-gig-confirm-manual-modal__actions">
                  <button
                    type="button"
                    className="btn tertiary"
                    onClick={() => !confirmManualSaving && setShowConfirmManualModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleConfirmManualSave}
                    disabled={confirmManualSaving || !(confirmManualName || '').trim()}
                  >
                    {confirmManualSaving ? 'Saving…' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}
      </>
    );
  }

  const renderVenueHireHirerBookedCard = () => {
    if (!isVenueHire || !bookerName || hireState === 'available') return null;
    const photoUrl = venueHireBookerProfile?.heroMedia?.url;
    const hasTech =
      isBookerGigin &&
      venueHireBookerProfile?.techRider?.isComplete &&
      Array.isArray(venueHireBookerProfile?.techRider?.lineup) &&
      venueHireBookerProfile.techRider.lineup.length > 0;
    const tr = (normalisedGig?.timeRangeLabel && String(normalisedGig.timeRangeLabel).trim()) || (rawGig ? slotTimeRangeLabel(rawGig) : '');
    const timeRange = tr && tr !== '—' ? tr : '';
    const showTimeSuffix = Boolean(timeRange);
    const isPending = hireState === 'pending';

    return (
      <div className="venue-gig-page__booked-strip">
        <div className="venue-gig-booked-section">
          <div className="venue-gig-booked-tile venue-gig-booked-tile--venue-hire-hirer">
            <div className="venue-gig-booked-tile__body">
              <div className="venue-gig-booked-tile__main">
                <div className="venue-gig-booked-tile__identity">
                  <span className="venue-gig-booked-tile__name">{bookerName}</span>
                  <p className="venue-gig-booked-tile__set-line">
                    <span className="venue-gig-booked-tile__set-label">Venue hire</span>
                    {showTimeSuffix ? <span className="venue-gig-booked-tile__time-range"> · {timeRange}</span> : null}
                    {isPending ? (
                      <span className="venue-gig-applications-set-tab__status-pill venue-gig-booked-tile__booked-pill venue-gig-booked-tile__booked-pill--pending">
                        Pending
                      </span>
                    ) : (
                      <span className="venue-gig-applications-set-tab__status-pill venue-gig-booked-tile__booked-pill">Booked</span>
                    )}
                  </p>
                </div>
                <div className="venue-gig-booked-tile__actions">
                  {FEATURES.chat && isBookerGigin && bookerConversation ? (
                    <button
                      type="button"
                      className="btn secondary venue-gig-booked-tile__btn"
                      onClick={() => navigate(`/venues/dashboard/messages?conversationId=${bookerConversation.id}`)}
                    >
                      <MessageIcon /> Message
                    </button>
                  ) : null}
                  {isBookerGigin && rawGig?.hirerUserId && hasTech ? (
                    <button
                      type="button"
                      className="btn tertiary venue-gig-booked-tile__btn"
                      onClick={() => openTechRiderForApplication(rawGig.hirerUserId)}
                      disabled={applicationsTechRiderLoading}
                    >
                      <TechRiderIcon /> Tech setup
                    </button>
                  ) : null}
                  {isBookerGigin && rawGig?.hirerUserId ? (
                    <button
                      type="button"
                      className="btn tertiary venue-gig-booked-tile__btn"
                      onClick={(e) => openInNewTab(`/artist/${rawGig.hirerUserId}`, e)}
                    >
                      <NewTabIcon /> View profile
                    </button>
                  ) : null}
                  {!isBookerGigin && canUpdate ? (
                    <button type="button" className="btn tertiary venue-gig-booked-tile__btn" onClick={openEditBooker}>
                      Edit
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="venue-gig-booked-tile__photo">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="venue-gig-booked-tile__img" />
                ) : (
                  <MicrophoneIcon />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderVenueHireGigDetailsProgrammeTile = () => {
    // Timing info (access → curfew) is already shown in the Gig Summary sidebar — hide this redundant body tile.
    return null;
  };

  return (
    <>
      <div className="venue-hire-confirmed-panel">
        {renderVenueHireHirerBookedCard()}

        {/* Performers first for confirmed/pending venue hires */}
        {hireState !== 'available' && (
        <div className="venue-hire-performers">
          <div className="venue-hire-confirmed-card venue-hire-performers__card">
            <h3 className="venue-hire-confirmed-card__title">
              <span className="venue-hire-confirmed-card__title-inner">Performers ({performerCount})</span>
            </h3>
          {performerCount === 0 ? (
            <div className="venue-hire-performers__empty">
              <div className="venue-hire-confirmed-card__empty">
                {canUpdate && (
                  <AddPerformersButton
                    onClick={() => {
                      setAddPerformerQuery('');
                      setAddPerformerShowCrmList(false);
                      setAddPerformerSelectedIds([]);
                      setShowAddPerformersModal(true);
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="venue-hire-performer-tiles">
                {performerItems.map((performer, index) => {
                  const displayName = performer.displayName || (performer.contactId ? crmNamesById[performer.contactId] : '') || 'Unknown';
                  const isGigin = performer.source === 'gigin' && (performer.userId || performer.artistId);
                  const secondaryText = isGigin ? 'On Gigin' : (performer.contactId ? 'CRM contact' : 'Manually entered');
                  const key = performer.userId || performer.artistId || performer.contactId || `manual-${index}`;
                  const isInContacts = !!performer.contactId;
                  return (
                    <div key={key} className="venue-hire-performer-tile">
                      <div className="venue-hire-performer-tile__left">
                        <span className="venue-hire-performer-tile__name">{displayName}</span>
                        <div className="venue-hire-performer-tile__meta-row">
                          <span className="venue-hire-performer-tile__meta">{secondaryText}</span>
                          {!isInContacts && canUpdate && (
                            <button
                              type="button"
                              className="venue-hire-performer-tile__edit-link"
                              onClick={() => {
                                setEditingPerformerIndex(index);
                                setAddPerformerQuery(displayName);
                                setAddPerformerShowCrmList(false);
                                setAddPerformerSelectedIds([]);
                                setShowAddPerformersModal(true);
                              }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="venue-hire-performer-tile__actions">
                        {isInContacts ? (
                          <button
                            type="button"
                            className="btn tertiary venue-hire-performer-tile__btn"
                            onClick={() => setContactModalEntryId(performer.contactId)}
                          >
                            Contact
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn tertiary venue-hire-performer-tile__btn"
                            onClick={() => {
                              setAddToContactsPerformerIndex(index);
                              setShowAddToContactsModal(true);
                            }}
                          >
                            Add to contacts
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {canUpdate && (
                <div className="venue-hire-performers__add-wrap">
                  <AddPerformersButton
                    onClick={() => {
                      setAddPerformerQuery('');
                      setAddPerformerShowCrmList(false);
                      setAddPerformerSelectedIds([]);
                      setShowAddPerformersModal(true);
                    }}
                  />
                </div>
              )}
            </>
          )}
          </div>
        </div>
        )}

        {venueHireSwapApplicationsAndGigDetails ? (
          <div
            ref={(el) => onVenueHireGigDetailsPortalMount?.(el)}
            className="venue-hire-gig-details-portal-target"
          />
        ) : null}
        {venueHireSwapApplicationsAndGigDetails && venueHireApplicationsPortalContainer
          ? createPortal(renderVenueHireApplications(), venueHireApplicationsPortalContainer)
          : !venueHireSwapApplicationsAndGigDetails
            ? renderVenueHireApplications()
            : null}
        {isVenueHire && hireId ? (
          <>
            <div className="gig-details-tile-row gig-details-tile-row--tech-span">
              <div className="gig-details-tile gig-details-tile--tech-wide">
                <VenueHireTechSetupMainCard
                  rawGig={rawGig}
                  normalisedGig={normalisedGig}
                  setGigInfo={setGigInfo}
                  refreshGigs={refreshGigs}
                  venues={venues}
                />
              </div>
            </div>

            <div className="gig-details-main">
              {renderVenueHireGigDetailsProgrammeTile()}
              <div className="gig-details-tile-row">
                <div className="gig-details-tile gig-details-tile--documents gig-details-tile--half">
                  <div className="fill-this-slot__header fill-this-slot__header--invite-promoter">
                    <DocumentsIcon />
                    <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter">Documents</h3>
                  </div>
                  {combinedListingDocuments.length === 0 ? (
                    <p className="gig-details-tile__empty">No documents attached to this listing.</p>
                  ) : (
                    <ul className="gig-details-doc-list">
                      {combinedListingDocuments.map((doc, i) => (
                        <li key={doc.key || `doc-${i}`} className="gig-details-doc-row">
                          <div className="gig-details-doc-row__main">
                            <span className="gig-details-doc-row__title">{doc.title || 'Document'}</span>
                            {doc.signed === true ? (
                              <span className="gig-details-doc-row__signed gig-details-doc-row__signed--yes" title="Signed">
                                Signed
                              </span>
                            ) : null}
                          </div>
                          {doc.sourceUrl ? (
                            <a
                              href={doc.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn tertiary gig-details-doc-row__download"
                              download
                              aria-label={`Download ${doc.title || 'document'}`}
                              title="Download"
                            >
                              <DownloadIcon />
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {renderSoundEngineerAndNotesTiles()}
              {!venueHireSwapApplicationsAndGigDetails ? renderVenueHireConfirmedApplicationsCard() : null}
            </div>
          </>
        ) : null}
      </div>

      {applicationsTechRiderProfile && (
        <ApplicantTechSetupModal
          techRider={applicationsTechRiderProfile.techRider}
          artistName={applicationsTechRiderProfile.name}
          venueTechRider={venueForHire?.techRider || null}
          application={hireState === 'confirmed' && rawGig?.techSetup ? { techSetup: rawGig.techSetup } : null}
          onClose={() => setApplicationsTechRiderProfile(null)}
        />
      )}

      {showEditBookerModal && (
        <Portal>
          <div className="modal" onClick={() => setShowEditBookerModal(false)} role="dialog" aria-modal="true">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>{bookerName ? 'Booker' : 'Confirm manually'}</h3>
                <button type="button" className="btn icon" onClick={() => setShowEditBookerModal(false)} aria-label="Close">
                  <CloseIcon />
                </button>
              </div>
              <label className="label" style={{ display: 'block', marginBottom: 8 }}>Name</label>
              <input
                type="text"
                className="input"
                value={editBookerName}
                onChange={(e) => setEditBookerName(e.target.value)}
                placeholder="Booker or hirer name"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn tertiary" onClick={() => setShowEditBookerModal(false)}>Cancel</button>
                <button type="button" className="btn primary" onClick={handleSaveBooker} disabled={savingBooker}>
                  {savingBooker ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showVenueHireInviteModal ? (
        <InviteArtistPromoterTile
          showHeader={false}
          bookingLinkUrl={bookingLinkUrl}
          onCopyLink={onCopyBookingLink ?? copyBookingLink}
          linkCopied={linkCopied}
          showManualOption={false}
          initialPopup="contacts"
          hideInlineShareButton
          submodalOnly
          onPopupClose={() => setShowVenueHireInviteModal(false)}
          contactsBody={(
                  <div className="invite-and-share-modal__list fill-this-slot__contacts-list">
                    {crmLoading ? (
                      <LoadingSpinner />
                    ) : !crmEntries?.length ? (
                      <p className="invite-and-share-modal__empty">No contacts yet. Add contacts in My Contacts.</p>
                    ) : (
                      crmEntries.map((entry) => {
                        const invited = invitedContactIds.has(entry.id);
                        const inviting = invitingContactId === entry.id;
                        return (
                          <div key={entry.id} className="invite-and-share-modal__row">
                            <div className="invite-and-share-modal__row-info">
                              <span className="invite-and-share-modal__row-name">{entry.name || 'Unknown'}</span>
                              <span className="invite-and-share-modal__row-sub">
                                {entry.artistId ? 'On Gigin' : entry.email || 'No email'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn tertiary invite-and-share-modal__row-btn"
                              onClick={() => inviteContactToHire(entry)}
                              disabled={invited || inviting}
                            >
                              {invited ? <><TickIcon /> Invited</> : inviting ? 'Inviting…' : 'Invite'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
          )}
          emailBody={(
                  <>
                    <div className="fill-this-slot__share-row">
                      <input
                        type="email"
                        className="input fill-this-slot__input"
                        placeholder="Email address"
                        value={emailInviteInput}
                        onChange={(e) => {
                          setEmailInviteInput(e.target.value);
                          setEmailInviteError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && sendInviteByEmail()}
                        aria-label="Email address"
                        aria-invalid={!!emailInviteError}
                      />
                      <button
                        type="button"
                        className="btn secondary fill-this-slot__copy-btn"
                        onClick={sendInviteByEmail}
                        disabled={emailInviteSending}
                      >
                        {emailInviteSending ? 'Sending…' : 'Invite'}
                      </button>
                    </div>
                    {emailInviteError ? (
                      <p
                        className="fill-this-slot__helper fill-this-slot__helper--above-input"
                        style={{ color: 'var(--gn-red-800)', marginTop: 6 }}
                      >
                        {emailInviteError}
                      </p>
                    ) : null}
                  </>
          )}
        />
      ) : null}

      <AddPerformersModal
        isOpen={showAddPerformersModal}
        onClose={() => {
          setShowAddPerformersModal(false);
          setAddPerformerQuery('');
          setAddPerformerShowCrmList(false);
          setAddPerformerSelectedIds([]);
          setEditingPerformerIndex(null);
        }}
        addPerformerQuery={addPerformerQuery}
        setAddPerformerQuery={setAddPerformerQuery}
        addPerformerShowCrmList={addPerformerShowCrmList}
        setAddPerformerShowCrmList={setAddPerformerShowCrmList}
        addPerformerSelectedIds={addPerformerSelectedIds}
        toggleCrmSelection={(entryId) =>
          setAddPerformerSelectedIds((prev) =>
            prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
          )
        }
        addPerformerSaving={addPerformerSaving}
        onAddFromTextBox={handleAddPerformerFromTextBox}
        onAddFromCrmList={handleAddSelectedFromCrmList}
        crmLoading={crmLoading}
        filteredCrmEntries={filteredCrmEntries}
        noCrmMessage={
          availableCrmEntries.length === 0 && crmEntries.length > 0
            ? 'All CRM artists are already added.'
            : 'No artists in CRM yet.'
        }
        editMode={editingPerformerIndex !== null}
        onSaveEdit={handleSaveEditPerformer}
        onRemoveEdit={handleRemovePerformer}
      />
      <AddToContactsModal
        isOpen={showAddToContactsModal}
        onClose={() => {
          setShowAddToContactsModal(false);
          setAddToContactsPerformerIndex(null);
        }}
        initialName={
          addToContactsPerformerIndex != null && performerItems[addToContactsPerformerIndex] != null
            ? (performerItems[addToContactsPerformerIndex].displayName ||
                (performerItems[addToContactsPerformerIndex].contactId ? crmNamesById[performerItems[addToContactsPerformerIndex].contactId] : '') ||
                '')
            : ''
        }
        onSave={handleAddToContactsSave}
        saving={addToContactsSaving}
      />
      <ContactDetailsModal
        isOpen={contactModalEntryId != null}
        onClose={() => setContactModalEntryId(null)}
        entry={crmEntries.find((e) => e.id === contactModalEntryId) || null}
      />
    </>
  );
}
