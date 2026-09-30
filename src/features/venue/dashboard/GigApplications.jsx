
import { useState, useEffect, useMemo, useRef } from 'react';
import { FEATURES } from '../../../config/features';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom'
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { 
    ClockIcon,
    EditIcon,
    ErrorIcon,
    FaceMehIcon,
    PeopleGroupIcon,
    StarIcon,
    TickIcon
} from '@features/shared/ui/extras/Icons';
import { format } from 'date-fns';
import { LinkIcon, InviteIcon, InviteIconSolid } from '../../shared/ui/extras/Icons';
import '@styles/host/invite-and-share-modal.styles.css';
import { SendGigDetailsTile } from '@features/venue/components/SendGigDetailsTile';
import { ApplicantTechSetupModal } from '@features/venue/components/ApplicantTechSetupModal';
import { EditGigTimeModal } from '@features/venue/components/EditGigTimeModal';
import { useAuth } from '@hooks/useAuth';
import { PaymentModal } from '@features/venue/components/PaymentModal';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { getMusicianProfileByMusicianId, getArtistProfileById } from '@services/client-side/artists';
import { getUserEmailById } from '@services/api/users';
import {
    getConversationsByParticipantAndGigId,
    getConversationsByGigAndMusicianProfileId,
} from '@services/client-side/conversations';
import { getOrCreateConversation, notifyOtherApplicantsGigConfirmed } from '@services/api/conversations';
import { getMostRecentMessage } from '@services/client-side/messages';
import { removeGigFromVenue } from '@services/client-side/venues';
import { confirmGigPayment, fetchSavedCards } from '@services/api/payments';
import { openInNewTab } from '../../../services/utils/misc';
import { CloseIcon, LeftArrowIcon, MessageIcon, MicrophoneIcon, NewTabIcon, PeopleGroupIconSolid, PermissionsIcon, PlayIcon, PreviousIcon, SettingsIcon, DeleteIcon, CancelIcon, TechRiderIcon } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import { getVenueProfileById } from '../../../services/client-side/venues';
import { loadStripe } from '@stripe/stripe-js';
import { sendGigAcceptedEmail, sendGigDeclinedEmail } from '../../../services/client-side/emails';
import Portal from '../../shared/components/Portal';
import { LoadingScreen } from '../../shared/ui/loading/LoadingScreen';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { cancelGigAndRefund } from '@services/api/payments';
import { acceptGigOffer, acceptGigOfferOM, logGigCancellation, markApplicantsViewed, declineGigApplication, revertGigAfterCancellationVenue, deleteGigAndInformation, updateGigDocument } from '@services/api/gigs';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { getLocalGigDateTime } from '../../../services/utils/filtering';
import { toJsDate } from '../../../services/utils/dates';
import { sendGigAcceptedMessage, updateDeclinedApplicationMessage, postCancellationMessage } from '@services/api/messages';
import { cancelledGigMusicianProfileUpdate } from '@services/api/artists';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { getGigsByIds } from '@services/client-side/gigs';
import { findSlotSiblingsFromFlatGigs, gigSlotHasUnviewedApplicants, gigSlotHasConfirmedArtist } from '@features/venue/gigs/utils/multiSlotGigGroup';
import { formatDate } from '@services/utils/dates';
import { GigHandbook } from '@features/artist/components/GigHandbook';
import { storage } from '@lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { GigInvitesModal } from '../components/GigInvitesModal';
const stripePromise = FEATURES.payments
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

const BOOKED_APPLICANT_STATUSES = ['confirmed', 'accepted', 'paid', 'payment processing'];

function isGuestApplicant(applicant) {
    return applicant?.guest === true || applicant?.type === 'guest';
}

function guestViewFromApplicant(app) {
    const photoUrl = app?.photoUrl || app?.photo?.url || null;
    return {
        ...app,
        id: app.id,
        guest: true,
        type: 'guest',
        name: app.name || app.artistName || 'Guest',
        email: app.email || null,
        phone: app.phone || null,
        contactName: app.contactName || '',
        heroMedia: photoUrl ? { url: photoUrl } : null,
        links: app.links || {},
        note: app.note || app.applicationMessage || '',
        applicationMessage: app.applicationMessage || app.note || '',
        needs: app.needs || [],
        bringOwn: app.bringOwn || [],
        setLabel: app.setLabel || '',
        userId: app.userId || null,
        fee: app.fee ?? app.proposedFee ?? null,
    };
}

/** True if tech setup object has anything worth showing in ApplicantTechSetupModal (applicant or gig-level shape). */
function techSetupPayloadHasContent(ts) {
    if (!ts || typeof ts !== 'object') return false;
    return (
        (Array.isArray(ts.usingVenueEquipment) && ts.usingVenueEquipment.length > 0) ||
        (Array.isArray(ts.bringingOwnEquipment) && ts.bringingOwnEquipment.length > 0) ||
        (Array.isArray(ts.hiringFromVenue) && ts.hiringFromVenue.length > 0) ||
        (Array.isArray(ts.needsDiscussion) && ts.needsDiscussion.length > 0) ||
        (Array.isArray(ts.missingEquipment) && ts.missingEquipment.length > 0) ||
        (Array.isArray(ts.venueEquipmentSelected) && ts.venueEquipmentSelected.length > 0) ||
        (Array.isArray(ts.hiredFromVenue) && ts.hiredFromVenue.length > 0) ||
        (typeof ts.setupNotes === 'string' && ts.setupNotes.trim() !== '') ||
        !!ts.compatibilityStatus
    );
}

/** Merge gig-level techSetup with applicant’s so equipment lists + setupNotes (equipment notes) stay together. */
function mergeBookedArtistTechSetup(slotGig, applicant) {
    const g = slotGig?.techSetup && typeof slotGig.techSetup === 'object' ? { ...slotGig.techSetup } : {};
    const a = applicant?.techSetup && typeof applicant.techSetup === 'object' ? { ...applicant.techSetup } : {};
    const merged = { ...g, ...a };
    const applicantNotes = typeof a.setupNotes === 'string' ? a.setupNotes.trim() : '';
    const gigNotes = typeof g.setupNotes === 'string' ? g.setupNotes.trim() : '';
    if (applicantNotes) merged.setupNotes = a.setupNotes;
    else if (gigNotes) merged.setupNotes = g.setupNotes;
    return merged;
}

