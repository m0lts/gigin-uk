
import { useState, useEffect, useMemo, useRef } from 'react';
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
import { LinkIcon, InviteIconSolid } from '../../shared/ui/extras/Icons';
import { TechRiderModal } from '@features/venue/components/TechRiderModal';
import { EditGigTimeModal } from '@features/venue/components/EditGigTimeModal';
import { useAuth } from '@hooks/useAuth';
import { PaymentModal } from '@features/venue/components/PaymentModal';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { getMusicianProfileByMusicianId, getArtistProfileById } from '@services/client-side/artists';
import { getUserEmailById } from '@services/api/users';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { getOrCreateConversation, notifyOtherApplicantsGigConfirmed } from '@services/api/conversations';
import { getMostRecentMessage } from '@services/client-side/messages';
import { removeGigFromVenue } from '@services/client-side/venues';
import { confirmGigPayment, fetchSavedCards } from '@services/api/payments';
import { openInNewTab } from '../../../services/utils/misc';
import { CloseIcon, LeftArrowIcon, NewTabIcon, PeopleGroupIconSolid, PermissionsIcon, PlayIcon, PreviousIcon, SettingsIcon, DeleteIcon, CancelIcon } from '../../shared/ui/extras/Icons';
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
import { toJsDate, formatDate as formatDateUtil } from '../../../services/utils/dates';
import { sendGigAcceptedMessage, updateDeclinedApplicationMessage, postCancellationMessage } from '@services/api/messages';
import { cancelledGigMusicianProfileUpdate } from '@services/api/artists';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { getGigsByIds } from '@services/client-side/gigs';
import { inviteToGig } from '@services/api/gigs';
import { sendGigInvitationMessage } from '@services/client-side/messages';
import { formatDate } from '@services/utils/dates';
import { GigHandbook } from '@features/artist/components/GigHandbook';
import { storage } from '@lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { GigInvitesModal } from '../components/GigInvitesModal';
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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

