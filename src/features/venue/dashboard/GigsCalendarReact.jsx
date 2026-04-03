import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { format } from 'date-fns';
import 'react-calendar/dist/Calendar.css';
import '@styles/host/gigs-calendar-react.styles.css';
import { getArtistProfileById, getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { hasVenuePerm } from '@services/utils/permissions';
import { updateGigDocument } from '@services/api/gigs';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { postCancellationMessage } from '@services/api/messages';
import Portal from '../../shared/components/Portal';
import { InviteAndShareModal } from '../components/InviteAndShareModal';
import { FillThisSlotModal } from '../components/FillThisSlotModal';
import { CloseIcon, LinkIcon, NewTabIcon, EditIcon, CancelIcon, DeleteGigIcon, InviteIcon } from '../../shared/ui/extras/Icons';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getDisplayName(applicant, applicantNames) {
  if (!applicant) return null;
  return (
    applicant.profileName ??
    applicant.name ??
    applicant.musicianName ??
    (applicant.id && applicantNames ? applicantNames[applicant.id] : null) ??
    null
  );
}

function applicantBookedForCalendar(a) {
  return a && ['confirmed', 'paid', 'accepted'].includes(a.status);
}

/** Whether this gig/slot counts as “booked” for calendar grouping (artist vs rental rules). */
function gigHasCalendarBookedSlot(gig) {
  if (!gig) return false;
  const rental = gig.itemType === 'venue_hire' || gig.bookingMode === 'rental' || gig.kind === 'Venue Rental';
  if (rental) return (gig.applicants || []).some((a) => a.status === 'confirmed');
  return (gig.applicants || []).some(applicantBookedForCalendar);
}

function getGigCalendarLabel(gig, applicantNames = {}) {
  const isPast = gig.status === 'past';
  const timeStr = gig.startTime || '—';

  const isRental = gig.itemType === 'venue_hire' || gig.bookingMode === 'rental' || gig.kind === 'Venue Rental';
  const hasRenterName = !!(gig.renterName && String(gig.renterName).trim());
  const hasRentalApplicantConfirmed = isRental && (gig.applicants || []).some((a) => a.status === 'confirmed');
  const hasArtistBooked = !isRental && (gig.applicants || []).some(applicantBookedForCalendar);
  const isHired = hasRenterName || hasRentalApplicantConfirmed || hasArtistBooked;

  if (isHired) {
    const confirmedApplicants = (gig.applicants || []).filter((a) =>
      isRental ? a.status === 'confirmed' : applicantBookedForCalendar(a)
    );
    const count = confirmedApplicants.length;
    const title =
      hasRenterName && !hasRentalApplicantConfirmed && !hasArtistBooked
        ? String(gig.renterName).trim() || 'Hired'
        : count > 1
          ? `${count} Artists`
          : getDisplayName(confirmedApplicants[0], applicantNames) || 'Artist';
    const status = 'Confirmed';
    return {
      title,
      time: timeStr,
      status,
      isPast,
    };
  }

  const hasMultipleSlots = Array.isArray(gig.gigSlots) && gig.gigSlots.length > 0;
  return {
    title: isRental ? 'For Hire' : (hasMultipleSlots ? 'Looking for artists' : 'Looking for artist'),
    time: timeStr,
    status: 'Unbooked',
    isPast,
  };
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateIso) {
  if (!dateIso) return '—';
  const d = new Date(dateIso + 'T12:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function getPrimaryGig(groupGigs) {
  if (!groupGigs?.length) return null;
  const sorted = [...groupGigs].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  return sorted[0];
}

/** True if this gig/item is a venue hire (rental or venue hire opportunity from venueHireOpportunities). */
function isVenueHireRental(gig) {
  if (!gig) return false;
  return gig.itemType === 'venue_hire' || gig.kind === 'Venue Rental' || gig.bookingMode === 'rental';
}

/** True if this gig is a venue hire (rental) with a confirmed hirer (renterName set). */
function isConfirmedVenueHire(gig) {
  if (!gig) return false;
  const hasRenter = !!(gig.renterName && String(gig.renterName).trim());
  return isVenueHireRental(gig) && hasRenter;
}

/** True if this gig is a venue hire (rental) but not yet confirmed (no hirer or hirer not confirmed). */
function isUnconfirmedVenueHire(gig) {
  return isVenueHireRental(gig) && !isConfirmedVenueHire(gig);
}

/** True if this gig is an artist booking (book and pay artist(s)), not venue hire. */
function isArtistBooking(gig) {
  return !isVenueHireRental(gig);
}

/**
 * Whether the booking is linked to a Gigin account/thread (vs manually entered).
 * Uses existing data: conversation exists for this gig + venue user.
 */
async function isBookedViaGigin(gigId, userId) {
  if (!gigId || !userId) return { bookedViaGigin: false, conversation: null };
  const convs = await getConversationsByParticipantAndGigId(gigId, userId);
  const conversation = convs.length > 0 ? convs[0] : null;
  return { bookedViaGigin: !!conversation, conversation };
}

function formatHireDateLine(dateIso, startTime, endTimeOrDuration) {
  if (!dateIso) return '—';
  const d = new Date(dateIso + 'T12:00:00');
  if (isNaN(d.getTime())) return '—';
  const dateStr = format(d, 'EEE d MMM');
  if (!startTime) return dateStr;
  let endTime = endTimeOrDuration;
  if (typeof endTimeOrDuration === 'number') {
    const [h, m] = (startTime || '0:0').split(':').map(Number);
    const totalMins = h * 60 + m + endTimeOrDuration;
    const eh = Math.floor(totalMins / 60) % 24;
    const em = totalMins % 60;
    endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  }
  return endTime ? `${dateStr} • ${startTime}–${endTime}` : `${dateStr} • ${startTime}`;
}

function normalizeTimeForDisplay(timeStr) {
  if (!timeStr || !String(timeStr).trim()) return '';
  const parts = String(timeStr).trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] ?? '0', 10);
  if (!Number.isFinite(h)) return String(timeStr).trim().slice(0, 5);
  return `${String(h).padStart(2, '0')}:${String(Number.isFinite(m) ? m : 0).padStart(2, '0')}`;
}