const VideoModal = ({ video, onClose }) => {
    return (
        <div className='modal videos'  onClick={onClose}>
            <div className='modal-content transparent' onClick={(e) => e.stopPropagation()}>
                <span className='close' onClick={onClose}>&times;</span>
                <video controls autoPlay style={{ width: '100%' }}>
                    <source src={video.file} type='video/mp4' />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
};

/** Artist application note under the name on card-layout application tiles (same conversation as Message). */
function ApplicationMessagePreview({ gigId, participantUserId, participantProfileId }) {
    const [text, setText] = useState(null);
    useEffect(() => {
        if (!gigId || (!participantProfileId && !participantUserId)) return undefined;
        let cancelled = false;
        (async () => {
            try {
                let conversations = [];
                if (participantProfileId) {
                    conversations = await getConversationsByGigAndMusicianProfileId(gigId, participantProfileId);
                }
                if (!conversations?.length && participantUserId) {
                    conversations = await getConversationsByParticipantAndGigId(gigId, participantUserId);
                }
                const conversationId = conversations?.[0]?.id;
                if (!conversationId) return;
                const msg = await getMostRecentMessage(conversationId, 'application');
                const t =
                    msg?.text != null && String(msg.text).trim() !== ''
                        ? String(msg.text).trim()
                        : null;
                if (!cancelled) setText(t);
            } catch (e) {
                console.error(e);
                if (!cancelled) setText(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [gigId, participantProfileId, participantUserId]);
    if (!text) return null;
    return (
        <div className="venue-application-submitted-note">
            <span className="venue-application-submitted-note__label">Application message</span>
            <p className="venue-application-submitted-note__body">{text}</p>
        </div>
    );
}

function runningOrderInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return `${parts[0][0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

function runningOrderFeeLabel(value) {
    if (value == null || value === '') return '';
    const text = String(value).trim();
    if (!text || text === '£') return '';
    if (text.startsWith('£')) return text;
    const numeric = text.replace(/[^0-9.]/g, '');
    return numeric ? `£${numeric}` : text;
}

function runningOrderApplicantMeta(profile) {
    const genre = Array.isArray(profile?.genres) && profile.genres.length
        ? profile.genres[0]
        : (profile?.genre || '');
    const rating = profile?.averageRating ?? profile?.rating;
    const ratingText = typeof rating === 'number' && rating > 0 ? rating.toFixed(1) : '';
    return [genre, ratingText].filter(Boolean).join(' · ');
}

/** Quoted application message for a running-order row. */
function RunningOrderQuote({ gigId, participantUserId, participantProfileId, stored }) {
    const [text, setText] = useState(typeof stored === 'string' && stored.trim() ? stored.trim() : null);
    useEffect(() => {
        if (typeof stored === 'string' && stored.trim()) {
            setText(stored.trim());
            return undefined;
        }
        if (!gigId || (!participantProfileId && !participantUserId)) return undefined;
        let cancelled = false;
        (async () => {
            try {
                let conversations = [];
                if (participantProfileId) {
                    conversations = await getConversationsByGigAndMusicianProfileId(gigId, participantProfileId);
                }
                if (!conversations?.length && participantUserId) {
                    conversations = await getConversationsByParticipantAndGigId(gigId, participantUserId);
                }
                const conversationId = conversations?.[0]?.id;
                if (!conversationId) return;
                const msg = await getMostRecentMessage(conversationId, 'application');
                const next = msg?.text != null && String(msg.text).trim() !== '' ? String(msg.text).trim() : null;
                if (!cancelled) setText(next);
            } catch (e) {
                console.error(e);
            }
        })();
        return () => { cancelled = true; };
    }, [gigId, participantProfileId, participantUserId, stored]);
    if (!text) return <span className="venue-gig-running__quote" />;
    return <span className="venue-gig-running__quote">“{text}”</span>;
}

/** Equipment notes + step-3 message from applicant record; conversation fetch only as fallback for legacy applications. */
function ApplicantSubmittedNotesSection({ gigId, participantUserId, participantProfileId, applicant }) {
    const trimmed =
        typeof applicant?.techSetup?.setupNotes === 'string' ? applicant.techSetup.setupNotes.trim() : '';
    const applicationMessageStored =
        typeof applicant?.applicationMessage === 'string' ? applicant.applicationMessage.trim() : '';
    const fetchMessageFromConversation =
        !applicationMessageStored && !!(participantProfileId || participantUserId);

    if (!trimmed && !applicationMessageStored && !fetchMessageFromConversation) return null;

    const equipmentBlock = trimmed ? (
        <div className="venue-application-submitted-note">
            <span className="venue-application-submitted-note__label">Equipment notes</span>
            <p className="venue-application-submitted-note__body">{trimmed}</p>
        </div>
    ) : null;

    const applicationMessageBlock = applicationMessageStored ? (
        <div className="venue-application-submitted-note">
            <span className="venue-application-submitted-note__label">Application message</span>
            <p className="venue-application-submitted-note__body">{applicationMessageStored}</p>
        </div>
    ) : fetchMessageFromConversation ? (
        <ApplicationMessagePreview
            gigId={gigId}
            participantUserId={participantUserId}
            participantProfileId={participantProfileId}
        />
    ) : null;

    if (!equipmentBlock) {
        return (
            <div className="venue-application-submitted-notes venue-application-submitted-notes--single">
                {applicationMessageBlock}
            </div>
        );
    }
    if (!applicationMessageBlock) {
        return <div className="venue-application-submitted-notes">{equipmentBlock}</div>;
    }
    return (
        <div className="venue-application-submitted-notes">
            {equipmentBlock}
            {applicationMessageBlock}
        </div>
    );
}

export const GigApplications = ({
    setShowAddGigsModal,
    setAddGigsEditData,
    setAddGigsMode,
    gigs,
    venues,
    refreshStripe,
    customerDetails,
    refreshGigs,
    rawGig,
    setGigInfo: setGigInfoFromParent,
    skipHeader,
    useCardLayout,
    copyToClipboard: copyToClipboardProp,
    showInvitesModalFromParent,
    setShowInvitesModalFromParent,
    onInviteArtist,
    onOpenConfirmGigManually,
    onEditManualBooked,
    /** Hide in-component tab strip (e.g. parent renders filter-style tabs above the applications card). */
    hideMultiSlotTabStrip = false,
    /** Controlled multi-set tab index; pair with `onMultiSlotActiveTabIndexChange`. */
    multiSlotActiveTabIndex: multiSlotActiveTabIndexProp,
    onMultiSlotActiveTabIndexChange,
    /** When set, booked artist tile(s) render here (e.g. above the applications card and set tabs). */
    bookedTilesPortalContainer = null,
    /** When set with `useCardLayout`, the Send gig details block portals here (above the applications tile). */
    sendGigDetailsPortalContainer = null,
    /**
     * When using `sendGigDetailsPortalContainer`, optional override: hide the tile when the artist-booking
     * night is fully booked (all sets filled per `isArtistBookingNightFullyBooked`). When omitted, visibility
     * uses per-slot `maxApplicants` merged with `gigs`.
     */
    sendGigDetailsPortalNightFullyBooked,
    /** When set, each slot's open/booked body portals into the running-order card and the old applications list is not rendered. */
    runningOrderSlotTargets = null,
}) => {

    const {isMdUp, isLgUp} = useBreakpoint();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const now = useMemo(() => new Date(), []);

    const [internalGigInfo, setInternalGigInfo] = useState(null);
    const gigInfo = rawGig !== undefined && rawGig !== null ? rawGig : internalGigInfo;
    const setGigInfoState = typeof setGigInfoFromParent === 'function' ? setGigInfoFromParent : setInternalGigInfo;

    // Helper function to fetch profile (artist or musician) by ID
    const getProfileById = async (profileId) => {
      let profile = await getArtistProfileById(profileId);
      const isArtistProfile = !!profile;
      if (!profile) {
        profile = await getMusicianProfileByMusicianId(profileId);
      }
      if (profile) {
        // For artist profiles, always fetch user email from user document (artist profiles don't have email field)
        if (isArtistProfile && profile.userId) {
          try {
            const email = await getUserEmailById({ userId: profile.userId });
            if (email) {
              profile.email = email;
            }
          } catch (error) {
            console.error('Error fetching user email:', error);
          }
        }
        // Normalize profile structure for backward compatibility
        return {
          ...profile,
          musicianId: profile.id || profile.musicianId || profileId,
        };
      }
      return null;
    };
    const [videoToPlay, setVideoToPlay] = useState(null);
    const [musicianProfiles, setMusicianProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalLoading, setModalLoading] = useState(false);
    const [loadingPaymentDetails, setLoadingPaymentDetails] = useState(false);
    const [savedCards, setSavedCards] = useState([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [makingPayment, setMakingPayment] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [musicianProfileId, setMusicianProfileId] = useState(false);
    const [paymentSlotGig, setPaymentSlotGig] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewProfile, setReviewProfile] = useState(null);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
    const [showCancelConfirmationModal, setShowCancelConfirmationModal] = useState(false);
    const [showCloseGigModal, setShowCloseGigModal] = useState(false);
    const [closeApplicationsPrompt, setCloseApplicationsPrompt] = useState(null);
    const [closeApplicationsGigIds, setCloseApplicationsGigIds] = useState([]);
    const [watchPaymentIntentId, setWatchPaymentIntentId] = useState(null);
    const [gigLinkCopied, setGigLinkCopied] = useState(false);
    const [hoveredRowId, setHoveredRowId] = useState(null);
    const [cancellationReason, setCancellationReason] = useState({
        reason: '',
        extraDetails: '',
      });
    const [eventLoading, setEventLoading] = useState(false);
    const [guestDetail, setGuestDetail] = useState(null);
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesValue, setNotesValue] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const notesTextareaRef = useRef(null);
    const [relatedSlots, setRelatedSlots] = useState([]);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [gigForHandbook, setGigForHandbook] = useState(null);
    const [confirmedArtistProfiles, setConfirmedArtistProfiles] = useState(new Map());
    const [heroImageUrls, setHeroImageUrls] = useState(new Map());
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const optionsMenuRef = useRef(null);
    /** When set, Cancel Gig modal only cancels this slot’s booking (multi-set). */
    const [cancelSlotGig, setCancelSlotGig] = useState(null);
    const [bookedTileOptionsGigId, setBookedTileOptionsGigId] = useState(null);
    const [bookedArtistTechRiderModal, setBookedArtistTechRiderModal] = useState(null);
    const [bookedArtistTechRiderLoading, setBookedArtistTechRiderLoading] = useState(false);
    const bookedTileOptionsMenuRef = useRef(null);

    // Close options menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target)) {
                setShowOptionsMenu(false);
            }
        };
        if (showOptionsMenu) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => {
            window.removeEventListener('click', handleClickOutside);
        };
    }, [showOptionsMenu]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (bookedTileOptionsMenuRef.current && !bookedTileOptionsMenuRef.current.contains(e.target)) {
                setBookedTileOptionsGigId(null);
            }
        };
        if (bookedTileOptionsGigId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => {
            window.removeEventListener('click', handleClickOutside);
        };
    }, [bookedTileOptionsGigId]);
    const [showInvitesModalInternal, setShowInvitesModalInternal] = useState(false);
    const showInvitesModal = (skipHeader && showInvitesModalFromParent !== undefined) ? showInvitesModalFromParent : showInvitesModalInternal;
    const setShowInvitesModal = (skipHeader && typeof setShowInvitesModalFromParent === 'function') ? setShowInvitesModalFromParent : setShowInvitesModalInternal;
    const [expandedSlotId, setExpandedSlotId] = useState(null);
    const [internalMultiSlotTabIndex, setInternalMultiSlotTabIndex] = useState(0);
    const isMultiSlotTabIndexControlled =
        multiSlotActiveTabIndexProp !== undefined &&
        typeof onMultiSlotActiveTabIndexChange === 'function';
    const activeMultiSlotTabIndex = isMultiSlotTabIndexControlled
        ? multiSlotActiveTabIndexProp
        : internalMultiSlotTabIndex;
    const setActiveMultiSlotTabIndex = (idx) => {
        if (isMultiSlotTabIndexControlled) {
            onMultiSlotActiveTabIndexChange(idx);
        } else {
            setInternalMultiSlotTabIndex(idx);
        }
    };
    const [inviteModalGig, setInviteModalGig] = useState(null);
    const [expandedRunningSets, setExpandedRunningSets] = useState({});
    const [showEditTimeModal, setShowEditTimeModal] = useState(false);
    const [editTimeModalMode, setEditTimeModalMode] = useState('both'); // 'name', 'timings', or 'both'
    const gigId = (rawGig ?? internalGigInfo)?.gigId || location.state?.gig?.gigId || '';
    const linkedGigIdsFromNav = Array.isArray(location.state?.linkedGigIds)
        ? location.state.linkedGigIds
        : null;
    const linkedGigIdsKey = linkedGigIdsFromNav?.length
        ? [...linkedGigIdsFromNav].sort().join(',')
        : '';
    const venueName = gigInfo?.venue?.venueName || location.state?.gig?.venue?.venueName || '';

    useEffect(() => {
        if (!gigId) return;
        const activeGig = Array.isArray(gigs) ? gigs.find((gig) => gig.gigId === gigId) : null;
        const fromParent = rawGig?.gigId === gigId ? rawGig : null;
        if (rawGig == null && activeGig) setInternalGigInfo(activeGig);

        const slotIds =
            Array.isArray(fromParent?.gigSlots) && fromParent.gigSlots.length > 0
                ? fromParent.gigSlots
                : Array.isArray(activeGig?.gigSlots) && activeGig.gigSlots.length > 0
                    ? activeGig.gigSlots
                    : null;

        const navLinked =
            Array.isArray(linkedGigIdsFromNav) &&
            linkedGigIdsFromNav.length > 1 &&
            linkedGigIdsFromNav.includes(gigId)
                ? [...new Set(linkedGigIdsFromNav.filter(Boolean))]
                : null;
        const navSiblingIds = navLinked
            ? navLinked.filter((id) => id !== gigId)
            : null;

        const notesSource = activeGig || fromParent;
        if (notesSource && !editingNotes) {
            setNotesValue(notesSource.notes || '');
        }

        if (Array.isArray(slotIds) && slotIds.length > 0) {
            (async () => {
                try {
                    const slotGigs = await getGigsByIds(slotIds);
                    const normalizedSlots = slotGigs.map((gig) => ({
                        ...gig,
                        gigId: gig.id || gig.gigId,
                    }));
                    setRelatedSlots(normalizedSlots);
                } catch (error) {
                    console.error('Error fetching related slots:', error);
                    const anchor = fromParent || activeGig;
                    let fb = [];
                    if (navSiblingIds?.length && Array.isArray(gigs)) {
                        fb = navSiblingIds
                            .map((id) => gigs.find((g) => g.gigId === id))
                            .filter(Boolean);
                    }
                    if (fb.length === 0) {
                        fb = findSlotSiblingsFromFlatGigs(anchor, gigs || []);
                    }
                    if (fb.length > 0) {
                        setRelatedSlots(fb.map((g) => ({ ...g, gigId: g.gigId || g.id })));
                    } else {
                        setRelatedSlots([]);
                    }
                }
            })();
        } else if (navSiblingIds?.length > 0) {
            (async () => {
                try {
                    const slotGigs = await getGigsByIds(navSiblingIds);
                    setRelatedSlots(
                        slotGigs.map((gig) => ({
                            ...gig,
                            gigId: gig.id || gig.gigId,
                        }))
                    );
                } catch (error) {
                    console.error('Error fetching related slots:', error);
                    const anchor = fromParent || activeGig;
                    let fb = [];
                    if (Array.isArray(gigs)) {
                        fb = navSiblingIds
                            .map((id) => gigs.find((g) => g.gigId === id))
                            .filter(Boolean);
                    }
                    if (fb.length === 0) {
                        fb = findSlotSiblingsFromFlatGigs(anchor, gigs || []);
                    }
                    if (fb.length > 0) {
                        setRelatedSlots(fb.map((g) => ({ ...g, gigId: g.gigId || g.id })));
                    } else {
                        setRelatedSlots([]);
                    }
                }
            })();
        } else {
            const anchor = fromParent || activeGig;
            const heuristic = findSlotSiblingsFromFlatGigs(anchor, gigs || []);
            if (heuristic.length > 0) {
                setRelatedSlots(
                    heuristic.map((g) => ({ ...g, gigId: g.gigId || g.id }))
                );
            } else {
                setRelatedSlots([]);
            }
        }
    }, [gigId, gigs, rawGig, editingNotes, linkedGigIdsKey]);

    const markedRef = useRef(new Set()); // gigIds we’ve already marked this session

    useEffect(() => {
      if (!gigInfo) return;
    
      // Only mark if there are unviewed applicants
      const hasUnviewed = Array.isArray(gigInfo.applicants) &&
        gigInfo.applicants.some(a => a?.viewed !== true);
    
      // Don’t call again for the same gig this session
      if (runningOrderSlotTargets || !hasUnviewed || markedRef.current.has(gigInfo.gigId)) {
        // still run musician profiles fetch
        fetchProfiles();
        return;
      }
    
      (async () => {
        try {
          await markApplicantsViewed({ venueId: gigInfo.venueId, gigId: gigInfo.gigId });
          markedRef.current.add(gigInfo.gigId);
        } catch (err) {
          console.error("Error marking applicants viewed:", err);
        } finally {
          fetchProfiles();
        }
      })();
    
      async function fetchProfiles() {
        try {
          // Collect applicants from all slots (current gig + related slots)
          const allSlots = [gigInfo, ...relatedSlots].filter(Boolean);
          const allApplicants = [];
          
          allSlots.forEach((slotGig) => {
            if (!Array.isArray(slotGig.applicants)) return;
            slotGig.applicants.forEach((app) => {
              allApplicants.push({
                ...app,
                slotGigId: slotGig.gigId,
                slotGigName: slotGig.gigName,
                slotStartTime: slotGig.startTime,
              });
            });
          });
          
          const profileApplicants = allApplicants.filter((app) => !isGuestApplicant(app));
          const guestApplicants = allApplicants.filter((app) => isGuestApplicant(app));
          // Get unique profile IDs first. Guests stay on the entry and are not looked up.
          const uniqueProfileIds = [...new Set(profileApplicants.map(app => app.id))];
          
          // Fetch all profiles in parallel (but only once per unique ID)
          const profilePromises = uniqueProfileIds.map(id => getProfileById(id));
          const fetchedProfiles = await Promise.all(profilePromises);
          
          // Create a map of profile ID to profile data
          const profilesMap = new Map();
          uniqueProfileIds.forEach((id, index) => {
            const profile = fetchedProfiles[index];
            if (profile) {
              profilesMap.set(id, {
                ...profile,
                id: id,
                applications: [],
              });
            }
          });
          
          // Add applications to each profile (spread full app so techSetup and other fields are preserved)
          for (const app of profileApplicants) {
            const profileEntry = profilesMap.get(app.id);
            if (profileEntry) {
              profileEntry.applications.push({
                ...app,
                slotGigId: app.slotGigId,
                slotGigName: app.slotGigName,
                slotStartTime: app.slotStartTime,
              });
            }
          }
          
          // Convert to array and create separate entries for each slot application (spread app so techSetup is available on the applicant)
          const profiles = [];
          profilesMap.forEach((profile) => {
            profile.applications.forEach((app) => {
              profiles.push({
                ...profile,
                ...app,
                applicationSlotGigId: app.slotGigId,
                applicationSlotGigName: app.slotGigName,
                applicationSlotStartTime: app.slotStartTime,
              });
            });
          });
          guestApplicants.forEach((app) => {
            profiles.push({
              ...guestViewFromApplicant(app),
              applicationSlotGigId: app.slotGigId,
              applicationSlotGigName: app.slotGigName,
              applicationSlotStartTime: app.slotStartTime,
            });
          });
          
          setMusicianProfiles(profiles);
          setLoading(false);
        } catch (e) {
          console.error("Error fetching profiles:", e);
        }
      }
    }, [gigInfo, relatedSlots, runningOrderSlotTargets]);

    const formatDate = (timestamp) => {
        if (!timestamp) return "—";
        let date;
        if (typeof timestamp.toDate === "function") {
          date = timestamp.toDate();
        }
        else if (timestamp instanceof Date) {
          date = timestamp;
        }
        else if (typeof timestamp === "string") {
          date = new Date(timestamp);
        }
        else if (typeof timestamp === "object" && "seconds" in timestamp) {
          date = new Date(timestamp.seconds * 1000);
        } else {
          return "Invalid date";
        }
        const day = date.getDate();
        const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
        const month = date.toLocaleDateString("en-GB", { month: "long" });
        const getOrdinalSuffix = (d) => {
          if (d > 3 && d < 21) return "th";
          switch (d % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
          }
        };
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const assertOk = (res, name) => {
        if (!res) throw new Error(`${name}: empty response`);
        if (res.error) throw (res.error instanceof Error ? res.error : new Error(`${name}: ${res.error?.message || 'failed'}`));
        return res;
    };

    const handleAccept = async (musicianId, event, proposedFee, musicianEmail, musicianName, slotGigId) => {
        event.stopPropagation();    
        try {
            if (!hasVenuePerm(venues, gigInfo.venueId, 'gigs.applications.manage')) return toast.error('You do not have permission to manage gig applications.');
            if (!gigInfo) return console.error('Gig data is missing');
            
            // Determine which gig to accept for (slot-specific or main gig)
            const targetGig = slotGigId ? [gigInfo, ...relatedSlots].find(g => g.gigId === slotGigId) : gigInfo;
            if (!targetGig) return console.error('Target gig not found');
            
            if (getLocalGigDateTime(targetGig) < new Date()) return toast.error('Gig is in the past.');
            const guestApplicant = (targetGig.applicants || []).find((entry) => entry.id === musicianId && (entry.guest || entry.type === 'guest'));
            setEventLoading(true);
            const nonPayableGig = !FEATURES.payments || targetGig.paymentModel === 'no_fee' || targetGig.kind === 'Open Mic' || targetGig.kind === "Ticketed Gig" || targetGig.budget === '£' || targetGig.budget === '£0';
            let globalAgreedFee;
            let acceptedApplicants = null;
            
            if (targetGig.kind === 'Open Mic') {
                const { updatedApplicants } = assertOk(
                    await acceptGigOfferOM({ gigData: targetGig, musicianProfileId: musicianId, role: 'venue' }),
                    'acceptGigOfferOM'
                );
                if (!Array.isArray(updatedApplicants)) {
                    toast.error('Failed to update gig status. Please try again.');
                    throw new Error('acceptGigOfferOM: updatedApplicants is not an array');
                };
                acceptedApplicants = updatedApplicants;
                
                // Update the target gig
                if (targetGig.gigId === gigInfo.gigId) {
                    setGigInfoState((prevGigInfo) => ({
                        ...prevGigInfo,
                        applicants: updatedApplicants,
                        paid: true,
                    }));
                } else {
                    // Update related slot
                    setRelatedSlots(prev => prev.map(slot => 
                        slot.gigId === slotGigId 
                            ? { ...slot, applicants: updatedApplicants, paid: true }
                            : slot
                    ));
                }
            } else {
                const { updatedApplicants, agreedFee } = assertOk(
                    await acceptGigOffer({ gigData: targetGig, musicianProfileId: musicianId, nonPayableGig, role: 'venue' }),
                    'acceptGigOffer'
                  );
                if (!Array.isArray(updatedApplicants)) {
                    toast.error('Failed to update gig status. Please try again.');
                    throw new Error('acceptGigOffer: no updatedApplicants')
                };
                if (agreedFee == null && !nonPayableGig) {
                    toast.error('Failed to update gig status. Please try again.');
                    throw new Error('acceptGigOffer: no agreedFee')
                };
                acceptedApplicants = updatedApplicants;
                
                // Update the target gig
                if (targetGig.gigId === gigInfo.gigId) {
                    setGigInfoState((prevGigInfo) => ({
                        ...prevGigInfo,
                        applicants: updatedApplicants,
                        agreedFee: `${agreedFee}`,
                        paid: false,
                    }));
                } else {
                    // Update related slot
                    setRelatedSlots(prev => prev.map(slot => 
                        slot.gigId === slotGigId 
                            ? { ...slot, applicants: updatedApplicants, agreedFee: `${agreedFee}`, paid: false }
                            : slot
                    ));
                }
                globalAgreedFee = agreedFee ?? '£';
            }
            
            // If this is a multi-slot gig, decline the musician's applications to other slots
            if (relatedSlots.length > 0) {
                const allSlots = [gigInfo, ...relatedSlots];
                for (const slot of allSlots) {
                    if (slot.gigId === slotGigId || slot.gigId === targetGig.gigId) continue; // Skip the accepted slot
                    
                    const hasPendingApplication = Array.isArray(slot.applicants) && 
                        slot.applicants.some(app => app.id === musicianId && app.status === 'pending');
                    
                    if (hasPendingApplication) {
                        try {
                            await declineGigApplication({ gigData: slot, musicianProfileId: musicianId, role: 'venue' });
                        } catch (error) {
                            console.error(`Error declining application for slot ${slot.gigId}:`, error);
                        }
                    }
                }
            }
            
            if (acceptedApplicants) {
                const filledStatuses = ['confirmed', 'accepted', 'paid', 'payment processing'];
                const night = [gigInfo, ...relatedSlots].filter(Boolean).map((slot) => (
                    slot.gigId === targetGig.gigId ? { ...slot, applicants: acceptedApplicants } : slot
                ));
                const seen = new Set();
                const unique = night.filter((slot) => {
                    if (!slot?.gigId || seen.has(slot.gigId)) return false;
                    seen.add(slot.gigId);
                    return true;
                });
                const slotFilled = (slot) => {
                    const apps = Array.isArray(slot?.applicants) ? slot.applicants : [];
                    if (slot?.kind === 'Open Mic') return apps.some((entry) => entry?.status === 'confirmed');
                    const rawMax = Number(slot?.maxApplicants);
                    const cap = Number.isFinite(rawMax) && rawMax >= 1 ? Math.floor(rawMax) : 1;
                    return apps.filter((entry) => filledStatuses.includes(entry?.status)).length >= cap;
                };
                const stillOpen = unique.filter((slot) => slot.applicationsOpen !== false);
                if (stillOpen.length && unique.length) {
                    const allFilled = unique.every(slotFilled);
                    setCloseApplicationsGigIds(stillOpen.map((slot) => slot.gigId));
                    setCloseApplicationsPrompt(allFilled ? 'filled' : 'rest');
                }
            }

            if (guestApplicant) {
                toast.success('Guest application accepted.');
                refreshGigs();
                return;
            }
            const musicianProfile = await getProfileById(musicianId);
            const venueProfile = await getVenueProfileById(targetGig.venueId);
            if (FEATURES.chat) {
            const { conversationId } = await getOrCreateConversation({ musicianProfile, gigData: targetGig, venueProfile, type: 'application' });
            if (proposedFee === targetGig.budget) {
                const applicationMessage = await getMostRecentMessage(conversationId, 'application');
                if (applicationMessage?.id) {
                    await sendGigAcceptedMessage({
                        conversationId,
                        originalMessageId: applicationMessage.id,
                        senderId: user.uid,
                        agreedFee: targetGig.budget,
                        userRole: 'venue',
                        nonPayableGig,
                    });
                }
            } else {
                const applicationMessage = await getMostRecentMessage(conversationId, 'negotiation');
                if (applicationMessage?.id) {
                    await sendGigAcceptedMessage({
                        conversationId,
                        originalMessageId: applicationMessage.id,
                        senderId: user.uid,
                        agreedFee: globalAgreedFee,
                        userRole: 'venue',
                        nonPayableGig,
                    });
                }
            }
            }
            await sendGigAcceptedEmail({
                userRole: 'venue',
                musicianProfile: musicianProfile,
                venueProfile: venueProfile,
                gigData: targetGig,
                agreedFee: globalAgreedFee,
                isNegotiated: false,
                nonPayableGig,
            })
            if (nonPayableGig && FEATURES.payments) {
                // Only fan out the "gig confirmed" notice to other applicants
                // once the listing has filled to its `maxApplicants` cap —
                // otherwise we'd tell pending artists the gig is gone while
                // the venue is still actively booking more acts. Open Mic
                // listings without an explicit cap are treated as unlimited
                // (matching server-side OM semantics — they stay open until
                // the venue closes them manually).
                const rawMax = Number(targetGig?.maxApplicants);
                const hasExplicitMax = Number.isFinite(rawMax) && rawMax >= 1;
                const isOpenMicGig = targetGig?.kind === 'Open Mic';
                const maxApplicants = hasExplicitMax ? Math.max(1, Math.floor(rawMax)) : (isOpenMicGig ? Infinity : 1);
                const apps = Array.isArray(targetGig.applicants) ? targetGig.applicants : [];
                const wasAlreadyConfirmed = apps.some((a) => a?.id === musicianId && a?.status === 'confirmed');
                const baseConfirmed = apps.filter((a) => a?.status === 'confirmed').length;
                const confirmedCount = wasAlreadyConfirmed ? baseConfirmed : baseConfirmed + 1;
                if (confirmedCount >= maxApplicants) {
                    await notifyOtherApplicantsGigConfirmed({ gigData: targetGig, acceptedMusicianId: musicianId });
                }
            }
            
            // Refresh gigs to get updated data
            refreshGigs();
        } catch (error) {
            toast.error('Error accepting gig application. Please try again.')
            console.error('Error updating gig document:', error);
        } finally {
            setEventLoading(false);
        }
    };

    const handleReject = async (musicianId, event, proposedFee, musicianEmail, musicianName, slotGigId) => {
        event.stopPropagation();
        try {
            if (!hasVenuePerm(venues, gigInfo.venueId, 'gigs.applications.manage')) return toast.error('You do not have permission to manage gig applications.');
            if (!gigInfo) return console.error('Gig data is missing');
            
            // Determine which gig to decline for (slot-specific or main gig)
            const targetGig = slotGigId ? [gigInfo, ...relatedSlots].find(g => g.gigId === slotGigId) : gigInfo;
            if (!targetGig) return console.error('Target gig not found');
            
            if (getLocalGigDateTime(targetGig) < new Date()) return toast.error('Gig is in the past.');
            const guestApplicant = (targetGig.applicants || []).find((entry) => entry.id === musicianId && (entry.guest || entry.type === 'guest'));
            setEventLoading(true);
            const {updatedApplicants} = assertOk(
                await declineGigApplication({ gigData: targetGig, musicianProfileId: musicianId, role: 'venue' }),
                'declineGigApplication'
            );
            if (!Array.isArray(updatedApplicants)) {
                toast.error('Failed to update gig status. Please try again.');
                throw new Error('declineGigApplication: no updatedApplicants')
            };
            
            // Update the target gig
            if (targetGig.gigId === gigInfo.gigId) {
                setGigInfoState((prevGigInfo) => ({
                    ...prevGigInfo,
                    applicants: updatedApplicants,
                }));
            } else {
                // Update related slot
                setRelatedSlots(prev => prev.map(slot => 
                    slot.gigId === slotGigId 
                        ? { ...slot, applicants: updatedApplicants }
                        : slot
                ));
            }
            
            if (guestApplicant) {
                toast.success('Guest application declined.');
                refreshGigs();
                return;
            }
            const musicianProfile = await getProfileById(musicianId);
            const venueProfile = await getVenueProfileById(targetGig.venueId);
            if (FEATURES.chat) {
            const { conversationId } = await getOrCreateConversation({ musicianProfile, gigData: targetGig, venueProfile, type: 'application' })
            if (proposedFee === targetGig.budget) {
                const applicationMessage = await getMostRecentMessage(conversationId, 'application');
                await updateDeclinedApplicationMessage({ conversationId, originalMessageId: applicationMessage.id, senderId: user.uid, userRole: 'venue', fee: targetGig.budget });
            } else {
                const applicationMessage = await getMostRecentMessage(conversationId, 'negotiation');
                await updateDeclinedApplicationMessage({ conversationId, originalMessageId: applicationMessage.id, senderId: user.uid, userRole: 'venue', fee: proposedFee });
            }
            }
            await sendGigDeclinedEmail({
                userRole: 'venue',
                venueProfile: venueProfile,
                musicianProfile: musicianProfile,
                gigData: targetGig,
            })
            
            // Refresh gigs to get updated data
            refreshGigs();
        } catch (error) {
            toast.error('Error declining gig application. Please try again.')
            console.error('Error updating gig document:', error);
        } finally {
            setEventLoading(false);
        }
    };

    const sendToConversation = async (userId, gigIdOverride = null, musicianProfileId = null) => {
        try {
            const gid = gigIdOverride ?? gigInfo.gigId;
            let conversations = [];
            if (musicianProfileId) {
                conversations = await getConversationsByGigAndMusicianProfileId(gid, musicianProfileId);
            }
            if (!conversations?.length && userId) {
                conversations = await getConversationsByParticipantAndGigId(gid, userId);
            }
            const conversationId = conversations?.[0]?.id;
            if (!conversationId) {
                toast.error('No conversation found.');
                return;
            }
            navigate(`/venues/dashboard/messages?conversationId=${conversationId}`);
        } catch (err) {
            console.error(err);
            toast.error('Could not open messages.');
        }
    };

    const openBookedArtistTechRider = async (slotGig, profile, applicant) => {
        const participantId = profile?.id;
        if (!participantId) return;
        setBookedArtistTechRiderLoading(true);
        try {
            const [loadedProfile, venueProfile] = await Promise.all([
                getProfileById(participantId),
                slotGig?.venueId ? getVenueProfileById(slotGig.venueId) : Promise.resolve(null),
            ]);
            const artistProfile = loadedProfile || profile;
            if (!artistProfile) {
                toast.error('Could not load artist profile.');
                return;
            }
            const techRider = artistProfile?.techRider;
            const hasRider = techRider?.isComplete && techRider?.lineup?.length > 0;
            const mergedTechSetup = mergeBookedArtistTechSetup(slotGig, applicant);
            const hasAppSetup = techSetupPayloadHasContent(mergedTechSetup);
            const venueRider = venueProfile?.techRider;
            const hasVenueRider = venueRider?.isComplete && venueRider?.lineup?.length > 0;
            if (!hasRider && !hasAppSetup && !hasVenueRider) {
                toast.info('No tech spec available.');
                return;
            }
            setBookedArtistTechRiderModal({
                artistProfile,
                venueTechRider: venueRider ?? null,
                applicant: applicant ?? null,
                applicationTechSetup: hasAppSetup ? mergedTechSetup : null,
            });
        } catch (err) {
            console.error(err);
            toast.error('Could not load tech spec.');
        } finally {
            setBookedArtistTechRiderLoading(false);
        }
    };

    const handleCompletePayment = async (profileId, slotGigId = null) => {
        // Find the correct slot gig for payment
        const targetSlotGigId = slotGigId || gigInfo.gigId;
        const targetSlotGig = targetSlotGigId === gigInfo.gigId 
            ? gigInfo 
            : relatedSlots.find(s => s.gigId === targetSlotGigId) || gigInfo;
        
        if (getLocalGigDateTime(targetSlotGig) < new Date()) return toast.error('Gig is in the past.');
        if (!hasVenuePerm(venues, targetSlotGig.venueId, 'gigs.pay')) return toast.error('You do not have permission to pay for gigs.');
        setLoadingPaymentDetails(true);
        try {
            const cards = await fetchSavedCards();
            setSavedCards(cards);
            setShowPaymentModal(true);
            setMusicianProfileId(profileId);
            // Store the slot gig so we can use it in PaymentModal
            setPaymentSlotGig(targetSlotGig);
        } catch (error) {
            toast.info("We couldn't access your saved cards. Sorry for any inconvenience.")
            console.error('Error fetching saved cards:', error);
        } finally {
            setLoadingPaymentDetails(false);
        }
    };

    const handleSelectCard = async (cardId) => {
        if (!hasVenuePerm(venues, gigInfo.venueId, 'gigs.pay')) return toast.error('You do not have permission to pay for gigs.');
        setMakingPayment(true);
        try {
            const customerId = (savedCards.find(c => c.id === cardId) || {}).customer || null;
            // Use the payment slot gig if available, otherwise fall back to gigInfo
            const targetGigForPayment = paymentSlotGig || gigInfo;
            const result = await confirmGigPayment({ cardId, gigData: targetGigForPayment, musicianProfileId, customerId });
            if (result.success && result.paymentIntent) {
                const piId = result?.paymentIntent?.id;
                if (piId) setWatchPaymentIntentId(piId);
                setPaymentSuccess(true);
                setGigInfoState(prev => ({
                    ...prev,
                    applicants: prev.applicants.map(applicant =>
                        applicant.id === musicianProfileId
                            ? { ...applicant, status: 'payment processing' }
                            : applicant
                    )
                }));
                setMakingPayment(false);
                toast.info("Processing your payment...");
            } else if (result.requiresAction && result.clientSecret) {
                const stripe = await stripePromise;
                const { error, paymentIntent } = await stripe.confirmCardPayment(result.clientSecret, { payment_method: result.paymentMethodId || cardId });
                if (error) {
                  setPaymentSuccess(false);
                  toast.error(error.message || 'Authentication failed. Please try another card.');
                  return;
                }
                setPaymentSuccess(true);
                setGigInfoState(prev => ({
                    ...prev,
                    applicants: prev.applicants.map(applicant =>
                        applicant.id === musicianProfileId
                            ? { ...applicant, status: 'payment processing' }
                            : applicant
                    )
                }));
                toast.info('Payment authenticated. Finalizing…');
                setMakingPayment(false);
                return;
            } else {
                setPaymentSuccess(false);
                toast.error(result.error || 'Payment failed. Please try again.');
                setMakingPayment(false);
            }
        } catch (error) {
            console.error('Error completing payment:', error);
            setMusicianProfileId(null);
            setPaymentSuccess(false);
            toast.error('An error occurred while processing the payment. Please try again.');
        } finally {
            setMakingPayment(false);
            refreshStripe();
        }
    };

    const formatDisputeDate = (timestamp) => {
        if (!timestamp || !timestamp.toDate) return '24 hours after the gig started';
        const date = timestamp.toDate();
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
        const year = date.getFullYear().toString().slice(-2); // Last two digits of the year
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes} ${day}/${month}/${year}`;
    };

    const openEditGigModal = (gig) => {
        // Every edit entry (single-slot and multi-slot) now routes through
        // the unified AddGigsModal. The Book-an-Event wizard renders per-slot
        // set rows when `extraSlots` are present, and the update path writes
        // each of the `existingGigIds` Firestore docs in place.
        //
        // Records originally created via "Add existing" (private, manually
        // confirmed artist) re-enter the addExisting variant so the editor
        // shows per-set Artist inputs and skips public-listing chrome.
        const isAddExistingOriginGig = (g) => {
            if (!g) return false;
            const apps = Array.isArray(g.applicants) ? g.applicants : [];
            return g.private === true && apps.some((a) => a?.status === 'confirmed' && !a?.id && !a?.artistId);
        };
        const isMultiSlotGroup = allSlots.length > 1;

        if (isMultiSlotGroup) {
            const sortedSlots = [...allSlots].sort((a, b) => {
                if (!a.startTime || !b.startTime) return 0;
                const [aH, aM] = a.startTime.split(':').map(Number);
                const [bH, bM] = b.startTime.split(':').map(Number);
                return (aH * 60 + aM) - (bH * 60 + bM);
            });

            const primaryGig = sortedSlots[0];
            const baseGigName = primaryGig.gigName.replace(/\s*\(Set\s+\d+\)\s*$/, '');

            const extraSlots = sortedSlots.slice(1).map(slot => ({
                startTime: slot.startTime,
                duration: slot.duration,
            }));

            const slotBudgets = sortedSlots.map(slot => {
                if (slot.kind === 'Open Mic' || slot.kind === 'Ticketed Gig') return null;
                const budgetStr = slot.budget || '';
                if (budgetStr === '£0' || budgetStr === '£' || !budgetStr) return null;
                const numericValue = budgetStr.replace(/[^0-9.]/g, '');
                return numericValue && parseFloat(numericValue) > 0 ? parseFloat(numericValue) : null;
            });

            // Per-set confirmed artist names — read from each slot's applicants
            // so editing a multi-set addExisting record pre-fills the right
            // name for each set's row.
            const artistNames = sortedSlots.map(slot => {
                const apps = Array.isArray(slot.applicants) ? slot.applicants : [];
                const confirmed = apps.find(a => a?.status === 'confirmed');
                return confirmed?.name ?? slot.artistName ?? '';
            });

            const startDT = toJsDate(primaryGig.startDateTime) ?? toJsDate(primaryGig.date);
            const dateOnly = startDT
                ? new Date(startDT.getFullYear(), startDT.getMonth(), startDT.getDate())
                : (primaryGig.date?.toDate ? primaryGig.date.toDate() : (primaryGig.date instanceof Date ? primaryGig.date : null));

            const convertedGig = {
                ...primaryGig,
                gigName: baseGigName,
                date: dateOnly,
                extraSlots: extraSlots,
                slotBudgets: slotBudgets,
                artistNames,
                existingGigIds: sortedSlots.map(slot => slot.gigId),
            };
            const mode = sortedSlots.some(isAddExistingOriginGig) ? 'addExisting' : 'bookNew';
            setAddGigsEditData?.(convertedGig);
            setAddGigsMode?.(mode);
            setShowAddGigsModal?.(true);
            return;
        }

        const startDT = toJsDate(gig.startDateTime) ?? toJsDate(gig.date);
        const dateOnly = startDT
            ? new Date(startDT.getFullYear(), startDT.getMonth(), startDT.getDate())
            : (gig.date?.toDate ? gig.date.toDate() : (gig.date instanceof Date ? gig.date : null));

        const convertedGig = {
            ...gig,
            date: dateOnly,
            existingGigIds: [gig.gigId],
        };
        const mode = isAddExistingOriginGig(gig) ? 'addExisting' : 'bookNew';
        setAddGigsEditData?.(convertedGig);
        setAddGigsMode?.(mode);
        setShowAddGigsModal?.(true);
    }

    const handleDeleteGig = async () => {
        try {
            setModalLoading(true);
            await deleteGigAndInformation({ gigId });
            navigate('/venues/dashboard/gigs');
            toast.success('Gig Deleted');
            window.location.reload();
        } catch (error) {
            console.error('Error deleting gig:', error);
            toast.error('Failed to delete gig. Please try again.');
        } finally {
            setModalLoading(false)
        }
    };

    const handleCloseGigLocal = async () => {
        try {
            await updateGigDocument({ gigId, action: 'gigs.applications.manage', updates: { status: 'closed' } });
            navigate('/venues/dashboard/gigs');
            toast.success(`Gig Closed`);
            refreshGigs();
        } catch (error) {
            console.error('Error closing gig:', error);
            toast.error('Failed to update gig status.');
        }
    }

    const handleReopenGig = async () => {
        try {
            await updateGigDocument({ gigId, action: 'gigs.applications.manage', updates: { status: 'open' } });
            navigate('/venues/dashboard/gigs');
            toast.success(`Gig Opened`);
            refreshGigs();
        } catch (error) {
            console.error('Error closing gig:', error);
            toast.error('Failed to update gig status.');
        }
    }

    const closeModal = () => {
        setVideoToPlay(null);
    };

    const formatCancellationReason = (reason) => {
        if (reason === 'fee') {
            return "they're not happy with the fee";
        } else if (reason === 'availability') {
            return 'of availability';
        } else if (reason === 'double-booking') {
            return 'of a double booking';
        } else if (reason === 'personal-reasons') {
            return 'of personal reasons';
        } else if (reason === 'illness') {
            return 'of illness';
        } else if (reason === 'information') {
            return 'of not enough information';
        } else {
            return 'of other reasons';
        }
    }

    const copyToClipboard = copyToClipboardProp ?? ((link) => {
        navigator.clipboard.writeText(`${link}`).then(() => {
            toast.success(`Copied Gig Link: ${link}`);
        }).catch((err) => {
            toast.error('Failed to copy link. Please try again.');
            console.error('Failed to copy link: ', err);
        });
    });

    const calculateEndTime = (startTime, duration) => {
        if (!startTime || !duration) return null;
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    };

    // Sorted slots for card layout (main gig + related slots by start time)
    const sortedSlots = useMemo(() => {
        const byId = new Map();
        [gigInfo, ...relatedSlots].filter(Boolean).forEach((g) => {
            if (g?.gigId) byId.set(g.gigId, g);
        });
        const all = [...byId.values()];
        return all.sort((a, b) => {
            if (!a.startTime || !b.startTime) return 0;
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
        });
    }, [gigInfo, relatedSlots]);

    // Helper to get slot number (1-indexed)
    const getSlotNumber = (slotGigId) => {
        const index = sortedSlots.findIndex(s => s.gigId === slotGigId);
        return index >= 0 ? index + 1 : null;
    };

    useEffect(() => {
        if (isMultiSlotTabIndexControlled) return;
        setInternalMultiSlotTabIndex(0);
    }, [gigInfo?.gigId, relatedSlots, isMultiSlotTabIndexControlled]);

    /** Mark the active set’s applicants viewed when the venue opens that tab (clears notification dot after refresh). */
    useEffect(() => {
        if (runningOrderSlotTargets || !useCardLayout || sortedSlots.length <= 1 || !gigInfo?.venueId) return;
        const idx = Math.min(
            Math.max(0, activeMultiSlotTabIndex),
            sortedSlots.length - 1
        );
        const slotGig = sortedSlots[idx];
        if (!slotGig?.gigId || !gigSlotHasUnviewedApplicants(slotGig)) return;
        let cancelled = false;
        (async () => {
            try {
                await markApplicantsViewed({ venueId: gigInfo.venueId, gigId: slotGig.gigId });
                if (!cancelled) refreshGigs?.();
            } catch (err) {
                console.error('Error marking slot applicants viewed:', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [
        useCardLayout,
        sortedSlots,
        activeMultiSlotTabIndex,
        gigInfo?.venueId,
        refreshGigs,
        runningOrderSlotTargets,
    ]);

    // Helper to get slot status
    const getSlotStatus = (slotGig) => {
        if (!slotGig) return 'empty';
        const confirmed = slotGig.applicants?.find(app => ['confirmed', 'accepted', 'paid'].includes(app?.status));
        if (confirmed) return 'confirmed';
        const count = slotGig.applicants?.length ?? 0;
        return count > 0 ? 'applications' : 'empty';
    };

    // Helper to get confirmed artist for a slot
    const getConfirmedArtistForSlot = (slotGig) => {
        if (!slotGig || !Array.isArray(slotGig.applicants)) return null;
        const confirmed = slotGig.applicants.find(app => ['confirmed', 'accepted', 'paid'].includes(app?.status));
        return confirmed ? confirmed.id : null;
    };

    const handleSaveNotes = async () => {
        if (!hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')) {
            toast.error('You do not have permission to update this gig.');
            setEditingNotes(false);
            setNotesValue(gigInfo.notes || '');
            return;
        }
        setSavingNotes(true);
        try {
            await updateGigDocument({
                gigId: gigInfo.gigId,
                action: 'gigs.update',
                updates: { notes: notesValue.trim() || null }
            });
            
            setEditingNotes(false);
            if (notesTextareaRef.current) {
                notesTextareaRef.current.blur();
            }
            refreshGigs();
        } catch (error) {
            console.error('Error updating notes:', error);
            toast.error('Failed to update notes. Please try again.');
            setNotesValue(gigInfo.notes || '');
        } finally {
            setSavingNotes(false);
        }
    };

      const handleCancelGig = async () => {
        if (!gigInfo) return;
        setModalLoading(true);
        try {
            const nextGig = cancelSlotGig || gigInfo;
            const gigId = nextGig.gigId;
            const venueProfile = await getVenueProfileById(nextGig.venueId);
            const isOpenMic = nextGig.kind === 'Open Mic';
            const isTicketed = nextGig.kind === 'Ticketed Gig';
            const isPartialSlotCancel =
                Boolean(cancelSlotGig) && useCardLayout && sortedSlots.length > 1;
            if (!isOpenMic && !isTicketed) {
                const taskNames = [
                    nextGig.clearPendingFeeTaskName,
                    nextGig.automaticMessageTaskName,
                ];
                await cancelGigAndRefund({
                    taskNames,
                    transactionId: nextGig.paymentIntentId,
                    gigId: nextGig.gigId,
                    venueId: nextGig.venueId,
                });
            }
            const handleMusicianCancellation = async (musician) => {
                if (!musician) {
                    console.error('Musician profile is null');
                    return;
                }
                // Normalize profile for API compatibility
                const normalizedProfile = {
                    ...musician,
                    musicianId: musician.id || musician.profileId || musician.musicianId,
                    profileId: musician.id || musician.profileId || musician.musicianId,
                };
                const { conversationId } = await getOrCreateConversation({ musicianProfile: normalizedProfile, gigData: nextGig, venueProfile, type: 'cancellation' });
                await postCancellationMessage(
                  { conversationId, senderId: user.uid, message: `${nextGig.venue.venueName} has unfortunately had to cancel because ${formatCancellationReason(
                    cancellationReason
                  )}. We apologise for any inconvenience caused.`, cancellingParty: 'venue' }
                );
                const musicianId = normalizedProfile.musicianId;
                await revertGigAfterCancellationVenue({ gigData: nextGig, musicianId, cancellationReason });
                await cancelledGigMusicianProfileUpdate({ musicianId, gigId });
                const cancellingParty = 'venue';
                await logGigCancellation({ gigId, musicianId, reason: cancellationReason, cancellingParty, venueId: venueProfile.venueId });
              };
          
              const cancelBookedApplicant = async (applicant) => {
                if (isGuestApplicant(applicant)) {
                  await revertGigAfterCancellationVenue({ gigData: nextGig, musicianId: applicant.id, cancellationReason });
                  await logGigCancellation({ gigId, musicianId: applicant.id, reason: cancellationReason, cancellingParty: 'venue', venueId: venueProfile.venueId });
                  return;
                }
                const musicianProfile = await getProfileById(applicant.id);
                await handleMusicianCancellation(musicianProfile);
              };
              if (isOpenMic) {
                const booked = nextGig.applicants
                  .filter(app => ['confirmed', 'accepted', 'paid'].includes(app?.status));
                for (const applicant of booked) {
                  await cancelBookedApplicant(applicant);
                }
            } else {
              const confirmedApplicant = nextGig.applicants.find(app => ['confirmed', 'accepted', 'paid'].includes(app?.status));
              if (!confirmedApplicant) {
                console.error("No confirmed applicant found");
                return;
              }
              await cancelBookedApplicant(confirmedApplicant);
            }
            setCancellationReason({
                reason: '',
                extraDetails: '',
            })
            setModalLoading(false);
            setShowCancelConfirmationModal(false);
            setCancelSlotGig(null);
            if (isPartialSlotCancel) {
                refreshGigs?.();
                toast.success('Booking cancelled.');
            } else {
                navigate('/venues/dashboard/gigs');
                toast.success('Gig cancellation successful.');
            }
        } catch (error) {
            console.error('Error canceling task:', error.message);
            setModalLoading(false);
            toast.error('Failed to cancel gig.')
        }
    };

    // Find all related slots if this is a grouped gig
    const allSlots = useMemo(() => {
        if (!gigInfo) return [];
        const combinedById = new Map();
        [gigInfo, ...relatedSlots].filter(Boolean).forEach((g) => {
            if (g?.gigId) combinedById.set(g.gigId, g);
        });
        if (combinedById.size > 1) {
            return [...combinedById.values()].sort((a, b) => {
                if (!a.startTime || !b.startTime) return 0;
                const [aH, aM] = a.startTime.split(':').map(Number);
                const [bH, bM] = b.startTime.split(':').map(Number);
                return (aH * 60 + aM) - (bH * 60 + bM);
            });
        }
        if (!gigs || !Array.isArray(gigInfo.gigSlots) || gigInfo.gigSlots.length === 0) {
            return [gigInfo].filter(Boolean);
        }
        const slots = [gigInfo];
        const processed = new Set([gigInfo.gigId]);
        const queue = [...gigInfo.gigSlots];

        while (queue.length > 0) {
            const slotId = queue.shift();
            if (processed.has(slotId)) continue;

            const slotGig = gigs.find(g => g.gigId === slotId);
            if (slotGig) {
                slots.push(slotGig);
                processed.add(slotId);

                if (Array.isArray(slotGig.gigSlots)) {
                    slotGig.gigSlots.forEach(id => {
                        if (!processed.has(id)) {
                            queue.push(id);
                        }
                    });
                }
            }
        }

        return slots.sort((a, b) => {
            if (!a.startTime || !b.startTime) return 0;
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
        });
    }, [gigInfo, relatedSlots, gigs]);

    // Calculate date and time display
    const dateTimeDisplay = useMemo(() => {
        if (!gigInfo) return '';

        let dateObj = null;
        if (gigInfo.date?.toDate && typeof gigInfo.date.toDate === 'function') {
            dateObj = gigInfo.date.toDate();
        } else if (gigInfo.date instanceof Date) {
            dateObj = gigInfo.date;
        } else if (gigInfo.date != null && gigInfo.date !== '') {
            dateObj = new Date(gigInfo.date);
        }
        if (!dateObj || Number.isNaN(dateObj.getTime())) {
            const iso = gigInfo.dateIso != null ? String(gigInfo.dateIso).trim() : '';
            if (iso) {
                dateObj = new Date(`${iso}T12:00:00`);
            }
        }
        if (!dateObj || Number.isNaN(dateObj.getTime())) return '';

        const formattedDate = format(dateObj, 'EEEE do MMMM');
        
        if (allSlots.length > 1) {
            // For grouped gigs, find earliest start and latest end
            const slotsWithTime = allSlots.filter(s => s.startTime && s.duration);
            if (slotsWithTime.length > 0) {
                const firstSlot = slotsWithTime[0];
                const lastSlot = slotsWithTime[slotsWithTime.length - 1];
                const firstStartTime = firstSlot.startTime;
                const lastEndTime = calculateEndTime(lastSlot.startTime, lastSlot.duration);
                return `${formattedDate} • ${firstStartTime}-${lastEndTime}`;
            }
        }
        
        // For single gigs
        if (gigInfo.startTime && gigInfo.duration) {
            const endTime = calculateEndTime(gigInfo.startTime, gigInfo.duration);
            return `${formattedDate} • ${gigInfo.startTime}-${endTime}`;
        }
        
        return formattedDate;
    }, [gigInfo, allSlots]);

    // Check if any slot has a confirmed musician
    const hasAnyConfirmed = useMemo(() => {
        if (!gigInfo) return false;
        const allSlotsToCheck = [gigInfo, ...relatedSlots].filter(Boolean);
        return allSlotsToCheck.some(slot => 
            Array.isArray(slot?.applicants) &&
            slot.applicants.some(a => ['confirmed', 'paid'].includes(a?.status))
        );
    }, [gigInfo, relatedSlots]);

    if (loading || !gigInfo) {
        return <LoadingScreen />;
    }

    const hasConfirmed =
    Array.isArray(gigInfo?.applicants) &&
    gigInfo.applicants.some(a => ['confirmed', 'accepted', 'paid'].includes(a?.status));

    const gigDateTime = getLocalGigDateTime(gigInfo);
    const clearing = gigInfo?.disputeClearingTime?.toDate?.();

    const showDispute =
        hasConfirmed &&
        !!gigDateTime &&
        !!clearing &&
        clearing > gigDateTime && 
        !gigInfo?.disputeLogged && 
        gigDateTime < now &&
        !gigInfo.venueHasReviewed;

    const disputeLogged = 
        hasConfirmed &&
        !!gigDateTime &&
        !!gigInfo?.disputeLogged &&
        gigDateTime < now;

    const applicationsTableOrEmpty = musicianProfiles.length > 0 ? (
        <table className='applications-table'>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Video</th>
                    <th>Fee</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {musicianProfiles
                    .filter((profile) => {
                        const slotGigId = profile.applicationSlotGigId || gigInfo.gigId;
                        const slotGig = slotGigId === gigInfo.gigId ? gigInfo : relatedSlots.find(s => s.gigId === slotGigId) || gigInfo;
                        const applicant = slotGig?.applicants?.find(applicant => applicant.id === profile.id);
                        const status = applicant ? applicant.status : (profile.status || 'pending');
                        if (status === 'declined') {
                            if (applicant?.declinedForOtherSet) return true;
                            const allSlots = [gigInfo, ...relatedSlots].filter(Boolean);
                            const hasInviteOnOtherSlot = allSlots.some(slot => {
                                if (slot.gigId === slotGigId) return false;
                                const otherApplicant = slot.applicants?.find(app => app.id === profile.id);
                                return otherApplicant && (otherApplicant.invited || (otherApplicant.status === 'pending' && otherApplicant.sentBy === 'venue'));
                            });
                            return !hasInviteOnOtherSlot;
                        }
                        return true;
                    })
                    .map((profile) => {
                        const slotGigId = profile.applicationSlotGigId || gigInfo.gigId;
                        const slotGig = slotGigId === gigInfo.gigId ? gigInfo : relatedSlots.find(s => s.gigId === slotGigId) || gigInfo;
                        const applicant = slotGig?.applicants?.find(applicant => applicant.id === profile.id);
                        const sender = applicant ? applicant.sentBy : (profile.sentBy || 'musician');
                        const status = applicant ? applicant.status : (profile.status || 'pending');
const gigAlreadyConfirmed = slotGig?.applicants?.some((a) => ['confirmed', 'accepted', 'paid'].includes(a?.status));
                                        const slotNumber = getSlotNumber(slotGigId);
                                        const isInvited = sender === 'venue' || applicant?.invited;
                                        const appliedToSlotText = relatedSlots.length > 0 && slotNumber ? (isInvited ? `Invited to Slot ${slotNumber}` : `Applied for Slot ${slotNumber}`) : null;
                                        return (
                                            <tr key={profile.id + (slotGigId || '')}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {profile.heroMedia?.url && (
                                            <img src={profile.heroMedia.url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                                        )}
                                        <div>
                                            <button type="button" className="btn text" style={{ padding: 0, fontWeight: 600 }} onClick={(e) => {
                                                if (isGuestApplicant(profile)) { e.stopPropagation(); setGuestDetail(profile); return; }
                                                openInNewTab(`/artist/${profile.id}`, e);
                                            }}>
                                                {profile.name}
                                                {isGuestApplicant(profile) && <span className="ga-guest-tag">Guest</span>}
                                            </button>
                                            {appliedToSlotText && <div style={{ fontSize: '0.8rem', color: 'var(--gn-grey-600)' }}>{appliedToSlotText}</div>}
                                        </div>
                                    </div>
                                </td>
                                <td>{profile.video?.file ? <button type="button" className="btn tertiary" onClick={() => setVideoToPlay(profile.video)}>Play</button> : '—'}</td>
                                <td>{profile.fee ?? '—'}</td>
                                <td>
                                    {status === 'pending' && !gigAlreadyConfirmed && (
                                        <div className="status-box">
                                            <div className="status pending">Pending</div>
                                        </div>
                                    )}
                                    {(status === 'confirmed' || status === 'paid' || status === 'accepted') && (
                                        <div className="status-box">
                                            <div className="status confirmed"><TickIcon /> Confirmed</div>
                                        </div>
                                    )}
                                    {status === 'declined' && (
                                        <div className="status-box">
                                            <div className="status declined"><ErrorIcon /> Declined</div>
                                            {applicant?.declinedForOtherSet ? (
                                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--gn-grey-600)', lineHeight: 1.35 }}>
                                                    Confirmed for another set — closed automatically.
                                                </p>
                                            ) : null}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
            </tbody>
        </table>
    ) : gigInfo.status === 'closed' ? (
        <div className='no-applications'>
            <h4>This Gig has been closed.</h4>
            {hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                <button className='btn primary' onClick={handleReopenGig}>Reopen Gig to Applications</button>
            )}
        </div>
    ) : (
        <div className='venue-hire-confirmed-card__empty'>
            <p className='venue-hire-confirmed-card__empty-text'>No applications yet.</p>
        </div>
    );

    // Per-slot applications: hire-style tiles when useCardLayout (venue gig details), else table
    const getSlotProfilesForSlot = (slotGig) => {
        const slotGigId = slotGig?.gigId;
        return musicianProfiles.filter((p) => {
            if ((p.applicationSlotGigId || gigInfo?.gigId) !== slotGigId) return false;
            const slotGigIdX = p.applicationSlotGigId || gigInfo.gigId;
            const slotGigX = slotGigIdX === gigInfo.gigId ? gigInfo : relatedSlots.find((s) => s.gigId === slotGigIdX) || gigInfo;
            const ap = slotGigX?.applicants?.find((a) => a.id === p.id);
            const st = ap ? ap.status : (p.status || 'pending');
            if (st === 'declined') {
                if (ap?.declinedForOtherSet) return true;
                const allSlots = [gigInfo, ...relatedSlots].filter(Boolean);
                const hasInviteOnOtherSlot = allSlots.some((slot) => {
                    if (slot.gigId === slotGigIdX) return false;
                    const otherApplicant = slot.applicants?.find((app) => app.id === p.id);
                    return otherApplicant && (otherApplicant.invited || (otherApplicant.status === 'pending' && otherApplicant.sentBy === 'venue'));
                });
                return !hasInviteOnOtherSlot;
            }
            return true;
        });
    };

    const getBookedApplicantForSlot = (slotGig) => {
        if (!slotGig?.applicants) return null;
        return slotGig.applicants.find((a) => BOOKED_APPLICANT_STATUSES.includes(a?.status)) || null;
    };

    const getProfileForBookedApplicant = (applicant) => {
        if (!applicant?.id) return null;
        return musicianProfiles.find((p) => p.id === applicant.id) || null;
    };

    const getPendingSlotProfilesForSlot = (slotGig) =>
        getSlotProfilesForSlot(slotGig).filter((p) => {
            const ap = slotGig?.applicants?.find((a) => a.id === p.id);
            const st = ap ? ap.status : (p.status || 'pending');
            return !BOOKED_APPLICANT_STATUSES.includes(st);
        });

    const renderSlotApplicationTileSecondaryActions = (profile, slotGig, slotGigId) => {
        const applicant = slotGig?.applicants?.find((a) => a.id === profile.id);
        const sender = applicant ? applicant.sentBy : (profile.sentBy || 'musician');
        const status = applicant ? applicant.status : (profile.status || 'pending');
        const gigAlreadyConfirmed = (!FEATURES.payments || slotGig?.paymentModel === 'no_fee' || slotGig?.kind === 'Open Mic')
            ? false
            : slotGig?.applicants?.some((a) =>
            ['confirmed', 'accepted', 'paid'].includes(a?.status)
        );

        if (getLocalGigDateTime(slotGig) < now) {
            return (
                <>
                    {status !== 'confirmed' ? (
                        <div className="status-box">
                            <div className="status previous">
                                <PreviousIcon />
                                Past
                            </div>
                        </div>
                    ) : FEATURES.reviews && !gigInfo.venueHasReviewed && !gigInfo.disputeLogged && hasVenuePerm(venues, gigInfo.venueId, 'reviews.create') ? (
                        <div className="leave-review">
                            <button type="button" className="btn primary venue-hire-application-tile__btn" onClick={() => { setShowReviewModal(true); setReviewProfile(profile); }}>
                                Leave a Review
                            </button>
                        </div>
                    ) : FEATURES.reviews && !gigInfo.venueHasReviewed && !gigInfo.disputeLogged && !hasVenuePerm(venues, gigInfo.venueId, 'reviews.create') ? (
                        <div className="status-box">
                            <div className="status past">
                                <PermissionsIcon />
                                You don&apos;t have permission to review artists
                            </div>
                        </div>
                    ) : FEATURES.reviews && gigInfo.venueHasReviewed && !gigInfo.disputeLogged ? (
                        <div className="status-box">
                            <div className="status confirmed">
                                <TickIcon />
                                Reviewed
                            </div>
                        </div>
                    ) : gigInfo.disputeLogged ? (
                        <div className="status-box">
                            <div className="status declined">
                                <ErrorIcon />
                                In Dispute
                            </div>
                        </div>
                    ) : null}
                </>
            );
        }

        return (
            <>
                {(status === 'confirmed' || status === 'paid' || status === 'accepted') && (
                    <div className="status-box">
                        <div className="status confirmed">
                            <TickIcon />
                            Confirmed
                        </div>
                    </div>
                )}
                {(status === 'negotiating' || (status === 'pending' && sender === 'venue')) && (
                    <div className="status-box">
                        <div className="status upcoming">
                            <ClockIcon />
                            Negotiating
                        </div>
                    </div>
                )}
                {FEATURES.payments && status === 'accepted' &&
                    slotGig.kind !== 'Open Mic' &&
                    slotGig.kind !== 'Ticketed Gig' &&
                    slotGig.budget !== '£' &&
                    slotGig.budget !== '£0' &&
                    hasVenuePerm(venues, slotGig.venueId, 'gigs.pay') &&
                    (loadingPaymentDetails || showPaymentModal || status === 'payment processing' ? (
                        <LoadingSpinner />
                    ) : (
                        <button type="button" className="btn primary venue-hire-application-tile__btn" onClick={() => handleCompletePayment(profile.id, slotGigId)}>
                            Complete Payment
                        </button>
                    ))}
                {status === 'pending' &&
                    getLocalGigDateTime(slotGig) > now &&
                    !applicant?.invited &&
                    !gigAlreadyConfirmed &&
                    sender !== 'venue' &&
                    hasVenuePerm(venues, slotGig.venueId, 'gigs.applications.manage') &&
                    (eventLoading ? (
                        <LoadingSpinner width={15} height={15} />
                    ) : (
                        <>
                            <button
                                type="button"
                                className="btn accept venue-hire-application-tile__btn"
                                onClick={(e) => handleAccept(profile.id, e, profile.proposedFee, profile.email, profile.name, slotGigId)}
                            >
                                Accept
                            </button>
                            <button
                                type="button"
                                className="btn danger venue-hire-application-tile__btn"
                                onClick={(e) => handleReject(profile.id, e, profile.proposedFee, profile.email, profile.name, slotGigId)}
                            >
                                Decline
                            </button>
                        </>
                    ))}
                {status === 'pending' &&
                    getLocalGigDateTime(slotGig) > now &&
                    !applicant?.invited &&
                    slotGig.kind === 'Open Mic' &&
                    gigAlreadyConfirmed &&
                    sender !== 'venue' &&
                    hasVenuePerm(venues, slotGig.venueId, 'gigs.applications.manage') &&
                    (eventLoading ? (
                        <LoadingSpinner width={15} height={15} />
                    ) : (
                        <>
                            <button
                                type="button"
                                className="btn accept venue-hire-application-tile__btn"
                                onClick={(e) => handleAccept(profile.id, e, profile.proposedFee, profile.email, profile.name, slotGigId)}
                            >
                                Accept
                            </button>
                            <button
                                type="button"
                                className="btn danger venue-hire-application-tile__btn"
                                onClick={(e) => handleReject(profile.id, e, profile.proposedFee, profile.email, profile.name, slotGigId)}
                            >
                                Decline
                            </button>
                        </>
                    ))}
                {status === 'pending' && getLocalGigDateTime(slotGig) > now && applicant?.invited && !gigAlreadyConfirmed && (
                    <div className="status-box">
                        <div className="status upcoming">
                            <ClockIcon />
                            Musician Invited
                        </div>
                    </div>
                )}
                {status === 'declined' && gigAlreadyConfirmed && (
                    <div className="status-box">
                        <div className="status declined">
                            <ErrorIcon />
                            Declined
                        </div>
                        {applicant?.declinedForOtherSet ? (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--gn-grey-600)', lineHeight: 1.35 }}>
                                Confirmed for another set — closed automatically.
                            </p>
                        ) : null}
                    </div>
                )}
                {status === 'withdrawn' && (
                    <div className="status-box">
                        <div className="status declined">
                            <ErrorIcon />
                            Musician Withdrew
                        </div>
                    </div>
                )}
                {status === 'pending' && gigAlreadyConfirmed && slotGig.kind !== 'Open Mic' && (
                    <div className="status-box">
                        <div className="status declined">
                            <ErrorIcon />
                            Declined
                        </div>
                    </div>
                )}
                {status === 'declined' && !gigAlreadyConfirmed && relatedSlots.length > 0 && hasVenuePerm(venues, slotGig.venueId, 'gigs.invite') && (
                    <div className="status-box">
                        <div className="status declined">
                            <ErrorIcon />
                            Declined
                        </div>
                        {applicant?.declinedForOtherSet ? (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--gn-grey-600)', lineHeight: 1.35 }}>
                                Confirmed for another set — closed automatically.
                            </p>
                        ) : null}
                    </div>
                )}
                {status === 'declined' &&
                    !gigAlreadyConfirmed &&
                    !applicant?.declinedForOtherSet &&
                    slotGig.budget !== '£' &&
                    slotGig.budget !== '£0' &&
                    slotGig.kind !== 'Ticketed Gig' &&
                    slotGig.kind !== 'Open Mic' &&
                    !applicant?.invited &&
                    hasVenuePerm(venues, slotGig.venueId, 'gigs.applications.manage') && (
                    <button type="button" className="btn primary venue-hire-application-tile__btn" onClick={() => sendToConversation(profile.userId, slotGigId, profile.id)}>
                        Negotiate Fee
                    </button>
                )}
                {status === 'declined' &&
                    !gigAlreadyConfirmed &&
                    relatedSlots.length === 0 &&
                    (slotGig.kind === 'Ticketed Gig' || slotGig.kind === 'Open Mic') &&
                    applicant?.invited && (
                    <div className="status-box">
                        <div className="status declined">
                            <ErrorIcon />
                            Declined
                        </div>
                        {applicant?.declinedForOtherSet ? (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--gn-grey-600)', lineHeight: 1.35 }}>
                                Confirmed for another set — closed automatically.
                            </p>
                        ) : null}
                    </div>
                )}
                {status === 'payment processing' && (
                    <div className="status-box">
                        <div className="status upcoming">
                            <ClockIcon />
                            Payment Processing
                        </div>
                    </div>
                )}
                {status !== 'accepted' &&
                    status !== 'declined' &&
                    status !== 'confirmed' &&
                    status !== 'paid' &&
                    status !== 'payment processing' &&
                    !hasVenuePerm(venues, gigInfo.venueId, 'gigs.applications.manage') && (
                    <div className="status-box">
                        <div className="status past">
                            <PermissionsIcon />
                            You don&apos;t have permission to manage gig applications
                        </div>
                    </div>
                )}
                {status === 'accepted' && !hasVenuePerm(venues, gigInfo.venueId, 'gigs.pay') && (
                    <div className="status-box">
                        <div className="status past">
                            <PermissionsIcon />
                            You don&apos;t have permission to pay for gigs
                        </div>
                    </div>
                )}
            </>
        );
    };

    const resolveBookedMusicTimeLabel = (slotGig) => {
        const et = slotGig?.eventTimings;
        if (et && typeof et === 'object' && !Array.isArray(et) && et.musicStart && et.musicStop) {
            const a = String(et.musicStart).trim();
            const b = String(et.musicStop).trim();
            if (a && b) return `${a} – ${b}`;
        }
        const st = slotGig?.startTime;
        const en = calculateEndTime(slotGig?.startTime, slotGig?.duration);
        if (st && en) return `${st} – ${en}`;
        return st || '—';
    };

    /** Single-set nights: show music window only; multi-set keeps “Set N” + optional “ · times”. */
    const getBookedTileSetLineDisplay = (slotGig, tileOpts = {}) => {
        const { setSubLabel = null } = tileOpts;
        const timeRange = resolveBookedMusicTimeLabel(slotGig);
        const hasTimeLabel = Boolean(timeRange && String(timeRange).trim() && timeRange !== '—');
        const isSingleSlotNight = sortedSlots.length <= 1;

        if (setSubLabel != null) {
            return { primaryLabel: setSubLabel, showTimeSuffix: hasTimeLabel, timeRange };
        }
        if (isSingleSlotNight && hasTimeLabel) {
            return { primaryLabel: timeRange, showTimeSuffix: false, timeRange };
        }
        if (isSingleSlotNight) {
            return { primaryLabel: '', showTimeSuffix: false, timeRange };
        }
        return {
            primaryLabel: `Set ${getSlotNumber(slotGig.gigId) ?? 1}`,
            showTimeSuffix: hasTimeLabel,
            timeRange,
        };
    };

    const renderBookedTileCard = (slotGig, profile, applicant, tileOpts = {}) => {
        if (!slotGig || !profile || !applicant) return null;
        const slotGigId = slotGig.gigId;
        const photoUrl = profile.heroMedia?.url;
        const { primaryLabel, showTimeSuffix, timeRange } = getBookedTileSetLineDisplay(slotGig, tileOpts);

        return (
            <div className="venue-gig-booked-tile" key={`booked-${slotGigId}`}>
                <div className="venue-gig-booked-tile__body">
                    <div className="venue-gig-booked-tile__main">
                        <div className="venue-gig-booked-tile__identity">
                            <span className="venue-gig-booked-tile__name">{profile.name}</span>
                            <p className="venue-gig-booked-tile__set-line">
                                {primaryLabel ? (
                                    <span className="venue-gig-booked-tile__set-label">{primaryLabel}</span>
                                ) : null}
                                {showTimeSuffix ? (
                                    <span className="venue-gig-booked-tile__time-range"> · {timeRange}</span>
                                ) : null}
                                <span className="venue-gig-applications-set-tab__status-pill venue-gig-booked-tile__booked-pill">
                                    Booked
                                </span>
                            </p>
                        </div>
                        <div className="venue-gig-booked-tile__actions">
                            {profile.id ? (
                                <button
                                    type="button"
                                    className="btn tertiary venue-gig-booked-tile__btn"
                                    onClick={() => openBookedArtistTechRider(slotGig, profile, applicant)}
                                    disabled={bookedArtistTechRiderLoading}
                                >
                                    <TechRiderIcon /> Tech Rider
                                </button>
                            ) : null}
                            {FEATURES.chat && (profile.userId || profile.id) ? (
                                <button
                                    type="button"
                                    className="btn secondary venue-gig-booked-tile__btn"
                                    onClick={() => sendToConversation(profile.userId, slotGigId, profile.id)}
                                >
                                    <MessageIcon /> Message
                                </button>
                            ) : null}
                            {getLocalGigDateTime(slotGig) > now &&
                            hasVenuePerm(venues, slotGig.venueId, 'gigs.update') ? (
                                <div
                                    className="venue-gig-booked-tile__options-wrap"
                                    ref={bookedTileOptionsGigId === slotGigId ? bookedTileOptionsMenuRef : undefined}
                                >
                                    <button
                                        type="button"
                                        className={`btn icon venue-gig-booked-tile__options-btn ${bookedTileOptionsGigId === slotGigId ? 'active' : ''}`}
                                        aria-label="Booking options"
                                        aria-expanded={bookedTileOptionsGigId === slotGigId}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setBookedTileOptionsGigId((id) => (id === slotGigId ? null : slotGigId));
                                        }}
                                    >
                                        <SettingsIcon />
                                    </button>
                                    {bookedTileOptionsGigId === slotGigId ? (
                                        <div
                                            className="venue-gig-booked-tile__options-dropdown"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                type="button"
                                                className="danger"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setBookedTileOptionsGigId(null);
                                                    setCancelSlotGig(slotGig);
                                                    setShowCancelConfirmationModal(true);
                                                }}
                                            >
                                                Cancel
                                                <CancelIcon />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
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
        );
    };

    /**
     * Simplified booked tile for manually-confirmed artists (no Gigin profile).
     * Shows name + an Edit button (opens the confirm-manually modal) but no photo or Message button.
     */
    const renderManualBookedTileCard = (slotGig, applicant, tileOpts = {}) => {
        if (!slotGig || !applicant) return null;
        const slotGigId = slotGig.gigId;
        const name = (applicant.name || applicant.artistName || '').trim() || 'Manually booked';
        const { primaryLabel, showTimeSuffix, timeRange } = getBookedTileSetLineDisplay(slotGig, tileOpts);
        const canEdit =
            (onEditManualBooked || onOpenConfirmGigManually) &&
            getLocalGigDateTime(slotGig) > now &&
            hasVenuePerm(venues, slotGig.venueId, 'gigs.update');

        return (
            <div className="venue-gig-booked-tile venue-gig-booked-tile--manual" key={`booked-manual-${slotGigId}`}>
                <div className="venue-gig-booked-tile__body">
                    <div className="venue-gig-booked-tile__main">
                        <div className="venue-gig-booked-tile__identity">
                            <span className="venue-gig-booked-tile__name">{name}</span>
                            <p className="venue-gig-booked-tile__set-line">
                                {primaryLabel ? (
                                    <span className="venue-gig-booked-tile__set-label">{primaryLabel}</span>
                                ) : null}
                                {showTimeSuffix ? (
                                    <span className="venue-gig-booked-tile__time-range"> · {timeRange}</span>
                                ) : null}
                                <span className="venue-gig-applications-set-tab__status-pill venue-gig-booked-tile__booked-pill">
                                    Booked
                                </span>
                            </p>
                        </div>
                        <div className="venue-gig-booked-tile__actions">
                            {canEdit ? (
                                <button
                                    type="button"
                                    className="btn tertiary venue-gig-booked-tile__btn"
                                    onClick={() => {
                                        if (onEditManualBooked) onEditManualBooked(applicant);
                                        else onOpenConfirmGigManually?.();
                                    }}
                                >
                                    <EditIcon /> Edit
                                </button>
                            ) : null}
                        </div>
                    </div>
                    <div className="venue-gig-booked-tile__photo">
                        <MicrophoneIcon />
                    </div>
                </div>
            </div>
        );
    };

    const wrapBookedSection = (children) => (
        <div className="venue-gig-booked-section">{children}</div>
    );

    const renderApplicationTilesForSlot = (slotGig, slotProfiles) => {
        const slotGigId = slotGig?.gigId;
        if (!slotProfiles.length) {
            return <p className="venue-hire-confirmed-card__empty-text">No applications for this slot.</p>;
        }
        return (
            <div className="venue-hire-application-tiles">
                {slotProfiles.map((profile) => {
                    const photoUrl = profile.heroMedia?.url;
                    const applicant = slotGig?.applicants?.find((a) => a.id === profile.id);
                    return (
                        <div key={`${profile.id}-${slotGigId}`} className="venue-hire-application-tile">
                            <div className="venue-hire-application-tile__photo">
                                {photoUrl ? (
                                    <img src={photoUrl} alt="" className="venue-hire-application-tile__img" />
                                ) : (
                                    <MicrophoneIcon />
                                )}
                            </div>
                            <div className="venue-hire-application-tile__main">
                                <div className="venue-hire-application-tile__identity">
                                    <span className="venue-hire-application-tile__name">
                                        {profile.name}
                                        {isGuestApplicant(profile) && <span className="ga-guest-tag">Guest</span>}
                                    </span>
                                </div>
                                <div className="venue-hire-application-tile__actions">
                                    {isGuestApplicant(profile) ? (
                                        <button
                                            type="button"
                                            className="btn secondary venue-hire-application-tile__btn"
                                            onClick={() => setGuestDetail(applicant || profile)}
                                        >
                                            Contact
                                        </button>
                                    ) : (
                                    <>
                                    <button
                                        type="button"
                                        className="btn tertiary venue-hire-application-tile__btn"
                                        onClick={(e) => openInNewTab(`/artist/${profile.id}`, e)}
                                    >
                                        <NewTabIcon /> View profile
                                    </button>
                                    {profile.userId || profile.id ? (
                                        <button
                                            type="button"
                                            className="btn secondary venue-hire-application-tile__btn"
                                            onClick={() => sendToConversation(profile.userId, slotGigId, profile.id)}
                                        >
                                            Message
                                        </button>
                                    ) : null}
                                    </>
                                    )}
                                    {renderSlotApplicationTileSecondaryActions(profile, slotGig, slotGigId)}
                                </div>
                                <ApplicantSubmittedNotesSection
                                    gigId={slotGigId}
                                    participantUserId={isGuestApplicant(profile) ? null : profile.userId}
                                    participantProfileId={isGuestApplicant(profile) ? null : profile.id}
                                    applicant={applicant}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderApplicationsTableForSlot = (slotGig) => {
        const slotProfiles = getSlotProfilesForSlot(slotGig);
        if (useCardLayout) {
            return renderApplicationTilesForSlot(slotGig, slotProfiles);
        }
        if (slotProfiles.length === 0) {
            return <p className="venue-hire-confirmed-card__empty-text">No applications for this slot.</p>;
        }
        return (
            <table className="applications-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Video</th>
                        <th>Fee</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {slotProfiles.map((profile) => {
                        const applicant = slotGig?.applicants?.find((a) => a.id === profile.id);
                        const status = applicant ? applicant.status : (profile.status || 'pending');
                        return (
                            <tr key={profile.id}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {profile.heroMedia?.url && (
                                            <img src={profile.heroMedia.url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                                        )}
                                        <div>
                                            <button type="button" className="btn text" style={{ padding: 0, fontWeight: 600 }} onClick={(e) => {
                                                if (isGuestApplicant(profile)) { e.stopPropagation(); setGuestDetail(applicant || profile); return; }
                                                openInNewTab(`/artist/${profile.id}`, e);
                                            }}>
                                                {profile.name}
                                                {isGuestApplicant(profile) && <span className="ga-guest-tag">Guest</span>}
                                            </button>
                                        </div>
                                    </div>
                                </td>
                                <td>{profile.video?.file ? <button type="button" className="btn tertiary" onClick={() => setVideoToPlay(profile.video)}>Play</button> : '—'}</td>
                                <td>{profile.fee ?? '—'}</td>
                                <td>
                                    {status === 'pending' && (
                                        <div className="status-box"><div className="status pending">Pending</div></div>
                                    )}
                                    {(status === 'confirmed' || status === 'paid' || status === 'accepted') && (
                                        <div className="status-box"><div className="status confirmed"><TickIcon /> Confirmed</div></div>
                                    )}
                                    {status === 'declined' && (
                                        <div className="status-box">
                                            <div className="status declined"><ErrorIcon /> Declined</div>
                                            {applicant?.declinedForOtherSet ? (
                                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--gn-grey-600)', lineHeight: 1.35 }}>
                                                    Confirmed for another set — closed automatically.
                                                </p>
                                            ) : null}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    const canAcceptRunningOrderApplicant = (profile, slotGig) => {
        if (!slotGig || getLocalGigDateTime(slotGig) < now) return false;
        const applicant = slotGig.applicants?.find((entry) => entry.id === profile.id);
        const sender = applicant ? applicant.sentBy : (profile.sentBy || 'musician');
        const status = applicant ? applicant.status : (profile.status || 'pending');
        if (status !== 'pending' || applicant?.invited || sender === 'venue') return false;
        if (!hasVenuePerm(venues, slotGig.venueId, 'gigs.applications.manage')) return false;
        const alreadyBooked = slotGig.applicants?.some((entry) =>
            ['confirmed', 'accepted', 'paid', 'payment processing'].includes(entry?.status)
        );
        if (alreadyBooked && slotGig.kind !== 'Open Mic') return false;
        return true;
    };

    const markRunningOrderApplicantViewed = async (slotGig, profileId) => {
        if (!slotGig?.gigId || !profileId) return;
        try {
            await markApplicantsViewed({
                venueId: slotGig.venueId,
                gigId: slotGig.gigId,
                applicantIds: [profileId],
            });
            setGigInfoState?.((prev) => {
                if (!prev || prev.gigId !== slotGig.gigId || !Array.isArray(prev.applicants)) return prev;
                return {
                    ...prev,
                    applicants: prev.applicants.map((entry) => (
                        entry.id === profileId ? { ...entry, viewed: true } : entry
                    )),
                };
            });
            refreshGigs?.();
        } catch (err) {
            console.error('Error marking applicant viewed:', err);
        }
    };

    const renderRunningOrderAvatar = (name, photoUrl, sizeClass) => (
        photoUrl ? (
            <img src={photoUrl} alt="" className={`venue-gig-running__avatar ${sizeClass}`} />
        ) : (
            <span className={`venue-gig-running__avatar venue-gig-running__avatar--initials ${sizeClass}`}>
                {runningOrderInitials(name)}
            </span>
        )
    );

    const renderRunningOrderBookedBody = (slotGig, applicant, profile) => {
        const name = (profile?.name || applicant?.name || applicant?.artistName || 'Artist').trim();
        const meta = runningOrderApplicantMeta(profile);
        const status = applicant?.status;
        const awaiting = status === 'accepted' || status === 'payment processing';
        const paid = status === 'paid' || status === 'confirmed';
        const techStatus = applicant?.techSetup?.compatibilityStatus;
        const techNeedsCheck = techStatus === 'missing_required';
        const techOk = techStatus === 'fully_compatible' || techStatus === 'compatible_with_hired';
        const fee = runningOrderFeeLabel(profile?.proposedFee || slotGig?.budget || applicant?.fee);
        const payable = FEATURES.payments
            && awaiting
            && slotGig.kind !== 'Open Mic'
            && slotGig.kind !== 'Ticketed Gig'
            && slotGig.budget !== '£'
            && slotGig.budget !== '£0'
            && getLocalGigDateTime(slotGig) > now
            && hasVenuePerm(venues, slotGig.venueId, 'gigs.pay');
        const canMessage = FEATURES.chat && profile && (profile.userId || profile.id);
        const canEditManual = !profile
            && (onEditManualBooked || onOpenConfirmGigManually)
            && getLocalGigDateTime(slotGig) > now
            && hasVenuePerm(venues, slotGig.venueId, 'gigs.update');
        return (
            <div className="venue-gig-running__booked">
                {renderRunningOrderAvatar(name, profile?.heroMedia?.url, 'venue-gig-running__avatar--lg')}
                <div className="venue-gig-running__booked-copy">
                    <span className="venue-gig-running__booked-name">{name}{(applicant?.guest || applicant?.type === 'guest') && <span className="ga-guest-tag">Guest</span>}</span>
                    {meta ? <span className="venue-gig-running__booked-genre">{meta}</span> : null}
                    <span className="venue-gig-running__chips">
                        {awaiting ? (
                            <span className="venue-gig-running__chip venue-gig-running__chip--amber">
                                <span className="venue-gig-running__chip-dot" />
                                Awaiting payment
                            </span>
                        ) : null}
                        {paid && fee ? (
                            <span className="venue-gig-running__chip venue-gig-running__chip--green">
                                <span className="venue-gig-running__chip-dot" />
                                Paid {fee}
                            </span>
                        ) : null}
                        {techNeedsCheck ? (
                            <span className="venue-gig-running__chip venue-gig-running__chip--amber">
                                <span className="venue-gig-running__chip-dot" />
                                Tech check needed
                            </span>
                        ) : null}
                        {techOk ? (
                            <span className="venue-gig-running__chip venue-gig-running__chip--green">
                                <span className="venue-gig-running__chip-dot" />
                                {paid ? 'Tech confirmed' : 'Tech fits'}
                            </span>
                        ) : null}
                    </span>
                </div>
                <div className="venue-gig-running__booked-actions">
                    {payable ? (
                        <button
                            type="button"
                            className="venue-gig-running__pay"
                            onClick={() => handleCompletePayment(profile.id, slotGig.gigId)}
                        >
                            Pay now
                        </button>
                    ) : null}
                    {profile?.id ? (
                        <button
                            type="button"
                            className="venue-gig-running__ghost"
                            onClick={() => openBookedArtistTechRider(slotGig, profile, applicant)}
                            disabled={bookedArtistTechRiderLoading}
                        >
                            Tech setup
                        </button>
                    ) : null}
                    {canMessage ? (
                        <button
                            type="button"
                            className="venue-gig-running__ghost"
                            onClick={() => sendToConversation(profile.userId, slotGig.gigId, profile.id)}
                        >
                            Message
                        </button>
                    ) : null}
                    {canEditManual ? (
                        <button
                            type="button"
                            className="venue-gig-running__ghost"
                            onClick={() => {
                                if (onEditManualBooked) onEditManualBooked(applicant);
                                else onOpenConfirmGigManually?.();
                            }}
                        >
                            Edit
                        </button>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderRunningOrderSetBody = (slotGig) => {
        const bookedApplicant = getBookedApplicantForSlot(slotGig);
        if (bookedApplicant) {
            const profile = getProfileForBookedApplicant(bookedApplicant);
            if (profile || bookedApplicant.manual === true || bookedApplicant.name || bookedApplicant.artistName) {
                return renderRunningOrderBookedBody(slotGig, bookedApplicant, profile);
            }
        }
        const openApplicants = (Array.isArray(slotGig?.applicants) ? slotGig.applicants : [])
            .filter((applicant) => {
                if (!applicant || applicant === bookedApplicant) return false;
                const status = applicant.status || 'pending';
                if (BOOKED_APPLICANT_STATUSES.includes(status) || status === 'withdrawn') return false;
                return true;
            })
            .sort((a, b) => {
                const aNew = !a.viewed && a.invited !== true;
                const bNew = !b.viewed && b.invited !== true;
                if (aNew !== bNew) return aNew ? -1 : 1;
                const aTime = Date.parse(a.appliedAt || a.createdAt || '') || 0;
                const bTime = Date.parse(b.appliedAt || b.createdAt || '') || 0;
                return bTime - aTime;
            });
        const openProfiles = openApplicants.map((applicant) => {
            const profile = musicianProfiles.find((entry) =>
                entry.id === applicant.id && (entry.applicationSlotGigId || gigInfo?.gigId) === slotGig.gigId
            ) || musicianProfiles.find((entry) => entry.id === applicant.id);
            return {
                ...(profile || {}),
                ...applicant,
                id: applicant.id || profile?.id,
                name: profile?.name || applicant.name || applicant.artistName || 'Artist',
                heroMedia: profile?.heroMedia,
                genres: profile?.genres,
                proposedFee: profile?.proposedFee || applicant.proposedFee || applicant.fee,
                userId: profile?.userId || applicant.userId,
                email: profile?.email || applicant.email,
            };
        });
        const expanded = Boolean(expandedRunningSets[slotGig.gigId]);
        const visible = expanded ? openProfiles : openProfiles.slice(0, 3);
        const canInvite = hasVenuePerm(venues, slotGig.venueId, 'gigs.invite');
        return (
            <>
                {visible.length === 0 ? (
                    <p className="venue-gig-running__empty">No applications yet</p>
                ) : visible.map((profile) => {
                    const applicant = slotGig?.applicants?.find((entry) => entry.id === profile.id);
                    const unviewed = applicant && !applicant.viewed && applicant.invited !== true;
                    const meta = runningOrderApplicantMeta(profile);
                    const fee = runningOrderFeeLabel(profile.proposedFee || profile.fee);
                    return (
                        <div key={`${profile.id}-${slotGig.gigId}`} className="venue-gig-running__applicant">
                            {renderRunningOrderAvatar(profile.name, profile.heroMedia?.url, 'venue-gig-running__avatar--sm')}
                            <span className="venue-gig-running__who">
                                <span className="venue-gig-running__who-name">
                                    {profile.name}
                                    {(profile.guest || profile.type === 'guest') && <span className="ga-guest-tag">Guest</span>}
                                    {unviewed ? <span className="venue-gig-running__fresh" aria-label="New application" /> : null}
                                </span>
                                {meta ? <span className="venue-gig-running__who-meta">{meta}</span> : null}
                            </span>
                            <RunningOrderQuote
                                gigId={slotGig.gigId}
                                participantUserId={isGuestApplicant(profile) ? null : profile.userId}
                                participantProfileId={isGuestApplicant(profile) ? null : profile.id}
                                stored={applicant?.applicationMessage}
                            />
                            <span className="venue-gig-running__ask">{fee}</span>
                            <span className="venue-gig-running__row-actions">
                                <button
                                    type="button"
                                    className="venue-gig-running__view"
                                    onClick={(event) => {
                                        markRunningOrderApplicantViewed(slotGig, profile.id);
                                        if (profile.guest || profile.type === 'guest') {
                                            setGuestDetail(profile);
                                            return;
                                        }
                                        openInNewTab(`/artist/${profile.id}`, event);
                                    }}
                                >
                                    View
                                </button>
                                {canAcceptRunningOrderApplicant(profile, slotGig) ? (
                                    <button
                                        type="button"
                                        className="venue-gig-running__accept"
                                        disabled={eventLoading}
                                        onClick={(event) => handleAccept(profile.id, event, profile.proposedFee, profile.email, profile.name, slotGig.gigId)}
                                    >
                                        Accept
                                    </button>
                                ) : null}
                            </span>
                        </div>
                    );
                })}
                <div className="venue-gig-running__footer">
                    {openProfiles.length > 3 ? (
                        <button
                            type="button"
                            className="venue-gig-running__see-all"
                            onClick={() => setExpandedRunningSets((prev) => ({
                                ...prev,
                                [slotGig.gigId]: !prev[slotGig.gigId],
                            }))}
                        >
                            {expanded ? 'Show fewer' : `See all ${openProfiles.length} applications`}
                        </button>
                    ) : <span />}
                    {canInvite ? (
                        <button
                            type="button"
                            className="venue-gig-running__invite"
                            onClick={() => setInviteModalGig(slotGig)}
                        >
                            <InviteIcon />
                            Invite to this set
                        </button>
                    ) : null}
                </div>
            </>
        );
    };

    const renderRunningOrderPortals = () => {
        if (!runningOrderSlotTargets) return guestDetail ? createPortal(<GuestApplicantPanel applicant={guestDetail} onClose={() => setGuestDetail(null)} />, document.body) : null;
        return <>
        {sortedSlots.map((slotGig) => {
            const target = runningOrderSlotTargets[slotGig.gigId];
            if (!target) return null;
            return createPortal(
                <div key={slotGig.gigId}>{renderRunningOrderSetBody(slotGig)}</div>,
                target
            );
        })}
        {guestDetail && createPortal(<GuestApplicantPanel applicant={guestDetail} onClose={() => setGuestDetail(null)} />, document.body)}
        </>
    };

    return (
        <>
            {runningOrderSlotTargets ? renderRunningOrderPortals() : (
            <>
            {!skipHeader && (
            <div className='head gig-applications'>
                <div style={{ width: '100%'}}>
                    {!isMdUp && (
                        <button className="btn text" onClick={() => navigate(-1)} style={{ marginBottom: '1rem'}}><LeftArrowIcon /> Back</button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <h1 className='title' style={{ fontWeight: 500, margin: 0 }}>
                            {relatedSlots.length > 0 
                                ? gigInfo.gigName.replace(/\s*\(Set \d+\)\s*$/, '')
                                : gigInfo.gigName}
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {!gigInfo.private ? (
                                <button 
                                    className="btn secondary"
                                    style={{ minWidth: 150 }}
                                    onClick={() => {
                                        const gigLink = `${window.location.origin}/gig/${gigInfo.gigId}`;
                                        copyToClipboard(gigLink);
                                    }}
                                    title="Copy gig link"
                                >
                                    <LinkIcon />
                                    Gig Link
                                </button>
                            ) : (
                                <button 
                                    className="btn secondary"
                                    style={{ minWidth: 150 }}
                                    disabled={!hasVenuePerm(venues, gigInfo.venueId, 'gigs.invite')}
                                    onClick={() => {
                                        if (!hasVenuePerm(venues, gigInfo.venueId, 'gigs.invite')) {
                                            toast.error('You do not have permission to perform this action.');
                                            return;
                                        }
                                        onInviteArtist?.();
                                    }}
                                    title={!hasVenuePerm(venues, gigInfo.venueId, 'gigs.invite') ? 'You do not have permission to create invites' : 'Create invite link'}
                                >
                                    <InviteIconSolid />
                                    Invite artist or promoter
                                </button>
                            )}
                            {hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                                <div className="gigs-toggle-container gig-applications">
                                    <label className="gigs-toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={gigInfo.private || false}
                                            disabled={!hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')}
                                            onChange={async (e) => {
                                                if (!hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')) {
                                                    toast.error('You do not have permission to update this gig.');
                                                    return;
                                                }
                                                try {
                                                    const newPrivate = e.target.checked;
                                                    await updateGigDocument({ 
                                                        gigId: gigInfo.gigId, 
                                                        action: 'gigs.update', 
                                                        updates: { private: newPrivate } 
                                                    });
                                                    toast.success(`Gig changed to ${newPrivate ? 'Invite Only' : 'Public'}`);
                                                    refreshGigs();
                                                } catch (error) {
                                                    console.error('Error updating invite only status:', error);
                                                    toast.error('Failed to update gig. Please try again.');
                                                }
                                            }}
                                        />
                                        <span className="gigs-toggle-slider"></span>
                                    </label>
                                    <span className="gigs-toggle-text">Invite Only?</span>
                                </div>
                            )}
                            <div style={{ position: 'relative' }} className="options-cell" ref={optionsMenuRef}>
                                <button 
                                    className={`btn icon ${showOptionsMenu ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowOptionsMenu(!showOptionsMenu);
                                    }}
                                >
                                    <SettingsIcon />
                                </button>
                                {showOptionsMenu && (
                                    <div className="options-dropdown" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            openInNewTab(`/gig/${gigInfo.gigId}?venue=${gigInfo.venueId}`, e);
                                            setShowOptionsMenu(false);
                                        }}>
                                            View Gig <NewTabIcon />
                                        </button>
                                        {getLocalGigDateTime(gigInfo) > now && (
                                            <>
                                                {(!Array.isArray(gigInfo?.applicants) || !gigInfo.applicants.some(applicant => 
                                                    ['accepted', 'confirmed', 'paid'].includes(applicant.status)
                                                )) && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowOptionsMenu(false);
                                                        openEditGigModal(gigInfo);
                                                    }}>
                                                        Edit Gig Details <EditIcon />
                                                    </button>
                                                )}
                                                {hasAnyConfirmed && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                                                    <>
                                                        <button onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowOptionsMenu(false);
                                                            setEditTimeModalMode('timings');
                                                            setShowEditTimeModal(true);
                                                        }}>
                                                            {allSlots.length > 1 ? 'Edit Timings' : 'Edit Time'} <EditIcon />
                                                        </button>
                                                        <button onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowOptionsMenu(false);
                                                            setEditTimeModalMode('name');
                                                            setShowEditTimeModal(true);
                                                        }}>
                                                            Edit Name <EditIcon />
                                                        </button>
                                                    </>
                                                )}
                                                {(!Array.isArray(gigInfo?.applicants) || !gigInfo.applicants.some(applicant => 
                                                    ['accepted', 'confirmed', 'paid'].includes(applicant.status)
                                                )) && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') ? (
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowOptionsMenu(false);
                                                        setShowDeleteConfirmationModal(true);
                                                    }}>
                                                        Delete Gig <DeleteIcon />
                                                    </button>
                                                ) : hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowOptionsMenu(false);
                                                        setCancelSlotGig(null);
                                                        setShowCancelConfirmationModal(true);
                                                    }}>
                                                        Cancel Gig <CancelIcon />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <h3>{dateTimeDisplay} at {venueName}</h3>
                    
                    {/* Monetary Status */}
                    <div style={{ marginTop: '0.5rem' }}>
                        {gigInfo.kind === 'Ticketed Gig' ? (
                            <h3>Ticketed Gig</h3>
                        ) : gigInfo.kind === 'Open Mic' ? (
                            <h3>Open Mic</h3>
                        ) : (
                            <h3>
                                {(() => {
                                    const budget = gigInfo.budget || '';
                                    if (budget === '£0' || budget === '£') {
                                        return 'No Fee';
                                    }
                                    // Extract numeric value and format
                                    const numericValue = budget.replace(/[^0-9.]/g, '');
                                    if (numericValue && parseFloat(numericValue) > 0) {
                                        return `£${numericValue}`;
                                    }
                                    return '—';
                                })()}
                            </h3>
                        )}
                    </div>
                    
                    {/* Notes */}
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                        <span style={{ fontWeight: 500, flexShrink: 0 }}>Notes:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                            <textarea
                                ref={notesTextareaRef}
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSaveNotes();
                                    }
                                }}
                                disabled={!hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')}
                                rows={1}
                                style={{
                                    width: '50%',
                                    minWidth: '300px',
                                    padding: '0.5rem',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #e6e6e6',
                                    borderRadius: '0.5rem',
                                    resize: 'none',
                                    outline: 'none',
                                }}
                                onFocus={(e) => {
                                    e.target.style.outline = '2px solid #000000';
                                    e.target.style.outlineOffset = '-1px';
                                    if (hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')) {
                                        setEditingNotes(true);
                                    } else {
                                        toast.error('You do not have permission to update this gig.');
                                    }
                                }}
                                onBlur={(e) => {
                                    e.target.style.outline = 'none';
                                    // Reset value if user clicks away without saving
                                    // Use setTimeout to allow save button click to register first
                                    setTimeout(() => {
                                        if (editingNotes && !savingNotes) {
                                            setNotesValue(gigInfo.notes || '');
                                            setEditingNotes(false);
                                        }
                                    }, 50);
                                }}
                            />
                            {editingNotes && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                                <button
                                    className="btn primary"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSaveNotes();
                                    }}
                                    onMouseDown={(e) => {
                                        // Prevent blur from firing before click
                                        e.preventDefault();
                                    }}
                                >
                                    Save
                                </button>
                            )}
                        </div>
                    </div>
                    
                </div>
            </div>
            )}
            <div className='body gigs'>
                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <>
                        {skipHeader && !useCardLayout && (
                            <div className="venue-gig-internal-notes" style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--gn-grey-300)', borderRadius: '8px', background: 'var(--gn-off-white)' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 600, fontSize: '1rem' }}>Internal notes</h4>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--gn-grey-600)', marginBottom: '0.25rem' }}>Notes</label>
                                    <textarea
                                        ref={notesTextareaRef}
                                        value={notesValue}
                                        onChange={(e) => setNotesValue(e.target.value)}
                                        onBlur={(e) => {
                                            e.target.style.outline = 'none';
                                            setTimeout(() => {
                                                if (editingNotes && !savingNotes) {
                                                    setNotesValue(gigInfo.notes || '');
                                                    setEditingNotes(false);
                                                }
                                            }, 50);
                                        }}
                                        onFocus={() => hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && setEditingNotes(true)}
                                        disabled={!hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')}
                                        rows={3}
                                        className="input"
                                        style={{ width: '100%', maxWidth: '100%', resize: 'vertical' }}
                                    />
                                    {editingNotes && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                                        <button type="button" className="btn primary" style={{ marginTop: '0.35rem' }} onClick={handleSaveNotes} onMouseDown={(e) => e.preventDefault()}>Save</button>
                                    )}
                                </div>
                            </div>
                        )}
                        {FEATURES.reviews && showDispute && hasVenuePerm(venues, gigInfo.venueId, 'reviews.create') && (
                            <div className='dispute-box'>
                                <h3>Not happy with how the gig went?</h3>
                                <h4>You have until {formatDisputeDate(gigInfo.disputeClearingTime)} to file an issue.</h4>
                                <button className='btn danger' onClick={() => {setShowReviewModal(true)}}>
                                    Dispute Gig
                                </button>
                            </div>
                        )}
                        {disputeLogged && (
                            <div className='dispute-box'>
                                <h3>Dispute logged.</h3>
                                <h4 style={{ marginBottom: 0 }}>Our team is looking into the dispute. We'll update you soon.</h4>
                            </div>
                        )}
                        {useCardLayout ? (() => {
                            // GigDetailsPanel wraps this in `.venue-hire-confirmed-panel__applications`.
                            const isMultiSlot = sortedSlots.length > 1;
                            const gigId = gigInfo?.gigId;
                            const gigLinkUrl = gigId ? `${window.location.origin}/gig/${gigId}` : null;
                            const mergeSlotWithGigsList = (slotGig) => {
                                if (!slotGig?.gigId || !Array.isArray(gigs)) return slotGig;
                                const fresh = gigs.find((g) => g.gigId === slotGig.gigId);
                                return fresh ? { ...slotGig, ...fresh } : slotGig;
                            };
                            const effectiveMaxApplicantsForSendTile = (slotGig) => {
                                const m = mergeSlotWithGigsList(slotGig);
                                const rawMax = Number(m?.maxApplicants);
                                const hasExplicitMax = Number.isFinite(rawMax) && rawMax >= 1;
                                if (hasExplicitMax) return Math.max(1, Math.floor(rawMax));
                                if (m?.kind === 'Open Mic') return Number.POSITIVE_INFINITY;
                                return 1;
                            };
                            const countBookedApplicantsOnSlotForSendTile = (slotGig) => {
                                const m = mergeSlotWithGigsList(slotGig);
                                if (!m?.applicants?.length) return 0;
                                return m.applicants.filter((a) =>
                                    BOOKED_APPLICANT_STATUSES.includes(a?.status)
                                ).length;
                            };
                            const isSlotFullyBookedForSendTile = (slotGig) =>
                                countBookedApplicantsOnSlotForSendTile(slotGig) >=
                                effectiveMaxApplicantsForSendTile(slotGig);
                            const handleCopyGigLink = () => {
                                if (!gigLinkUrl) return;
                                copyToClipboardProp?.(gigLinkUrl);
                                setGigLinkCopied(true);
                                window.setTimeout(() => setGigLinkCopied(false), 2000);
                            };
                            const renderShareDetailsBlock = ({ persistent = false } = {}) => {
                                if (sendGigDetailsPortalContainer) return null;
                                if (!gigLinkUrl) return null;
                                return (
                                    <div className={`venue-gig-applications-empty__gig-link${persistent ? ' venue-gig-applications-empty__gig-link--persistent' : ''}`}>
                                        <p className="venue-gig-applications-empty__gig-link-label">Send gig details</p>
                                        <div className="invite-and-share-modal__share-row venue-gig-applications-empty__gig-link-row">
                                            <input
                                                type="text"
                                                className="input invite-and-share-modal__share-input"
                                                value={gigLinkUrl}
                                                readOnly
                                                onFocus={(e) => e.target.select()}
                                                onClick={(e) => e.target.select()}
                                                aria-label="Gig link"
                                            />
                                            <button
                                                type="button"
                                                className="btn secondary invite-and-share-modal__copy-btn"
                                                onClick={handleCopyGigLink}
                                            >
                                                {gigLinkCopied ? <><TickIcon /> Copied</> : <><LinkIcon /> Copy</>}
                                            </button>
                                            {onInviteArtist ? (
                                                <button
                                                    type="button"
                                                    className="btn artist-profile venue-gig-applications-empty__preview-btn"
                                                    onClick={onInviteArtist}
                                                >
                                                    <InviteIconSolid /> Invite
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            };

                            const renderSendGigDetailsPortal = (visible) => {
                                if (!sendGigDetailsPortalContainer || !gigLinkUrl || !visible) return null;
                                return createPortal(
                                    <SendGigDetailsTile
                                        bookingLinkUrl={gigLinkUrl}
                                        onCopyLink={handleCopyGigLink}
                                        linkCopied={gigLinkCopied}
                                        onInviteArtist={onInviteArtist}
                                        showInviteButton={!!onInviteArtist}
                                    />,
                                    sendGigDetailsPortalContainer
                                );
                            };
                            const renderEmptyState = () => {
                                return (
                                    <div className="venue-gig-applications-empty">
                                        <h3 className="venue-gig-applications-empty__title">No applications yet</h3>
                                        <p className="venue-gig-applications-empty__body">
                                            Send the gig details to artists and promoters, or manually enter who is booked.
                                        </p>
                                        {!sendGigDetailsPortalContainer ? renderShareDetailsBlock() : null}
                                    </div>
                                );
                            };

                            if (!isMultiSlot) {
                                const slotGig = sortedSlots[0];
                                if (!slotGig) return null;
                                const bookedApp = getBookedApplicantForSlot(slotGig);
                                const bookedProfile = bookedApp ? getProfileForBookedApplicant(bookedApp) : null;
                                const isManualBooking = bookedApp?.manual === true;
                                const pending = getPendingSlotProfilesForSlot(slotGig);
                                const sendTileFullyBooked =
                                    typeof sendGigDetailsPortalNightFullyBooked === 'boolean'
                                        ? sendGigDetailsPortalNightFullyBooked
                                        : isSlotFullyBookedForSendTile(slotGig);
                                if (!bookedProfile && !isManualBooking && pending.length === 0) {
                                    return (
                                        <>
                                            {renderSendGigDetailsPortal(
                                                Boolean(gigLinkUrl && !sendTileFullyBooked)
                                            )}
                                            {renderEmptyState()}
                                        </>
                                    );
                                }
                                const bookedSection = bookedApp
                                    ? wrapBookedSection(
                                          bookedProfile
                                              ? renderBookedTileCard(slotGig, bookedProfile, bookedApp)
                                              : isManualBooking
                                                ? renderManualBookedTileCard(slotGig, bookedApp)
                                                : null
                                      )
                                    : null;
                                const renderBookedSection = () => {
                                    if (!bookedSection) return null;
                                    if (bookedTilesPortalContainer) {
                                        return createPortal(bookedSection, bookedTilesPortalContainer);
                                    }
                                    return bookedSection;
                                };
                                return (
                                    <>
                                        {renderSendGigDetailsPortal(
                                            Boolean(gigLinkUrl && !sendTileFullyBooked)
                                        )}
                                        {!sendTileFullyBooked
                                            ? renderShareDetailsBlock({ persistent: true })
                                            : null}
                                        {renderBookedSection()}
                                        {pending.length > 0 ? renderApplicationTilesForSlot(slotGig, pending) : null}
                                    </>
                                );
                            }

                            const anyApplicantAcrossSlots = sortedSlots.some(
                                (slotGig) => getSlotProfilesForSlot(slotGig).length > 0
                            );
                            const bookedStack = sortedSlots
                                .map((sg) => {
                                    const app = getBookedApplicantForSlot(sg);
                                    if (!app) return null;
                                    const prof = getProfileForBookedApplicant(app);
                                    if (prof) return { slotGig: sg, applicant: app, profile: prof, manual: false };
                                    if (app.manual === true) return { slotGig: sg, applicant: app, profile: null, manual: true };
                                    return null;
                                })
                                .filter(Boolean);
                            const hasAnyApplicationsContent = anyApplicantAcrossSlots || bookedStack.length > 0;
                            const sendTileFullyBookedMulti =
                                typeof sendGigDetailsPortalNightFullyBooked === 'boolean'
                                    ? sendGigDetailsPortalNightFullyBooked
                                    : sortedSlots.length > 0 &&
                                      sortedSlots.every((sg) => isSlotFullyBookedForSendTile(sg));
                            const activeIdx = Math.min(
                                Math.max(0, activeMultiSlotTabIndex),
                                sortedSlots.length - 1
                            );
                            const activeSlotGig = sortedSlots[activeIdx];
                            const activePending = activeSlotGig
                                ? getPendingSlotProfilesForSlot(activeSlotGig)
                                : [];
                            const activeBookedApp = activeSlotGig
                                ? getBookedApplicantForSlot(activeSlotGig)
                                : null;
                            const activeBookedProfile = activeBookedApp
                                ? getProfileForBookedApplicant(activeBookedApp)
                                : null;
                            const activeBookedArtistDisplayName = (() => {
                                if (!activeBookedApp) return '';
                                const fromProfile = activeBookedProfile?.name?.trim();
                                if (fromProfile) return fromProfile;
                                const fromApplicant = (
                                    activeBookedApp.name ||
                                    activeBookedApp.artistName ||
                                    ''
                                ).trim();
                                return fromApplicant;
                            })();

                            const bookedSection =
                                bookedStack.length > 0
                                    ? wrapBookedSection(
                                          <div className="venue-gig-booked-tiles-stack">
                                              {bookedStack.map(({ slotGig: sg, applicant, profile, manual }) =>
                                                  manual
                                                      ? renderManualBookedTileCard(sg, applicant, {
                                                            setSubLabel: `Set ${getSlotNumber(sg.gigId) ?? '?'}`,
                                                        })
                                                      : renderBookedTileCard(sg, profile, applicant, {
                                                            setSubLabel: `Set ${getSlotNumber(sg.gigId) ?? '?'}`,
                                                        })
                                              )}
                                          </div>
                                      )
                                    : null;
                            const renderBookedSection = () => {
                                if (!bookedSection) return null;
                                if (bookedTilesPortalContainer) {
                                    return createPortal(bookedSection, bookedTilesPortalContainer);
                                }
                                return bookedSection;
                            };

                            const showSendGigDetailsPortal = Boolean(gigLinkUrl) && !sendTileFullyBookedMulti;

                            return (
                                <>
                                    {renderSendGigDetailsPortal(showSendGigDetailsPortal)}
                                    {!sendTileFullyBookedMulti
                                        ? renderShareDetailsBlock({ persistent: true })
                                        : null}
                                    {renderBookedSection()}
                                    {!hideMultiSlotTabStrip ? (
                                        <div
                                            className="venue-gig-applications-set-tabs"
                                            role="tablist"
                                            aria-label="Sets on this gig"
                                        >
                                            {sortedSlots.map((slotGig, idx) => {
                                                const endT = calculateEndTime(slotGig.startTime, slotGig.duration);
                                                const timeSub =
                                                    slotGig.startTime && endT
                                                        ? `${slotGig.startTime} – ${endT}`
                                                        : slotGig.startTime || '—';
                                                const n = getSlotNumber(slotGig.gigId) ?? idx + 1;
                                                return (
                                                    <button
                                                        key={slotGig.gigId}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={idx === activeIdx}
                                                        className={`venue-gig-applications-set-tab${
                                                            idx === activeIdx ? ' venue-gig-applications-set-tab--active' : ''
                                                        }`}
                                                        onClick={() => setActiveMultiSlotTabIndex(idx)}
                                                    >
                                                        <span className="venue-gig-applications-set-tab__title">
                                                            Set {n}
                                                            {gigSlotHasConfirmedArtist(slotGig) ? (
                                                                <span className="venue-gig-applications-set-tab__status-pill">
                                                                    Booked
                                                                </span>
                                                            ) : null}
                                                            {gigSlotHasUnviewedApplicants(slotGig) ? (
                                                                <span
                                                                    className="venue-gig-applications-set-tab__notify"
                                                                    aria-label="New application"
                                                                />
                                                            ) : null}
                                                        </span>
                                                        <span className="venue-gig-applications-set-tab__time">{timeSub}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                    {!hasAnyApplicationsContent ? (
                                        renderEmptyState()
                                    ) : activePending.length === 0 ? (
                                        activeBookedApp ? (
                                            <p className="venue-hire-confirmed-card__empty-text venue-gig-applications-set-empty">
                                                {activeBookedArtistDisplayName
                                                    ? `This set has been booked with ${activeBookedArtistDisplayName}.`
                                                    : 'This set has been booked.'}
                                            </p>
                                        ) : (
                                            <p className="venue-hire-confirmed-card__empty-text venue-gig-applications-set-empty">
                                                No other applications for this set yet.
                                            </p>
                                        )
                                    ) : (
                                        renderApplicationTilesForSlot(activeSlotGig, activePending)
                                    )}
                                </>
                            );
                        })() : (
                            <>
                        {/* Slot boxes for multi-slot gigs */}
                        {relatedSlots.length > 0 && (
                            <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {[gigInfo, ...relatedSlots]
                                    .filter(Boolean)
                                    .sort((a, b) => {
                                        if (!a.startTime || !b.startTime) return 0;
                                        const [aH, aM] = a.startTime.split(':').map(Number);
                                        const [bH, bM] = b.startTime.split(':').map(Number);
                                        return (aH * 60 + aM) - (bH * 60 + bM);
                                    })
                                    .map((slotGig, index) => {
                                        const slotNumber = index + 1;
                                        const confirmedArtistId = getConfirmedArtistForSlot(slotGig);
                                        const confirmedArtist = confirmedArtistId 
                                            ? musicianProfiles.find(p => p.id === confirmedArtistId)
                                            : null;
                                        const endTime = calculateEndTime(slotGig.startTime, slotGig.duration);
                                        
                                        return (
                                            <div 
                                                key={slotGig.gigId} 
                                                style={{ 
                                                    padding: '1rem', 
                                                    border: '1px solid var(--gn-grey-300)', 
                                                    borderRadius: '0.5rem',
                                                    minWidth: '200px',
                                                    flex: '1 1 200px',
                                                    position: 'relative'
                                                }}
                                            >
                                                <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>Slot {slotNumber}</h4>
                                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--gn-grey-600)' }}>
                                                    {slotGig.startTime}{endTime ? ` - ${endTime}` : ''}
                                                </p>
                                                {confirmedArtistId && (
                                                    <div className='status-box' style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                                                        <div className='status confirmed'>
                                                            <TickIcon />
                                                            Confirmed
                                                        </div>
                                                    </div>
                                                )}
                                                {confirmedArtist ? (() => {
                                                    const heroImageUrl = confirmedArtist.heroMedia.url;
                                                    const heroBrightness = confirmedArtist.heroBrightness || 110;
                                                    const heroPositionY = confirmedArtist.heroPositionY || 50;
                                                    
                                                    return (
                                                        <div style={{ marginTop: '0.5rem' }}>
                                                            {heroImageUrl && (
                                                                <div 
                                                                    style={{
                                                                        position: 'relative',
                                                                        width: '100%',
                                                                        height: '200px',
                                                                        borderRadius: '0.5rem',
                                                                        overflow: 'hidden',
                                                                        marginBottom: '0.5rem',
                                                                        filter: `brightness(${heroBrightness}%)`,
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={heroImageUrl}
                                                                        alt={confirmedArtist.name}
                                                                        style={{
                                                                            width: '100%',
                                                                            height: '100%',
                                                                            objectFit: 'cover',
                                                                            objectPosition: `center ${heroPositionY}%`,
                                                                        }}
                                                                    />
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            bottom: 0,
                                                                            left: 0,
                                                                            padding: '0.75rem',
                                                                            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                                                                            width: '100%',
                                                                        }}
                                                                    >
                                                                        <h4 style={{ 
                                                                            margin: 0, 
                                                                            color: 'white', 
                                                                            fontSize: '1.5rem',
                                                                            fontWeight: 600 
                                                                        }}>
                                                                            {confirmedArtist.name}
                                                                        </h4>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                <button
                                                                    className='btn tertiary'
                                                                    onClick={(e) => {
                                                                        if (isGuestApplicant(confirmedArtist)) { setGuestDetail(confirmedArtist); return; }
                                                                        openInNewTab(`/artist/${confirmedArtist.id}`, e);
                                                                    }}
                                                                >
                                                                    Profile
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })() : FEATURES.discovery ? (
                                                    <button 
                                                        className='btn secondary'
                                                        style={{ marginTop: '0.5rem', width: '100%' }}
                                                        onClick={() => navigate('/venues/dashboard/artists/find')}
                                                    >
                                                        Find Artist
                                                    </button>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                        {/* Confirmed artist box for single-slot gigs */}
                        {relatedSlots.length === 0 && (() => {
                            const confirmedArtistId = getConfirmedArtistForSlot(gigInfo);
                            const confirmedArtist = confirmedArtistId 
                                ? musicianProfiles.find(p => p.id === confirmedArtistId)
                                : null;
                            const endTime = calculateEndTime(gigInfo.startTime, gigInfo.duration);
                            
                            if (!confirmedArtist) return null;
                            
                            return (
                                <div style={{ marginBottom: '2rem' }}>
                                    <div 
                                        style={{ 
                                            padding: '1rem', 
                                            border: '1px solid var(--gn-grey-300)', 
                                            borderRadius: '0.5rem',
                                            minWidth: '200px',
                                            maxWidth: '400px',
                                            position: 'relative'
                                        }}
                                    >
                                        <h4 style={{ margin: '0 0 0.5rem 0' }}>
                                            {gigInfo.startTime}{endTime ? ` - ${endTime}` : ''}
                                        </h4>
                                        <div className='status-box' style={{ position: 'absolute', top: '0.75rem', right: '1rem' }}>
                                            <div className='status confirmed'>
                                                <TickIcon />
                                                Confirmed
                                            </div>
                                        </div>
                                        {(() => {
                                            const heroImageUrl = confirmedArtist.heroMedia?.url;
                                            const heroBrightness = confirmedArtist.heroBrightness || 110;
                                            const heroPositionY = confirmedArtist.heroPositionY || 50;
                                            
                                            return (
                                                <div style={{ marginTop: '1rem' }}>
                                                    {heroImageUrl && (
                                                        <div 
                                                            style={{
                                                                position: 'relative',
                                                                width: '100%',
                                                                height: '200px',
                                                                borderRadius: '0.5rem',
                                                                overflow: 'hidden',
                                                                marginBottom: '0.5rem',
                                                                filter: `brightness(${heroBrightness}%)`,
                                                            }}
                                                        >
                                                            <img
                                                                src={heroImageUrl}
                                                                alt={confirmedArtist.name}
                                                                style={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover',
                                                                    objectPosition: `center ${heroPositionY}%`,
                                                                }}
                                                            />
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    bottom: 0,
                                                                    left: 0,
                                                                    padding: '0.75rem',
                                                                    background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                                                                    width: '100%',
                                                                }}
                                                            >
                                                                <h4 style={{ 
                                                                    margin: 0, 
                                                                    color: 'white', 
                                                                    fontSize: '1.5rem',
                                                                    fontWeight: 600 
                                                                }}>
                                                                    {confirmedArtist.name}
                                                                </h4>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        <button
                                                            className='btn tertiary'
                                                            onClick={(e) => {
                                                                if (isGuestApplicant(confirmedArtist)) { setGuestDetail(confirmedArtist); return; }
                                                                openInNewTab(`/artist/${confirmedArtist.id}`, e);
                                                            }}
                                                        >
                                                            Profile
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })()}
                        {musicianProfiles.length > 0 && (
                            <h4 style={{ marginBottom: '1rem', marginTop: '2rem' }}>All Gig Applications</h4>
                        )}
                        {musicianProfiles.length > 0 ? (
                        <table className='applications-table'>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Video</th>
                                    <th>Fee</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {musicianProfiles
                                    .filter((profile) => {
                                        // Filter out declined applications if the artist has been invited to a different slot
                                        const slotGigId = profile.applicationSlotGigId || gigInfo.gigId;
                                        const slotGig = slotGigId === gigInfo.gigId 
                                            ? gigInfo 
                                            : relatedSlots.find(s => s.gigId === slotGigId) || gigInfo;
                                        const applicant = slotGig?.applicants?.find(applicant => applicant.id === profile.id);
                                        const status = applicant ? applicant.status : (profile.status || 'pending');
                                        
                                        // If this is a declined application, check if artist has been invited to a different slot
                                        if (status === 'declined') {
                                            if (applicant?.declinedForOtherSet) return true;
                                            const allSlots = [gigInfo, ...relatedSlots].filter(Boolean);
                                            const hasInviteOnOtherSlot = allSlots.some(slot => {
                                                if (slot.gigId === slotGigId) return false; // Same slot
                                                const otherApplicant = slot.applicants?.find(app => app.id === profile.id);
                                                return otherApplicant && (otherApplicant.invited || otherApplicant.status === 'pending' && otherApplicant.sentBy === 'venue');
                                            });
                                            // Hide declined application if artist has been invited to a different slot
                                            return !hasInviteOnOtherSlot;
                                        }
                                        return true;
                                    })
                                    .map((profile, index) => {
                                    // Find the applicant for the specific slot this row represents
                                    const slotGigId = profile.applicationSlotGigId || gigInfo.gigId;
                                    const slotGig = slotGigId === gigInfo.gigId 
                                        ? gigInfo 
                                        : relatedSlots.find(s => s.gigId === slotGigId) || gigInfo;
                                    const applicant = slotGig?.applicants?.find(applicant => applicant.id === profile.id);
                                    const sender = applicant ? applicant.sentBy : (profile.sentBy || 'musician');
                                    const status = applicant ? applicant.status : (profile.status || 'pending');
                                    const gigAlreadyConfirmed = (!FEATURES.payments || slotGig?.paymentModel === 'no_fee' || slotGig?.kind === 'Open Mic')
                                        ? false
                                        : slotGig?.applicants?.some((a) => ['confirmed', 'accepted', 'paid'].includes(a?.status));
                                    const slotNumber = getSlotNumber(slotGigId);
                                    const isInvited = sender === 'venue' || applicant?.invited;
                                    const appliedToSlotText = relatedSlots.length > 0 && slotNumber 
                                        ? (isInvited ? `Invited to Slot ${slotNumber}` : `Applied for Slot ${slotNumber}`)
                                        : null;
                                    
                                    return (
                                        <tr key={`${profile.id}-${slotGigId}-${index}`} className='applicant' onClick={(e) => {
                                            if (isGuestApplicant(profile)) { setGuestDetail(applicant || profile); return; }
                                            openInNewTab(`/artist/${profile.id}`, e);
                                        }} onMouseEnter={() => setHoveredRowId(profile.id)}
                                        onMouseLeave={() => setHoveredRowId(null)}>
                                            <td className='musician-name'>
                                                {hoveredRowId === profile.id && !isGuestApplicant(profile) && (
                                                    <NewTabIcon />
                                                )}
                                                {profile.name}
                                                {isGuestApplicant(profile) && <span className="ga-guest-tag">Guest</span>}
                                            </td>
                                            <td>{profile?.videos && profile?.videos.length > 0 ? (
                                                <button className='btn tertiary' onClick={(e) => {e.stopPropagation(); setVideoToPlay(profile.videos[0]);}} onMouseEnter={() => setHoveredRowId(null)} onMouseLeave={() => setHoveredRowId(profile.id)}>
                                                    <PlayIcon />
                                                    Play Video
                                                </button>
                                            ) : (
                                                'No Video'
                                            )}</td>
                                            <td>
                                                {(gigInfo.kind !== 'Open Mic' && gigInfo.kind !== 'Ticketed Gig') ? (
                                                    profile.proposedFee !== gigInfo.budget ? (
                                                        <>
                                                            <span style={{ textDecoration: 'line-through', marginRight: '5px' }}>{gigInfo.budget}</span>
                                                            <span>{profile.proposedFee}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {profile.proposedFee}
                                                        </>
                                                    )
                                                ) : (
                                                    gigInfo.kind
                                                )}
                                            </td>
                                            {getLocalGigDateTime(gigInfo) < now ? (
                                                <td className='status-container' style={{
                                                    textAlign: 'center',
                                                    minWidth: '140px',
                                                    width: '100%',
                                                    whiteSpace: 'nowrap'
                                                  }}>
                                                    {status !== 'confirmed' ? (
                                                        <div className='status-box'>
                                                            <div className='status previous'>
                                                                <PreviousIcon />
                                                                Past
                                                            </div>
                                                        </div>
                                                    ) : FEATURES.reviews && !gigInfo.venueHasReviewed && !gigInfo.disputeLogged && hasVenuePerm(venues, gigInfo.venueId, 'reviews.create') ? (
                                                        <div className='leave-review'>
                                                            <button className='btn primary' onClick={(e) => {e.stopPropagation(); setShowReviewModal(true); setReviewProfile(profile)}}>
                                                                Leave a Review
                                                            </button>
                                                        </div>
                                                    ) : FEATURES.reviews && !gigInfo.venueHasReviewed && !gigInfo.disputeLogged && !hasVenuePerm(venues, gigInfo.venueId, 'reviews.create') ? (
                                                        <div className='status-box'>
                                                            <div className='status past'>
                                                                <PermissionsIcon />
                                                                You don't have permission to review artists
                                                            </div>
                                                        </div>
                                                    ) : FEATURES.reviews && gigInfo.venueHasReviewed && !gigInfo.disputeLogged ? (
                                                        <div className='status-box'>
                                                            <div className='status confirmed'>
                                                                <TickIcon />
                                                                Reviewed
                                                            </div>
                                                        </div>
                                                    ) : gigInfo.disputeLogged && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                In Dispute
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            ) : (
                                                <td className='status-container' style={{
                                                    minWidth: '140px',
                                                    width: '100%',
                                                    minHeight: '50px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                  }}>
                                                    {appliedToSlotText && (
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--gn-grey-600)', margin: '0 0 0.5rem 0' }}>
                                                            {appliedToSlotText}
                                                        </p>
                                                    )}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    {(status === 'confirmed' || status === 'paid' || status === 'accepted') && (
                                                        <div className='status-box'>
                                                            <div className='status confirmed'>
                                                                <TickIcon />
                                                                Confirmed
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'negotiating' || (status === 'pending' && sender === 'venue') && (
                                                        <div className='status-box'>
                                                            <div className='status upcoming'>
                                                                <ClockIcon />
                                                                Negotiating
                                                            </div>
                                                        </div>
                                                    )}
                                                    {FEATURES.payments && status === 'accepted' && (slotGig.kind !== 'Open Mic' && slotGig.kind !== 'Ticketed Gig') && slotGig.budget !== '£' && slotGig.budget !== '£0' && hasVenuePerm(venues, slotGig.venueId, 'gigs.pay') && (
                                                        loadingPaymentDetails || showPaymentModal || status === 'payment processing' ? (
                                                            <LoadingSpinner />
                                                        ) : (
                                                            <button className='btn primary' onClick={(event) => {event.stopPropagation(); handleCompletePayment(profile.id, slotGigId)}}>
                                                                Complete Payment
                                                            </button>
                                                        )
                                                    )}
                                                    {(status === 'pending' && getLocalGigDateTime(slotGig) > now) && !applicant?.invited && !gigAlreadyConfirmed && sender !== 'venue' && hasVenuePerm(venues, slotGig.venueId, 'gigs.applications.manage') && (
                                                        <>
                                                            {eventLoading ? (
                                                                <LoadingSpinner width={15} height={15} />
                                                            ) : (
                                                                <div className='two-buttons'>
                                                                    <button className='btn accept small' style={{ display: 'flex', alignItems: 'center', gap: '5px'}} onClick={(event) => handleAccept(profile.id, event, profile.proposedFee, profile.email, profile.name, slotGigId)}>
                                                                        <TickIcon />
                                                                        Accept
                                                                    </button>
                                                                    <button className='btn decline small' style={{ display: 'flex', alignItems: 'center', gap: '5px'}} onClick={(event) => handleReject(profile.id, event, profile.proposedFee, profile.email, profile.name, slotGigId)}>
                                                                        <ErrorIcon />
                                                                        Decline
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                    {(status === 'pending' && getLocalGigDateTime(slotGig) > now) && !applicant?.invited && slotGig.kind === 'Open Mic' && gigAlreadyConfirmed && sender !== 'venue' && hasVenuePerm(venues, slotGig.venueId, 'gigs.applications.manage') && (
                                                        <>
                                                            {eventLoading ? (
                                                                <LoadingSpinner width={15} height={15} />
                                                            ) : (
                                                                <div className='two-buttons'>
                                                                    <button className='btn accept small' style={{ display: 'flex', alignItems: 'center', gap: '5px'}} onClick={(event) => handleAccept(profile.id, event, profile.proposedFee, profile.email, profile.name, slotGigId)}>
                                                                        <TickIcon />
                                                                        Accept
                                                                    </button>
                                                                    <button className='btn decline small' style={{ display: 'flex', alignItems: 'center', gap: '5px'}} onClick={(event) => handleReject(profile.id, event, profile.proposedFee, profile.email, profile.name, slotGigId)}>
                                                                        <ErrorIcon />
                                                                        Decline
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                    {(status === 'pending' && getLocalGigDateTime(slotGig) > now) && applicant?.invited && !gigAlreadyConfirmed && (
                                                        <div className='status-box'>
                                                            <div className='status upcoming'>
                                                                <ClockIcon />
                                                                Musician Invited
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'declined' && gigAlreadyConfirmed && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                Declined
                                                            </div>
                                                            {applicant?.declinedForOtherSet ? (
                                                                <p style={{ fontSize: '0.82rem', color: 'var(--gn-grey-600)', margin: '0.35rem 0 0', lineHeight: 1.35 }}>
                                                                    Confirmed for another set — closed automatically.
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                    {status === 'withdrawn' && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                Musician Withdrew
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'pending' && gigAlreadyConfirmed && slotGig.kind !== 'Open Mic' && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                Declined
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && relatedSlots.length > 0 && hasVenuePerm(venues, slotGig.venueId, 'gigs.invite') && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                Declined
                                                            </div>
                                                            {applicant?.declinedForOtherSet ? (
                                                                <p style={{ fontSize: '0.82rem', color: 'var(--gn-grey-600)', margin: '0.35rem 0 0', lineHeight: 1.35 }}>
                                                                    Confirmed for another set — closed automatically.
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && !applicant?.declinedForOtherSet && (slotGig.budget !== '£' && slotGig.budget !== '£0') && (slotGig.kind !== 'Ticketed Gig' && slotGig.kind !== 'Open Mic') && !applicant?.invited && hasVenuePerm(venues, slotGig.venueId, 'gigs.applications.manage') && (
                                                        <button className='btn primary small' onClick={(event) => {event.stopPropagation(); sendToConversation(profile.userId, slotGigId, profile.id)}}>
                                                            Negotiate Fee
                                                        </button>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && relatedSlots.length === 0 && (slotGig.kind === 'Ticketed Gig' || slotGig.kind === 'Open Mic') && applicant?.invited && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                Declined
                                                            </div>
                                                            {applicant?.declinedForOtherSet ? (
                                                                <p style={{ fontSize: '0.82rem', color: 'var(--gn-grey-600)', margin: '0.35rem 0 0', lineHeight: 1.35 }}>
                                                                    Confirmed for another set — closed automatically.
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && relatedSlots.length === 0 && (slotGig.kind === 'Ticketed Gig' || slotGig.kind === 'Open Mic') && !applicant?.invited && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                Declined
                                                            </div>
                                                            {applicant?.declinedForOtherSet ? (
                                                                <p style={{ fontSize: '0.82rem', color: 'var(--gn-grey-600)', margin: '0.35rem 0 0', lineHeight: 1.35 }}>
                                                                    Confirmed for another set — closed automatically.
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                    {status === 'payment processing' && (
                                                        <div className='status-box'>
                                                            <div className='status upcoming'>
                                                                <ClockIcon />
                                                                Payment Processing
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status !== 'accepted' && status !== 'declined' && status !== 'confirmed' && !hasVenuePerm(venues, gigInfo.venueId, 'gigs.applications.manage') && (
                                                        <div className='status-box'>
                                                            <div className='status past'>
                                                                <PermissionsIcon />
                                                                You don't have permission to manage gig applications
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'accepted' && !hasVenuePerm(venues, gigInfo.venueId, 'gigs.pay') && (
                                                        <div className='status-box'>
                                                            <div className='status past'>
                                                                <PermissionsIcon />
                                                                You don't have permission to pay for gigs
                                                            </div>
                                                        </div>
                                                    )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : gigInfo.status === 'closed' ? (
                        <div className='no-applications'>
                            <h4>This Gig has been closed.</h4>
                            {hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                                <button className='btn primary' onClick={handleReopenGig}>
                                    Reopen Gig to Applications
                                </button>
                            )}
                        </div>
                    ) : hasVenuePerm(venues, gigInfo.venueId, 'gigs.invite') && relatedSlots.length === 0 && (
                        <div className='no-applications'>
                            <h4>No artists have applied to this gig yet.</h4>
                            {FEATURES.discovery && (
                            <button className='btn primary' onClick={() => navigate('/venues/dashboard/artists/find')}>
                                Find Artist
                            </button>
                            )}
                        </div>
                    )}
                    </>
                        )}
                    </>
                )}
            </div>
            </>
            )}
            {bookedArtistTechRiderModal ? (
                <Portal>
                    <ApplicantTechSetupModal
                        techRider={bookedArtistTechRiderModal.artistProfile?.techRider || {}}
                        artistName={bookedArtistTechRiderModal.artistProfile?.name || 'Artist'}
                        venueTechRider={bookedArtistTechRiderModal.venueTechRider}
                        application={
                            bookedArtistTechRiderModal.applicationTechSetup
                                ? { techSetup: bookedArtistTechRiderModal.applicationTechSetup }
                                : bookedArtistTechRiderModal.applicant?.techSetup
                                  ? { techSetup: bookedArtistTechRiderModal.applicant.techSetup }
                                  : null
                        }
                        onClose={() => setBookedArtistTechRiderModal(null)}
                    />
                </Portal>
            ) : null}
            {FEATURES.payments && showPaymentModal && (
                <Portal>
                    <PaymentModal 
                        savedCards={savedCards}
                        onSelectCard={handleSelectCard}
                        onClose={() => {setShowPaymentModal(false); setPaymentSuccess(false), setMusicianProfileId(null); setWatchPaymentIntentId(null); setPaymentSlotGig(null)}}
                        gigData={paymentSlotGig || gigInfo}
                        setMakingPayment={setMakingPayment}
                        makingPayment={makingPayment}
                        setPaymentSuccess={setPaymentSuccess}
                        paymentSuccess={paymentSuccess}
                        setSavedCards={setSavedCards}
                        paymentIntentId={watchPaymentIntentId}
                        setGigData={setGigInfo}
                        musicianProfileId={musicianProfileId}
                        customerDetails={customerDetails}
                        venues={venues}
                    />
                </Portal>
            )}
            {FEATURES.reviews && showReviewModal && (
                <Portal>
                    <ReviewModal
                        gigData={gigInfo}
                        setGigData={setGigInfo}
                        reviewer='venue'
                        venueProfiles={venues}
                        onClose={() => {
                            setShowReviewModal(false)
                            setReviewProfile(null)
                        }}
                    />
                </Portal>
            )}
            {showPromoteModal && (
                <Portal>
                    <PromoteModal
                        socialLinks={null}
                        setShowSocialsModal={setShowPromoteModal}
                        musicianId={null}
                        venueId={gigInfo.venueId}
                    />
                </Portal>
            )}
            {closeApplicationsPrompt && (
                <Portal>
                    <div className='modal' onClick={() => setCloseApplicationsPrompt(null)}>
                        <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                            <h3>{closeApplicationsPrompt === 'filled' ? 'Close applications now?' : 'Some sets are still open'}</h3>
                            <p>
                                {closeApplicationsPrompt === 'filled'
                                    ? 'Every slot is filled. You can close applications, or keep the gig open.'
                                    : 'You can close applications for the sets that are still open, or keep taking applications.'}
                            </p>
                            <div className='two-buttons' style={{ marginTop: '1rem' }}>
                                <button type='button' className='btn tertiary' onClick={() => setCloseApplicationsPrompt(null)}>
                                    Keep open
                                </button>
                                <button
                                    type='button'
                                    className='btn primary'
                                    onClick={async () => {
                                        const ids = closeApplicationsGigIds;
                                        setCloseApplicationsPrompt(null);
                                        try {
                                            await Promise.all(ids.map((id) => updateGigDocument({
                                                gigId: id,
                                                action: 'gigs.applications.manage',
                                                updates: { applicationsOpen: false },
                                            })));
                                            toast.success('Applications closed.');
                                            refreshGigs();
                                        } catch (err) {
                                            console.error(err);
                                            toast.error('Failed to close applications.');
                                        }
                                    }}
                                >
                                    {closeApplicationsPrompt === 'filled' ? 'Close' : 'Close applications for the rest'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
            {showDeleteConfirmationModal && (
                <Portal>
                    {modalLoading ? (
                        <LoadingModal />
                    ) : (
                        <div className='modal delete-gig' onClick={() => setShowDeleteConfirmationModal(false)}>
                            <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                                <h3 style={{ textAlign: 'center' }}>Are you sure you want to delete this gig?</h3>
                                <div className='two-buttons' style={{ marginTop: '1.5rem'}}>
                                    <button className='btn tertiary' onClick={() => setShowDeleteConfirmationModal(false)}>
                                        Cancel
                                    </button>
                                    <button className='btn danger' onClick={handleDeleteGig}>
                                        Delete Gig
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </Portal>
            )}
            {showCancelConfirmationModal && (
                <Portal>
                    {modalLoading ? (
                        <LoadingModal />
                    ) : (
                        <div className='modal cancel-gig' onClick={() => { setCancelSlotGig(null); setShowCancelConfirmationModal(false); }}>
                            <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                                <h3>{cancelSlotGig ? 'Cancel booking' : 'Cancel Gig'}</h3>
                                <div className="modal-body">
                                    <div className="text">
                                        <h4>What&apos;s your reason for cancelling?</h4>
                                    </div>
                                    <div className="input-container select">
                                        <select id='cancellation-reason' value={cancellationReason.reason} onChange={(e) => setCancellationReason((prev) => ({
                                                ...prev,
                                                reason: e.target.value,
                                            }))}>
                                            <option value=''>Please select a reason</option>
                                            <option value='fee'>Fee Dispute</option>
                                            <option value='availability'>Availability</option>
                                            <option value='double-booking'>Double Booking</option>
                                            <option value='personal-reasons'>Personal Reasons</option>
                                            <option value='illness'>Illness</option>
                                            <option value='information'>Not Enough Information</option>
                                            <option value='other'>Other</option>
                                        </select>
                                    </div>
                                    <div className="input-container">
                                        <label htmlFor="extraDetails" className='label'>Add any extra details below:</label>
                                        <textarea name="extra-details" value={cancellationReason.extraDetails} id="extraDetails" className='input' onChange={(e) => setCancellationReason((prev) => ({
                                                ...prev,
                                                extraDetails: e.target.value,
                                            }))}></textarea>
                                    </div>
                                </div>
                                <div className='two-buttons'>
                                    <button className='btn tertiary' onClick={() => { setCancelSlotGig(null); setShowCancelConfirmationModal(false); }}>
                                        Exit
                                    </button>
                                    <button className='btn danger' onClick={handleCancelGig}>
                                        {cancelSlotGig ? 'Cancel booking' : 'Cancel Gig'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </Portal>
            )}
            {videoToPlay && <VideoModal video={videoToPlay} onClose={closeModal} />}
            {showGigHandbook && gigForHandbook && (
                <Portal>
                    <div className="modal" onClick={() => setShowGigHandbook(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <button 
                                className="btn close tertiary"
                                onClick={() => setShowGigHandbook(false)}
                            >
                                Close
                            </button>
                            <GigHandbook 
                                setShowGigHandbook={setShowGigHandbook}
                                gigForHandbook={gigForHandbook}
                                musicianId={null}
                            />
                        </div>
                    </div>
                </Portal>
            )}
            {(inviteModalGig || (showInvitesModal && gigInfo)) && (
                <GigInvitesModal
                    gig={inviteModalGig || gigInfo}
                    venues={venues}
                    onClose={() => {
                        if (inviteModalGig) setInviteModalGig(null);
                        else setShowInvitesModal(false);
                    }}
                    refreshGigs={refreshGigs}
                />
            )}
            {showEditTimeModal && gigInfo && (
                <Portal>
                    <EditGigTimeModal
                        gig={gigInfo}
                        allSlots={allSlots}
                        onClose={() => setShowEditTimeModal(false)}
                        refreshGigs={refreshGigs}
                        user={user}
                        editMode={editTimeModalMode}
                    />
                </Portal>
            )}
        </>
    );
};

function GuestApplicantPanel({ applicant, onClose }) {
  const phoneDigits = String(applicant.phone || '').replace(/[^\d]/g, '');
  const waNumber = phoneDigits.startsWith('0') ? `44${phoneDigits.slice(1)}` : phoneDigits;
  const contacts = [
    applicant.email && { key: 'email', node: <a href={`mailto:${applicant.email}`}>{applicant.email}</a> },
    applicant.phone && { key: 'phone', node: <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">{applicant.phone}</a> },
    applicant.instagram && { key: 'instagram', node: applicant.instagram },
  ].filter((line) => line && (line.key !== 'phone' || waNumber));
  const links = Object.entries(applicant.links || {}).filter(([, value]) => value);
  return (
    <div className="ga-guest-panel-backdrop" onClick={onClose}>
      <aside className="ga-guest-panel" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{applicant.name || 'Guest'}</h2>
          <span className="ga-guest-tag">Guest</span>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        {applicant.photoUrl && <img src={applicant.photoUrl} alt="" />}
        <p>{applicant.contactName}</p>
        {contacts.map((line) => <p key={line.key}>{line.key === 'phone' ? 'Phone · ' : line.key === 'email' ? 'Email · ' : 'Instagram · '}{line.node}</p>)}
        {links.map(([key, value]) => <p key={key}><a href={value} target="_blank" rel="noreferrer">{key}</a></p>)}
        {applicant.setLabel && <p>{applicant.setLabel}</p>}
        {applicant.note && <p>{applicant.note}</p>}
        {!!applicant.needs?.length && <p>Needs {applicant.needs.length} items from the bar.</p>}
        {!!applicant.bringOwn?.length && <p>Bringing {applicant.bringOwn.join(', ')}.</p>}
      </aside>
    </div>
  );
}
