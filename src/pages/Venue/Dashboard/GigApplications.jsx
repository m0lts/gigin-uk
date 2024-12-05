
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom"
import { doc, getDoc, updateDoc, onSnapshot, getDocs, Timestamp, collection, query, addDoc, where, arrayUnion, writeBatch } from 'firebase/firestore';
import { firestore, functions } from '../../../firebase';
import { LoadingThreeDots } from "../../../components/ui/loading/Loading";
import { BackgroundMusicIcon, ClockIcon, EditIcon, ErrorIcon, FaceFrownIcon, FaceMehIcon, PeopleGroupIcon, RejectedIcon, StarIcon, TickIcon } from "../../../components/ui/Extras/Icons";
import { useAuth } from "../../../hooks/useAuth";
import { useGigs } from "../../../context/GigsContext";
import { PaymentModal } from "../../../components/venue-components/PaymentModal";
import { httpsCallable } from "firebase/functions";
import { ReviewModal } from "../../../components/common/ReviewModal";
import { PromoteModal } from "../../../components/common/PromoteModal";

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

    const gigId = location.state?.gig?.gigId || '';
    const gigDate = location.state?.gig?.date || '';
    const venueName = location.state?.gig?.venue?.venueName || '';

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!gigId || !gigs) return;
        const activeGig = gigs.find(gig => gig.gigId === gigId);
        setGigInfo(activeGig);
    }, [gigId, gigs]);

    useEffect(() => {
        if (!gigInfo) return;
        const updateApplicantsViewed = async () => {
            try {
                const gigRef = doc(firestore, 'gigs', gigInfo.gigId);
                const updatedApplicants = gigInfo.applicants.map(applicant => ({
                    ...applicant,
                    viewed: true
                }));
                await updateDoc(gigRef, { applicants: updatedApplicants });
            } catch (error) {
                console.error('Error updating applicants "viewed" field:', error);
            }
        };
        const fetchMusicianProfiles = async () => {
            const profiles = await Promise.all(gigInfo.applicants.map(async (applicant) => {
                const musicianRef = doc(firestore, 'musicianProfiles', applicant.id);
                const musicianSnapshot = await getDoc(musicianRef);
                if (musicianSnapshot.exists()) {
                    return { 
                        ...musicianSnapshot.data(), 
                        id: applicant.id, 
                        status: applicant.status, 
                        proposedFee: applicant.fee,
                        viewed: true,
                    };
                }
                return null;
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

    const openMusicianProfile = (musicianId) => {
        const url = `/${musicianId}/${gigInfo.gigId}`;
        window.open(url, '_blank');
    };

    if (loading) {
        return <LoadingThreeDots />;
    }

    const handleAccept = async (musicianId, event, proposedFee, musicianEmail, musicianName) => {
        event.stopPropagation();    
        try {
            if (!gigInfo) {
                console.error('Gig data is missing');
                return;
            }
            if (gigInfo.date.toDate() < new Date()) {
                console.error('Gig is in the past.');
                return;
            }
            let agreedFee;
            const updatedApplicants = gigInfo.applicants.map(applicant => {
                if (applicant.id === musicianId) {
                    agreedFee = applicant.fee;
                    return { ...applicant, status: 'accepted' };
                } else {
                    return { ...applicant, status: 'declined' };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigInfo.gigId);
            await updateDoc(gigRef, { 
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            });
            setGigInfo((prevGigInfo) => ({
                ...prevGigInfo,
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            }));
            const conversationsRef = collection(firestore, 'conversations');
            const conversationQuery = query(conversationsRef, where('participants', 'array-contains', musicianId), where('gigId', '==', gigId));
            const conversationSnapshot = await getDocs(conversationQuery);
            if (!conversationSnapshot.empty) {
                const conversationId = conversationSnapshot.docs[0].id;
                const timestamp = Timestamp.now();
                if (proposedFee === gigInfo.budget) {
                    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                    const messageQuery = query(messagesRef, where('type', '==', 'application'));
                    const messageSnapshot = await getDocs(messageQuery);
                    if (!messageSnapshot.empty) {
                        const messageId = messageSnapshot.docs[0].id;
                        const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                        await updateDoc(messageRef, {
                            status: 'accepted',
                        });
                        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                        await addDoc(messagesRef, {
                            senderId: user.uid,
                            text: `The gig has been accepted with a fee of ${agreedFee}.`,
                            timestamp: timestamp,
                            type: 'announcement',
                            status: 'awaiting payment',
                        });
                        const conversationRef = doc(firestore, 'conversations', conversationId);
                        await updateDoc(conversationRef, {
                            lastMessage: `Gig application accepted.`,
                            lastMessageTimestamp: timestamp,
                        });
                    } else {
                        console.error('No application message found in the conversation.');
                    }
                } else {
                    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                    const messageQuery = query(messagesRef, where('type', '==', 'negotiation'));
                    const messageSnapshot = await getDocs(messageQuery);
                    if (!messageSnapshot.empty) {
                        const messageId = messageSnapshot.docs[0].id;
                        const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                        await updateDoc(messageRef, {
                            status: 'accepted',
                            timestamp: timestamp,
                        });
                        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                        await addDoc(messagesRef, {
                            senderId: user.uid,
                            text: `The gig has been accepted with a fee of ${agreedFee}.`,
                            timestamp: timestamp,
                            type: 'announcement',
                            status: 'awaiting payment',
                        });
                        const conversationRef = doc(firestore, 'conversations', conversationId);
                        await updateDoc(conversationRef, {
                            lastMessage: `Gig application accepted.`,
                            lastMessageTimestamp: timestamp,
                        });
                    } else {
                        console.error('No negotiation message found in the conversation.');
                    }
                }
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: musicianEmail,
                    message: {
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
                            <p>Please visit your <a href="${window.location.origin}/dashboard">dashboard</a> to see the status of the gig.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            } else {
                console.error('No conversation found for the musician and gig.');
            }     
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleReject = async (musicianId, event, proposedFee, musicianEmail, musicianName) => {
        event.stopPropagation();
        try {
            if (!gigInfo) {
                console.error('Gig data is missing');
                return;
            }
            if (gigInfo.date.toDate() < new Date()) {
                console.error('Gig is in the past.');
                return;
            }
            const updatedApplicants = gigInfo.applicants.map(applicant => {
                if (applicant.id === musicianId) {
                    return { ...applicant, status: 'declined' };
                } else {
                    return { ...applicant };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigInfo.gigId);
            await updateDoc(gigRef, { 
                applicants: updatedApplicants,
            });
            setGigInfo((prevGigInfo) => ({
                ...prevGigInfo,
                applicants: updatedApplicants,
            }));
            const conversationsRef = collection(firestore, 'conversations');
            const conversationQuery = query(conversationsRef, where('participants', 'array-contains', musicianId), where('gigId', '==', gigId));
            const conversationSnapshot = await getDocs(conversationQuery);
            if (!conversationSnapshot.empty) {
                const conversationId = conversationSnapshot.docs[0].id;
                const timestamp = Timestamp.now();
                if (proposedFee === gigInfo.budget) {
                    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                    const messageQuery = query(messagesRef, where('type', '==', 'application'));
                    const messageSnapshot = await getDocs(messageQuery);
                    if (!messageSnapshot.empty) {
                        const messageId = messageSnapshot.docs[0].id;
                        const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                        await updateDoc(messageRef, {
                            status: 'declined',
                            timestamp: timestamp,
                        });
                        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                        await addDoc(messagesRef, {
                            senderId: user.uid,
                            text: `Your gig application was declined.`,
                            timestamp: timestamp,
                            type: 'application-response',
                            status: 'declined'
                        });
                        const conversationRef = doc(firestore, 'conversations', conversationId);
                        await updateDoc(conversationRef, {
                            lastMessage: `Gig application declined.`,
                            lastMessageTimestamp: timestamp,
                        });
                    } else {
                        console.error('No application message found in the conversation.');
                    }
                } else {
                    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                    const messageQuery = query(messagesRef, where('type', '==', 'negotiation'));
                    const messageSnapshot = await getDocs(messageQuery);
                    if (!messageSnapshot.empty) {
                        const messageId = messageSnapshot.docs[0].id;
                        const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                        await updateDoc(messageRef, {
                            status: 'declined',
                            timestamp: timestamp,
                        });
                        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                        await addDoc(messagesRef, {
                            senderId: user.uid,
                            text: `Your offer was declined.`,
                            timestamp: timestamp,
                            type: 'negotiation-response',
                            status: 'declined'
                        });
                        const conversationRef = doc(firestore, 'conversations', conversationId);
                        await updateDoc(conversationRef, {
                            lastMessage: `Gig offer declined.`,
                            lastMessageTimestamp: timestamp,
                        });
                    } else {
                        console.error('No negotiation message found in the conversation.');
                    }
                }
            }
            const mailRef = collection(firestore, 'mail');
            await addDoc(mailRef, {
                to: musicianEmail,
                message: {
                    subject: `Your Gig Application Has Been Declined`,
                    text: `Your application for the gig at ${gigInfo.venue.venueName} on ${formatDate(gigInfo.date)} has been declined.`,
                    html: `
                        <p>Hi ${musicianName},</p>
                        <p>Unfortunately your application for the following gig has been declined:</p>
                        <ul>
                            <li><strong>Gig:</strong> ${gigInfo.venue.venueName}</li>
                            <li><strong>Date:</strong> ${formatDate(gigInfo.date)}</li>
                        </ul>
                        <p>Please visit your <a href="${window.location.origin}/dashboard">dashboard</a> to find another gig or negotiate the fee.</p>
                        <p>Thanks,<br />The Gigin Team</p>
                    `,
                },
            });
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const sendToConversation = async (profileId) => {
        const conversationsRef = collection(firestore, 'conversations');
        const conversationQuery = query(conversationsRef, where('participants', 'array-contains', profileId), where('gigId', '==', gigId));
        const conversationSnapshot = await getDocs(conversationQuery);
        if (!conversationSnapshot.empty) {
            const conversationId = conversationSnapshot.docs[0].id;
            navigate(`/messages?conversationId=${conversationId}`)
        }
    }

    const handleCompletePayment = async (profileId) => {
        setLoadingPaymentDetails(true);
        try {
            const getSavedCards = httpsCallable(functions, 'getSavedCards');
            const response = await getSavedCards();
            setSavedCards(response.data.paymentMethods);
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
            const amountToCharge = parseFloat(gigInfo.agreedFee.replace('£', '')) * 1.05;
            const stripeAmount = Math.round(amountToCharge * 100);
            const gigDate = gigInfo.date.toDate();
            const confirmPayment = httpsCallable(functions, 'confirmPayment');
            const response = await confirmPayment({
                paymentMethodId: cardId,
                amountToCharge: stripeAmount,
                gigData: gigInfo,
                gigDate, 
            });
            if (response.data.success) {
                setPaymentSuccess(true);
                setGigInfo((prevGigInfo) => ({
                  ...prevGigInfo,
                  status: 'payment processing',
                }));
            } else {
                setPaymentSuccess(false);
                alert(response.data.error || 'Payment failed. Please try again.');
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
        if (!timestamp || !timestamp.toDate) return "24 hours after the gig started";
    
        const date = timestamp.toDate();
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed
        const year = date.getFullYear().toString().slice(-2); // Last two digits of the year
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
    
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
            const batch = writeBatch(firestore);
            const gigRef = doc(firestore, 'gigs', gigInfo.gigId);
            batch.delete(gigRef);
            const musicianUpdates = gigInfo.applicants.map(async (applicant) => {
                const musicianRef = doc(firestore, 'musicianProfiles', applicant.id);
                const musicianSnapshot = await getDoc(musicianRef);
                if (musicianSnapshot.exists()) {
                    const musicianData = musicianSnapshot.data();
                    const updatedGigApplications = musicianData.gigApplications.filter(id => id !== gigInfo.gigId);
                    batch.update(musicianRef, { gigApplications: updatedGigApplications });
                }
            });
            await Promise.all(musicianUpdates);
            const venueRef = doc(firestore, 'venueProfiles', gigInfo.venueId);
            const venueSnapshot = await getDoc(venueRef);
            if (venueSnapshot.exists()) {
                const venueData = venueSnapshot.data();
                const updatedVenueGigs = venueData.gigs.filter(id => id !== gigInfo.gigId);
                batch.update(venueRef, { gigs: updatedVenueGigs });
            }
            const conversationsRef = collection(firestore, 'conversations');
            const conversationsQuery = query(conversationsRef, where('gigId', '==', gigInfo.gigId));
            const conversationsSnapshot = await getDocs(conversationsQuery);
            conversationsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            navigate('/venues/dashboard');
            window.location.reload();
        } catch (error) {
            console.error('Error deleting gig:', error);
        }
    };

    return (
        <>
            <div className="head">
                <h1 className="title" style={{ fontWeight: 500 }}>
                    Applications for {formatDate(gigInfo.date)} at {venueName}
                    {gigInfo.status === 'open' && !gigInfo.applicants.some(applicant => applicant.status === 'accepted' || applicant.status === 'confirmed') && (
                        <button className="btn icon" onClick={() => openGigPostModal(gigInfo)}>
                        <EditIcon />
                    </button>
                    )}
                </h1>
                {gigInfo.status === 'open' && !gigInfo.applicants.some(applicant => applicant.status === 'accepted' || applicant.status === 'confirmed') ? (
                    <button className="btn danger" onClick={() => setShowDeleteConfirmationModal(true)}>
                        Delete Gig
                    </button>
                ) : new Date < new Date(gigInfo.date.toDate().setHours(...gigInfo.startTime.split(':').map(Number))) && (
                    <button className="primary-alt btn" onClick={() => setShowPromoteModal(true)}>
                        <PeopleGroupIcon /> Promote
                    </button>
                )}
            </div>
            <div className="body gigs">
                {loading ? (
                    <LoadingThreeDots />
                ) : (
                    <>
                    {new Date(gigInfo.disputeClearingTime) > new Date(gigInfo.date.toDate().setHours(...gigInfo.startTime.split(':').map(Number))) &&
                        gigInfo.applicants.some(applicant => applicant.status === 'confirmed' &&
                        !gigInfo.disputeLogged) && (
                        <div className="dispute-box">
                            <h3>Not happy with how the gig went?</h3>
                            <h4>You have until {formatDisputeDate(gigInfo.disputeClearingTime)} to file an issue.</h4>
                            <button className="btn primary-alt" onClick={() => {setShowReviewModal(true)}}>
                                Dispute Gig
                            </button>
                        </div>
                    )}
                    {musicianProfiles.length > 0 ? (
                        <table className="applications-table">
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
                                        <tr key={profile.id} className="applicant">
                                            <td>
                                                {profile.name}
                                            </td>
                                            {windowWidth > 880 && (
                                                <td className="genres">
                                                    {profile.genres
                                                        .filter(genre => !genre.includes(' '))
                                                        .map((genre, index) => (
                                                            <span key={index} className="genre-tag">{genre}</span>
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
                                                        <div className="status-box">
                                                            <div className="status confirmed">
                                                                <TickIcon />
                                                                Confirmed
                                                            </div>
                                                        </div>
                                                    ) : !gigInfo.venueHasReviewed && !gigInfo.disputeLogged ? (
                                                        <div className="leave-review">
                                                            <button className="btn primary" onClick={(e) => {e.stopPropagation(); setShowReviewModal(true); setReviewProfile(profile)}}>
                                                                Leave a Review
                                                            </button>
                                                        </div>
                                                    ) : gigInfo.venueHasReviewed && !gigInfo.disputeLogged ? (
                                                        <div className="status-box">
                                                            <div className="status confirmed">
                                                                <TickIcon />
                                                                Reviewed
                                                            </div>
                                                        </div>
                                                    ) : gigInfo.disputeLogged && (
                                                        <div className="status-box">
                                                            <div className="status declined">
                                                                <ErrorIcon />
                                                                Reported
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                                {status === 'negotiating' && (
                                                    <div className="status-box">
                                                        <div className="status upcoming">
                                                            <ClockIcon />
                                                            Negotiating
                                                        </div>
                                                    </div>
                                                )}
                                                {status === 'accepted' && (
                                                    loadingPaymentDetails || showPaymentModal || status === 'payment processing' ? (
                                                        <LoadingThreeDots />
                                                    ) : (
                                                        <button className="btn primary" onClick={(event) => {event.stopPropagation(); handleCompletePayment(profile.id)}}>
                                                            Complete Payment
                                                        </button>
                                                    )
                                                )}
                                                {status === 'pending' && (
                                                    <>
                                                        <button className="btn accept small" onClick={(event) => handleAccept(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                            Accept
                                                        </button>
                                                        <button className="btn decline small" onClick={(event) => handleReject(profile.id, event, profile.proposedFee, profile.email, profile.name)}>
                                                            Decline
                                                        </button>
                                                    </>
                                                )}
                                                {status === 'declined' && (
                                                    <button className="btn primary" onClick={(event) => {event.stopPropagation(); sendToConversation(profile.id)}}>
                                                        Negotiate Fee
                                                    </button>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn text"
                                                    onClick={() => openMusicianProfile(profile.id)}
                                                >
                                                    View Musician
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="no-applications">
                            <FaceMehIcon />
                            <h4>No musicians have applied to this gig yet.</h4>
                            <button className="btn primary" onClick={() => navigate('/venues/dashboard/musicians/find')}>
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
                    reviewer="venue"
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
                <div className="modal">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Are you sure you want to delete this gig?</h3>
                        <div className="two-buttons">
                            <button className="btn danger" onClick={handleDeleteGig}>
                                Delete Gig
                            </button>
                            <button className="btn secondary" onClick={() => setShowDeleteConfirmationModal(false)}>
                                Cancel
                            </button>
                        </div>
                        <button className="btn tertiary close" onClick={() => setShowDeleteConfirmationModal(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