/** End HH:MM from start time + duration (minutes); same day wrap at midnight as existing calendar logic. */
function endTimeFromStartAndDuration(startTime, durationMinutes) {
  if (!startTime || !String(startTime).trim() || !(Number(durationMinutes) > 0)) return '';
  const [h, m] = String(startTime).trim().split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const totalMins = h * 60 + (Number.isFinite(m) ? m : 0) + Number(durationMinutes);
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

/**
 * Popup meta line: first slot start through last slot end, e.g. "19:30 – 22:00".
 * Uses allGigs when grouped; falls back to primaryGig only.
 */
function formatArtistBookingMetaTimeRange(allGigs, primaryGig) {
  const list = Array.isArray(allGigs) && allGigs.length ? allGigs : primaryGig ? [primaryGig] : [];
  const timed = list.filter(
    (g) => g && String(g.startTime ?? '').trim() && Number(g.duration) > 0
  );
  if (!timed.length) return null;
  const sorted = [...timed].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startDisp = normalizeTimeForDisplay(first.startTime);
  const endDisp = endTimeFromStartAndDuration(last.startTime, last.duration);
  if (!startDisp || !endDisp) return null;
  return `${startDisp} – ${endDisp}`;
}

/** Calendar pill line 1: time span for artist bookings (matches venue hire “start – end” line). */
function formatArtistCalendarPillLine1(allGigs, primaryGig) {
  return (
    formatArtistBookingMetaTimeRange(allGigs, primaryGig) ||
    normalizeTimeForDisplay(primaryGig?.startTime) ||
    '—'
  );
}

function slotHasBookedArtistForCalendar(gig) {
  return (gig.applicants || []).some(applicantBookedForCalendar);
}

/** Last-seen pending applicant count per multi-slot artist group (calendar popup + pills). */
const ARTIST_GIG_PENDING_SEEN_KEY = 'gigin-artist-gig-pending-seen';

/** Pending applications not yet acknowledged via opening the gig popup (same rules as popup). */
function getArtistCalendarUnseenApplicationCount(allGigs) {
  if (!Array.isArray(allGigs) || allGigs.length === 0 || typeof localStorage === 'undefined') return 0;

  const byGroup = new Map();
  allGigs.forEach((gig) => {
    if (!gig) return;
    const k = gig._groupKey ?? gig.gigId;
    if (k == null || k === '') return;
    const key = String(k);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(gig);
  });

  let totalNew = 0;
  byGroup.forEach((gigs) => {
    const totalPending = gigs.reduce(
      (sum, gig) => sum + (gig.applicants || []).filter((a) => a?.status === 'pending').length,
      0
    );
    if (totalPending <= 0) return;
    const groupKey = String(gigs[0]._groupKey ?? gigs[0].gigId ?? '');
    if (!groupKey) return;
    const seen = parseInt(localStorage.getItem(`${ARTIST_GIG_PENDING_SEEN_KEY}-${groupKey}`), 10);
    const newCount = Number.isNaN(seen) ? totalPending : Math.max(0, totalPending - seen);
    totalNew += newCount;
  });
  return totalNew;
}

export function GigsCalendarReact({
  gigs = [],
  onDeleteGigs,
  onDeleteHireOpportunities,
  onAddGigForDate,
  venues = [],
  user,
  refreshGigs,
  copyToClipboard,
  setAddGigsEditData,
  setShowAddGigsModal,
  setShowInvitesModal,
  setSelectedGigForInvites,
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState(new Date());
  const [applicantNames, setApplicantNames] = useState({});
  const [pendingDeleteGigIds, setPendingDeleteGigIds] = useState(null);
  const [pendingDeleteHireIds, setPendingDeleteHireIds] = useState(null);
  const [selectedGigDetail, setSelectedGigDetail] = useState(null);
  const [detailNotesValue, setDetailNotesValue] = useState('');
  const [detailSoundManagerValue, setDetailSoundManagerValue] = useState('');
  const [detailEditingNotes, setDetailEditingNotes] = useState(false);
  const [detailEditingSoundManager, setDetailEditingSoundManager] = useState(false);
  /** For confirmed venue hire popup: conversation if booked via Gigin. */
  const [hireConversation, setHireConversation] = useState(null);
  const [hireConversationLoading, setHireConversationLoading] = useState(false);
  /** Cancel booking confirm: show modal, notify booker checkbox. */
  const [hireCancelConfirm, setHireCancelConfirm] = useState(null);
  const [hireCancelNotifyBooker, setHireCancelNotifyBooker] = useState(true);
  /** Unconfirmed venue hire: delete confirm (gigId or null). */
  const [unconfirmedHireDeleteConfirm, setUnconfirmedHireDeleteConfirm] = useState(null);
  /** For dates with multiple gigs: which pill index is shown (0-based). Key = dateKey (yyyy-mm-dd). */
  const [visiblePillIndexByDate, setVisiblePillIndexByDate] = useState({});
  /** Gig to show in Invite & Share modal (artist booking or venue hire). */
  const [inviteShareGig, setInviteShareGig] = useState(null);
  /** Application counts for unbooked venue hires (hireId -> count). */
  const [hireApplicationCounts, setHireApplicationCounts] = useState({});

  const gigsByDate = useMemo(() => {
    const flat = Array.isArray(gigs)
      ? gigs.flatMap((g) => {
          const list = g.allGigs ? g.allGigs : [g.primaryGig || g];
          const groupKey = g.primaryGig?.gigId ?? g.allGigs?.[0]?.gigId ?? list[0]?.gigId;
          return list.map((gig) => (gig ? { ...gig, _groupKey: groupKey } : null)).filter(Boolean);
        })
      : [];
    const byDate = {};
    flat.forEach((gig) => {
      const iso = gig.dateIso;
      if (!iso) return;
      if (!byDate[iso]) byDate[iso] = [];
      byDate[iso].push(gig);
    });
    return byDate;
  }, [gigs]);

  // Fetch profile names for confirmed single-artist applicants that don't have a name on the gig
  const applicantIdsToFetch = useMemo(() => {
    const flat = Array.isArray(gigs) ? gigs.flatMap((g) => (g.allGigs ? g.allGigs : [g.primaryGig || g])) : [];
    const ids = new Set();
    flat.forEach((gig) => {
      const confirmedApplicants = (gig.applicants || []).filter((a) => a.status === 'confirmed');
      if (confirmedApplicants.length !== 1 || !confirmedApplicants[0]?.id) return;
      const a = confirmedApplicants[0];
      if (a.profileName ?? a.name ?? a.musicianName) return;
      ids.add(a.id);
    });
    return Array.from(ids);
  }, [gigs]);

  useEffect(() => {
    if (applicantIdsToFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const id of applicantIdsToFetch) {
        if (cancelled) return;
        let profile = await getArtistProfileById(id);
        if (!profile) profile = await getMusicianProfileByMusicianId(id);
        const name = profile?.name ?? null;
        if (name) next[id] = name;
      }
      if (!cancelled) setApplicantNames((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [applicantIdsToFetch]);

  // When opening a confirmed venue hire popup, resolve whether it's booked via Gigin.
  useEffect(() => {
    if (!selectedGigDetail?.primaryGig || !isConfirmedVenueHire(selectedGigDetail.primaryGig) || !user?.uid) {
      setHireConversation(null);
      setHireConversationLoading(false);
      setHireCancelConfirm(null);
      return;
    }
    const primaryGig = selectedGigDetail.primaryGig;
    setHireConversationLoading(true);
    setHireConversation(null);
    let cancelled = false;
    isBookedViaGigin(primaryGig.gigId, user.uid).then(({ conversation }) => {
      if (!cancelled) {
        setHireConversation(conversation);
        setHireConversationLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedGigDetail?.primaryGig?.gigId, user?.uid]);

  // Reset Invite & Share modal when gig detail modal opens or closes (avoids stale state).
  useEffect(() => {
    setInviteShareGig(null);
  }, [selectedGigDetail?.primaryGig?.gigId, selectedGigDetail]);

  // Unbooked venue hire IDs (for fetching application counts).
  const unbookedHireIds = useMemo(() => {
    const ids = new Set();
    if (!Array.isArray(gigs) || !user?.uid) return [];
    gigs.forEach((g) => {
      const list = g.allGigs ?? (g.primaryGig ? [g.primaryGig] : []);
      list.forEach((gig) => {
        if (!gig || gig.itemType !== 'venue_hire') return;
        if (gig.renterName && String(gig.renterName).trim()) return;
        const id = gig.gigId ?? gig.hireSpaceId;
        if (id) ids.add(id);
      });
    });
    return Array.from(ids);
  }, [gigs, user?.uid]);

  // Fetch application (conversation) counts for unbooked venue hires.
  useEffect(() => {
    if (unbookedHireIds.length === 0 || !user?.uid) return;
    let cancelled = false;
    const next = {};
    (async () => {
      for (const hireId of unbookedHireIds) {
        if (cancelled) return;
        const convs = await getConversationsByParticipantAndGigId(hireId, user.uid);
        next[hireId] = (convs || []).length;
      }
      if (!cancelled) setHireApplicationCounts((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [unbookedHireIds, user?.uid]);

  const formatShortWeekday = (_, date) => WEEKDAY_LABELS[date.getDay()];

  /** Format venue hire time range for pill line 1: "start – end" or just "start" */
  function formatVenueHireTimeRange(gig) {
    const start = gig?.startTime?.trim() || gig?.rentalAccessFrom?.trim();
    const end = gig?.rentalHardCurfew?.trim() || gig?.curfew?.trim() || gig?.endTime?.trim();
    if (!start) return '—';
    if (!end) return start;
    return `${start} – ${end}`;
  }

  const HIRE_SEEN_KEY = 'gigin-hire-seen';
  function getHireApplicationLine(pill) {
    if (pill.itemType !== 'venue_hire' || pill.status !== 'Unbooked') return null;
    const gigsToCount = pill.allGigs ?? (pill.primaryGig ? [pill.primaryGig] : []);
    let total = 0;
    let newCount = 0;
    gigsToCount.forEach((gig) => {
      const id = gig?.gigId ?? gig?.hireSpaceId;
      if (!id) return;
      const count = hireApplicationCounts[id] ?? 0;
      total += count;
      const seen = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem(`${HIRE_SEEN_KEY}-${id}`), 10) : NaN;
      if (!Number.isNaN(seen)) newCount += Math.max(0, count - seen);
      else if (count > 0) newCount += count;
    });
    if (total === 0) return null;
    if (newCount > 0) return newCount === 1 ? '1 new application' : `${newCount} new applications`;
    return total === 1 ? '1 application' : `${total} applications`;
  }

  /** Unseen new hire applications (same localStorage rules as getHireApplicationLine). */
  function getHireUnseenNewApplicationCount(pill) {
    if (pill.itemType !== 'venue_hire' || pill.status !== 'Unbooked') return 0;
    const gigsToCount = pill.allGigs ?? (pill.primaryGig ? [pill.primaryGig] : []);
    let newCount = 0;
    gigsToCount.forEach((gig) => {
      const id = gig?.gigId ?? gig?.hireSpaceId;
      if (!id) return;
      const count = hireApplicationCounts[id] ?? 0;
      if (count <= 0) return;
      const seen = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem(`${HIRE_SEEN_KEY}-${id}`), 10) : NaN;
      if (!Number.isNaN(seen)) newCount += Math.max(0, count - seen);
      else newCount += count;
    });
    return newCount;
  }

  const tileContent = ({ date }) => {
    const dateKey = formatDateKey(date);
    const dayGigs = gigsByDate[dateKey] || [];
    // Collapse multiple past unbooked slots from the same gig into one "Unbooked" pill
    const byGroup = new Map();
    dayGigs.forEach((gig) => {
      const key = gig._groupKey ?? gig.gigId;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(gig);
    });
    const pills = [];
    byGroup.forEach((groupGigs, groupKey) => {
      const allPastUnbooked =
        groupGigs.length > 1 &&
        groupGigs.every((g) => g.status === 'past' && !gigHasCalendarBookedSlot(g));
      const primaryGig = getPrimaryGig(groupGigs);
      if (allPastUnbooked) {
        const n = groupGigs.length;
        const isRental = primaryGig?.itemType === 'venue_hire' || primaryGig?.bookingMode === 'rental' || primaryGig?.kind === 'Venue Rental';
        const title = isRental
          ? (n > 1 ? `For hire (0/${n})` : 'For Hire')
          : (n > 1 ? `Looking for artists (0/${n})` : 'Looking for artist');
        pills.push({
          key: `group-${groupKey}`,
          title,
          time: primaryGig?.startTime || '',
          status: 'Unbooked',
          isPast: true,
          gigIds: groupGigs.map((g) => g.gigId),
          primaryGig,
          allGigs: groupGigs,
          itemType: isRental ? 'venue_hire' : undefined,
        });
      } else if (groupGigs.length > 1) {
        // Multiple sets (same gig group): line 1 = time range, line 2 = X/Y booked (like venue hire pills)
        const confirmedCount = groupGigs.filter((g) => slotHasBookedArtistForCalendar(g)).length;
        const totalCount = groupGigs.length;
        const unbookedCount = totalCount - confirmedCount;
        const allConfirmed = confirmedCount === totalCount;
        const title =
          allConfirmed
            ? `${totalCount} Artists`
            : unbookedCount === 1
              ? 'Looking for artist'
              : 'Looking for artists';
        const status = `${confirmedCount}/${totalCount} booked`;
        const isRentalGroup =
          primaryGig?.itemType === 'venue_hire' ||
          primaryGig?.bookingMode === 'rental' ||
          primaryGig?.kind === 'Venue Rental';
        const unseenAppCount = !isRentalGroup ? getArtistCalendarUnseenApplicationCount(groupGigs) : 0;
        pills.push({
          key: `group-${groupKey}`,
          title,
          time: primaryGig?.startTime || '—',
          status,
          isAllConfirmed: allConfirmed,
          isPast: groupGigs[0]?.status === 'past',
          primaryGig,
          allGigs: groupGigs,
          ...(!isRentalGroup && { calendarArtistLine1: formatArtistCalendarPillLine1(groupGigs, primaryGig) }),
          ...(unseenAppCount > 0 && { artistCalendarUnseenAppCount: unseenAppCount }),
        });
      } else {
        const gig = groupGigs[0];
        const { title, time, status, isPast } = getGigCalendarLabel(gig, applicantNames);
        const isPastUnbooked = isPast && status === 'Unbooked';
        const isVenueHire = gig.itemType === 'venue_hire';
        const unseenAppCount = !isVenueHire ? getArtistCalendarUnseenApplicationCount([gig]) : 0;
        pills.push({
          key: gig.gigId ?? gig.hireSpaceId,
          title,
          time,
          status,
          isPast,
          gigIds: isPastUnbooked ? [gig.gigId ?? gig.hireSpaceId] : undefined,
          itemType: isVenueHire ? 'venue_hire' : undefined,
          primaryGig: gig,
          allGigs: [gig],
          ...(!isVenueHire && { calendarArtistLine1: formatArtistCalendarPillLine1([gig], gig) }),
          ...(unseenAppCount > 0 && { artistCalendarUnseenAppCount: unseenAppCount }),
        });
      }
    });

    // Merge multiple unbooked pills on this day into one "Looking for artists (0/N)"
    const unbookedPills = pills.filter((p) => p.status === 'Unbooked');
    const confirmedPills = pills.filter((p) => p.status !== 'Unbooked');
    const mergedUnbookedAllGigs =
      unbookedPills.length > 1 ? unbookedPills.flatMap((p) => p.allGigs || []) : [];
    const mergedUnbookedUnseenCount =
      unbookedPills.length > 1 && !unbookedPills[0].itemType
        ? getArtistCalendarUnseenApplicationCount(mergedUnbookedAllGigs)
        : 0;
    const finalPills =
      unbookedPills.length > 1
        ? [
            ...confirmedPills,
            {
              key: 'unbooked-merged',
              title: `Looking for artists (0/${unbookedPills.length})`,
              time: unbookedPills[0].time,
              status: 'Unbooked',
              isPast: unbookedPills[0].isPast,
              gigIds: unbookedPills[0].isPast ? unbookedPills.flatMap((p) => p.gigIds || (p.primaryGig ? [p.primaryGig.gigId] : [])) : undefined,
              primaryGig: unbookedPills[0].primaryGig,
              allGigs: mergedUnbookedAllGigs,
              itemType: unbookedPills[0].itemType,
              ...(!unbookedPills[0].itemType && {
                calendarArtistLine1: formatArtistCalendarPillLine1(
                  unbookedPills[0].allGigs || [unbookedPills[0].primaryGig],
                  unbookedPills[0].primaryGig
                ),
              }),
              ...(mergedUnbookedUnseenCount > 0 && { artistCalendarUnseenAppCount: mergedUnbookedUnseenCount }),
            },
          ]
        : pills;

    const hasMultiplePills = finalPills.length > 1;
    const currentIndex = hasMultiplePills
      ? Math.min(Math.max(visiblePillIndexByDate[dateKey] ?? 0, 0), finalPills.length - 1)
      : 0;
    const pillsToShow = hasMultiplePills ? [finalPills[currentIndex]] : finalPills;

    return (
      <>
        <div className="gigs-calendar-react__day-hover-area" aria-hidden="true" />
        {hasMultiplePills && (
          <div className="gigs-calendar-react__day-gig-nav" onClick={(e) => e.stopPropagation()}>
            {currentIndex > 0 && (
              <button
                type="button"
                className="gigs-calendar-react__day-gig-nav-btn gigs-calendar-react__day-gig-nav-btn--prev"
                aria-label="Previous gig"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setVisiblePillIndexByDate((prev) => ({
                    ...prev,
                    [dateKey]: currentIndex - 1,
                  }));
                }}
              >
                ‹
              </button>
            )}
            <span className="gigs-calendar-react__day-gig-nav-label">
              {currentIndex + 1}/{finalPills.length}
            </span>
            {currentIndex < finalPills.length - 1 && (
              <button
                type="button"
                className="gigs-calendar-react__day-gig-nav-btn gigs-calendar-react__day-gig-nav-btn--next"
                aria-label="Next gig"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setVisiblePillIndexByDate((prev) => ({
                    ...prev,
                    [dateKey]: currentIndex + 1,
                  }));
                }}
              >
                ›
              </button>
            )}
          </div>
        )}
        <div className={`gigs-calendar-react__day-gigs ${hasMultiplePills ? 'gigs-calendar-react__day-gigs--has-nav' : ''}`}>
          {pillsToShow.map((pill) => {
            const hireUnseenNewCount =
              pill.itemType === 'venue_hire' && pill.status === 'Unbooked'
                ? getHireUnseenNewApplicationCount(pill)
                : 0;
            const hireHasUnseenNewApplications = hireUnseenNewCount > 0;
            return (
            <div
              key={pill.key}
              role="button"
              tabIndex={0}
              className={`gigs-calendar-react__day-gig ${((pill.status === 'Confirmed' || pill.status === 'Hired') || pill.isAllConfirmed) ? 'gigs-calendar-react__day-gig--confirmed' : ''} ${pill.isPast ? 'gigs-calendar-react__day-gig--past' : ''} ${pill.isPast && pill.status === 'Unbooked' ? 'gigs-calendar-react__day-gig--past-unbooked' : ''} ${pill.calendarArtistLine1 && !pill.itemType && !(pill.isPast && pill.status === 'Unbooked') ? 'gigs-calendar-react__day-gig--artist-booking-two-line' : ''} ${pill.artistCalendarUnseenAppCount > 0 ? 'gigs-calendar-react__day-gig--artist-new-pending' : ''} ${hireHasUnseenNewApplications ? 'gigs-calendar-react__day-gig--hire-new-pending' : ''} ${pill.gigIds?.length ? 'gigs-calendar-react__day-gig--deletable' : ''} gigs-calendar-react__day-gig--clickable`}
              onClick={(e) => {
                e.stopPropagation();
                if (e.target.closest('.gigs-calendar-react__day-gig-delete')) return;
                if (pill.primaryGig) {
                  setDetailNotesValue(pill.primaryGig.notes || '');
                  setDetailSoundManagerValue(pill.primaryGig.soundManager || '');
                  setDetailEditingNotes(false);
                  setDetailEditingSoundManager(false);
                  setSelectedGigDetail({ primaryGig: pill.primaryGig, allGigs: pill.allGigs });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.target.closest('.gigs-calendar-react__day-gig-delete')) return;
                  if (pill.primaryGig) {
                    setDetailNotesValue(pill.primaryGig.notes || '');
                    setDetailSoundManagerValue(pill.primaryGig.soundManager || '');
                    setDetailEditingNotes(false);
                    setDetailEditingSoundManager(false);
                    setSelectedGigDetail({ primaryGig: pill.primaryGig, allGigs: pill.allGigs });
                  }
                }
              }}
            >
              {pill.itemType === 'venue_hire' ? (
                /* Venue hire: line 1 "[start – end]"; line 2 unbooked; orange dot top-right when unseen new applications */
                <>
                  {hireHasUnseenNewApplications ? (
                    <span className="gigs-calendar-react__day-gig-pill-new-badge" aria-hidden="true" />
                  ) : null}
                  <div className="gigs-calendar-react__day-gig-title">
                    {formatVenueHireTimeRange(pill.primaryGig)}
                  </div>
                  <div
                    className={`gigs-calendar-react__day-gig-meta${
                      hireHasUnseenNewApplications ? ' gigs-calendar-react__day-gig-meta--artist-new-apps' : ''
                    }`.trim()}
                  >
                    {pill.status === 'Unbooked'
                      ? (() => {
                          const line = getHireApplicationLine(pill);
                          if (hireHasUnseenNewApplications && line) {
                            return (
                              <span className="gigs-calendar-react__day-gig-applications-line gigs-calendar-react__day-gig-applications-line--has-new">
                                {`• ${line}`}
                              </span>
                            );
                          }
                          return line || 'Unbooked';
                        })()
                      : pill.title}
                  </div>
                </>
              ) : pill.isPast && pill.status === 'Unbooked' ? (
                <div className="gigs-calendar-react__day-gig-meta gigs-calendar-react__day-gig-meta--only">
                  {pill.time !== '—' && pill.time ? `${pill.time} • ` : ''}{pill.status}
                </div>
              ) : pill.calendarArtistLine1 && !pill.itemType ? (
                <>
                  {pill.artistCalendarUnseenAppCount > 0 ? (
                    <span className="gigs-calendar-react__day-gig-pill-new-badge" aria-hidden="true" />
                  ) : null}
                  <div className="gigs-calendar-react__day-gig-title">{pill.calendarArtistLine1}</div>
                  <div
                    className={`gigs-calendar-react__day-gig-meta${pill.artistCalendarUnseenAppCount > 0 ? ' gigs-calendar-react__day-gig-meta--artist-new-apps' : ''}`.trim()}
                  >
                    {pill.artistCalendarUnseenAppCount > 0
                      ? (pill.artistCalendarUnseenAppCount === 1
                        ? '• 1 new application'
                        : `• ${pill.artistCalendarUnseenAppCount} new applications`)
                      : pill.status === 'Confirmed'
                        ? pill.title
                        : pill.key === 'unbooked-merged'
                          ? pill.title
                          : pill.status}
                  </div>
                </>
              ) : (
                <>
                  <div className="gigs-calendar-react__day-gig-title">{pill.title}</div>
                  <div className="gigs-calendar-react__day-gig-meta">
                    {pill.time !== '—' && pill.time ? `${pill.time} • ` : ''}{pill.status}
                  </div>
                </>
              )}
              {pill.gigIds?.length && (onDeleteGigs || onDeleteHireOpportunities) && (
                <span
                  role="button"
                  tabIndex={0}
                  className="gigs-calendar-react__day-gig-delete"
                  aria-label={pill.itemType === 'venue_hire' ? 'Delete venue hire' : 'Delete gig'}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (pill.itemType === 'venue_hire') {
                      setPendingDeleteHireIds(pill.gigIds);
                    } else {
                      setPendingDeleteGigIds(pill.gigIds);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (pill.itemType === 'venue_hire') {
                        setPendingDeleteHireIds(pill.gigIds);
                      } else {
                        setPendingDeleteGigIds(pill.gigIds);
                      }
                    }
                  }}
                >
                  ×
                </span>
              )}
            </div>
            );
          })}
        </div>
        <span className="gigs-calendar-react__day-add-wrap">
          <span
            role="button"
            tabIndex={0}
            className="gigs-calendar-react__day-add"
            aria-label="Add gig"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddGigForDate?.(dateKey);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onAddGigForDate?.(dateKey);
              }
            }}
          >
            +
          </span>
        </span>
      </>
    );
  };

  const handleClickDay = (date) => {
    const dateKey = formatDateKey(date);
    const dayGigs = gigsByDate[dateKey] || [];
    if (dayGigs.length === 0 && onAddGigForDate) {
      onAddGigForDate(dateKey);
    }
  };

  const tileClassName = ({ date }) => {
    const dateKey = formatDateKey(date);
    const dayGigs = gigsByDate[dateKey] || [];
    return dayGigs.length === 0 ? 'gigs-calendar-react__tile--add-on-click' : '';
  };

  return (
    <div className="gigs-calendar-react">
      <Calendar
        value={value}
        onChange={setValue}
        onClickDay={handleClickDay}
        tileClassName={tileClassName}
        locale="en-GB"
        minDetail="month"
        maxDetail="month"
        prev2Label={null}
        next2Label={null}
        showFixedNumberOfWeeks={false}
        formatShortWeekday={formatShortWeekday}
        tileContent={tileContent}
      />
      {pendingDeleteGigIds && (
        <Portal>
          <div
            className="modal cancel-gig"
            onClick={() => setPendingDeleteGigIds(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-unbooked-gig-title"
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 id="remove-unbooked-gig-title">Do you want to remove this unbooked gig?</h3>
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setPendingDeleteGigIds(null)}>No</button>
                <button type="button" className="btn danger" onClick={() => { onDeleteGigs?.(pendingDeleteGigIds); setPendingDeleteGigIds(null); }}>Yes</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {pendingDeleteHireIds && (
        <Portal>
          <div
            className="modal cancel-gig"
            onClick={() => setPendingDeleteHireIds(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-hire-title"
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 id="remove-hire-title">Do you want to remove this venue hire opportunity?</h3>
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setPendingDeleteHireIds(null)}>No</button>
                <button type="button" className="btn danger" onClick={() => { onDeleteHireOpportunities?.(pendingDeleteHireIds); setPendingDeleteHireIds(null); }}>Yes</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {selectedGigDetail && (() => {
        const { primaryGig, allGigs } = selectedGigDetail;
        const showVenueHirePopup = isConfirmedVenueHire(primaryGig) || isUnconfirmedVenueHire(primaryGig);
        const isConfirmedHire = isConfirmedVenueHire(primaryGig);
        const hasRenter = !!(primaryGig.renterName && String(primaryGig.renterName).trim());
        const applicantCount = allGigs.reduce((sum, g) => sum + (g.applicants?.length || 0), 0);
        const canUpdate = hasVenuePerm(venues, primaryGig.venueId, 'gigs.update');
        const gigLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/gig/${primaryGig.gigId}`;
        const openFullScreen = () => {
          setSelectedGigDetail(null);
          navigate('/venues/dashboard/gigs/gig-applications', { state: { gig: primaryGig } });
        };
        const endTime = primaryGig.rentalHardCurfew || (primaryGig.startTime && primaryGig.duration != null
            ? (() => {
              const [h, m] = primaryGig.startTime.split(':').map(Number);
              const totalMins = h * 60 + (m || 0) + primaryGig.duration;
              const eh = Math.floor(totalMins / 60) % 24;
              const em = totalMins % 60;
              return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
            })()
            : null);

        if (showVenueHirePopup) {
          const bookedViaGigin = isConfirmedHire && !!hireConversation;
          /** Show Edit gig only when no booker yet, or booker is manually entered (not confirmed via Gigin). */
          const isBookerManual = !hasRenter || primaryGig.hirerType === 'manual' || !primaryGig.hirerType;
          const showEditGigHire = isBookerManual;
          const handleCancelBooking = async () => {
            if (!hireCancelConfirm || !canUpdate) return;
            try {
              if (bookedViaGigin && hireCancelNotifyBooker && hireConversation?.id) {
                await postCancellationMessage({
                  conversationId: hireConversation.id,
                  senderId: user.uid,
                  message: 'This venue hire booking has been cancelled. The slot is now available again.',
                  cancellingParty: 'venue',
                });
              }
              await updateGigDocument({
                gigId: primaryGig.gigId,
                action: 'gigs.update',
                updates: { renterName: null, status: 'open' },
              });
              toast.success('Booking cancelled.');
              setHireCancelConfirm(null);
              setSelectedGigDetail(null);
              refreshGigs?.();
            } catch (err) {
              console.error(err);
              toast.error('Failed to cancel booking.');
            }
          };

          const handleInviteToApply = () => {
            setSelectedGigDetail(null);
            setInviteShareGig(primaryGig);
          };
          const handleHirePrivateToggle = async (e) => {
            if (!canUpdate) return;
            const newPrivate = e.target.checked;
            try {
              await updateGigDocument({
                gigId: primaryGig.gigId,
                action: 'gigs.update',
                updates: { private: newPrivate },
              });
              toast.success(newPrivate ? 'Invite-only' : 'Open for applications');
              refreshGigs?.();
              setSelectedGigDetail((prev) =>
                prev ? { ...prev, primaryGig: { ...prev.primaryGig, private: newPrivate } } : null
              );
            } catch (err) {
              console.error(err);
              toast.error('Failed to update.');
            }
          };
          const hireIsInviteOnly = !!primaryGig.private;
          const handleUnconfirmedDelete = () => {
            const id = primaryGig?.hireSpaceId ?? primaryGig?.gigId;
            if (!id) return;
            if (primaryGig?.itemType === 'venue_hire') {
              onDeleteHireOpportunities?.([id]);
            } else {
              onDeleteGigs?.([primaryGig.gigId]);
            }
            setUnconfirmedHireDeleteConfirm(null);
            setSelectedGigDetail(null);
            refreshGigs?.();
          };

          return (
            <Portal>
              <div
                className="modal cancel-gig gigs-calendar-react__gig-detail-modal gigs-calendar-react__venue-hire-modal"
                onClick={() => { setHireCancelConfirm(null); setUnconfirmedHireDeleteConfirm(null); setSelectedGigDetail(null); }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="venue-hire-modal-title"
              >
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <header className="gigs-calendar-react__venue-hire-header">
                    <h2 id="venue-hire-modal-title" className="gigs-calendar-react__venue-hire-title">Venue hire</h2>
                    <div className="gigs-calendar-react__venue-hire-header-right">
                      <button type="button" className="btn primary gigs-calendar-react__venue-hire-open-booking-btn" onClick={openFullScreen}>
                        View gig details
                      </button>
                    </div>
                  </header>
                  {(() => {
                    const venueName = primaryGig.venueId && venues?.length ? (venues.find((v) => v.venueId === primaryGig.venueId)?.name || '') : '';
                    const dateTimeLine = formatHireDateLine(primaryGig.dateIso, primaryGig.rentalAccessFrom || primaryGig.startTime, primaryGig.rentalHardCurfew || (primaryGig.duration != null ? primaryGig.duration : endTime));
                    return (
                      <div className="gigs-calendar-react__venue-hire-meta">
                        {venueName ? <p className="gigs-calendar-react__venue-hire-venue-name">{venueName}</p> : null}
                        <p className="gigs-calendar-react__venue-hire-datetime">{dateTimeLine}</p>
                      </div>
                    );
                  })()}

                  <section className="gigs-calendar-react__venue-hire-section">
                    {(hasRenter || isConfirmedHire) && <h4 className="gigs-calendar-react__venue-hire-section-title">Booked by</h4>}
                    <div className="gigs-calendar-react__venue-hire-booked-row">
                      {hasRenter || isConfirmedHire ? (
                        <p className="gigs-calendar-react__venue-hire-booked-name">
                          {isConfirmedHire
                            ? ((primaryGig.renterName && String(primaryGig.renterName).trim()) || '—')
                            : (primaryGig.renterName && String(primaryGig.renterName).trim()) || '—'}
                        </p>
                      ) : null}
                      <span className={`gigs-calendar-react__venue-hire-status-pill gigs-calendar-react__venue-hire-status-pill--${isConfirmedHire ? 'confirmed' : hasRenter ? 'ready' : 'available'}`}>
                        {isConfirmedHire ? 'Confirmed' : hasRenter ? 'Ready to confirm' : 'Unbooked'}
                      </span>
                    </div>
                    {!hasRenter && !isConfirmedHire && (() => {
                      const hireId = primaryGig.id ?? primaryGig.gigId;
                      const total = hireApplicationCounts[hireId] ?? 0;
                      if (total === 0) return null;
                      const seen = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem(`${HIRE_SEEN_KEY}-${hireId}`), 10) : NaN;
                      const newCount = Number.isNaN(seen) ? total : Math.max(0, total - seen);
                      const hasNew = newCount > 0;
                      const text = hasNew
                        ? (newCount === 1 ? '• 1 new application' : `• ${newCount} new applications`)
                        : (total === 1 ? '1 application' : `${total} applications`);
                      return (
                        <p className={`gigs-calendar-react__venue-hire-applications-line ${hasNew ? 'gigs-calendar-react__venue-hire-applications-line--new' : ''}`}>
                          {text}
                        </p>
                      );
                    })()}
                    {isConfirmedHire && (() => {
                      const hasDeposit = primaryGig.rentalDepositRequired === true || primaryGig.depositRequired === true || (primaryGig.depositAmount != null && primaryGig.depositAmount !== '');
                      const hireFeeRaw = String(primaryGig.hireFee ?? primaryGig.rentalFee ?? primaryGig.budget ?? '').trim().toLowerCase();
                      const hireFeeNumeric = Number(hireFeeRaw.replace(/[^\d.]/g, ''));
                      const hasPayableHireFee = !!hireFeeRaw && hireFeeRaw !== 'free' && (Number.isFinite(hireFeeNumeric) ? hireFeeNumeric > 0 : true);
                      return (
                        <div className="gigs-calendar-react__venue-hire-payment-status">
                          {hasDeposit && (
                            <p className="gigs-calendar-react__venue-hire-deposit-status">
                              Deposit: {primaryGig.depositStatus === 'paid' || primaryGig.depositPaid === true ? 'Paid' : (primaryGig.depositPaid === false || primaryGig.depositStatus === 'unpaid' ? 'Unpaid' : '—')}
                            </p>
                          )}
                        {hasPayableHireFee && (
                          <p className="gigs-calendar-react__venue-hire-fee-status">
                            Hire fee: {primaryGig.hireFeePaid === true ? 'Paid' : 'Unpaid'}
                          </p>
                        )}
                        </div>
                      );
                    })()}
                  </section>
                </div>
              </div>

              {hireCancelConfirm && (
                <Portal>
                  <div
                    className="modal cancel-gig"
                    onClick={() => setHireCancelConfirm(null)}
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <h3>Cancel booking?</h3>
                      {hireCancelConfirm.bookedViaGigin && (
                        <label className="gigs-calendar-react__venue-hire-cancel-notify">
                          <input
                            type="checkbox"
                            checked={hireCancelNotifyBooker}
                            onChange={(e) => setHireCancelNotifyBooker(e.target.checked)}
                          />
                          <span>Notify booker</span>
                        </label>
                      )}
                      <div className="two-buttons" style={{ marginTop: '1rem' }}>
                        <button type="button" className="btn tertiary" onClick={() => setHireCancelConfirm(null)}>Keep booking</button>
                        <button type="button" className="btn danger" onClick={handleCancelBooking}>Cancel booking</button>
                      </div>
                    </div>
                  </div>
                </Portal>
              )}

              {unconfirmedHireDeleteConfirm && (
                <Portal>
                  <div
                    className="modal cancel-gig"
                    onClick={() => setUnconfirmedHireDeleteConfirm(null)}
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <h3>Delete this gig?</h3>
                      <p>This slot will be removed. This action cannot be undone.</p>
                      <div className="two-buttons" style={{ marginTop: '1rem' }}>
                        <button type="button" className="btn tertiary" onClick={() => setUnconfirmedHireDeleteConfirm(null)}>Keep</button>
                        <button type="button" className="btn danger" onClick={handleUnconfirmedDelete}>Delete</button>
                      </div>
                    </div>
                  </div>
                </Portal>
              )}

            </Portal>
          );
        }

        if (isArtistBooking(primaryGig)) {
          const confirmedArtists = allGigs.flatMap((g) =>
            (g.applicants || [])
              .filter((a) => a.status === 'confirmed' || a.status === 'paid' || a.status === 'accepted')
              .map((a) => a.name || a.profileName || 'Artist')
          );
          const totalSlots = Math.max(1, allGigs.length);
          const bookedCount = allGigs.filter((g) =>
            (g.applicants || []).some((a) =>
              a.status === 'confirmed' || a.status === 'paid' || a.status === 'accepted'
            )
          ).length;
          const totalPending = allGigs.reduce(
            (sum, g) => sum + (g.applicants || []).filter((a) => a.status === 'pending').length,
            0
          );
          const artistGroupKey = primaryGig._groupKey ?? primaryGig.gigId ?? '';
          let artistApplicationLine = null;
          let artistApplicationLineIsNew = false;
          if (totalPending > 0 && artistGroupKey) {
            const seen =
              typeof localStorage !== 'undefined'
                ? parseInt(localStorage.getItem(`${ARTIST_GIG_PENDING_SEEN_KEY}-${artistGroupKey}`), 10)
                : NaN;
            const newCount = Number.isNaN(seen) ? totalPending : Math.max(0, totalPending - seen);
            artistApplicationLineIsNew = newCount > 0;
            artistApplicationLine = artistApplicationLineIsNew
              ? (newCount === 1 ? '• 1 new application' : `• ${newCount} new applications`)
              : totalPending === 1
                ? '1 application'
                : `${totalPending} applications`;
          }
          let artistStatusPillVariant = 'available';
          if (bookedCount >= totalSlots) {
            artistStatusPillVariant = 'confirmed';
          } else if (bookedCount > 0) {
            artistStatusPillVariant = 'ready';
          }
          const artistSlotsBookedLabel = `${bookedCount}/${totalSlots} ${totalSlots === 1 ? 'slot' : 'slots'} booked`;
          const openArtistGigFullScreen = () => {
            if (typeof localStorage !== 'undefined' && artistGroupKey) {
              localStorage.setItem(`${ARTIST_GIG_PENDING_SEEN_KEY}-${artistGroupKey}`, String(totalPending));
            }
            setSelectedGigDetail(null);
            navigate('/venues/dashboard/gigs/gig-applications', { state: { gig: primaryGig } });
          };

          return (
            <>
            <Portal>
              <div
                className="modal cancel-gig gigs-calendar-react__gig-detail-modal gigs-calendar-react__artist-booking-modal"
                onClick={() => setSelectedGigDetail(null)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="artist-booking-modal-title"
              >
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <header className="gigs-calendar-react__venue-hire-header">
                    <h2 id="artist-booking-modal-title" className="gigs-calendar-react__venue-hire-title">
                      {primaryGig.gigName || 'Gig'}
                    </h2>
                    <div className="gigs-calendar-react__venue-hire-header-right">
                      <button type="button" className="btn primary gigs-calendar-react__venue-hire-open-booking-btn" onClick={openArtistGigFullScreen}>
                        View gig details
                      </button>
                    </div>
                  </header>
                  {(() => {
                    const venueName = primaryGig.venueId && venues?.length ? (venues.find((v) => v.venueId === primaryGig.venueId)?.name || '') : '';
                    const dateIso = primaryGig.dateIso;
                    const d = dateIso ? new Date(`${dateIso}T12:00:00`) : null;
                    const dateStr = !d || isNaN(d.getTime()) ? '—' : format(d, 'EEE d MMM');
                    const timeRangeStr = formatArtistBookingMetaTimeRange(allGigs, primaryGig);
                    let timePart = '';
                    if (timeRangeStr) {
                      timePart = timeRangeStr;
                    } else if (primaryGig.startTime) {
                      const dur = primaryGig.duration;
                      if (dur != null && dur !== '' && Number(dur) > 0) {
                        timePart = `${normalizeTimeForDisplay(primaryGig.startTime)} • ${dur} min`;
                      } else {
                        timePart = normalizeTimeForDisplay(primaryGig.startTime);
                      }
                    }
                    const dateTimeLine = timePart ? `${dateStr} • ${timePart}` : dateStr;
                    return (
                      <div className="gigs-calendar-react__venue-hire-meta">
                        {venueName ? <p className="gigs-calendar-react__venue-hire-venue-name">{venueName}</p> : null}
                        <p className="gigs-calendar-react__venue-hire-datetime">{dateTimeLine}</p>
                      </div>
                    );
                  })()}

                  <section className="gigs-calendar-react__venue-hire-section">
                    <div className="gigs-calendar-react__venue-hire-booked-row gigs-calendar-react__artist-booking-booked-row">
                      <span
                        className={`gigs-calendar-react__venue-hire-status-pill gigs-calendar-react__venue-hire-status-pill--${artistStatusPillVariant}`}
                      >
                        {artistSlotsBookedLabel}
                      </span>
                    </div>
                    {artistApplicationLine ? (
                      <p
                        className={`gigs-calendar-react__venue-hire-applications-line ${artistApplicationLineIsNew ? 'gigs-calendar-react__venue-hire-applications-line--new' : ''}`.trim()}
                      >
                        {artistApplicationLine}
                      </p>
                    ) : null}
                    {confirmedArtists.length > 0 ? (
                      <>
                        <h4 className="gigs-calendar-react__venue-hire-section-title">Artist(s)</h4>
                        <p className="gigs-calendar-react__gig-detail-value">{confirmedArtists.join(', ')}</p>
                      </>
                    ) : null}
                  </section>

                </div>
              </div>
            </Portal>
              {unconfirmedHireDeleteConfirm && (
                <Portal>
                  <div
                    className="modal cancel-gig"
                    onClick={() => setUnconfirmedHireDeleteConfirm(null)}
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <h3>Delete this gig?</h3>
                      <p>This slot will be removed. This action cannot be undone.</p>
                      <div className="two-buttons" style={{ marginTop: '1rem' }}>
                        <button type="button" className="btn tertiary" onClick={() => setUnconfirmedHireDeleteConfirm(null)}>Keep</button>
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => {
                            onDeleteGigs?.([unconfirmedHireDeleteConfirm]);
                            setUnconfirmedHireDeleteConfirm(null);
                            setSelectedGigDetail(null);
                            refreshGigs?.();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </Portal>
              )}
          </>
          );
        }

        const handleSaveNotes = async () => {
          if (!canUpdate) return;
          try {
            await Promise.all(
              allGigs.map((g) =>
                updateGigDocument({
                  gigId: g.gigId,
                  action: 'gigs.update',
                  updates: { notes: detailNotesValue.trim() || null },
                })
              )
            );
            toast.success('Notes updated.');
            setDetailEditingNotes(false);
            refreshGigs?.();
          } catch (err) {
            console.error(err);
            toast.error('Failed to update notes.');
          }
        };
        const handleSaveSoundManager = async () => {
          if (!canUpdate) return;
          try {
            await Promise.all(
              allGigs.map((g) =>
                updateGigDocument({
                  gigId: g.gigId,
                  action: 'gigs.update',
                  updates: { soundManager: detailSoundManagerValue.trim() || null },
                })
              )
            );
            toast.success('Sound manager updated.');
            setDetailEditingSoundManager(false);
            refreshGigs?.();
          } catch (err) {
            console.error(err);
            toast.error('Failed to update sound manager.');
          }
        };
        const handlePrivateToggle = async (e) => {
          if (!canUpdate) return;
          const newPrivate = e.target.checked;
          try {
            await Promise.all(
              allGigs.map((g) =>
                updateGigDocument({
                  gigId: g.gigId,
                  action: 'gigs.update',
                  updates: { private: newPrivate },
                })
              )
            );
            toast.success(`Gig changed to ${newPrivate ? 'Invite Only' : 'Public'}.`);
            refreshGigs?.();
            setSelectedGigDetail((prev) =>
              prev ? { ...prev, primaryGig: { ...prev.primaryGig, private: newPrivate } } : null
            );
          } catch (err) {
            console.error(err);
            toast.error('Failed to update.');
          }
        };
        return (
          <Portal>
            <div
              className="modal cancel-gig gigs-calendar-react__gig-detail-modal"
              onClick={() => setSelectedGigDetail(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="gig-detail-title"
            >
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 id="gig-detail-title" className="gigs-calendar-react__gig-detail-title">
                  {primaryGig.gigName || 'Gig'}
                </h3>
                <div className="gigs-calendar-react__gig-detail-grid">
                  <div className="gigs-calendar-react__gig-detail-row">
                    <span className="gigs-calendar-react__gig-detail-label">Date</span>
                    <span>{formatDisplayDate(primaryGig.dateIso)}</span>
                  </div>
                  <div className="gigs-calendar-react__gig-detail-row">
                    <span className="gigs-calendar-react__gig-detail-label">Time</span>
                    <span>
                      {formatArtistBookingMetaTimeRange(allGigs, primaryGig)
                        || (primaryGig.startTime ? normalizeTimeForDisplay(primaryGig.startTime) : '—')}
                    </span>
                  </div>
                  <div className="gigs-calendar-react__gig-detail-row">
                    <span className="gigs-calendar-react__gig-detail-label">Duration</span>
                    <span>{primaryGig.duration != null ? `${primaryGig.duration} min` : '—'}</span>
                  </div>
                </div>
                <div className="gigs-calendar-react__gig-detail-actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={openFullScreen}
                  >
                    {applicantCount === 0
                      ? 'View gig'
                      : applicantCount === 1
                        ? '1 Applicant'
                        : `${applicantCount} Applicants`}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={openFullScreen}
                    title="Open gig applications full screen"
                  >
                    <NewTabIcon /> Open full screen
                  </button>
                </div>
                <div className="gigs-calendar-react__gig-detail-section">
                  <h4 className="gigs-calendar-react__gig-detail-section-title">Notes</h4>
                  {detailEditingNotes ? (
                    <div className="gigs-calendar-react__gig-detail-edit">
                      <textarea
                        className="input"
                        value={detailNotesValue}
                        onChange={(e) => setDetailNotesValue(e.target.value)}
                        rows={3}
                      />
                      <div className="gigs-calendar-react__gig-detail-edit-actions">
                        <button type="button" className="btn tertiary" onClick={() => setDetailEditingNotes(false)}>
                          Cancel
                        </button>
                        <button type="button" className="btn primary" onClick={handleSaveNotes}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`gigs-calendar-react__gig-detail-box ${canUpdate ? 'gigs-calendar-react__gig-detail-box--editable' : ''}`}
                      onClick={() => canUpdate && setDetailEditingNotes(true)}
                    >
                      {detailNotesValue || '—'}
                      {canUpdate && <span className="gigs-calendar-react__gig-detail-hint">Click to edit</span>}
                    </div>
                  )}
                </div>
                <div className="gigs-calendar-react__gig-detail-section">
                  <h4 className="gigs-calendar-react__gig-detail-section-title">Sound manager</h4>
                  {detailEditingSoundManager ? (
                    <div className="gigs-calendar-react__gig-detail-edit">
                      <textarea
                        className="input"
                        value={detailSoundManagerValue}
                        onChange={(e) => setDetailSoundManagerValue(e.target.value)}
                        rows={2}
                      />
                      <div className="gigs-calendar-react__gig-detail-edit-actions">
                        <button type="button" className="btn tertiary" onClick={() => setDetailEditingSoundManager(false)}>
                          Cancel
                        </button>
                        <button type="button" className="btn primary" onClick={handleSaveSoundManager}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`gigs-calendar-react__gig-detail-box ${canUpdate ? 'gigs-calendar-react__gig-detail-box--editable' : ''}`}
                      onClick={() => canUpdate && setDetailEditingSoundManager(true)}
                    >
                      {detailSoundManagerValue || '—'}
                      {canUpdate && <span className="gigs-calendar-react__gig-detail-hint">Click to edit</span>}
                    </div>
                  )}
                </div>
                <div className="gigs-calendar-react__gig-detail-section">
                  <h4 className="gigs-calendar-react__gig-detail-section-title">Gig link</h4>
                  <div className="gigs-calendar-react__gig-detail-link-row">
                    <span className="gigs-calendar-react__gig-detail-link">{gigLink}</span>
                    <button
                      type="button"
                      className="btn icon"
                      onClick={() => copyToClipboard?.(gigLink)}
                      title="Copy link"
                    >
                      <LinkIcon />
                    </button>
                  </div>
                </div>
                <div className="gigs-calendar-react__gig-detail-section">
                  <div className="gigs-calendar-react__gig-detail-invite-row">
                    <span className="gigs-calendar-react__gig-detail-label">Invite only</span>
                    <label className="gigs-toggle-switch">
                      <input
                        type="checkbox"
                        checked={primaryGig.private || false}
                        disabled={!canUpdate}
                        onChange={handlePrivateToggle}
                      />
                      <span className="gigs-toggle-slider" />
                    </label>
                  </div>
                </div>
                <div className="two-buttons" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn tertiary" onClick={() => setSelectedGigDetail(null)}>
                    Close
                  </button>
                  <button type="button" className="btn primary" onClick={openFullScreen}>
                    Open gig applications full screen
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        );
      })()}
      {inviteShareGig && inviteShareGig.itemType === 'venue_hire' && (
        <FillThisSlotModal
          gig={inviteShareGig}
          venues={venues}
          user={user}
          refreshGigs={refreshGigs}
          onClose={() => setInviteShareGig(null)}
        />
      )}
      {inviteShareGig && inviteShareGig.itemType !== 'venue_hire' && (
        <InviteAndShareModal
          gig={inviteShareGig}
          venues={venues}
          user={user}
          onClose={() => setInviteShareGig(null)}
          refreshGigs={refreshGigs}
        />
      )}
    </div>
  );
}
