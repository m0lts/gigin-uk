
import { useState, useEffect } from 'react';
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
import { useGigs } from '@context/GigsContext';
import { PaymentModal } from '@features/venue/components/PaymentModal';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { declineGigApplication, deleteGig, updateGigApplicants } from '@services/gigs';
import { getMusicianProfileByMusicianId, removeGigFromMusician } from '@services/musicians';
import { deleteConversationsByGigId, getConversationsByParticipantAndGigId, getOrCreateConversation } from '@services/conversations';
import { sendGigAcceptedMessage, updateDeclinedApplicationMessage } from '@services/messages';
import { sendEmail } from '@services/emails';
import { removeGigFromVenue } from '@services/venues';
import { confirmGigPayment, fetchSavedCards } from '@services/functions';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { openInNewTab } from '../../../services/utils/misc';
import { updateGigDocument } from '../../../services/gigs';

export const GigApplications = ({ setGigPostModal, setEditGigData }) => {

    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { gigs } = useGigs();

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
            if (gigInfo.date.toDate() < new Date()) return console.error('Gig is in the past.');
            const { updatedApplicants, agreedFee } = await acceptGigOffer(gigInfo, musicianId);
            setGigInfo((prevGigInfo) => ({
                ...prevGigInfo,
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            }));
            const musicianProfile = await getMusicianProfileByMusicianId(musicianId);
            const venueProfile = await getVenueProfileById(gigInfo.venueId);
            const conversationId = await getOrCreateConversation(musicianProfile, gigInfo, venueProfile, 'application')
            if (proposedFee === gigInfo.budget) {
                const applicationMessage = await getMostRecentMessage(conversationId, 'application');
                await sendGigAcceptedMessage(conversationId, applicationMessage.id, user.uid, gigInfo.budget, 'venue');
            } else {
                const applicationMessage = await getMostRecentMessage(conversationId, 'negotiation');
                await sendGigAcceptedMessage(conversationId, applicationMessage.id, user.uid, agreedFee, 'venue');
            }
            await sendEmail({
                musicianEmail,
                subject: `Your Gig Application Has Been Accepted!`,
                text: `Congratulations! Your application for the gig at ${gigInfo.venue.venueName} on ${formatDate(gigInfo.date)} has been accepted.`,
                html: `
                    <p>Hi ${musicianName},</p>
                    <p>We're excited to inform you that your application for the following gig has been accepted:</p>
                    <ul>
                        <li><strong>Gig:</strong> ${gigInfo.venue.venueName}</li>
                        <li><strong>Date:</strong> ${formatDate(gigInfo.date)}</li>
                        <li><strong>Fee:</strong> ${agreedFee}</li>
                    </ul>
                    <p>The gig isn't confirmed until the venue pays the gig fee.</p>
                    <p>Please visit your <a href='${window.location.origin}/dashboard'>dashboard</a> to see the status of the gig.</p>
                    <p>Thanks,<br />The Gigin Team</p>
                `,
            })
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleReject = async (musicianId, event, proposedFee, musicianEmail, musicianName) => {
        event.stopPropagation();
        try {
            if (!gigInfo) return console.error('Gig data is missing');
            if (gigInfo.date.toDate() < new Date()) return console.error('Gig is in the past.');
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
                await updateDeclinedApplicationMessage(conversationId, applicationMessage.id, user.uid, agreedFee, 'venue');
            }
            await sendEmail({
                to: musicianEmail,
                subject: `Your Gig Application Has Been Declined`,
                text: `Your application for the gig at ${gigInfo.venue.venueName} on ${formatDate(gigInfo.date)} has been declined.`,
                html: `
                    <p>Hi ${musicianName},</p>
                    <p>Unfortunately your application for the following gig has been declined:</p>
                    <ul>
                        <li><strong>Gig:</strong> ${gigInfo.venue.venueName}</li>
                        <li><strong>Date:</strong> ${formatDate(gigInfo.date)}</li>
                    </ul>
                    <p>Please visit your <a href='${window.location.origin}/dashboard'>dashboard</a> to find another gig or negotiate the fee.</p>
                    <p>Thanks,<br />The Gigin Team</p>
                `,
            });
        } catch (error) {
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
            console.error('Error fetching saved cards:', error);
        } finally {
            setLoadingPaymentDetails(false);
        }
    };

    const handleSelectCard = async (cardId) => {
        setMakingPayment(true);
        try {
            const result = await confirmGigPayment({ cardId, gigData: gigInfo });
            if (result.success) {
                setPaymentSuccess(true);
                setGigInfo(prev => ({ ...prev, status: 'payment processing' }));
            } else {
                setPaymentSuccess(false);
                alert(result.error || 'Payment failed. Please try again.');
            }
        } catch (error) {
            console.error('Error completing payment:', error);
            setMusicianProfileId(null);
            setPaymentSuccess(false);
            alert('An error occurred while processing the payment.');
        } finally {
            setMakingPayment(false);
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
            navigate('/venues/dashboard');
            window.location.reload();
        } catch (error) {
            console.error('Error deleting gig:', error);
        }
    };

    const handleCloseGig = async () => {
        try {
            await updateGigDocument(gigId, {
                status: 'closed',
            });
            navigate('/venues/dashboard/gigs');
        } catch (error) {
            console.error('Error closing gig:', error);
        }
    }

    const handleReopenGig = async () => {
        try {
            await updateGigDocument(gigId, {
                status: 'open',
            });
            navigate('/venues/dashboard/gigs');
        } catch (error) {
            console.error('Error closing gig:', error);
        }
    }

    return (
        <>
            <div className='head'>
                <h1 className='title' style={{ fontWeight: 500 }}>
                    Applications for {formatDate(gigInfo.date)} at {venueName}
                    {gigInfo.status === 'open' && !gigInfo?.applicants.some(applicant => applicant.status === 'accepted' || applicant.status === 'confirmed') && (
                        <button className='btn icon' onClick={() => openGigPostModal(gigInfo)}>
                        <EditIcon />
                    </button>
                    )}
                </h1>
                {gigInfo.status === 'open' && !gigInfo.applicants.some(applicant => applicant.status === 'accepted' || applicant.status === 'confirmed') ? (
                    <>
                        <button className="btn secondary" onClick={() => setShowCloseGigModal(true)}>
                            Close Gig
                        </button>
                        <button className='btn danger' onClick={() => setShowDeleteConfirmationModal(true)}>
                            Delete Gig
                        </button>
                    </>
                ) : new Date < new Date(gigInfo.date.toDate().setHours(...gigInfo.startTime.split(':').map(Number))) && (
                    <button className='primary-alt btn' onClick={() => setShowPromoteModal(true)}>
                        <PeopleGroupIcon /> Promote
                    </button>
                )}
            </div>
            <div className='body gigs'>
                {loading ? (
                    <LoadingThreeDots />
                ) : (
                    <>
                    {new Date(gigInfo.disputeClearingTime) > new Date(gigInfo.date.toDate().setHours(...gigInfo.startTime.split(':').map(Number))) &&
                        gigInfo.applicants.some(applicant => applicant.status === 'confirmed' &&
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
                                    {windowWidth > 1268 && (
                                        <th>Reviews</th>
                                    )}
                                    <th>Fee</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {musicianProfiles.map((profile) => {
                                    const applicant = gigInfo.applicants.find(applicant => applicant.id === profile.id);
                                    const status = applicant ? applicant.status : 'pending';
                                    return (
                                        <tr key={profile.id} className='applicant'>
                                            <td>
                                                {profile.name}
                                            </td>
                                            {windowWidth > 880 && (
                                                <td className='genres'>
                                                    {profile.genres
                                                        .filter(genre => !genre.includes(' '))
                                                        .map((genre, index) => (
                                                            <span key={index} className='genre-tag'>{genre}</span>
                                                        ))}
                                                </td>
                                            )}
                                            {windowWidth > 1268 && (
                                                <td>{profile.reviews && profile.reviews.length > 0 ? (
                                                    <>
                                                        <StarIcon /> 
                                                        {profile.avgReviews.avgRating}
                                                        ({profile.avgReviews.totalReviews})
                                                    </>
                                                ) : (
                                                    'No Reviews'
                                                )}</td>
                                            )}
                                            <td>
                                                {profile.proposedFee !== gigInfo.budget ? (
                                                    <>
                                                        <span style={{ textDecoration: 'line-through', marginRight: '5px' }}>{gigInfo.budget}</span>
                                                        <span>{profile.proposedFee}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        {profile.proposedFee}
                                                    </>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {(status === 'confirmed' || status === 'paid') && (
                                                    new Date() < new Date(gigInfo.date.toDate().setHours(...gigInfo.startTime.split(':').map(Number))) ? (
                                                        <div className='status-box'>
                                                            <div className='status confirmed'>
                                                                <TickIcon />
                                                                Confirmed
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
                                                    )
                                                )}
                                                {status === 'negotiating' && (
                                                    <div className='status-box'>
                                                        <div className='status upcoming'>
                                                            <ClockIcon />
                                                            Negotiating
                                                        </div>
                                                    </div>
                                                )}
                                                {status === 'accepted' && (
                                                    loadingPaymentDetails || showPaymentModal || status === 'payment processing' ? (
                                                        <LoadingThreeDots />
                                                    ) : (
                                                        <button className='btn primary' onClick={(event) => {event.stopPropagation(); handleCompletePayment(profile.id)}}>
                                                            Complete Payment
                                                        </button>
                                                    )
                                                )}
                                                {status === 'pending' && (
                                                    <>
                                                        <button className='btn accept small' onClick={(event) => handleAccept(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                            Accept
                                                        </button>
                                                        <button className='btn decline small' onClick={(event) => handleReject(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                            Decline
                                                        </button>
                                                    </>
                                                )}
                                                {status === 'declined' && (
                                                    <button className='btn primary' onClick={(event) => {event.stopPropagation(); sendToConversation(profile.id)}}>
                                                        Negotiate Fee
                                                    </button>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    className='btn text'
                                                    onClick={(e) => openInNewTab(`/${profile.id}/${gigInfo.gigId}`, e)}
                                                >
                                                    View Musician
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : gigInfo.status === 'closed' ? (
                        <div className='no-applications'>
                            <FaceMehIcon />
                            <h4>You have closed this gig.</h4>
                            <button className='btn primary' onClick={handleReopenGig}>
                                Reopen Gig to Applications
                            </button>
                        </div>
                    ) : (
                        <div className='no-applications'>
                            <FaceMehIcon />
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
                <PaymentModal 
                    savedCards={savedCards}
                    onSelectCard={handleSelectCard}
                    onClose={() => {setShowPaymentModal(false); setPaymentSuccess(false), setMusicianProfileId(null)}}
                    gigData={gigInfo}
                    setMakingPayment={setMakingPayment}
                    makingPayment={makingPayment}
                    setPaymentSuccess={setPaymentSuccess}
                    paymentSuccess={paymentSuccess}
                    setSavedCards={setSavedCards}
                />
            )}
            {showReviewModal && (
                <ReviewModal
                    gigData={gigInfo}
                    setGigData={setGigInfo}
                    reviewer='venue'
                    onClose={() => {
                        setShowReviewModal(false)
                        setReviewProfile(null)
                    }}
                />
            )}
            {showPromoteModal && (
                <PromoteModal
                    socialLinks={null}
                    setShowSocialsModal={setShowPromoteModal}
                    musicianId={null}
                    venueId={gigInfo.venueId}
                />
            )}
            {showDeleteConfirmationModal && (
                <div className='modal'>
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
            )}
            {showCloseGigModal && (
                <div className='modal'>
                    <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                        <h3>Are you sure you want to close this gig?</h3>
                        <p>Musicians will no longer be able to apply to this gig.</p>
                        <div className='two-buttons'>
                            <button className='btn danger' onClick={handleCloseGig}>
                                Close Gig
                            </button>
                            <button className='btn secondary' onClick={() => setShowCloseGigModal(false)}>
                                Cancel
                            </button>
                        </div>
                        <button className='btn tertiary close' onClick={() => setShowCloseGigModal(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
