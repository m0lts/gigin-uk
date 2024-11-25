
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom"
import { doc, getDoc, updateDoc, onSnapshot, getDocs, Timestamp, collection, query, addDoc, where, arrayUnion } from 'firebase/firestore';
import { firestore, functions } from '../../../firebase';
import { LoadingThreeDots } from "../../../components/ui/loading/Loading";
import { BackgroundMusicIcon, ClockIcon, FaceFrownIcon, FaceMehIcon, RejectedIcon, TickIcon } from "../../../components/ui/Extras/Icons";
import { useAuth } from "../../../hooks/useAuth";
import { useGigs } from "../../../context/GigsContext";
import { PaymentModal } from "../../../components/venue-components/PaymentModal";
import { httpsCallable } from "firebase/functions";

export const GigApplications = () => {

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

    const gigId = location.state?.gig?.gigId || '';
    const gigDate = location.state?.gig?.date || '';
    const venueName = location.state?.gig?.venue?.venueName || '';

    useEffect(() => {
        if (!gigId || !gigs) return;
        const activeGig = gigs.find(gig => gig.gigId === gigId);
        setGigInfo(activeGig);
    }, [gigId, gigs]);

    useEffect(() => {
        if (!gigInfo) return;
        const fetchMusicianProfiles = async () => {
            const profiles = await Promise.all(gigInfo.applicants.map(async (applicant) => {
                const musicianRef = doc(firestore, 'musicianProfiles', applicant.id);
                const musicianSnapshot = await getDoc(musicianRef);
                if (musicianSnapshot.exists()) {
                    return { 
                        ...musicianSnapshot.data(), 
                        id: applicant.id, 
                        status: applicant.status, 
                        proposedFee: applicant.fee 
                    };
                }
                return null;
            }));

            setMusicianProfiles(profiles.filter(profile => profile !== null));
            setLoading(false);
        };
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

    const handleAccept = async (musicianId, event, proposedFee) => {
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
            } else {
                console.error('No conversation found for the musician and gig.');
            }     
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleReject = async (musicianId, event, proposedFee) => {
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

    return (
        <>
            <div className="head">
                <h1 className="title" style={{ fontWeight: 500 }}>
                    Applications for {formatDate(gigInfo.date)} at {venueName}
                </h1>
            </div>
            <div className="body gigs">
                {loading ? (
                    <LoadingThreeDots />
                ) : (
                    musicianProfiles.length > 0 ? (
                        <table className="applications-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Genre(s)</th>
                                    <th>Reviews</th>
                                    <th>Fee</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {musicianProfiles.map((profile) => {

                                    const applicant = gigInfo.applicants.find(applicant => applicant.id === profile.id);
                                    const status = applicant ? applicant.status : 'pending';

                                    return (
                                        <tr key={profile.id} className="applicant"  onClick={() => openMusicianProfile(profile.id)}>
                                            <td>
                                                {profile.name}
                                            </td>
                                            <td className="genres">
                                                {profile.genres
                                                    .filter(genre => !genre.includes(' ')) // Filter to include only one-word genres
                                                    .map((genre, index) => (
                                                        <span key={index} className="genre-tag">{genre}</span>
                                                    ))}
                                            </td>
                                            <td>{profile.reviews?.length || 'No'} Reviews</td>
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
                                                {status === 'confirmed' && (
                                                    <div className="status-box">
                                                        <div className="status confirmed">
                                                            <TickIcon />
                                                            Confirmed
                                                        </div>
                                                    </div>
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
                                                        <button className="btn accept small" onClick={(event) => handleAccept(profile.id, event, profile.proposedFee)}>
                                                            Accept
                                                        </button>
                                                        <button className="btn danger small" onClick={(event) => handleReject(profile.id, event, profile.proposedFee)}>
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
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="no-applications">
                            <FaceMehIcon />
                            <h4>No musicians have applied to this gig yet.</h4>
                            <button className="btn primary-alt" onClick={() => navigate('/venues/dashboard/musicians/find')}>
                                Invite a Musician to Apply
                            </button>
                        </div>
                    )
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
        </>
    );
};
