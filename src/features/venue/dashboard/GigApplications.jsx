
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
import { useAuth } from '@hooks/useAuth';
import { PaymentModal } from '@features/venue/components/PaymentModal';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { getMusicianProfileByMusicianId } from '@services/client-side/musicians';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { getOrCreateConversation } from '@services/function-calls/conversations';
import { getMostRecentMessage } from '@services/client-side/messages';
import { removeGigFromVenue } from '@services/client-side/venues';
import { confirmGigPayment, fetchSavedCards } from '@services/function-calls/payments';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { openInNewTab } from '../../../services/utils/misc';
import { CloseIcon, NewTabIcon, PeopleGroupIconSolid, PlayIcon, PreviousIcon } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import { getVenueProfileById } from '../../../services/client-side/venues';
import { loadStripe } from '@stripe/stripe-js';
import { sendGigAcceptedEmail, sendGigDeclinedEmail } from '../../../services/client-side/emails';
import Portal from '../../shared/components/Portal';
import { LoadingScreen } from '../../shared/ui/loading/LoadingScreen';
import { notifyOtherApplicantsGigConfirmed } from '../../../services/function-calls/conversations';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { cancelGigAndRefund } from '@services/function-calls/tasks';
import { acceptGigOffer, acceptGigOfferOM, logGigCancellation, markApplicantsViewed } from '../../../services/function-calls/gigs';
import { postCancellationMessage } from '../../../services/function-calls/messages';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { getLocalGigDateTime } from '../../../services/utils/filtering';
import { toJsDate } from '../../../services/utils/dates';
import { handleCloseGig, handleOpenGig, declineGigApplication, revertGigAfterCancellationVenue, deleteGigAndInformation } from '../../../services/function-calls/gigs';
import { sendGigAcceptedMessage, updateDeclinedApplicationMessage } from '../../../services/function-calls/messages';
import { updateMusicianCancelledGig } from '../../../services/function-calls/musicians';
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

