import React, { useState, useEffect, useRef } from 'react';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { 
    RejectedIcon,
    SendMessageIcon,
    TickIcon } from '@features/shared/ui/extras/Icons';
import '@styles/musician/messages.styles.css';
import { PaymentModal } from '@features/venue/components/PaymentModal'
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { useNavigate } from 'react-router-dom';
import { sendMessage, listenToMessages, sendGigAcceptedMessage, updateDeclinedApplicationMessage, sendCounterOfferMessage, updateReviewMessageStatus } from '@services/messages';
import { acceptGigOffer, declineGigApplication, updateGigWithCounterOffer } from '@services/gigs';
import { getVenueProfileById } from '@services/venues';
import { getMusicianProfileByMusicianId } from '@services/musicians';
import { sendGigAcceptedEmail, sendGigDeclinedEmail, sendCounterOfferEmail } from '@services/emails';
import { fetchSavedCards, confirmGigPayment } from '@services/functions';
import { CalendarIconSolid } from '../../../shared/ui/extras/Icons';
import AddToCalendarButton from '../../../shared/components/AddToCalendarButton';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);


export const MessageThread = ({ activeConversation, conversationId, user, musicianProfileId, gigId, gigData, setGigData }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [userRole, setUserRole] = useState('');
    const [allowCounterOffer, setAllowCounterOffer] = useState(false);
    const [newCounterOffer, setNewCounterOffer] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [savedCards, setSavedCards] = useState([]);
    const [loadingPaymentDetails, setLoadingPaymentDetails] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [makingPayment, setMakingPayment] = useState(false);
    const [paymentMessageId, setPaymentMessageId] = useState();
    const [paymentIntentId, setPaymentIntentId] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const navigate = useNavigate();

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (activeConversation) {
            const userEntry = activeConversation.accountNames.find(account => account.accountId === user.uid);
            if (userEntry?.role === 'venue') {
                setUserRole('venue');
            } else if (userEntry?.role === 'band') {
                setUserRole('band');
            } else {
                setUserRole('musician');
            }
        }
    }, [activeConversation])

    useEffect(() => {
        if (!conversationId) return;
        const unsubscribe = listenToMessages(conversationId, setMessages);
        return () => unsubscribe();
      }, [conversationId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        try {
            await sendMessage(conversationId, {
              senderId: user.uid,
              text: newMessage,
            });
            setNewMessage('');
        } catch (error) {
        console.error('Error sending message:', error);
        }
    };

    const handleCounterOffer = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setNewCounterOffer(`£${value}`)
    }

    const handleAcceptGig = async (event, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) return console.error('Gig data is missing');
            if (gigData.date.toDate() < new Date()) return console.error('Gig is in the past.');
            const nonPayableGig = gigData.kind === 'Open Mic' || gigData.kind === "Ticketed Gig";
            const { updatedApplicants, agreedFee } = await acceptGigOffer(gigData, musicianProfileId, nonPayableGig);
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            }));
            await sendGigAcceptedMessage(conversationId, messageId, user.uid, agreedFee, userRole);
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendGigAcceptedEmail({
                userRole,
                musicianProfile: musicianProfileData,
                venueProfile: venueData,
                gigData,
                agreedFee,
                isNegotiated: false,
                nonPayableGig
            });
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleAcceptNegotiation = async (event, messageId) => {
        event.stopPropagation();    
        try {
            if (!gigData) return console.error('Gig data is missing');
            const { updatedApplicants, agreedFee } = await acceptGigOffer(gigData, musicianProfileId);
            setGigData(prev => ({
              ...prev,
              applicants: updatedApplicants,
              agreedFee: `${agreedFee}`,
              paid: false,
            }));
            await sendGigAcceptedMessage(conversationId, messageId, user.uid, agreedFee, userRole);
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendGigAcceptedEmail({
                userRole,
                musicianProfile: musicianProfileData,
                venueProfile: venueData,
                gigData,
                agreedFee,
                isNegotiated: true,
              });
            console.log('Agreed fee:', agreedFee);
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleDeclineNegotiation = async (event, newFee, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) return console.error('Gig data is missing');
            const updatedApplicants = await declineGigApplication(gigData, musicianProfileId);
            setGigData(prev => ({
                ...prev,
                applicants: updatedApplicants,
            }));
            await updateDeclinedApplicationMessage(
                conversationId,
                messageId,
                user.uid,
                userRole,
                newFee
            );
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendGigDeclinedEmail({
                userRole,
                venueProfile: venueData,
                musicianProfile: musicianProfileData,
                gigData,
                declineType: 'negotiation',
                profileType: musicianProfileData.bandProfile ? 'band' : 'musician',
            });
            setAllowCounterOffer(true);
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleDeclineApplication = async (event, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) return console.error('Gig data is missing');
            const updatedApplicants = await declineGigApplication(gigData, musicianProfileId);
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
            }));
            await updateDeclinedApplicationMessage(
                conversationId,
                messageId,
                user.uid,
                userRole,
            );
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendGigDeclinedEmail({
                userRole,
                venueProfile: venueData,
                musicianProfile: musicianProfileData,
                gigData,
                profileType: musicianProfileData.bandProfile ? 'band' : 'musician',
              });
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleSendCounterOffer = async (newFee, messageId) => {
        try {
            if (!gigData) return console.error('Gig data is missing');
            const value = (newFee || '').trim();
            const numericPart = value.replace(/£|\s/g, '');
            const num = Number(numericPart);
            if (!numericPart || isNaN(num) || num <= 0) {
                toast.info('Please enter a valid value.');
                return;
            }
            const updatedApplicants = await updateGigWithCounterOffer(gigData, musicianProfileId, newFee);
            setGigData((prev) => ({ ...prev, applicants: updatedApplicants }));
            await sendCounterOfferMessage(
                conversationId,
                messageId,
                user.uid,
                newFee,
                gigData.budget,
                userRole
            );
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendCounterOfferEmail({
                userRole,
                musicianProfile: musicianProfileData,
                venueProfile: venueData,
                gigData,
                newFee,
                profileType: musicianProfileData.bandProfile ? 'band' : 'musician',
            });
            setAllowCounterOffer(false);
        } catch (error) {
            console.error('Error sending counter-offer:', error);
        }
    };


    const handleCompletePayment = async () => {
        setLoadingPaymentDetails(true);
        await fetchSavedCardsAndModal();
        setPaymentIntentId(null);
      };

    const fetchSavedCardsAndModal = async () => {
        try {
            const cards = await fetchSavedCards();
            setSavedCards(cards);
            setShowPaymentModal(true);
        } catch (error) {
            console.error('Error fetching saved cards:', error);
            alert('Unable to fetch saved cards.');
        } finally {
            setLoadingPaymentDetails(false);
        }
    };

    const handleSelectCard = async (cardId) => {
        setMakingPayment(true);
        try {
            const result = await confirmGigPayment({ cardId, gigData, musicianProfileId });
            if (result.success && result.paymentIntent) {
                setPaymentSuccess(true);
                setGigData(prev => ({
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
                const { error } = await stripe.confirmCardPayment(result.clientSecret, { payment_method: result.paymentMethodId || cardId });
                if (error) {
                  setPaymentSuccess(false);
                  toast.error(error.message || 'Authentication failed. Please try another card.');
                  return;
                }
                setPaymentSuccess(true);
                setGigData(prev => ({
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
            setPaymentSuccess(false);
            toast.error('Payment failed. Please try again.');
        } finally {
            setMakingPayment(false);
        }
    };

    const handleMessageReviewed = async () => {
        try {
          const reviewedMessageId = await updateReviewMessageStatus(conversationId, messages, user.uid);
          if (reviewedMessageId) {
            const updatedMessages = messages.map((msg) =>
              msg.id === reviewedMessageId ? { ...msg, status: 'closed' } : msg
            );
            setMessages(updatedMessages);
          }
        } catch (error) {
          console.error('Error updating message in Firestore:', error);
        }
    };

    const toDate = (val) => {
        if (!val) return null;
        if (val.toDate) return val.toDate();            // Firestore Timestamp
        if (val instanceof Date) return val;
        const d = new Date(val);                         // ISO/string/number
        return isNaN(d.getTime()) ? null : d;
      };
      
      const start = toDate(gigData?.startDateTime);
      const durationMs = Number(gigData?.duration || 0) * 60_000;
      const end = start ? new Date(start.getTime() + durationMs) : null;
    
    return (
        <>
        <div className='messages'>
            {messages.length > 0 && (
                messages.map((message) => {
                    const getGroupOfParticipant = (participantId) => {
                        const entry = activeConversation.accountNames.find(acc => acc.accountId === participantId);
                      
                        if (!entry) return null;
                      
                        const role = entry.role;
                      
                        if (
                          role === 'Band Leader' ||
                          role === 'Band Member' ||
                          role === 'band' ||
                          role === 'musician'
                        ) {
                          return 'band';
                        }
                      
                        if (role === 'venue') {
                          return 'venue';
                        }
                      
                        return null;
                      };
            
                const currentParticipantId = user.uid;
                const userGroup = getGroupOfParticipant(currentParticipantId);
            
                const senderGroup = getGroupOfParticipant(message.senderId);
                const isSameGroup = senderGroup === userGroup;
                return (
                    <div className='message-container' key={message.id}>
                        <div className={`message ${message.senderId === user.uid ? 'sent' : 'received'} ${message.type === 'negotiation' ? 'negotiation' : ''} ${message.type === 'application' ? 'application' : ''} ${message.type === 'announcement' || message.type === 'review' ? 'announcement' : ''}`} >
                            {(message.type === 'application' || message.type === 'invitation') && isSameGroup ? (
                                <>
                                    <h4>
                                        {message.type === 'application' ? (
                                            <div className='accepted-group'>
                                                Gig application sent.
                                                {userRole !== 'venue' && activeConversation.bandConversation ? (
                                                    <button className='btn primary' onClick={() => navigate(`/dashboard/bands/${activeConversation.accountNames.find(account => account.role === 'band')}`)}>
                                                        Check Band Profile
                                                    </button>
                                                ) : userRole === 'musician' && (
                                                    <button className='btn primary' onClick={() => navigate('/dashboard/profile')}>
                                                        Check my Profile
                                                    </button>
                                                )}
                                            </div>

                                        ) : (
                                            <>
                                                Gig invitation sent.
                                            </>
                                        )}
                                    </h4>
                                    {message.status === 'accepted' ? (
                                        <div className='accepted-group'>
                                            <div className='status-box'>
                                                <div className='status confirmed'>
                                                    <TickIcon />
                                                    Accepted
                                                </div>
                                            </div>
                                        </div>
                                    ) : (message.status === 'declined' || message.status === 'countered') && (
                                        <>
                                        <div className='status-box'>
                                            <div className='status rejected'>
                                                <RejectedIcon />
                                                Declined
                                            </div>
                                        </div>
                                        {message.status !== 'countered' && (
                                            <div className={`counter-offer ${isSameGroup ? 'sent' : 'received'}`}>
                                            <h4>Send Counter Offer:</h4>
                                            <div className='input-group'>
                                                <input
                                                    type='text'
                                                    className='input'
                                                    value={newCounterOffer}
                                                    onChange={(e) => handleCounterOffer(e)}
                                                    placeholder='£'
                                                />
                                                <button
                                                    className='btn primary'
                                                    onClick={() => handleSendCounterOffer(newCounterOffer, message.id)}
                                                >
                                                    Send
                                                </button>
                                            </div>
                                        </div>
                                        )}
                                        </>
                                    )}
                                </>
                            ) 
                            : (message.type === 'application' || message.type === 'invitation') && !isSameGroup ? (
                                <>
                                    <h4>{message.text}</h4>
                                    {message.status === 'accepted' ? (
                                        <div className='status-box'>
                                            <div className='status confirmed'>
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : (message.status === 'declined' || message.status === 'countered') ? (
                                        <>
                                        <div className='status-box'>
                                            <div className='status rejected'>
                                                <RejectedIcon />
                                                Declined
                                            </div>
                                        </div>
                                        {message.status !== 'countered' && (
                                            <div className={`counter-offer ${isSameGroup ? 'sent' : 'received'}`}>
                                                <h4>Send Counter Offer:</h4>
                                                <div className='input-group'>
                                                    <input
                                                        type='text'
                                                        className='input'
                                                        value={newCounterOffer}
                                                        onChange={(e) => handleCounterOffer(e)}
                                                        placeholder='£'
                                                    />
                                                    <button
                                                        className='btn primary'
                                                        onClick={() => handleSendCounterOffer(newCounterOffer, message.id)}
                                                    >
                                                        Send
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        </>
                                    ) : message.status !== 'countered' && (
                                        <div className='two-buttons'>
                                            <button className='btn accept' onClick={(event) => handleAcceptGig(event, message.id)}>
                                                Accept
                                            </button>
                                            <button className='btn decline' onClick={(event) => handleDeclineApplication(event, message.id)}>
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            ) : 
                            message.type === 'negotiation' && isSameGroup ? (
                                <>
                                    <div className='fees'>
                                        <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                                        <h4>{message.newFee}</h4>
                                    </div>
                                    {message.status === 'accepted' ? (
                                        <div className='status-box'>
                                            <div className='status confirmed'>
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : message.status === 'declined' && (
                                        <>
                                            <div className='status-box'>
                                                <div className='status rejected'>
                                                    <RejectedIcon />
                                                    Declined
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : message.type === 'negotiation' && !isSameGroup ? (
                                <>
                                    <h4>{message.text}</h4>
                                    <div className='fees'>
                                        <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                                        <h4>{message.newFee}</h4>
                                    </div>
                                    {message.status === 'accepted' ? (
                                        <div className='status-box'>
                                            <div className='status confirmed'>
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : (message.status === 'declined' || message.status === 'countered') ? (
                                        <>
                                            <div className='status-box'>
                                                <div className='status rejected'>
                                                    <RejectedIcon />
                                                    Declined
                                                </div>
                                            </div>
                                            {message.status !== 'countered' && (
                                                <div className={`counter-offer ${isSameGroup ? 'sent' : 'received'}`}>
                                                   <h4>Send Counter Offer:</h4>
                                                <div className='input-group'>
                                                    <input
                                                        type='text'
                                                        className='input'
                                                        value={newCounterOffer}
                                                        onChange={(e) => handleCounterOffer(e)}
                                                        placeholder='£'
                                                    />
                                                    <button
                                                        className='btn primary'
                                                        onClick={() => handleSendCounterOffer(newCounterOffer, message.id)}
                                                    >
                                                        Send
                                                    </button>
                                                </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className='two-buttons'>
                                            <button className='btn accept' onClick={(event) => handleAcceptNegotiation(event, message.id)}>
                                                Accept
                                            </button>
                                            <button className='btn decline' onClick={(event) => handleDeclineNegotiation(event, message.newFee, message.id)}>
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            ) : message.type === 'announcement' ? (
                                <>
                                {message.status === 'awaiting payment' && userRole === 'venue' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text} Please click the button below to pay. The gig will be confirmed once you have paid.</h4>
                                        {loadingPaymentDetails || gigData?.status === 'payment processing' ? (
                                            <LoadingThreeDots />
                                        ) : (
                                            <button className='btn primary complete-payment' onClick={() => {handleCompletePayment(); setPaymentMessageId(message.id)}}>
                                                Complete Payment
                                            </button>
                                        )}
                                    </>
                                ) : message.status === 'awaiting payment' && (userRole === 'musician' || userRole === 'band') ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text} Once the venue has paid the fee, the gig will be confirmed.</h4>
                                    </>
                                ) : message.status === 'gig confirmed' ? (
                                    (gigData?.kind === 'Open Mic' || gigData?.kind === 'Ticketed Gig') ? (
                                        <>
                                            <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                            <h4>{message.text} <br /> {'No payment is required for this type of gig.'}</h4>
                                        </>
                                    ) : (
                                        <>
                                            <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                            <h4>{message.text} {userRole !== 'venue' && !activeConversation.bandConversation ? 'Your payment will arrive in your account 24 hours after the gig has been performed.' : userRole !== 'venue' && !activeConversation.bandConversation && 'The band admin will receive the gig fee 48 hours after the gig is performed.'}</h4>
                                            <AddToCalendarButton
                                                event={{
                                                    title: `Gig at ${gigData.venue.venueName}`,
                                                    start: start,
                                                    end: end,
                                                    description: `Gig confirmed with fee: ${gigData.agreedFee}`,
                                                    location: gigData.venue.address,
                                                }}
                                            />
                                        </>
                                    )
                                ) : message.status === 'payment failed' && userRole === 'venue' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                ) : message.status === 'payment failed' && (userRole === 'musician' || userRole === 'band') ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>The gig will be confirmed when the venue has paid the gig fee.</h4>
                                    </>
                                ) : message.status === 'cancellation' && message?.cancellingParty !== userRole ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                ) : message.status === 'cancellation' && message?.cancellingParty === userRole ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>You cancelled the gig. The gig fee has been refunded to the venue.</h4>
                                    </>
                                ) : message.status === 'dispute' && (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                )}
                                </>
                            ) : message.type === 'review' ? (
                                <>
                                    {(userRole === 'musician' || userRole === 'band') ? (
                                        !gigData.musicianHasReviewed ? (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>How was your experience? Click the button below to review the venue.</h4>
                                                <button
                                                    className='btn primary'
                                                    onClick={() => setShowReviewModal(true)}
                                                >
                                                    {gigData.disputeClearingTime && new Date(gigData.disputeClearingTime.toDate()) > new Date()
                                                        ? 'Leave a Review'
                                                        : 'Leave a Review'}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>Thank you for submitting your review.</h4>
                                            </>
                                        )
                                    ) : (
                                        !gigData.venueHasReviewed && !gigData.disputeLogged ? (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>How was your experience? Click the button below to review the musician{gigData.disputeClearingTime && new Date(gigData.disputeClearingTime.toDate()) > new Date() ? ' or if you want to report an issue with the gig and request a refund.' : '.'}</h4>
                                                <button
                                                    className='btn primary'
                                                    onClick={() => setShowReviewModal(true)}
                                                >
                                                    {gigData.disputeClearingTime && new Date(gigData.disputeClearingTime.toDate()) > new Date()
                                                        ? 'Leave a Review / Report Issue'
                                                        : 'Leave a Review'}
                                                </button>
                                            </>
                                        ) : gigData.venueHasReviewed && !gigData.disputeLogged ? (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>Thank you for submitting your review.</h4>
                                            </>
                                        ) : !gigData.venueHasReviewed && gigData.disputeLogged && (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>We have received your report.</h4>
                                            </>
                                        )
                                    )}
                                </>
                            ) : (
                                <>
                                    <h4>{message.text}</h4>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            )}
                        </div>
                        <div ref={messagesEndRef} />
                    </div>
                )})
            )}
            </div>
            <form className='message-input' onSubmit={handleSendMessage}>
                <input
                    type='text'
                    className='input'
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder='Aa'
                />
                <button type='submit' className='btn primary'><SendMessageIcon /></button>
            </form>
            {showPaymentModal && (
                <PaymentModal
                    savedCards={savedCards}
                    onSelectCard={handleSelectCard}
                    onClose={() => {setShowPaymentModal(false); setPaymentSuccess(false)}}
                    gigData={gigData}
                    setMakingPayment={setMakingPayment}
                    makingPayment={makingPayment}
                    setPaymentSuccess={setPaymentSuccess}
                    paymentSuccess={paymentSuccess}
                    setSavedCards={setSavedCards}
                    paymentIntentId={paymentIntentId}
                    setPaymentIntentId={setPaymentIntentId} 
                />
            )}
            {showReviewModal &&
                <ReviewModal
                    gigData={gigData}
                    setGigData={setGigData}
                    reviewer={userRole}
                    onClose={(reviewSubmitted) => {
                        setShowReviewModal(false);
                        if (reviewSubmitted) {
                            handleMessageReviewed();
                        }
                    }}
                />
            }
        </>
    );
};