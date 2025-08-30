
import { useState, useEffect, useMemo } from 'react';
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
import { declineGigApplication, deleteGig, updateGigApplicants } from '@services/gigs';
import { getMusicianProfileByMusicianId, removeGigFromMusician } from '@services/musicians';
import { deleteConversationsByGigId, getConversationsByParticipantAndGigId, getOrCreateConversation } from '@services/conversations';
import { sendGigAcceptedMessage, updateDeclinedApplicationMessage, getMostRecentMessage } from '@services/messages';
import { removeGigFromVenue } from '@services/venues';
import { confirmGigPayment, fetchSavedCards } from '@services/functions';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { openInNewTab } from '../../../services/utils/misc';
import { acceptGigOffer, updateGigDocument } from '../../../services/gigs';
import { CloseIcon, NewTabIcon, PeopleGroupIconSolid, PlayIcon, PreviousIcon } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import { getVenueProfileById } from '../../../services/venues';
import { loadStripe } from '@stripe/stripe-js';
import { sendGigAcceptedEmail, sendGigDeclinedEmail } from '../../../services/emails';
import Portal from '../../shared/components/Portal';
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

export const GigApplications = ({ setGigPostModal, setEditGigData, gigs }) => {

    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const now = useMemo(() => new Date(), []);
    const [videoToPlay, setVideoToPlay] = useState(null);
    const [gigInfo, setGigInfo] = useState(null);
    const [musicianProfiles, setMusicianProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
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
    const [showCloseGigModal, setShowCloseGigModal] = useState(false);
    const [watchPaymentIntentId, setWatchPaymentIntentId] = useState(null);
    const [hoveredRowId, setHoveredRowId] = useState(null);
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

    const getLocalGigDateTime = (gig) => {
        const dateObj = gig.date.toDate();
        const [hours, minutes] = gig.startTime.split(':').map(Number);
        dateObj.setHours(hours);
        dateObj.setMinutes(minutes);
        dateObj.setSeconds(0);
        dateObj.setMilliseconds(0);
        return dateObj;
      };

    useEffect(() => {
        if (!gigInfo) return;
        const updateApplicantsViewed = async () => {
            try {
                const updatedApplicants = gigInfo.applicants.map(applicant => ({
                    ...applicant,
                    viewed: true
                }));
                await updateGigApplicants(gigInfo.gigId, updatedApplicants)
            } catch (error) {
                console.error("Error updating applicants 'viewed' field:", error);
            }
        };
        const fetchMusicianProfiles = async () => {
            const profiles = await Promise.all(gigInfo.applicants.map(async (applicant) => {
                const musicianData = await getMusicianProfileByMusicianId(applicant.id)
                return { 
                    ...musicianData, 
                    id: applicant.id, 
                    status: applicant.status, 
                    proposedFee: applicant.fee,
                    viewed: true,
                };
            }));
            
            setMusicianProfiles(profiles.filter(profile => profile !== null));
            setLoading(false);
        };
        updateApplicantsViewed();
        fetchMusicianProfiles();
    }, [gigInfo]);

    const formatDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        const getOrdinalSuffix = (day) => {
            if (day > 3 && day < 21) return 'th';
            switch (day % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        };
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    if (loading) {
        return <LoadingThreeDots />;
    }

    const handleAccept = async (musicianId, event, proposedFee, musicianEmail, musicianName) => {
        event.stopPropagation();    
        try {
            if (!gigInfo) return console.error('Gig data is missing');
            if (getLocalGigDateTime(gigInfo) < new Date()) return console.error('Gig is in the past.');
            const nonPayableGig = gigInfo.kind === 'Open Mic' || gigInfo.kind === "Ticketed Gig";
            const { updatedApplicants, agreedFee } = await acceptGigOffer(gigInfo, musicianId, nonPayableGig);
            setGigInfo((prevGigInfo) => ({
                ...prevGigInfo,
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            }));
            const musicianProfile = await getMusicianProfileByMusicianId(musicianId);
            const venueProfile = await getVenueProfileById(gigInfo.venueId);
            const conversationId = await getOrCreateConversation(musicianProfile, gigInfo, venueProfile, 'application');
            if (proposedFee === gigInfo.budget) {
                const applicationMessage = await getMostRecentMessage(conversationId, 'application');
                console.log(applicationMessage)
                await sendGigAcceptedMessage(conversationId, applicationMessage.id, user.uid, gigInfo.budget, 'venue', nonPayableGig);
            } else {
                const applicationMessage = await getMostRecentMessage(conversationId, 'negotiation');
                await sendGigAcceptedMessage(conversationId, applicationMessage.id, user.uid, agreedFee, 'venue', nonPayableGig);
            }
            await sendGigAcceptedEmail({
                userRole: 'venue',
                musicianProfile: musicianProfile,
                venueProfile: venueProfile,
                gigData: gigInfo,
                agreedFee: agreedFee,
                isNegotiated: false,
                nonPayableGig,
            })
            toast.success('Application Accepted.')
        } catch (error) {
            toast.error('Error accepting gig application. Please try again.')
            console.error('Error updating gig document:', error);
        }
    };

    const handleReject = async (musicianId, event, proposedFee, musicianEmail, musicianName) => {
        event.stopPropagation();
        try {
            if (!gigInfo) return console.error('Gig data is missing');
            if (getLocalGigDateTime(gigInfo) < new Date()) return console.error('Gig is in the past.');
            const { updatedApplicants } = await declineGigApplication(gigInfo, musicianId);
            setGigInfo((prevGigInfo) => ({
                ...prevGigInfo,
                applicants: updatedApplicants,
            }));
            const musicianProfile = await getMusicianProfileByMusicianId(musicianId);
            const venueProfile = await getVenueProfileById(gigInfo.venueId);
            const conversationId = await getOrCreateConversation(musicianProfile, gigInfo, venueProfile, 'application')
            if (proposedFee === gigInfo.budget) {
                const applicationMessage = await getMostRecentMessage(conversationId, 'application');
                await updateDeclinedApplicationMessage(conversationId, applicationMessage.id, user.uid, gigInfo.budget, 'venue');
            } else {
                const applicationMessage = await getMostRecentMessage(conversationId, 'negotiation');
                await updateDeclinedApplicationMessage(conversationId, applicationMessage.id, user.uid, proposedFee, 'venue');
            }
            await sendGigDeclinedEmail({
                userRole: 'venue',
                venueProfile: venueProfile,
                musicianProfile: musicianProfile,
                gigData: gigInfo,
            })
            toast.info('Application Rejected.')
        } catch (error) {
            toast.error('Error rejecting gig application. Please try again.')
            console.error('Error updating gig document:', error);
        }
    };

    const sendToConversation = async (profileId) => {
        const conversations = await getConversationsByParticipantAndGigId(gigInfo.gigId, profileId)
        const conversationId = conversations[0].id;
        navigate(`/messages?conversationId=${conversationId}`);
    }

    const handleCompletePayment = async (profileId) => {
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
            const result = await confirmGigPayment({ cardId, gigData: gigInfo, musicianProfileId });
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
                return;
            } else {
                setPaymentSuccess(false);
                toast.error(result.error || 'Payment failed. Please try again.');
            }
        } catch (error) {
            console.error('Error completing payment:', error);
            setMusicianProfileId(null);
            setPaymentSuccess(false);
            toast.error('An error occurred while processing the payment. Please try again.');
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
        const convertedGig = {
            ...gig,
            date: gig.date ? gig.date.toDate() : null,
        };
        setEditGigData(convertedGig);
        setGigPostModal(true);
    }

    const handleDeleteGig = async () => {
        try {
            const { gigId, applicants, venueId } = gigInfo;
            await deleteGig(gigId);
            await Promise.all(applicants.map(applicant => 
                removeGigFromMusician(applicant.id, gigId)
            ));
            await removeGigFromVenue(venueId, gigId);
            await deleteConversationsByGigId(gigId);
            navigate('/venues/dashboard/gigs');
            toast.success('Gig Deleted');
        } catch (error) {
            console.error('Error deleting gig:', error);
            toast.error('Failed to delete gig. Please try again.');
        }
    };

    const handleCloseGig = async () => {
        try {
            await updateGigDocument(gigId, {
                status: 'closed',
            });
            navigate('/venues/dashboard/gigs');
            toast.success(`Gig Closed`);
        } catch (error) {
            console.error('Error closing gig:', error);
            toast.error('Failed to update gig status.');
        }
    }

    const handleReopenGig = async () => {
        try {
            await updateGigDocument(gigId, {
                status: 'open',
            });
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

    return (
        <>
            <div className='head gig-applications'>
                <div>
                    <h1 className='title' style={{ fontWeight: 500 }}>
                        Applications for "{gigInfo.gigName}"
                    </h1>
                    <h3>{gigInfo.startTime} {formatDate(gigInfo.date)} at {venueName}</h3>
                    <button className="btn text" style={{ marginTop: 5 }} onClick={(e) => openInNewTab(`/gig/${gigInfo.gigId}?venue=true`, e)}>Visit Gig Page <NewTabIcon /></button>
                </div>
                {getLocalGigDateTime(gigInfo) > now && (
                    <div className='action-buttons'>
                        {!Array.isArray(gigInfo?.applicants) || !gigInfo.applicants.some(applicant => 
                            ['accepted', 'confirmed', 'paid'].includes(applicant.status)
                        ) && (
                            <button className='btn tertiary' onClick={() => openGigPostModal(gigInfo)}>
                                Edit Gig Details
                            </button>
                        )}
                        {!Array.isArray(gigInfo?.applicants) || !gigInfo.applicants.some(applicant => 
                            ['accepted', 'confirmed', 'paid'].includes(applicant.status)
                        ) ? (
                            <>
                                {gigInfo.status === 'closed' ? (
                                <button className="btn tertiary" onClick={handleReopenGig}>
                                    Open To Applications
                                </button>

                                ) : (
                                <button className="btn tertiary" onClick={handleCloseGig}>
                                    Close From Applications
                                </button>

                                )}
                                <button className='btn danger' onClick={() => setShowDeleteConfirmationModal(true)}>
                                    Delete Gig
                                </button>
                            </>
                        ) : (
                            <button className='primary btn' onClick={() => setShowPromoteModal(true)}>
                                <PeopleGroupIconSolid /> Promote Gig
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className='body gigs'>
                {loading ? (
                    <LoadingThreeDots />
                ) : (
                    <>
                    {new Date(gigInfo.disputeClearingTime) > getLocalGigDateTime(gigInfo) &&
                        Array.isArray(gigInfo?.applicants) && gigInfo?.applicants.some(applicant => applicant.status === 'confirmed' &&
                        !gigInfo.disputeLogged) && (
                        <div className='dispute-box'>
                            <h3>Not happy with how the gig went?</h3>
                            <h4>You have until {formatDisputeDate(gigInfo.disputeClearingTime)} to file an issue.</h4>
                            <button className='btn primary-alt' onClick={() => {setShowReviewModal(true)}}>
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
                                {musicianProfiles.map((profile) => {
                                    const applicant = gigInfo?.applicants?.find(applicant => applicant.id === profile.id);
                                    const status = applicant ? applicant.status : 'pending';
                                    return (
                                        <tr key={profile.id} className='applicant' onClick={(e) => openInNewTab(`/${profile.id}/${gigInfo.gigId}`, e)} onMouseEnter={() => setHoveredRowId(profile.id)}
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
                                                    '-'
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
                                                    whiteSpace: 'nowrap'
                                                  }}>
                                                    {(status === 'confirmed' || status === 'paid') && (
                                                        <div className='status-box'>
                                                            <div className='status confirmed'>
                                                                <TickIcon />
                                                                Confirmed
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'negotiating' && (
                                                        <div className='status-box'>
                                                            <div className='status upcoming'>
                                                                <ClockIcon />
                                                                Negotiating
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'accepted' && (gigInfo.kind !== 'Open Mic' && gigInfo.kind !== 'Ticketed Gig') && (
                                                        loadingPaymentDetails || showPaymentModal || status === 'payment processing' ? (
                                                            <LoadingThreeDots />
                                                        ) : (
                                                            <button className='btn primary' onClick={(event) => {event.stopPropagation(); handleCompletePayment(profile.id)}}>
                                                                Complete Payment
                                                            </button>
                                                        )
                                                    )}
                                                    {(status === 'pending' && getLocalGigDateTime(gigInfo) > now) && !applicant.invited && (
                                                        <>
                                                            <button className='btn accept small' onClick={(event) => handleAccept(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                                <TickIcon />
                                                                Accept
                                                            </button>
                                                            <button className='btn decline small' onClick={(event) => handleReject(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                                <CloseIcon />
                                                                Decline
                                                            </button>
                                                        </>
                                                    )}
                                                    {(status === 'pending' && getLocalGigDateTime(gigInfo) > now) && applicant.invited && (
                                                        <div className='status-box'>
                                                            <div className='status upcoming'>
                                                                <ClockIcon />
                                                                Musician Invited
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status === 'declined' && (
                                                        <button className='btn primary' onClick={(event) => {event.stopPropagation(); sendToConversation(profile.id)}}>
                                                            Negotiate Fee
                                                        </button>
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
                            <h4>You have closed this gig.</h4>
                            <button className='btn primary' onClick={handleReopenGig}>
                                Reopen Gig to Applications
                            </button>
                        </div>
                    ) : (
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
                    <div className='modal' onClick={() => setShowDeleteConfirmationModal(false)}>
                        <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                            <h3>Are you sure you want to delete this gig?</h3>
                            <div className='two-buttons'>
                                <button className='btn danger' onClick={handleDeleteGig}>
                                    Delete Gig
                                </button>
                                <button className='btn secondary' onClick={() => setShowDeleteConfirmationModal(false)}>
                                    Cancel
                                </button>
                            </div>
                            <button className='btn tertiary close' onClick={() => setShowDeleteConfirmationModal(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </Portal>
            )}
            {videoToPlay && <VideoModal video={videoToPlay} onClose={closeModal} />}
        </>
    );
};