export const GigApplications = ({ setGigPostModal, setEditGigData, gigs, venues, refreshStripe, customerDetails, refreshGigs }) => {

    const {isMdUp, isLgUp} = useBreakpoint();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const now = useMemo(() => new Date(), []);

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
    const [gigInfo, setGigInfo] = useState(null);
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
    const [watchPaymentIntentId, setWatchPaymentIntentId] = useState(null);
    const [hoveredRowId, setHoveredRowId] = useState(null);
    const [cancellationReason, setCancellationReason] = useState({
        reason: '',
        extraDetails: '',
      });
    const [eventLoading, setEventLoading] = useState(false);
    const [showTechRiderModal, setShowTechRiderModal] = useState(false);
    const [techRiderProfile, setTechRiderProfile] = useState(null);
    const [editingSoundManager, setEditingSoundManager] = useState(false);
    const [soundManagerValue, setSoundManagerValue] = useState('');
    const [savingSoundManager, setSavingSoundManager] = useState(false);
    const soundManagerTextareaRef = useRef(null);
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesValue, setNotesValue] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const notesTextareaRef = useRef(null);
    const [relatedSlots, setRelatedSlots] = useState([]);
    const [showSlotInviteModal, setShowSlotInviteModal] = useState(false);
    const [selectedMusicianForSlotInvite, setSelectedMusicianForSlotInvite] = useState(null);
    const [declinedSlotGigId, setDeclinedSlotGigId] = useState(null);
    const [invitingToSlot, setInvitingToSlot] = useState(false);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [gigForHandbook, setGigForHandbook] = useState(null);
    const [confirmedArtistProfiles, setConfirmedArtistProfiles] = useState(new Map());
    const [heroImageUrls, setHeroImageUrls] = useState(new Map());
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const optionsMenuRef = useRef(null);

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
    const [showInvitesModal, setShowInvitesModal] = useState(false);
    const [showEditTimeModal, setShowEditTimeModal] = useState(false);
    const [editTimeModalMode, setEditTimeModalMode] = useState('both'); // 'name', 'timings', or 'both'
    const gigId = location.state?.gig?.gigId || '';
    const gigDate = location.state?.gig?.date || '';
    const venueName = location.state?.gig?.venue?.venueName || '';

    useEffect(() => {
        if (!gigId || !gigs) return;
        const activeGig = gigs.find(gig => gig.gigId === gigId);
        setGigInfo(activeGig);
        if (activeGig) {
            if (!editingSoundManager) {
                setSoundManagerValue(activeGig.soundManager || '');
            }
            if (!editingNotes) {
                setNotesValue(activeGig.notes || '');
            }
            
            // Fetch related slots if this gig has gigSlots
            if (Array.isArray(activeGig.gigSlots) && activeGig.gigSlots.length > 0) {
                (async () => {
                    try {
                        const slotGigs = await getGigsByIds(activeGig.gigSlots);
                        // Normalize slot gigs to match the format used in the component
                        const normalizedSlots = slotGigs.map(gig => ({
                            ...gig,
                            gigId: gig.id || gig.gigId,
                        }));
                        setRelatedSlots(normalizedSlots);
                    } catch (error) {
                        console.error('Error fetching related slots:', error);
                        setRelatedSlots([]);
                    }
                })();
            } else {
                setRelatedSlots([]);
            }
        }
    }, [gigId, gigs, editingSoundManager, editingNotes]);

    const markedRef = useRef(new Set()); // gigIds we’ve already marked this session

    useEffect(() => {
      if (!gigInfo) return;
    
      // Only mark if there are unviewed applicants
      const hasUnviewed = Array.isArray(gigInfo.applicants) &&
        gigInfo.applicants.some(a => a?.viewed !== true);
    
      // Don’t call again for the same gig this session
      if (!hasUnviewed || markedRef.current.has(gigInfo.gigId)) {
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
          
          // Get unique profile IDs first
          const uniqueProfileIds = [...new Set(allApplicants.map(app => app.id))];
          
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
          
          // Add applications to each profile
          for (const app of allApplicants) {
            const profileEntry = profilesMap.get(app.id);
            if (profileEntry) {
              profileEntry.applications.push({
                slotGigId: app.slotGigId,
                slotGigName: app.slotGigName,
                slotStartTime: app.slotStartTime,
                status: app.status,
                proposedFee: app.fee,
                viewed: app.viewed,
                invited: app.invited,
                sentBy: app.sentBy,
              });
            }
          }
          
          // Convert to array and create separate entries for each slot application
          const profiles = [];
          profilesMap.forEach((profile) => {
            profile.applications.forEach((app) => {
              profiles.push({
                ...profile,
                applicationSlotGigId: app.slotGigId,
                applicationSlotGigName: app.slotGigName,
                applicationSlotStartTime: app.slotStartTime,
                status: app.status,
                proposedFee: app.proposedFee,
                viewed: app.viewed,
                invited: app.invited,
                sentBy: app.sentBy,
              });
            });
          });
          
          setMusicianProfiles(profiles);
          setLoading(false);
        } catch (e) {
          console.error("Error fetching profiles:", e);
        }
      }
    }, [gigInfo, relatedSlots]);

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
            setEventLoading(true);
            const nonPayableGig = targetGig.kind === 'Open Mic' || targetGig.kind === "Ticketed Gig" || targetGig.budget === '£' || targetGig.budget === '£0';
            let globalAgreedFee;
            
            if (targetGig.kind === 'Open Mic') {
                const { updatedApplicants } = assertOk(
                    await acceptGigOfferOM({ gigData: targetGig, musicianProfileId: musicianId, role: 'venue' }),
                    'acceptGigOfferOM'
                );
                if (!Array.isArray(updatedApplicants)) {
                    toast.error('Failed to update gig status. Please try again.');
                    throw new Error('acceptGigOfferOM: updatedApplicants is not an array');
                };
                
                // Update the target gig
                if (targetGig.gigId === gigInfo.gigId) {
                    setGigInfo((prevGigInfo) => ({
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
                if (agreedFee == null) {
                    toast.error('Failed to update gig status. Please try again.');
                    throw new Error('acceptGigOffer: no agreedFee')
                };
                
                // Update the target gig
                if (targetGig.gigId === gigInfo.gigId) {
                    setGigInfo((prevGigInfo) => ({
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
                globalAgreedFee = agreedFee;
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
            
            const musicianProfile = await getProfileById(musicianId);
            const venueProfile = await getVenueProfileById(targetGig.venueId);
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
            await sendGigAcceptedEmail({
                userRole: 'venue',
                musicianProfile: musicianProfile,
                venueProfile: venueProfile,
                gigData: targetGig,
                agreedFee: globalAgreedFee,
                isNegotiated: false,
                nonPayableGig,
            })
            if (nonPayableGig) {
                await notifyOtherApplicantsGigConfirmed({ gigData: targetGig, acceptedMusicianId: musicianId });
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
                setGigInfo((prevGigInfo) => ({
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
            
            const musicianProfile = await getProfileById(musicianId);
            const venueProfile = await getVenueProfileById(targetGig.venueId);
            const { conversationId } = await getOrCreateConversation({ musicianProfile, gigData: targetGig, venueProfile, type: 'application' })
            if (proposedFee === targetGig.budget) {
                const applicationMessage = await getMostRecentMessage(conversationId, 'application');
                await updateDeclinedApplicationMessage({ conversationId, originalMessageId: applicationMessage.id, senderId: user.uid, userRole: 'venue', fee: targetGig.budget });
            } else {
                const applicationMessage = await getMostRecentMessage(conversationId, 'negotiation');
                await updateDeclinedApplicationMessage({ conversationId, originalMessageId: applicationMessage.id, senderId: user.uid, userRole: 'venue', fee: proposedFee });
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

    const handleDeclineAndInviteToSlot = async (musicianId, event, proposedFee, musicianEmail, musicianName, slotGigId, profile) => {
        event.stopPropagation();
        try {
            // First, decline the application
            await handleReject(musicianId, event, proposedFee, musicianEmail, musicianName, slotGigId);
            
            // Then open the slot invite modal
            setSelectedMusicianForSlotInvite(profile);
            setDeclinedSlotGigId(slotGigId);
            setShowSlotInviteModal(true);
        } catch (error) {
            console.error('Error declining and opening invite modal:', error);
            // Error is already handled in handleReject, so we don't need to show another toast
        }
    };

    const sendToConversation = async (userId) => {
        const conversations = await getConversationsByParticipantAndGigId(gigInfo.gigId, userId)
        const conversationId = conversations[0].id;
        navigate(`/venues/dashboard/messages?conversationId=${conversationId}`);
    }

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
                setGigInfo(prev => ({
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
                setGigInfo(prev => ({
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

    const openGigPostModal = (gig) => {
        // Check if this is a grouped gig with multiple slots
        if (allSlots.length > 1) {
            // Package all slots together for editing
            const sortedSlots = [...allSlots].sort((a, b) => {
                if (!a.startTime || !b.startTime) return 0;
                const [aH, aM] = a.startTime.split(':').map(Number);
                const [bH, bM] = b.startTime.split(':').map(Number);
                return (aH * 60 + aM) - (bH * 60 + bM);
            });
            
            const primaryGig = sortedSlots[0];
            const baseGigName = primaryGig.gigName.replace(/\s*\(Set\s+\d+\)\s*$/, '');
            
            // Create extraSlots from remaining slots
            const extraSlots = sortedSlots.slice(1).map(slot => ({
                startTime: slot.startTime,
                duration: slot.duration,
            }));
            
            // Get budgets for each slot
            const slotBudgets = sortedSlots.map(slot => {
                if (slot.kind === 'Open Mic' || slot.kind === 'Ticketed Gig') return null;
                // Extract numeric value from budget string (e.g., "£100" -> 100)
                const budgetStr = slot.budget || '';
                if (budgetStr === '£0' || budgetStr === '£' || !budgetStr) return null;
                const numericValue = budgetStr.replace(/[^0-9.]/g, '');
                return numericValue && parseFloat(numericValue) > 0 ? parseFloat(numericValue) : null;
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
                // Preserve existing gig IDs for editing
                existingGigIds: sortedSlots.map(slot => slot.gigId),
            };
            setEditGigData(convertedGig);
        } else {
            const startDT = toJsDate(gig.startDateTime) ?? toJsDate(gig.date);
            const dateOnly = startDT
                ? new Date(startDT.getFullYear(), startDT.getMonth(), startDT.getDate())
                : (gig.date?.toDate ? gig.date.toDate() : (gig.date instanceof Date ? gig.date : null));

            const convertedGig = {
                ...gig,
                date: dateOnly,
                // Set existingGigIds for single-slot gigs so we can add slots to the same gig
                existingGigIds: [gig.gigId],
            };
            setEditGigData(convertedGig);
        }
        setGigPostModal(true);
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

    const copyToClipboard = (link) => {
        navigator.clipboard.writeText(`${link}`).then(() => {
            toast.success(`Copied Gig Link: ${link}`);
        }).catch((err) => {
            toast.error('Failed to copy link. Please try again.')
            console.error('Failed to copy link: ', err);
        });
    };

    const calculateEndTime = (startTime, duration) => {
        if (!startTime || !duration) return null;
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    };

    // Helper to get slot number (1-indexed)
    const getSlotNumber = (slotGigId) => {
        const allSlots = [gigInfo, ...relatedSlots].filter(Boolean);
        const sortedSlots = [...allSlots].sort((a, b) => {
            if (!a.startTime || !b.startTime) return 0;
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
        });
        const index = sortedSlots.findIndex(s => s.gigId === slotGigId);
        return index >= 0 ? index + 1 : null;
    };

    // Helper to get confirmed artist for a slot
    const getConfirmedArtistForSlot = (slotGig) => {
        if (!slotGig || !Array.isArray(slotGig.applicants)) return null;
        const confirmed = slotGig.applicants.find(app => app.status === 'confirmed');
        return confirmed ? confirmed.id : null;
    };

    // Helper to handle inviting to a different slot
    const handleInviteToSlot = async (slotGig) => {
        if (!selectedMusicianForSlotInvite || !slotGig) return;
        
        try {
            setInvitingToSlot(true);
            if (!hasVenuePerm(venues, slotGig.venueId, 'gigs.invite')) {
                toast.error('You do not have permission to invite artists for this venue.');
                return;
            }
            
            const venueToSend = venues.find(v => v.venueId === slotGig.venueId);
            if (!venueToSend) {
                toast.error('Venue not found.');
                return;
            }
            
            const musicianProfilePayload = {
                musicianId: selectedMusicianForSlotInvite.id,
                id: selectedMusicianForSlotInvite.id,
                name: selectedMusicianForSlotInvite.name,
                genres: selectedMusicianForSlotInvite.genres || [],
                musicianType: selectedMusicianForSlotInvite.artistType || 'Musician/Band',
                musicType: selectedMusicianForSlotInvite.genres || [],
                bandProfile: false,
                userId: selectedMusicianForSlotInvite.userId,
            };
            
            const res = await inviteToGig({ gigId: slotGig.gigId, musicianProfile: musicianProfilePayload });
            if (!res.success) {
                if (res.code === 'permission-denied') {
                    toast.error("You don't have permission to invite artists for this venue.");
                } else if (res.code === 'failed-precondition') {
                    toast.error('This gig is missing required venue info.');
                } else {
                    toast.error('Error inviting artist. Please try again.');
                }
                return;
            }
            
            const { conversationId } = await getOrCreateConversation({
                musicianProfile: musicianProfilePayload,
                gigData: slotGig,
                venueProfile: venueToSend,
                type: 'invitation',
            });
            
            if (slotGig.kind === 'Ticketed Gig' || slotGig.kind === 'Open Mic') {
                await sendGigInvitationMessage(conversationId, {
                    senderId: user.uid,
                    text: `${venueToSend.accountName} invited ${selectedMusicianForSlotInvite.name} to play at their gig at ${slotGig.venue.venueName} on the ${formatDate(slotGig.date)}.`,
                });
            } else {
                await sendGigInvitationMessage(conversationId, {
                    senderId: user.uid,
                    text: `${venueToSend.accountName} invited ${selectedMusicianForSlotInvite.name} to play at their gig at ${slotGig.venue.venueName} on the ${formatDate(slotGig.date)} for ${slotGig.budget}.`,
                });
            }
            
            // Remove the declined application from the table if it exists
            // Only remove if the artist was declined from a slot and successfully invited to a different one
            if (declinedSlotGigId && selectedMusicianForSlotInvite?.id && declinedSlotGigId !== slotGig.gigId) {
                const declinedSlot = declinedSlotGigId === gigInfo.gigId 
                    ? gigInfo 
                    : relatedSlots.find(s => s.gigId === declinedSlotGigId);
                
                if (declinedSlot) {
                    const updatedApplicants = (declinedSlot.applicants || []).filter(
                        app => !(app.id === selectedMusicianForSlotInvite.id && app.status === 'declined')
                    );
                    
                    if (declinedSlotGigId === gigInfo.gigId) {
                        setGigInfo(prev => ({
                            ...prev,
                            applicants: updatedApplicants
                        }));
                    } else {
                        setRelatedSlots(prev => prev.map(slot => 
                            slot.gigId === declinedSlotGigId 
                                ? { ...slot, applicants: updatedApplicants }
                                : slot
                        ));
                    }
                }
            }
            
            setShowSlotInviteModal(false);
            setSelectedMusicianForSlotInvite(null);
            setDeclinedSlotGigId(null);
            toast.success(`Invite sent to ${selectedMusicianForSlotInvite.name} for Slot ${getSlotNumber(slotGig.gigId)}`);
            refreshGigs();
        } catch (error) {
            console.error('Error inviting to slot:', error);
            toast.error('Error inviting artist. Please try again.');
        } finally {
            setInvitingToSlot(false);
        }
    };

    const handleSaveSoundManager = async () => {
        if (!hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')) {
            toast.error('You do not have permission to update this gig.');
            setEditingSoundManager(false);
            setSoundManagerValue(gigInfo.soundManager || '');
            return;
        }
        setSavingSoundManager(true);
        try {
            await updateGigDocument({
                gigId: gigInfo.gigId,
                action: 'gigs.update',
                updates: { soundManager: soundManagerValue.trim() || null }
            });
            
            setEditingSoundManager(false);
            if (soundManagerTextareaRef.current) {
                soundManagerTextareaRef.current.blur();
            }
            refreshGigs();
        } catch (error) {
            console.error('Error updating sound manager:', error);
            toast.error('Failed to update sound manager. Please try again.');
            setSoundManagerValue(gigInfo.soundManager || '');
        } finally {
            setSavingSoundManager(false);
        }
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
            const nextGig = gigInfo;
            const gigId = nextGig.gigId;
            const venueProfile = await getVenueProfileById(nextGig.venueId);
            const isOpenMic = nextGig.kind === 'Open Mic';
            const isTicketed = nextGig.kind === 'Ticketed Gig';
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
          
              if (isOpenMic) {
                const bandOrMusicianProfiles = await Promise.all(
                  nextGig.applicants
                    .filter(app => app.status === 'confirmed')
                    .map(app => getProfileById(app.id))
                );
                for (const musician of bandOrMusicianProfiles.filter(Boolean)) {
                  await handleMusicianCancellation(musician);
                }
            } else {
              const confirmedApplicant = nextGig.applicants.find(app => app.status === 'confirmed');
              if (!confirmedApplicant) {
                console.error("No confirmed applicant found");
                return;
              }
              const musicianProfile = await getProfileById(confirmedApplicant.id);
              await handleMusicianCancellation(musicianProfile);
            }
            setCancellationReason({
                reason: '',
                extraDetails: '',
            })
            setModalLoading(false);
            setShowCancelConfirmationModal(false);
            navigate('/venues/dashboard/gigs');
            toast.success('Gig cancellation successful.')
        } catch (error) {
            console.error('Error canceling task:', error.message);
            setModalLoading(false);
            toast.error('Failed to cancel gig.')
        }
    };

    // Find all related slots if this is a grouped gig
    const allSlots = useMemo(() => {
        if (!gigInfo || !gigs || !Array.isArray(gigInfo.gigSlots) || gigInfo.gigSlots.length === 0) {
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
        
        // Sort by startTime
        return slots.sort((a, b) => {
            if (!a.startTime || !b.startTime) return 0;
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
        });
    }, [gigInfo, gigs]);

    // Calculate date and time display
    const dateTimeDisplay = useMemo(() => {
        if (!gigInfo || !gigInfo.date) return '';
        
        const dateObj = gigInfo.date?.toDate ? gigInfo.date.toDate() : (gigInfo.date instanceof Date ? gigInfo.date : new Date(gigInfo.date));
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
    gigInfo.applicants.some(a => a?.status === 'confirmed');

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

    return (
        <>
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
                                        setShowInvitesModal(true);
                                    }}
                                    title={!hasVenuePerm(venues, gigInfo.venueId, 'gigs.invite') ? 'You do not have permission to create invites' : 'Create invite link'}
                                >
                                    <InviteIconSolid />
                                    Invite Artist
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
                                                        openGigPostModal(gigInfo);
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
                    
                    {/* Sound Manager */}
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                        <span style={{ fontWeight: 500, flexShrink: 0 }}>Sound Manager:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                            <textarea
                                ref={soundManagerTextareaRef}
                                value={soundManagerValue}
                                onChange={(e) => setSoundManagerValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSaveSoundManager();
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.style.outline = '2px solid #000000';
                                    e.target.style.outlineOffset = '-1px';
                                    if (hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')) {
                                        setEditingSoundManager(true);
                                    } else {
                                        toast.error('You do not have permission to update this gig.');
                                    }
                                }}
                                onBlur={(e) => {
                                    e.target.style.outline = 'none';
                                    // Reset value if user clicks away without saving
                                    // Use setTimeout to allow save button click to register first
                                    setTimeout(() => {
                                        if (editingSoundManager && !savingSoundManager) {
                                            setSoundManagerValue(gigInfo.soundManager || '');
                                            setEditingSoundManager(false);
                                        }
                                    }, 50);
                                }}
                                disabled={!hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')}
                                rows={1}
                                style={{
                                    width: '25%',
                                    minWidth: '200px',
                                    padding: '0.5rem',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #e6e6e6',
                                    borderRadius: '0.5rem',
                                    resize: 'none',
                                    outline: 'none',
                                }}
                            />
                            {editingSoundManager && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                                <button
                                    className="btn primary"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSaveSoundManager();
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
            <div className='body gigs'>
                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <>
                        {showDispute && hasVenuePerm(venues, gigInfo.venueId, 'reviews.create') && (
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
                                                                {confirmedArtist.techRider && confirmedArtist.techRider.isComplete && (
                                                                    <button
                                                                        className='btn tertiary'
                                                                        onClick={() => {
                                                                            setTechRiderProfile(confirmedArtist);
                                                                            setShowTechRiderModal(true);
                                                                        }}
                                                                    >
                                                                        Tech Rider
                                                                    </button>
                                                                )}
                                                                <button
                                                                    className='btn tertiary'
                                                                    onClick={(e) => openInNewTab(`/artist/${confirmedArtist.id}`, e)}
                                                                >
                                                                    Profile
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })() : (
                                                    <button 
                                                        className='btn secondary'
                                                        style={{ marginTop: '0.5rem', width: '100%' }}
                                                        onClick={() => navigate('/venues/dashboard/artists/find')}
                                                    >
                                                        Find Artist
                                                    </button>
                                                )}
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
                                                        {confirmedArtist.techRider && confirmedArtist.techRider.isComplete && (
                                                            <button
                                                                className='btn tertiary'
                                                                onClick={() => {
                                                                    setTechRiderProfile(confirmedArtist);
                                                                    setShowTechRiderModal(true);
                                                                }}
                                                            >
                                                                Tech Rider
                                                            </button>
                                                        )}
                                                        <button
                                                            className='btn tertiary'
                                                            onClick={(e) => openInNewTab(`/artist/${confirmedArtist.id}`, e)}
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
                                    {isMdUp && (
                                        <th>Tech Rider</th>
                                    )}
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
                                    const gigAlreadyConfirmed = slotGig?.applicants?.some((a) => a.status === 'confirmed');
                                    const slotNumber = getSlotNumber(slotGigId);
                                    const isInvited = sender === 'venue' || applicant?.invited;
                                    const appliedToSlotText = relatedSlots.length > 0 && slotNumber 
                                        ? (isInvited ? `Invited to Slot ${slotNumber}` : `Applied for Slot ${slotNumber}`)
                                        : null;
                                    
                                    return (
                                        <tr key={`${profile.id}-${slotGigId}-${index}`} className='applicant' onClick={(e) => openInNewTab(`/artist/${profile.id}`, e)} onMouseEnter={() => setHoveredRowId(profile.id)}
                                        onMouseLeave={() => setHoveredRowId(null)}>
                                            <td className='musician-name'>
                                                {hoveredRowId === profile.id && (
                                                    <NewTabIcon />
                                                )}
                                                {profile.name}
                                            </td>
                                            <td>{profile?.videos && profile?.videos.length > 0 ? (
                                                <button className='btn tertiary' onClick={(e) => {e.stopPropagation(); setVideoToPlay(profile.videos[0]);}} onMouseEnter={() => setHoveredRowId(null)} onMouseLeave={() => setHoveredRowId(profile.id)}>
                                                    <PlayIcon />
                                                    Play Video
                                                </button>
                                            ) : (
                                                'No Video'
                                            )}</td>
                                            {isMdUp && (
                                                <td>
                                                    {profile?.techRider && profile.techRider.isComplete && profile.techRider.lineup && profile.techRider.lineup.length > 0 ? (
                                                        <button 
                                                            className='btn tertiary' 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setTechRiderProfile(profile);
                                                                setShowTechRiderModal(true);
                                                            }}
                                                            onMouseEnter={() => setHoveredRowId(null)} 
                                                            onMouseLeave={() => setHoveredRowId(profile.id)}
                                                        >
                                                            See Tech Rider
                                                        </button>
                                                    ) : (
                                                        <span style={{ color: 'var(--gn-grey-500)', fontSize: '0.9rem' }}>No tech rider</span>
                                                    )}
                                                </td>
                                            )}
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
                                                    ) : !gigInfo.venueHasReviewed && !gigInfo.disputeLogged && hasVenuePerm(venues, gigInfo.venueId, 'reviews.create') ? (
                                                        <div className='leave-review'>
                                                            <button className='btn primary' onClick={(e) => {e.stopPropagation(); setShowReviewModal(true); setReviewProfile(profile)}}>
                                                                Leave a Review
                                                            </button>
                                                        </div>
                                                    ) : !gigInfo.venueHasReviewed && !gigInfo.disputeLogged && !hasVenuePerm(venues, gigInfo.venueId, 'reviews.create') ? (
                                                        <div className='status-box'>
                                                            <div className='status past'>
                                                                <PermissionsIcon />
                                                                You don't have permission to review artists
                                                            </div>
                                                        </div>
                                                    ) : gigInfo.venueHasReviewed && !gigInfo.disputeLogged ? (
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
                                                    {(status === 'confirmed' || status === 'paid') && (
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
                                                    {status === 'accepted' && (slotGig.kind !== 'Open Mic' && slotGig.kind !== 'Ticketed Gig') && slotGig.budget !== '£' && slotGig.budget !== '£0' && hasVenuePerm(venues, slotGig.venueId, 'gigs.pay') && (
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
                                                        </div>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && (slotGig.budget !== '£' && slotGig.budget !== '£0') && (slotGig.kind !== 'Ticketed Gig' && slotGig.kind !== 'Open Mic') && !applicant?.invited && hasVenuePerm(venues, slotGig.venueId, 'gigs.applications.manage') && (
                                                        <button className='btn primary small' onClick={(event) => {event.stopPropagation(); sendToConversation(profile.userId)}}>
                                                            Negotiate Fee
                                                        </button>
                                                    )}
                                                    {status !== 'declined' && status !== 'withdrawn' && status !== 'confirmed' && !applicant?.invited && !gigAlreadyConfirmed && relatedSlots.length > 0 && hasVenuePerm(venues, slotGig.venueId, 'gigs.invite') && (
                                                        <button 
                                                            className='btn secondary small' 
                                                            onClick={(event) => handleDeclineAndInviteToSlot(profile.id, event, profile.proposedFee, profile.email, profile.name, slotGigId, profile)}
                                                            disabled={eventLoading}
                                                        >
                                                            Invite to a different slot
                                                        </button>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && relatedSlots.length > 0 && hasVenuePerm(venues, slotGig.venueId, 'gigs.invite') && (
                                                        <button 
                                                            className='btn secondary small' 
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setSelectedMusicianForSlotInvite(profile);
                                                                setDeclinedSlotGigId(slotGigId);
                                                                setShowSlotInviteModal(true);
                                                            }}
                                                        >
                                                            Invite to a different slot
                                                        </button>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && relatedSlots.length === 0 && (slotGig.kind === 'Ticketed Gig' || slotGig.kind === 'Open Mic') && applicant?.invited && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                Declined
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && relatedSlots.length === 0 && (slotGig.kind === 'Ticketed Gig' || slotGig.kind === 'Open Mic') && !applicant?.invited && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                Declined
                                                            </div>
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
                            <button className='btn primary' onClick={() => navigate('/venues/dashboard/artists/find')}>
                                Find Artist
                            </button>
                        </div>
                    )}
                    </>
                )}
            </div>
            {showPaymentModal && (
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
            {showReviewModal && (
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
                        <div className='modal cancel-gig' onClick={() => setShowCancelConfirmationModal(false)}>
                            <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                                <h3>Cancel Gig</h3>
                                <div className="modal-body">
                                    <div className="text">
                                        <h4>What's your reason for cancelling?</h4>
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
                                    <button className='btn tertiary' onClick={() => setShowCancelConfirmationModal(false)}>
                                        Exit
                                    </button>
                                    <button className='btn danger' onClick={handleCancelGig}>
                                        Cancel Gig
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </Portal>
            )}
            {videoToPlay && <VideoModal video={videoToPlay} onClose={closeModal} />}
            {showTechRiderModal && techRiderProfile && (
                <Portal>
                    <TechRiderModal 
                        techRider={techRiderProfile.techRider}
                        artistName={techRiderProfile.name}
                        venueTechRider={(() => {
                            if (!gigInfo?.venueId || !venues) return null;
                            const venue = venues.find(v => v.venueId === gigInfo.venueId);
                            return venue?.techRider || null;
                        })()}
                        onClose={() => {
                            setShowTechRiderModal(false);
                            setTechRiderProfile(null);
                        }}
                    />
                </Portal>
            )}
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
            {showSlotInviteModal && selectedMusicianForSlotInvite && (
                <Portal>
                    <div className="modal invite-musician" onClick={() => {
                        setShowSlotInviteModal(false);
                        setSelectedMusicianForSlotInvite(null);
                    }}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-text">
                                    <InviteIconSolid />
                                    <h2>Invite {selectedMusicianForSlotInvite.name} to a different slot.</h2>
                                </div>
                            </div>
                            <div className="gig-selection">
                                {[gigInfo, ...relatedSlots]
                                    .filter(Boolean)
                                    .filter(slot => {
                                        // Only show slots that aren't confirmed
                                        const confirmedArtistId = getConfirmedArtistForSlot(slot);
                                        if (confirmedArtistId) return false;
                                        // Exclude the slot the musician was declined from
                                        if (declinedSlotGigId && slot.gigId === declinedSlotGigId) return false;
                                        return true;
                                    })
                                    .sort((a, b) => {
                                        if (!a.startTime || !b.startTime) return 0;
                                        const [aH, aM] = a.startTime.split(':').map(Number);
                                        const [bH, bM] = b.startTime.split(':').map(Number);
                                        return (aH * 60 + aM) - (bH * 60 + bM);
                                    })
                                    .map((slotGig, index) => {
                                        const slotNumber = getSlotNumber(slotGig.gigId);
                                        const endTime = calculateEndTime(slotGig.startTime, slotGig.duration);
                                        const canInvite = hasVenuePerm(venues, slotGig.venueId, 'gigs.invite');
                                        
                                        if (canInvite) {
                                            return (
                                                <div
                                                    className="card"
                                                    key={slotGig.gigId}
                                                    onClick={() => handleInviteToSlot(slotGig)}
                                                    style={{ cursor: invitingToSlot ? 'not-allowed' : 'pointer', opacity: invitingToSlot ? 0.6 : 1 }}
                                                >
                                                    <div className="gig-details">
                                                        <h4 className="text">Slot {slotNumber}</h4>
                                                        <h5>{slotGig.venue?.venueName || venueName}</h5>
                                                    </div>
                                                    <p className="sub-text">
                                                        {formatDateUtil(slotGig.date, 'short')} - {slotGig.startTime}{endTime ? `-${endTime}` : ''}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        
                                        return (
                                            <div className="card disabled" key={slotGig.gigId}>
                                                <div className="gig-details">
                                                    <h4 className="text">Slot {slotNumber}</h4>
                                                    <h5 className="details-text">
                                                        You don't have permission to invite artists to gigs at this venue.
                                                    </h5>
                                                </div>
                                                <p className="sub-text">
                                                    {formatDateUtil(slotGig.date, 'short')} - {slotGig.startTime}{endTime ? `-${endTime}` : ''}
                                                </p>
                                            </div>
                                        );
                                    })}
                            </div>
                            <div className="two-buttons">
                                <button 
                                    className="btn tertiary" 
                                    onClick={() => {
                                        setShowSlotInviteModal(false);
                                        setSelectedMusicianForSlotInvite(null);
                                    }}
                                    disabled={invitingToSlot}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
            {showInvitesModal && gigInfo && (
                <GigInvitesModal
                    gig={gigInfo}
                    venues={venues}
                    onClose={() => {
                        setShowInvitesModal(false);
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
