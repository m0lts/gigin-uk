import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '@styles/host/venue-gig-page.styles.css';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import Portal from '@features/shared/components/Portal';
import { LeftArrowIcon, LinkIcon, InviteIconSolid, CalendarIconLight, LocationPinIcon, RightChevronIcon } from '@features/shared/ui/extras/Icons';
import { ArtistFillThisSlotTile } from '@features/venue/gigs/components/ArtistFillThisSlotTile';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { getLocalGigDateTime } from '@services/utils/filtering';
import { getGigsByIds, deleteGigsBatch } from '@services/client-side/gigs';
import { updateGigDocument } from '@services/api/gigs';
import { updateVenueHireOpportunity, deleteVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { postCancellationMessage } from '@services/api/messages';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { hasVenuePerm } from '@services/utils/permissions';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { normaliseGig } from '../utils/normaliseGig';
import { findSlotSiblingsFromFlatGigs, isArtistBookingNightFullyBooked } from '../utils/multiSlotGigGroup';
import { BookingSummarySidebar } from '../components/BookingSummarySidebar';
import { GigInvitesModal } from '../../components/GigInvitesModal';
import { GigOptionsMenu } from '../../components/GigOptionsMenu';
import { getMainPanelComponent } from './panels';

function calculateEndTime(startTime, duration) {
  if (!startTime || duration == null) return null;
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = (h || 0) * 60 + (m || 0) + (duration || 0);
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

async function isBookedViaGigin(gigId, userId) {
  if (!gigId || !userId) return { bookedViaGigin: false, conversation: null };
  const convs = await getConversationsByParticipantAndGigId(gigId, userId);
  const conversation = convs.length > 0 ? convs[0] : null;
  return { bookedViaGigin: !!conversation, conversation };
}

/** Dashboard list payloads sometimes omit `gigSlots`; navigation state usually has it for multi-set nights. */
function pickGigSlotsForMerge(listGig, navGig) {
  if (Array.isArray(listGig?.gigSlots) && listGig.gigSlots.length > 0) return listGig.gigSlots;
  if (Array.isArray(navGig?.gigSlots) && navGig.gigSlots.length > 0) return navGig.gigSlots;
  return listGig?.gigSlots ?? navGig?.gigSlots;
}

function sortGigSlotsByStartTime(a, b) {
  if (!a?.startTime || !b?.startTime) return 0;
  const [aH, aM] = a.startTime.split(':').map(Number);
  const [bH, bM] = b.startTime.split(':').map(Number);
  return aH * 60 + (aM || 0) - (bH * 60 + (bM || 0));
}

/** Unique slot docs by gigId (avoids duplicate Set 1 when anchor gig also appears in `relatedSlots`). */
function dedupeGigSlots(slots) {
  const byId = new Map();
  (slots || []).forEach((g) => {
    const id = g?.gigId || g?.id;
    if (id) byId.set(id, { ...g, gigId: id });
  });
  return [...byId.values()].sort(sortGigSlotsByStartTime);
}

function gigFirestoreDateToPlain(dateField) {
  if (!dateField) return null;
  if (typeof dateField.toDate === 'function') return dateField.toDate();
  if (dateField instanceof Date) return dateField;
  if (typeof dateField === 'string') {
    const parsed = new Date(dateField);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (dateField.seconds != null) return new Date(dateField.seconds * 1000);
  return null;
}

const ARTIST_BOOKING_PILL_LABELS = {
  confirmed: 'Confirmed',
  awaiting: 'Awaiting payment',
  negotiating: 'Negotiating',
  open: 'Open for applications',
  closed: 'Closed',
  played: 'Played',
  expired: 'Expired · unbooked',
  dispute: 'In dispute',
};

function slotIsNegotiating(slot) {
  const applicants = slot?.applicants || [];
  return applicants.some((applicant) =>
    applicant?.status === 'pending'
    && (applicant.conversationId || (applicant.proposedFee && slot.budgetValue && applicant.proposedFee !== slot.budgetValue))
  ) || applicants.some((applicant) => applicant?.status === 'accepted' && applicant.conversationId);
}

/** Same pill as the gigs table: `consolePillKey` + `PILL_LABELS` in Gigs / GigsConsole. */
function artistBookingStatusPill(slots, now) {
  const primary = slots?.[0];
  if (!primary) return { key: 'open', label: ARTIST_BOOKING_PILL_LABELS.open };
  if (primary.status === 'in dispute' || primary.disputeLogged) {
    return { key: 'dispute', label: ARTIST_BOOKING_PILL_LABELS.dispute };
  }
  const dateTime = getLocalGigDateTime(primary);
  if (dateTime && dateTime < now) {
    if (primary.status === 'expired') return { key: 'expired', label: ARTIST_BOOKING_PILL_LABELS.expired };
    return { key: 'played', label: ARTIST_BOOKING_PILL_LABELS.played };
  }
  const list = slots.length ? slots : [primary];
  const confirmed = (slot) => (slot.applicants || []).some((applicant) => applicant?.status === 'confirmed');
  if (list.every(confirmed)) return { key: 'confirmed', label: ARTIST_BOOKING_PILL_LABELS.confirmed };
  if (list.some((slot) => (slot.applicants || []).some((applicant) => applicant?.status === 'accepted'))) {
    return { key: 'awaiting', label: ARTIST_BOOKING_PILL_LABELS.awaiting };
  }
  if (list.some(slotIsNegotiating)) return { key: 'negotiating', label: ARTIST_BOOKING_PILL_LABELS.negotiating };
  const isOpen = list.some((slot) => slot.status === 'upcoming' || slot.status === 'open');
  const key = isOpen ? 'open' : 'closed';
  return { key, label: ARTIST_BOOKING_PILL_LABELS[key] };
}

function formatArtistBookingDateLine(dateField, venueName) {
  const date = gigFirestoreDateToPlain(dateField);
  const datePart = date
    ? date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const venue = venueName ? String(venueName).trim() : '';
  return [datePart, venue].filter(Boolean).join(' · ');
}

function isAddExistingOriginGigFromApplicants(g) {
  if (!g) return false;
  const apps = Array.isArray(g.applicants) ? g.applicants : [];
  return g.private === true && apps.some((a) => a?.status === 'confirmed' && !a?.id && !a?.artistId);
}

/** Matches `Gigs.jsx` edit packaging so AddGigsModal prefills multi-slot artist nights. */
function packageArtistBookingEditDataFromSlots(sortedSlots) {
  if (!sortedSlots?.length) return null;
  const slotDocId = (g) => g?.gigId || g?.id;
  if (sortedSlots.length === 1) {
    const g = sortedSlots[0];
    const gid = slotDocId(g);
    return {
      ...g,
      gigId: gid,
      date: gigFirestoreDateToPlain(g.date),
      existingGigIds: gid ? [gid] : [],
    };
  }
  const primaryGig = sortedSlots[0];
  const baseGigName = String(primaryGig.gigName ?? '').replace(/\s*\(Set\s+\d+\)\s*$/, '');
  const extraSlots = sortedSlots.slice(1).map((slot) => ({
    startTime: slot.startTime,
    duration: slot.duration,
  }));
  const slotBudgets = sortedSlots.map((slot) =>
    slot.budgetValue !== undefined ? slot.budgetValue : null
  );
  const artistNames = sortedSlots.map((slot) => {
    const apps = Array.isArray(slot.applicants) ? slot.applicants : [];
    const confirmed = apps.find((a) => a?.status === 'confirmed');
    return confirmed?.name ?? slot.artistName ?? '';
  });
  return {
    ...primaryGig,
    gigId: slotDocId(primaryGig),
    gigName: baseGigName,
    date: gigFirestoreDateToPlain(primaryGig.date),
    extraSlots,
    slotBudgets,
    artistNames,
    existingGigIds: sortedSlots.map((slot) => slotDocId(slot)).filter(Boolean),
  };
}

export function VenueGigPageShell({
  gigs,
  venueHireOpportunities = [],
  venues,
  user,
  refreshGigs,
  setShowAddGigsModal,
  setAddGigsEditData,
  setAddGigsMode,
  refreshStripe,
  customerDetails,
  copyToClipboard,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMdUp } = useBreakpoint();

  const stateGig = location.state?.gig;
  /** Passed from Gigs list / calendar so multi-set nights work even when `gigSlots` is missing on docs. */
  const linkedGigIdsFromNav = Array.isArray(location.state?.linkedGigIds)
    ? location.state.linkedGigIds
    : null;
  const linkedGigIdsKey = linkedGigIdsFromNav?.length
    ? [...linkedGigIdsFromNav].sort().join(',')
    : '';
  const gigId = stateGig?.gigId || '';
  const isVenueHireFromState = stateGig?.itemType === 'venue_hire';
  const [gigInfo, setGigInfo] = useState(null);
  const [relatedSlots, setRelatedSlots] = useState([]);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showInvitesModal, setShowInvitesModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelConversation, setCancelConversation] = useState(null);
  const [cancelNotifyBooker, setCancelNotifyBooker] = useState(true);
  const [showInviteToApplyModal, setShowInviteToApplyModal] = useState(false);
  const [showArtistInviteModal, setShowArtistInviteModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const optionsMenuRef = React.useRef(null);
  /**
   * For multi-set nights, always anchor the page on the earliest slot (one combined details view).
   * `gigId` from navigation may be any set; once siblings load, we resolve this to the primary id.
   */
  const [multiSlotAnchorGigId, setMultiSlotAnchorGigId] = useState(null);

  useEffect(() => {
    setMultiSlotAnchorGigId(null);
  }, [gigId]);

  // Load gig from list and related slots (or use venue hire from state).
  // When the same gig is still selected, merge: list/state (`next`) must win on overlapping keys
  // so refresh after Add Gigs save (or navigation state) updates the page. Apply `prev` first, then `next`.
  useEffect(() => {
    if (isVenueHireFromState && stateGig) {
      setGigInfo((prev) => {
        const next = stateGig;
        if (!next) return null;
        if (prev?.gigId === next.gigId) {
          return { ...prev, ...next };
        }
        return next;
      });
      setRelatedSlots([]);
      return;
    }
    if (!gigId) return;

    const effectiveGigId = multiSlotAnchorGigId || gigId;
    const activeGig = Array.isArray(gigs) ? gigs.find((g) => g.gigId === effectiveGigId) : null;
    /** Navigation payload for *this* visit (may be a non-anchor slot; keeps gigSlots when list omits them). */
    const navGig = stateGig?.gigId === gigId ? stateGig : null;
    if (!activeGig && !navGig) return;

    const mergedBase =
      activeGig && navGig
        ? { ...navGig, ...activeGig, gigSlots: pickGigSlotsForMerge(activeGig, navGig) }
        : activeGig || navGig;

    const currentGigId = mergedBase?.gigId;
    const navLinked =
      Array.isArray(linkedGigIdsFromNav) &&
      linkedGigIdsFromNav.length > 1 &&
      currentGigId &&
      linkedGigIdsFromNav.includes(currentGigId)
        ? [...new Set(linkedGigIdsFromNav.filter(Boolean))]
        : null;
    const navSiblingIds = navLinked
      ? navLinked.filter((id) => id !== currentGigId)
      : null;

    const hasFirestoreSlots =
      Array.isArray(mergedBase?.gigSlots) && mergedBase.gigSlots.length > 0;

    const siblingFetchIds = hasFirestoreSlots
      ? mergedBase.gigSlots
      : navSiblingIds?.length
        ? navSiblingIds
        : null;

    const heuristicSiblings = siblingFetchIds
      ? []
      : findSlotSiblingsFromFlatGigs(mergedBase, gigs || []);

    const syntheticGigSlots = hasFirestoreSlots
      ? null
      : navSiblingIds?.length
        ? navSiblingIds
        : heuristicSiblings.length > 0
          ? heuristicSiblings.map((g) => g.gigId).filter(Boolean)
          : null;

    const mergedWithLinkedSlots =
      syntheticGigSlots && syntheticGigSlots.length > 0
        ? { ...mergedBase, gigSlots: syntheticGigSlots }
        : mergedBase;

    setGigInfo((prev) => {
      if (!mergedWithLinkedSlots) return null;
      if (prev?.gigId === mergedWithLinkedSlots.gigId) {
        return {
          ...prev,
          ...mergedWithLinkedSlots,
          gigSlots: pickGigSlotsForMerge(mergedWithLinkedSlots, prev),
        };
      }
      return mergedWithLinkedSlots;
    });

    const applyFallbackRelatedSlots = () => {
      let fb = [];
      if (navSiblingIds?.length && Array.isArray(gigs)) {
        fb = navSiblingIds
          .map((id) => gigs.find((g) => g.gigId === id))
          .filter(Boolean);
      }
      if (fb.length === 0) {
        fb = findSlotSiblingsFromFlatGigs(mergedBase, gigs || []);
      }
      if (fb.length > 0) {
        setRelatedSlots(fb.map((g) => ({ ...g, gigId: g.gigId || g.id })));
        setGigInfo((prev) => {
          if (!prev || prev.gigId !== mergedBase.gigId) return prev;
          return {
            ...prev,
            gigSlots: fb.map((g) => g.gigId).filter(Boolean),
          };
        });
      } else {
        setRelatedSlots([]);
      }
    };

    if (siblingFetchIds?.length > 0) {
      getGigsByIds(siblingFetchIds)
        .then((slotGigs) => {
          setRelatedSlots(
            slotGigs.map((g) => ({ ...g, gigId: g.id || g.gigId }))
          );
        })
        .catch(() => {
          applyFallbackRelatedSlots();
        });
    } else if (heuristicSiblings.length > 0) {
      setRelatedSlots(
        heuristicSiblings.map((g) => ({ ...g, gigId: g.gigId || g.id }))
      );
    } else {
      setRelatedSlots([]);
    }
  }, [gigId, gigs, isVenueHireFromState, stateGig, multiSlotAnchorGigId, linkedGigIdsKey]);

  // After siblings load, anchor this screen on the earliest set so the venue sees one combined gig night.
  useEffect(() => {
    if (!gigInfo || !relatedSlots.length) {
      setMultiSlotAnchorGigId(null);
      return;
    }
    const unique = dedupeGigSlots([gigInfo, ...relatedSlots]);
    if (unique.length < 2) {
      setMultiSlotAnchorGigId(null);
      return;
    }
    const primaryId = unique[0].gigId;
    if (primaryId) setMultiSlotAnchorGigId(primaryId);
  }, [gigInfo, relatedSlots]);

  // When viewing a venue hire, sync gigInfo with venueHireOpportunities after refresh (e.g. after editing capacity in AddGigs modal).
  useEffect(() => {
    if (!gigInfo?.gigId || gigInfo?.itemType !== 'venue_hire' || !venueHireOpportunities?.length) return;
    const updated = venueHireOpportunities.find(
      (h) => (h.id || h.gigId) === gigInfo.gigId
    );
    if (updated) {
      const hireId = updated.id || updated.gigId;
      setGigInfo((prev) =>
        prev?.gigId === hireId
          ? {
              ...updated,
              gigId: hireId,
              itemType: 'venue_hire',
              renterName: updated.renterName ?? updated.hirerName ?? prev?.renterName,
              rentalDepositRequired: updated.rentalDepositRequired ?? updated.depositRequired ?? prev?.rentalDepositRequired,
              rentalDepositAmount: updated.rentalDepositAmount ?? updated.depositAmount ?? prev?.rentalDepositAmount,
              depositAmount: updated.depositAmount ?? updated.rentalDepositAmount ?? prev?.depositAmount,
            }
          : prev
      );
    }
  }, [gigInfo?.gigId, gigInfo?.itemType, venueHireOpportunities]);

  const allSlots = useMemo(() => {
    if (!gigInfo) return [];
    if (!relatedSlots.length) return [gigInfo];
    return dedupeGigSlots([gigInfo, ...relatedSlots]);
  }, [gigInfo, relatedSlots]);

  const venueRowForGig = useMemo(() => {
    if (!gigInfo?.venueId || !venues?.length) return null;
    return venues.find((v) => v.venueId === gigInfo.venueId) ?? null;
  }, [gigInfo?.venueId, venues]);

  const normalisedGig = useMemo(
    () =>
      gigInfo
        ? normaliseGig(gigInfo, {
            allSlots,
            venueCapacity: venueRowForGig?.capacity,
          })
        : null,
    [gigInfo, allSlots, venueRowForGig?.capacity]
  );

  const isArtistBookingFullyBooked = useMemo(
    () =>
      gigInfo && normalisedGig
        ? isArtistBookingNightFullyBooked({
            normalisedGig,
            rawGig: gigInfo,
            artistBookingSlotGigs: allSlots,
            gigs,
          })
        : false,
    [gigInfo, normalisedGig, allSlots, gigs]
  );

  useEffect(() => {
    if (isArtistBookingFullyBooked) setShowArtistInviteModal(false);
  }, [isArtistBookingFullyBooked]);

  const artistBookingApplicantsTotalCount = useMemo(
    () =>
      allSlots.reduce(
        (sum, g) => sum + (Array.isArray(g?.applicants) ? g.applicants.length : 0),
        0
      ),
    [allSlots]
  );

  const venueGigPageTitle = useMemo(() => {
    if (!normalisedGig) return '';
    if (normalisedGig.bookingMode === 'venue_hire') return 'Venue hire';
    const raw = normalisedGig.title || '';
    const n = normalisedGig.perSlotSummaries?.length;
    if (n > 1) {
      const stripped = raw.replace(/\s*\(Set\s+\d+\)\s*$/i, '').trim();
      return stripped || raw;
    }
    return raw;
  }, [normalisedGig]);

  const copyGigLink = () => {
    const link = normalisedGig?.links?.gigLinkUrl;
    if (link && typeof copyToClipboard === 'function') {
      copyToClipboard(link);
    } else if (link) {
      navigator.clipboard.writeText(link).then(
        () => toast.success('Copied gig link'),
        () => toast.error('Failed to copy')
      );
    }
  };

  useEffect(() => {
    if (!showOptionsMenu) return;
    const handleClickOutside = (e) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target)) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showOptionsMenu]);

  const hasAnyConfirmed =
    gigInfo &&
    [gigInfo, ...relatedSlots].some((slot) =>
      (slot?.applicants || []).some((a) => ['confirmed', 'paid'].includes(a?.status))
    );
  const isVenueHire = normalisedGig?.bookingMode === 'venue_hire';
  const hasVenueHireBooker = isVenueHire && !!(gigInfo?.renterName && String(gigInfo.renterName).trim());
  const showCancelGigOption = (hasAnyConfirmed || hasVenueHireBooker) && hasVenuePerm(venues, gigInfo?.venueId, 'gigs.update');
  const showDeleteGigOption = !hasAnyConfirmed && !hasVenueHireBooker && hasVenuePerm(venues, gigInfo?.venueId, 'gigs.update');
  // When cancel confirm opens for venue hire, resolve whether booking is via Gigin (for "Notify booker").
  useEffect(() => {
    if (!showCancelConfirm || !isVenueHire || !gigInfo?.gigId || !user?.uid) {
      setCancelConversation(null);
      return;
    }
    let cancelled = false;
    isBookedViaGigin(gigInfo.gigId, user.uid).then(({ conversation }) => {
      if (!cancelled) setCancelConversation(conversation);
    });
    return () => { cancelled = true; };
  }, [showCancelConfirm, isVenueHire, gigInfo?.gigId, user?.uid]);
  const now = useMemo(() => new Date(), []);
  const gigDateTime = gigInfo ? getLocalGigDateTime(gigInfo) : null;
  const venueName =
    gigInfo?.venue?.venueName ||
    (gigInfo?.venueId && venues?.length ? (venues.find((v) => v.venueId === gigInfo.venueId)?.name || '') : '') ||
    '';
  /** Edit Event (gig details) only when not confirmed, or when booker/artist is manually entered. */
  const isBookerManual = isVenueHire && (gigInfo?.hirerType === 'manual' || !gigInfo?.hirerType);
  const showEditGigOption =
    gigDateTime > now &&
    hasVenuePerm(venues, gigInfo?.venueId, 'gigs.update') &&
    (isVenueHire ? !hasVenueHireBooker || isBookerManual : !hasAnyConfirmed);

  const handleCancelGig = async () => {
    if (!gigInfo?.gigId || !hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')) return;
    setShowCancelConfirm(false);
    try {
      if (isVenueHire) {
        if (cancelConversation && cancelNotifyBooker && cancelConversation.id) {
          await postCancellationMessage({
            conversationId: cancelConversation.id,
            senderId: user.uid,
            message: 'This venue hire booking has been cancelled. The slot is now available again.',
            cancellingParty: 'venue',
          });
        }
        const hireId = gigInfo.id || gigInfo.gigId;
        await updateVenueHireOpportunity(hireId, { hirerName: null, status: 'available' });
        toast.success('Booking cancelled.');
        refreshGigs?.();
        navigate('/venues/dashboard/gigs', { replace: true });
      } else {
        toast.info('To cancel an artist booking, use the Options menu on the Gigs list.');
        navigate('/venues/dashboard/gigs');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel booking.');
    }
  };

  const handleDeleteGig = async () => {
    if (!gigInfo?.gigId || !hasVenuePerm(venues, gigInfo?.venueId, 'gigs.update')) return;
    setShowDeleteConfirm(false);
    try {
      if (isVenueHire) {
        const hireId = gigInfo.id || gigInfo.gigId;
        await deleteVenueHireOpportunity(hireId);
        toast.success('Venue hire opportunity removed.');
      } else {
        await deleteGigsBatch([gigInfo.gigId]);
        toast.success('Gig deleted.');
      }
      refreshGigs?.();
      navigate('/venues/dashboard/gigs', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error(isVenueHire ? 'Failed to remove. Please try again.' : 'Failed to delete gig. Please try again.');
    }
  };

  if (!gigId) {
    navigate('/venues/dashboard/gigs', { replace: true });
    return null;
  }

  if (!gigInfo) {
    return <LoadingScreen />;
  }

  const MainPanel = getMainPanelComponent(normalisedGig);
  const isVenueHirePage = normalisedGig.bookingMode === 'venue_hire';
  const isConfirmedVenueHire = isVenueHirePage && normalisedGig.status === 'confirmed';
  const isOpenArtistBookingPage = normalisedGig.bookingMode === 'artist_booking' && normalisedGig.status === 'open';
  const isConfirmedArtistBookingPage = normalisedGig.bookingMode === 'artist_booking' && normalisedGig.status === 'confirmed';
  const isArtistBookingPage = isOpenArtistBookingPage || isConfirmedArtistBookingPage;
  const noBookerYet = isVenueHirePage && !hasVenueHireBooker;
  // Both venue-hire-with-no-booker and open artist bookings show the "invite UI" state:
  // an invite/fill-this-slot tile + the applications-visibility toggle. Unifying these
  // lets the same MainPanel (GigDetailsPanel) drive both flows.
  const showInviteUx = noBookerYet || isOpenArtistBookingPage;
  /** Venue hire (until confirmed) or open artist booking: drive listing visibility on public venue profile. */
  const showVenueProfileVisibilityToggle =
    (isVenueHirePage && !isConfirmedVenueHire) || isOpenArtistBookingPage;
  const canUpdateGigs = hasVenuePerm(venues, gigInfo?.venueId, 'gigs.update');
  const hasPublicApplyLink = !gigInfo.private && normalisedGig?.links?.gigLinkUrl;

  const openEditGigModal = () => {
    if (normalisedGig.bookingMode === 'venue_hire') {
      const hireId = gigInfo.gigId || gigInfo.id;
      setAddGigsEditData?.({
        ...gigInfo,
        gigId: hireId,
        date: gigFirestoreDateToPlain(gigInfo.date),
      });
      setAddGigsMode?.('bookNew');
      setShowAddGigsModal?.(true);
      return;
    }
    const sortedSlots = dedupeGigSlots([gigInfo, ...relatedSlots]);
    const convertedGig = packageArtistBookingEditDataFromSlots(sortedSlots);
    if (!convertedGig?.existingGigIds?.length) return;
    const mode = sortedSlots.some(isAddExistingOriginGigFromApplicants) ? 'addExisting' : 'bookNew';
    setAddGigsEditData?.(convertedGig);
    setAddGigsMode?.(mode);
    setShowAddGigsModal?.(true);
  };

  /* Open + confirmed artist bookings: header invite opens share / ArtistFillThisSlotTile (not only while status is open). */
  const canInviteArtist = isArtistBookingPage && hasVenuePerm(venues, gigInfo?.venueId, 'gigs.invite');
  const isGigApplicationsClosed = gigInfo?.status === 'closed' || gigInfo?.applicationsOpen === false;
  const showArtistInviteInApplications =
    canInviteArtist && !isGigApplicationsClosed && !isArtistBookingFullyBooked;

  const openPreviewListing = (event) => {
    const id = gigInfo?.id || gigInfo?.gigId;
    if (id) openInNewTab(isVenueHirePage ? `/hire/${id}` : `/gig/${id}`, event);
  };
  const statusPill = isArtistBookingPage ? artistBookingStatusPill(allSlots, now) : null;
  const dateLine = isArtistBookingPage ? formatArtistBookingDateLine(gigInfo?.date, venueName) : '';

  return (
    <div className={`venue-gig-page${isArtistBookingPage ? ' venue-gig-page--console' : ''}`}>
      {isArtistBookingPage && (
        <header className="venue-gig-page__bar">
          <div className="venue-gig-page__crumb">
            {!isMdUp && (
              <button
                type="button"
                className="btn text venue-gig-page__back"
                onClick={() => navigate(-1)}
              >
                <LeftArrowIcon /> Back
              </button>
            )}
            <Link className="venue-gig-page__crumb-link" to="/venues/dashboard/gigs">Gigs</Link>
            <span className="venue-gig-page__crumb-chevron" aria-hidden="true">
              <RightChevronIcon />
            </span>
            <span className="venue-gig-page__crumb-current">{venueGigPageTitle}</span>
          </div>
          <div className="venue-gig-page__bar-actions">
            <button type="button" className="venue-gig-page__bar-btn" onClick={openPreviewListing}>
              Preview listing
            </button>
            {showEditGigOption && (
              <button type="button" className="venue-gig-page__bar-btn" onClick={openEditGigModal}>
                Edit gig
              </button>
            )}
            <GigOptionsMenu
              appearance="icon"
              isOpen={showOptionsMenu}
              onToggle={() => setShowOptionsMenu((v) => !v)}
              menuRef={optionsMenuRef}
              showPreviewGigPost
              onPreviewGigPost={openPreviewListing}
              previewGigPostLabel="Preview listing"
              previewGigPostTitle="Preview listing"
              showEditGig={showEditGigOption}
              onEditGig={openEditGigModal}
              showCancelGig={gigDateTime > now && showCancelGigOption}
              onCancelGig={() => {
                toast.info('To cancel an artist booking, use the Options menu on the Gigs list.');
                navigate('/venues/dashboard/gigs');
              }}
              showDeleteGig={gigDateTime > now && showDeleteGigOption}
              onDeleteGig={() => setShowDeleteConfirm(true)}
            />
          </div>
        </header>
      )}
      <div className={isArtistBookingPage ? 'venue-gig-page__scroll' : 'venue-gig-page__container'}>
        {!isArtistBookingPage && (
        <header className="venue-gig-page__header venue-gig-page__header--surface">
          {!isMdUp && (
            <button
              type="button"
              className="btn text venue-gig-page__back"
              onClick={() => navigate(-1)}
            >
              <LeftArrowIcon /> Back
            </button>
          )}
          <div className="venue-gig-page__header-grid">
            <div className="venue-gig-page__header-left">
              <div className="venue-gig-page__title-row">
                <h1 className="venue-gig-page__title">{venueGigPageTitle}</h1>
              </div>
              <div className="venue-gig-page__meta">
                <div className="venue-gig-page__datetime-row">
                  <CalendarIconLight />
                  <p className="venue-gig-page__datetime">
                    {normalisedGig.dateLabel}
                    {normalisedGig.timeRangeLabel ? `, ${normalisedGig.timeRangeLabel}` : ''}
                    {normalisedGig.perSlotSummaries?.length > 1
                      ? ` · ${normalisedGig.perSlotSummaries.length} sets`
                      : ''}
                  </p>
                </div>
                {venueName ? (
                  <div className="venue-gig-page__venue-row">
                    <LocationPinIcon />
                    <p className="venue-gig-page__venue-name">{venueName}</p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="venue-gig-page__header-right">
              <div className="venue-gig-page__header-row venue-gig-page__header-row--actions">
                {isVenueHirePage && !isConfirmedVenueHire && !noBookerYet && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setShowInviteToApplyModal(true)}
                    title="Invite artists or promoters to apply for this hire"
                  >
                    <InviteIconSolid /> Invite to apply
                  </button>
                )}
                {!isConfirmedVenueHire && isVenueHirePage && hasPublicApplyLink && !noBookerYet && (
                  <button type="button" className="btn secondary" onClick={copyGigLink}>
                    <LinkIcon /> Copy link
                  </button>
                )}
                {isVenueHirePage && !noBookerYet && !isConfirmedVenueHire && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                  <label className="venue-gig-page__invite-only">
                    <input
                      type="checkbox"
                      checked={!!gigInfo.private}
                      onChange={async (e) => {
                        try {
                          await updateVenueHireOpportunity(gigInfo.id || gigInfo.gigId, { private: e.target.checked });
                          toast.success(`Gig changed to ${e.target.checked ? 'Invite only' : 'Public'}`);
                          refreshGigs?.();
                        } catch (err) {
                          toast.error('Failed to update.');
                        }
                      }}
                    />
                    <span>Invite only</span>
                  </label>
                )}
                <GigOptionsMenu
                  isOpen={showOptionsMenu}
                  onToggle={() => setShowOptionsMenu((v) => !v)}
                  menuRef={optionsMenuRef}
                  showPreviewGigPost={!isConfirmedVenueHire}
                  onPreviewGigPost={(e) => {
                    const id = gigInfo?.id || gigInfo?.gigId;
                    if (id) openInNewTab(isVenueHirePage ? `/hire/${id}` : `/gig/${id}`, e);
                  }}
                  previewGigPostLabel={isVenueHirePage ? 'Preview venue hire post' : 'Preview gig post'}
                  previewGigPostTitle={isVenueHirePage ? 'Preview venue hire post' : 'Preview gig post'}
                  showEditGig={showEditGigOption}
                  onEditGig={openEditGigModal}
                  showCancelGig={gigDateTime > now && showCancelGigOption}
                  onCancelGig={() => {
                    if (isVenueHire) setShowCancelConfirm(true);
                    else {
                      toast.info('To cancel an artist booking, use the Options menu on the Gigs list.');
                      navigate('/venues/dashboard/gigs');
                    }
                  }}
                  showDeleteGig={gigDateTime > now && showDeleteGigOption}
                  onDeleteGig={() => setShowDeleteConfirm(true)}
                />
              </div>
            </div>
          </div>
        </header>
        )}

        <div className={isArtistBookingPage ? 'venue-gig-page__columns' : 'venue-gig-page__layout'}>
          <div className={isArtistBookingPage ? 'venue-gig-page__column' : 'venue-gig-page__column-passthrough'}>
          {isArtistBookingPage && (
            <div className="venue-gig-page__page-head">
              {dateLine ? <p className="venue-gig-page__date-line">{dateLine}</p> : null}
              <div className="venue-gig-page__title-line">
                <h1 className="venue-gig-page__page-title">{venueGigPageTitle}</h1>
                <span className={`venue-gig-page__pill venue-gig-page__pill--${statusPill.key}`}>
                  <span className="venue-gig-page__pill-dot" />
                  {statusPill.label}
                </span>
              </div>
            </div>
          )}
          <main className="venue-gig-page__main">
            {(() => {
              const venueProfile = gigInfo?.venueId && venues?.length ? venues.find((v) => v.venueId === gigInfo.venueId) ?? null : null;
              const panel = (
                <MainPanel
                  normalisedGig={normalisedGig}
                  rawGig={gigInfo}
                  setGigInfo={setGigInfo}
                  gigs={gigs}
                  venues={venues}
                  venueProfile={venueProfile}
                  refreshGigs={refreshGigs}
                  setShowAddGigsModal={setShowAddGigsModal}
                  setAddGigsEditData={setAddGigsEditData}
                  setAddGigsMode={setAddGigsMode}
                  refreshStripe={refreshStripe}
                  customerDetails={customerDetails}
                  copyToClipboard={copyToClipboard}
                  showInvitesModal={showInvitesModal}
                  setShowInvitesModal={setShowInvitesModal}
                  onCopyBookingLink={showInviteUx ? copyGigLink : undefined}
                  bookingLinkUrl={showInviteUx && (gigInfo?.id || gigInfo?.gigId) && typeof window !== 'undefined' ? `${window.location.origin}/${isVenueHirePage ? 'hire' : 'gig'}/${gigInfo.id || gigInfo.gigId}` : undefined}
                  applicationsInviteOnly={
                    showVenueProfileVisibilityToggle && canUpdateGigs ? !!gigInfo?.private : undefined
                  }
                  onApplicationsVisibilityChange={
                    showVenueProfileVisibilityToggle && canUpdateGigs
                      ? async (inviteOnly) => {
                          try {
                            if (isVenueHirePage) {
                              await updateVenueHireOpportunity(gigInfo.id || gigInfo.gigId, { private: inviteOnly });
                            } else {
                              await updateGigDocument({
                                gigId: gigInfo.gigId,
                                action: 'gigs.update',
                                updates: { private: inviteOnly },
                              });
                            }
                            setGigInfo((prev) => (prev ? { ...prev, private: inviteOnly } : prev));
                            toast.success(
                              inviteOnly
                                ? 'Listing hidden from your venue profile.'
                                : 'Listing visible on your venue profile.'
                            );
                            refreshGigs?.();
                          } catch (err) {
                            toast.error('Failed to update.');
                          }
                        }
                      : undefined
                  }
                  onInviteArtist={
                    showArtistInviteInApplications ? () => setShowArtistInviteModal(true) : undefined
                  }
                  artistBookingApplicantsTotalCount={artistBookingApplicantsTotalCount}
                  artistBookingSlotGigs={isArtistBookingPage ? allSlots : undefined}
                />
              );
              return isVenueHirePage || isArtistBookingPage ? panel : <div className="venue-gig-page__main-card">{panel}</div>;
            })()}
          </main>
          </div>
          <div className={isArtistBookingPage ? 'venue-gig-page__rail' : 'venue-gig-page__column-passthrough'}>
          <BookingSummarySidebar
            normalisedGig={normalisedGig}
            rawGig={gigInfo}
            venues={venues}
            mergedTimelineSlots={allSlots}
            setGigInfo={setGigInfo}
            refreshGigs={refreshGigs}
            gigLinkUrl={normalisedGig?.links?.gigLinkUrl || (gigInfo?.gigId ? `${window.location.origin}/gig/${gigInfo.gigId}` : '')}
            onInviteFromContacts={
              hasVenuePerm(venues, gigInfo?.venueId, 'gigs.invite')
                ? () => setShowInviteToApplyModal(true)
                : undefined
            }
            bookingSummaryOnEditGig={
              hasVenuePerm(venues, gigInfo?.venueId, 'gigs.update') ? openEditGigModal : undefined
            }
            onEdit={
              hasVenuePerm(venues, gigInfo?.venueId, 'gigs.update') ? openEditGigModal : undefined
            }
          />
          </div>
        </div>
      </div>

      {showCancelConfirm && (
        <Portal>
          <div
            className="modal cancel-gig"
            onClick={() => setShowCancelConfirm(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Cancel booking?</h3>
              {cancelConversation && (
                <label className="gigs-calendar-react__venue-hire-cancel-notify">
                  <input
                    type="checkbox"
                    checked={cancelNotifyBooker}
                    onChange={(e) => setCancelNotifyBooker(e.target.checked)}
                  />
                  <span>Notify booker</span>
                </label>
              )}
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setShowCancelConfirm(false)}>
                  Keep booking
                </button>
                <button type="button" className="btn danger" onClick={handleCancelGig}>
                  Cancel booking
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showDeleteConfirm && (
        <Portal>
          <div
            className="modal cancel-gig"
            onClick={() => setShowDeleteConfirm(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>{isVenueHire ? 'Delete this venue hire?' : 'Delete this gig?'}</h3>
              <p>Are you sure? This action cannot be undone.</p>
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setShowDeleteConfirm(false)}>
                  No
                </button>
                <button type="button" className="btn danger" onClick={handleDeleteGig}>
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showInviteToApplyModal && gigInfo && user && (
        <GigInvitesModal
          gig={gigInfo}
          venues={venues}
          onClose={() => setShowInviteToApplyModal(false)}
          refreshGigs={refreshGigs}
          user={user}
          fromGigsTable={false}
        />
      )}

      {showArtistInviteModal && gigInfo && (
        <ArtistFillThisSlotTile
          gig={gigInfo}
          venues={venues}
          refreshGigs={refreshGigs}
          initialPopup="contacts"
          hideInlineShareButton
          submodalOnly
          showManualOption={false}
          onPopupClose={() => setShowArtistInviteModal(false)}
        />
      )}
    </div>
  );
}