export const GigApplications = ({ setGigPostModal, setEditGigData, gigs, venues, refreshStripe }) => {

    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const now = useMemo(() => new Date(), []);
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
    const gigId = location.state?.gig?.gigId || '';
    const gigDate = location.state?.gig?.date || '';
    const venueName = location.state?.gig?.venue?.venueName || '';

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useResizeEffect((width) => {
        setWindowWidth(width);
      });

    useEffect(() => {
        if (!gigId || !gigs) return;
        const activeGig = gigs.find(gig => gig.gigId === gigId);
        setGigInfo(activeGig);
    }, [gigId, gigs]);

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
          await markApplicantsViewed(gigInfo.venueId, gigInfo.gigId);
          markedRef.current.add(gigInfo.gigId);
        } catch (err) {
          console.error("Error marking applicants viewed:", err);
        } finally {
          fetchProfiles();
        }
      })();
    
      async function fetchProfiles() {
        try {
          const profiles = await Promise.all(
            (gigInfo.applicants || []).map(async (app) => {
              const m = await getMusicianProfileByMusicianId(app.id);
              return m ? {
                ...m,
                id: app.id,
                status: app.status,
                proposedFee: app.fee,
                viewed: true,
              } : null;
            })
          );
          setMusicianProfiles(profiles.filter(Boolean));
          setLoading(false);
        } catch (e) {
          console.error("Error fetching musician profiles:", e);
        }
      }
    }, [gigInfo]);

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
    const handleAccept = async (musicianId, event, proposedFee, musicianEmail, musicianName) => {
        event.stopPropagation();    
        try {
            if (!gigInfo) return console.error('Gig data is missing');
            if (getLocalGigDateTime(gigInfo) < new Date()) return toast.error('Gig is in the past.');
            setEventLoading(true);
            const nonPayableGig = gigInfo.kind === 'Open Mic' || gigInfo.kind === "Ticketed Gig" || gigInfo.budget === '£' || gigInfo.budget === '£0';
            let globalAgreedFee;
            if (gigInfo.kind === 'Open Mic') {
                const { updatedApplicants } = await acceptGigOfferOM(gigInfo, musicianId);
                setGigInfo((prevGigInfo) => ({
                    ...prevGigInfo,
                    applicants: updatedApplicants,
                    paid: true,
                }));
            } else {
                const { updatedApplicants, agreedFee } = await acceptGigOffer(gigInfo, musicianId, nonPayableGig);
                setGigInfo((prevGigInfo) => ({
                    ...prevGigInfo,
                    applicants: updatedApplicants,
                    agreedFee: `${agreedFee}`,
                    paid: false,
                }));
                globalAgreedFee = agreedFee;
            }
            const musicianProfile = await getMusicianProfileByMusicianId(musicianId);
            const venueProfile = await getVenueProfileById(gigInfo.venueId);
            const conversationId = await getOrCreateConversation(musicianProfile, gigInfo, venueProfile, 'application');
            if (proposedFee === gigInfo.budget) {
                const applicationMessage = await getMostRecentMessage(conversationId, 'application');
                await sendGigAcceptedMessage(conversationId, applicationMessage.id, user.uid, gigInfo.budget, 'venue', nonPayableGig);
            } else {
                const applicationMessage = await getMostRecentMessage(conversationId, 'negotiation');
                await sendGigAcceptedMessage(conversationId, applicationMessage.id, user.uid, globalAgreedFee, 'venue', nonPayableGig);
            }
            await sendGigAcceptedEmail({
                userRole: 'venue',
                musicianProfile: musicianProfile,
                venueProfile: venueProfile,
                gigData: gigInfo,
                agreedFee: globalAgreedFee,
                isNegotiated: false,
                nonPayableGig,
            })
            if (nonPayableGig) {
                await notifyOtherApplicantsGigConfirmed(gigInfo, musicianId);
            }
        } catch (error) {
            toast.error('Error accepting gig application. Please try again.')
            console.error('Error updating gig document:', error);
        } finally {
            setEventLoading(false);
        }
    };

    const handleReject = async (musicianId, event, proposedFee, musicianEmail, musicianName) => {
        event.stopPropagation();
        try {
            if (!gigInfo) return console.error('Gig data is missing');
            if (getLocalGigDateTime(gigInfo) < new Date()) return toast.error('Gig is in the past.');
            setEventLoading(true);
            const updatedApplicants = await declineGigApplication(gigInfo, musicianId);
            setGigInfo((prevGigInfo) => ({
                ...prevGigInfo,
                applicants: updatedApplicants,
            }));
            const musicianProfile = await getMusicianProfileByMusicianId(musicianId);
            const venueProfile = await getVenueProfileById(gigInfo.venueId);
            const conversationId = await getOrCreateConversation(musicianProfile, gigInfo, venueProfile, 'application')
            if (proposedFee === gigInfo.budget) {
                const applicationMessage = await getMostRecentMessage(conversationId, 'application');
                await updateDeclinedApplicationMessage(conversationId, applicationMessage.id, user.uid, 'venue', gigInfo.budget);
            } else {
                const applicationMessage = await getMostRecentMessage(conversationId, 'negotiation');
                await updateDeclinedApplicationMessage(conversationId, applicationMessage.id, user.uid, 'venue', proposedFee);
            }
            await sendGigDeclinedEmail({
                userRole: 'venue',
                venueProfile: venueProfile,
                musicianProfile: musicianProfile,
                gigData: gigInfo,
            })
        } catch (error) {
            toast.error('Error rejecting gig application. Please try again.')
            console.error('Error updating gig document:', error);
        } finally {
            setEventLoading(false);
        }
    };

    const sendToConversation = async (userId) => {
        const conversations = await getConversationsByParticipantAndGigId(gigInfo.gigId, userId)
        const conversationId = conversations[0].id;
        navigate(`/venues/dashboard/messages?conversationId=${conversationId}`);
    }

    const handleCompletePayment = async (profileId) => {
        if (getLocalGigDateTime(gigInfo) < new Date()) return toast.error('Gig is in the past.');
        setLoadingPaymentDetails(true);
        try {
            const cards = await fetchSavedCards();
            setSavedCards(cards);
            setShowPaymentModal(true);
            setMusicianProfileId(profileId);
        } catch (error) {
            toast.info("We couldn't access your saved cards. Sorry for any inconvenience.")
            console.error('Error fetching saved cards:', error);
        } finally {
            setLoadingPaymentDetails(false);
        }
    };

    const handleSelectCard = async (cardId) => {
        setMakingPayment(true);
        try {
            const customerId = (savedCards.find(c => c.id === cardId) || {}).customer || null;
            const result = await confirmGigPayment({ cardId, gigData: gigInfo, musicianProfileId, customerId });
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
        const startDT = toJsDate(gig.startDateTime) ?? toJsDate(gig.date);
        const dateOnly = startDT
            ? new Date(startDT.getFullYear(), startDT.getMonth(), startDT.getDate())
            : null;

        const convertedGig = {
            ...gig,
            date: dateOnly,
        };
        setEditGigData(convertedGig);
        setGigPostModal(true);
    }

    const handleDeleteGig = async () => {
        try {
            setModalLoading(true);
            await deleteGigAndInformation(gigId);
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
            await handleCloseGig(gigId);
            navigate('/venues/dashboard/gigs');
            toast.success(`Gig Closed`);
        } catch (error) {
            console.error('Error closing gig:', error);
            toast.error('Failed to update gig status.');
        }
    }

    const handleReopenGig = async () => {
        try {
            await handleOpenGig(gigId);
            navigate('/venues/dashboard/gigs');
            toast.success(`Gig Opened`);
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
                });
            }
            const handleMusicianCancellation = async (musician) => {
                const conversationId = await getOrCreateConversation(musician, nextGig, venueProfile, 'cancellation');
                await postCancellationMessage(
                  conversationId,
                  user.uid,
                  `${nextGig.venue.venueName} has unfortunately had to cancel because ${formatCancellationReason(
                    cancellationReason
                  )}. We apologise for any inconvenience caused.`,
                  'venue'
                );
                await revertGigAfterCancellationVenue(nextGig, musician.musicianId, cancellationReason);
                await updateMusicianCancelledGig(musician.musicianId, gigId);
                const cancellingParty = 'venue';
                await logGigCancellation(gigId, musician.musicianId, cancellationReason, cancellingParty, venueProfile.venueId);
              };
          
              if (isOpenMic) {
                const bandOrMusicianProfiles = await Promise.all(
                  nextGig.applicants
                    .filter(app => app.status === 'confirmed')
                    .map(app => getMusicianProfileByMusicianId(app.id))
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
              const musicianProfile = await getMusicianProfileByMusicianId(confirmedApplicant.id);
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

    if (loading || !gigInfo) {
        return <LoadingScreen />;
    }

    return (
        <>
            <div className='head gig-applications'>
                <div>
                    <h1 className='title' style={{ fontWeight: 500 }}>
                        Applications for "{gigInfo.gigName}"
                    </h1>
                    <h3>{gigInfo.startTime} {formatDate(gigInfo.date)} at {venueName}</h3>
                    <button className="btn text" style={{ marginTop: 5 }} onClick={(e) => openInNewTab(`/gig/${gigInfo.gigId}?venueViewing=true`, e)}>Visit Gig Page <NewTabIcon /></button>
                </div>
                {getLocalGigDateTime(gigInfo) > now && (
                    <div className='action-buttons'>
                        {!Array.isArray(gigInfo?.applicants) || !gigInfo.applicants.some(applicant => 
                            ['accepted', 'confirmed', 'paid'].includes(applicant.status)
                        ) && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                            <button className='btn tertiary' onClick={() => openGigPostModal(gigInfo)}>
                                Edit Gig Details
                            </button>
                        )}
                        {!Array.isArray(gigInfo?.applicants) || !gigInfo.applicants.some(applicant => 
                            ['accepted', 'confirmed', 'paid'].includes(applicant.status)
                        ) && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') ? (
                            <>
                                {gigInfo.status === 'closed' ? (
                                    <button className="btn tertiary" onClick={handleReopenGig}>
                                        Open To Applications
                                    </button>
                                ) : (
                                    <button className="btn tertiary" onClick={handleCloseGigLocal}>
                                        Close From Applications
                                    </button>
                                )}
                                <button className='btn danger' onClick={() => setShowDeleteConfirmationModal(true)}>
                                    Delete Gig
                                </button>
                            </>
                        ) : hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                            <>
                                <button className='btn danger' onClick={() => setShowCancelConfirmationModal(true)}>
                                    Cancel Gig
                                </button>
                                <button className='primary btn' onClick={() => setShowPromoteModal(true)}>
                                    <PeopleGroupIconSolid /> Promote Gig
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
            <div className='body gigs'>
                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <>
                    {gigInfo?.disputeClearingTime?.toDate() > getLocalGigDateTime(gigInfo) && Array.isArray(gigInfo?.applicants) && gigInfo?.applicants.some(applicant => applicant.status === 'confirmed' && !gigInfo.disputeLogged) && (
                        <div className='dispute-box'>
                            <h3>Not happy with how the gig went?</h3>
                            <h4>You have until {formatDisputeDate(gigInfo.disputeClearingTime)} to file an issue.</h4>
                            <button className='btn danger' onClick={() => {setShowReviewModal(true)}}>
                                Dispute Gig
                            </button>
                        </div>
                    )}
                        {musicianProfiles.length > 0 ? (
                        <table className='applications-table'>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    {windowWidth > 880 && (
                                        <th>Genre(s)</th>
                                    )}
                                    <th>Video</th>
                                    <th>Fee</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {musicianProfiles.map((profile, index) => {
                                    const applicant = gigInfo?.applicants?.find(applicant => applicant.id === profile.id);
                                    const sender = applicant ? applicant.sentBy : 'musician';
                                    const status = applicant ? applicant.status : 'pending';
                                    const gigAlreadyConfirmed = gigInfo?.applicants?.some((a) => a.status === 'confirmed');
                                    return (
                                        <tr key={index} className='applicant' onClick={(e) => openInNewTab(`/${profile.id}/${gigInfo.gigId}`, e)} onMouseEnter={() => setHoveredRowId(profile.id)}
                                        onMouseLeave={() => setHoveredRowId(null)}>
                                            <td className='musician-name'>
                                                {hoveredRowId === profile.id && (
                                                    <NewTabIcon />
                                                )}
                                                {profile.name}
                                            </td>
                                            {windowWidth > 880 && (
                                                <td className='genres'>
                                                    {profile?.genres ? (
                                                        <>
                                                            {profile.genres
                                                                .filter(genre => !genre.includes(' '))
                                                                .map((genre, index) => (
                                                                    <span key={index} className='genre-tag'>{genre}</span>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        'N/A'
                                                    )}
                                                </td>
                                            )}
                                            <td>{profile?.videos && profile?.videos.length > 0 ? (
                                                <button className='btn small tertiary' onClick={(e) => {e.stopPropagation(); setVideoToPlay(profile.videos[0]);}} onMouseEnter={() => setHoveredRowId(null)} onMouseLeave={() => setHoveredRowId(profile.id)}>
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
                                                    ) : !gigInfo.venueHasReviewed && !gigInfo.disputeLogged ? (
                                                        <div className='leave-review'>
                                                            <button className='btn primary' onClick={(e) => {e.stopPropagation(); setShowReviewModal(true); setReviewProfile(profile)}}>
                                                                Leave a Review
                                                            </button>
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
                                                                Reported
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            ) : (
                                                <td className='status-container' style={{
                                                    textAlign: 'center',
                                                    minWidth: '140px',
                                                    width: '100%',
                                                    whiteSpace: 'nowrap',
                                                    minHeight: '50px',
                                                  }}>
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
                                                    {status === 'accepted' && (gigInfo.kind !== 'Open Mic' && gigInfo.kind !== 'Ticketed Gig') && gigInfo.budget !== '£' && gigInfo.budget !== '£0' && (
                                                        loadingPaymentDetails || showPaymentModal || status === 'payment processing' ? (
                                                            <LoadingSpinner />
                                                        ) : (
                                                            <button className='btn primary' onClick={(event) => {event.stopPropagation(); handleCompletePayment(profile.id)}}>
                                                                Complete Payment
                                                            </button>
                                                        )
                                                    )}
                                                    {(status === 'pending' && getLocalGigDateTime(gigInfo) > now) && !applicant?.invited && !gigAlreadyConfirmed && sender !== 'venue' && (
                                                        <>
                                                            {eventLoading ? (
                                                                <LoadingSpinner width={15} height={15} />
                                                            ) : (
                                                                <>
                                                                    <button className='btn accept small' onClick={(event) => handleAccept(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                                        <TickIcon />
                                                                        Accept
                                                                    </button>
                                                                    <button className='btn decline small' onClick={(event) => handleReject(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                                        <ErrorIcon />
                                                                        Decline
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                    {(status === 'pending' && getLocalGigDateTime(gigInfo) > now) && !applicant?.invited && gigInfo.kind === 'Open Mic' && gigAlreadyConfirmed && sender !== 'venue' && (
                                                        <>
                                                            {eventLoading ? (
                                                                <LoadingSpinner width={15} height={15} />
                                                            ) : (
                                                                <>
                                                                    <button className='btn accept small' onClick={(event) => handleAccept(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                                        <TickIcon />
                                                                        Accept
                                                                    </button>
                                                                    <button className='btn decline small' onClick={(event) => handleReject(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                                        <ErrorIcon />
                                                                        Decline
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                    {(status === 'pending' && getLocalGigDateTime(gigInfo) > now) && applicant?.invited && !gigAlreadyConfirmed && (
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
                                                    {status === 'pending' && gigAlreadyConfirmed && gigInfo.kind !== 'Open Mic' && (
                                                        <div className='status-box'>
                                                            <div className='status declined'>
                                                                <ErrorIcon />
                                                                Declined
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && (gigInfo.kind !== 'Ticketed Gig' && gigInfo.kind !== 'Open Mic') && !applicant?.invited && (
                                                        <button className='btn primary' onClick={(event) => {event.stopPropagation(); sendToConversation(profile.userId)}}>
                                                            Negotiate Fee
                                                        </button>
                                                    )}
                                                    {status === 'declined' && !gigAlreadyConfirmed && (gigInfo.kind === 'Ticketed Gig' || gigInfo.kind === 'Open Mic') && applicant?.invited && (
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
                    ) : hasVenuePerm(venues, gigInfo.venueId, 'gigs.invite') && (
                        <div className='no-applications'>
                            <h4>No musicians have applied to this gig yet.</h4>
                            <button className='btn primary' onClick={() => navigate('/venues/dashboard/musicians/find')}>
                                Invite a Musician to Apply
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
                        onClose={() => {setShowPaymentModal(false); setPaymentSuccess(false), setMusicianProfileId(null); setWatchPaymentIntentId(null)}}
                        gigData={gigInfo}
                        setMakingPayment={setMakingPayment}
                        makingPayment={makingPayment}
                        setPaymentSuccess={setPaymentSuccess}
                        paymentSuccess={paymentSuccess}
                        setSavedCards={setSavedCards}
                        paymentIntentId={watchPaymentIntentId}
                        setGigData={setGigInfo}
                        musicianProfileId={musicianProfileId}
                    />
                </Portal>
            )}
            {showReviewModal && (
                <Portal>
                    <ReviewModal
                        gigData={gigInfo}
                        setGigData={setGigInfo}
                        reviewer='venue'
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
        </>
    );
};
