import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, getDocs, arrayUnion, where } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { CloseIcon, DownChevronIcon, RejectedIcon, SendMessageIcon, TickIcon, HouseIcon, MicrophoneIcon } from '../../components/ui/Extras/Icons';
import '/styles/common/messages.styles.css';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { PaymentModal } from '../../components/venue-components/PaymentModal'
import { LoadingThreeDots } from '../../components/ui/loading/Loading'

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
            if (activeConversation.accountNames.find(account => account.accountId === user.uid)?.role === 'venue') {
                setUserRole('venue')
            } else {
                setUserRole('musician')
            }
        }
    }, [activeConversation])

    useEffect(() => {
        if (!conversationId) return;
        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(messagesQuery, snapshot => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setMessages(fetchedMessages);
        });
        return () => unsubscribe();
    }, [conversationId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        try {
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            const timestamp = Timestamp.now();
            await addDoc(messagesRef, {
                senderId: user.uid,
                text: newMessage,
                timestamp: timestamp,
                type: 'text',
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: newMessage,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
            });
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const openMusicianProfile = (musicianId) => {
        const url = `/musician/${musicianId}/${gigId}`;
        window.open(url, '_blank');
    };

    const handleCounterOffer = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setNewCounterOffer(`£${value}`)
    }

    const handleAcceptGig = async (event, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            let agreedFee;
            const updatedApplicants = gigData.applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    agreedFee = applicant.fee;
                    return { ...applicant, status: 'accepted' };
                } else {
                    return { ...applicant, status: 'declined' };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { 
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            }));
            const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
            await updateDoc(messageRef, {
                status: 'accepted',
            });
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            const timestamp = Timestamp.now();
            await addDoc(messagesRef, {
                senderId: user.uid,
                text: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                timestamp: timestamp,
                type: 'announcement',
                status: 'awaiting payment',
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
                status: 'closed',
            });
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleAcceptNegotiation = async (event, messageId) => {
        event.stopPropagation();    
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            let agreedFee;
            const updatedApplicants = gigData.applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    agreedFee = applicant.fee;
                    return { ...applicant, status: 'accepted' };
                } else {
                    return { ...applicant, status: 'declined' };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { 
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false
            });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            }));
            const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
            await updateDoc(messageRef, {
                status: 'accepted',
            });
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            const timestamp = Timestamp.now();
            await addDoc(messagesRef, {
                senderId: user.uid,
                text: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                timestamp: timestamp,
                type: 'announcement',
                status: 'awaiting payment',
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
                status: 'closed',
            });
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleDeclineNegotiation = async (event, newFee, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            const updatedApplicants = gigData.applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    return { ...applicant, status: 'declined' };
                } else {
                    return { ...applicant };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { applicants: updatedApplicants });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
            }));
            const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
            const timestamp = Timestamp.now();
            await updateDoc(messageRef, {
                status: 'declined',
                timestamp: timestamp,
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The fee of ${newFee} was declined by the ${userRole}.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
            });
            setAllowCounterOffer(true);
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleDeclineApplication = async (event, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            const updatedApplicants = gigData.applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    return { ...applicant, status: 'declined' };
                } else {
                    return { ...applicant };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { applicants: updatedApplicants });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
            }));
            const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
            const timestamp = Timestamp.now();
            await updateDoc(messageRef, {
                status: 'declined',
                timestamp: timestamp,
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The gig application has been declined.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
            });
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleSendCounterOffer = async (newFee) => {
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            const applicants = gigData.applicants;
            const updatedApplicants = applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    return {
                        ...applicant,
                        fee: newFee,
                        timestamp: Timestamp.now(),
                        status: 'pending'
                    };
                } else {
                    return { ...applicant }
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { applicants: updatedApplicants });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
            }));
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            const timestamp = Timestamp.now();
            await addDoc(messagesRef, {
                senderId: user.uid,
                text: `The ${userRole} proposes a new fee of ${newFee}.`,
                timestamp: timestamp,
                type: 'negotiation',
                status: 'pending',
                oldFee: gigData.budget,
                newFee: newFee,
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The ${userRole} proposes a new fee of ${newFee}.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
            });
            setAllowCounterOffer(false);
        } catch (error) {
            console.error('Error sending counter-offer:', error);
        }
    };

    const handleCompletePayment = async () => {
        setLoadingPaymentDetails(true);
        await fetchSavedCards();
    };

    const fetchSavedCards = async () => {
        try {
          const getSavedCards = httpsCallable(functions, 'getSavedCards');
          const response = await getSavedCards();
          setSavedCards(response.data.paymentMethods);
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
          const amountToCharge = parseFloat(gigData.agreedFee.replace('£', '')) * 1.05;
          const stripeAmount = Math.round(amountToCharge * 100);
          const gigDate = gigData.date.toDate();
          const confirmPayment = httpsCallable(functions, 'confirmPayment');
          const response = await confirmPayment({ 
            paymentMethodId: cardId,
            amountToCharge: stripeAmount,
            gigData,
            gigDate,
          });
          if (response.data.success) {
            setPaymentSuccess(true);
            setGigData((prevGigData) => ({
              ...prevGigData,
              status: 'payment processing',
            }));
          } else {
            setPaymentSuccess(false);
            alert(response.data.error || 'Payment failed. Please try again.');
          }
        } catch (error) {
          console.error('Error completing payment:', error);
          setPaymentSuccess(false);
          alert('An error occurred while processing the payment. Please try again.');
        } finally {
          setMakingPayment(false);
        }
      };

      console.log(messages)

    
    return (
        <>
        <div className="messages">
            {messages.length > 0 && (
                messages.map((message) => (
                    <div className='message-container'>
                        {/* {message.type !== 'announcement' && (
                            <div className="participant-icon">
                                {message.senderId === musicianProfileId ? (
                                    <div className="icon-circle">
                                        <HouseIcon />
                                    </div>
                                ) : message.senderId === musicianProfileId && (
                                    <div className="icon-circle">
                                        <MicrophoneIcon />
                                    </div>
                                )}
                            </div>
                        )} */}
                        <div key={message.id} className={`message ${message.senderId === user.uid ? 'sent' : 'received'} ${message.type === 'negotiation' ? 'negotiation' : ''} ${message.type === 'application' ? 'application' : ''} ${message.type === 'announcement' ? 'announcement' : ''}`} >
                            {(message.type === 'application' || message.type === 'invitation') && message.senderId === user.uid ? (
                                <>
                                    <h4>
                                        {message.type === 'application' ? (
                                            <>
                                                Gig application sent.
                                            </>

                                        ) : (
                                            <>
                                                Gig invitation sent.
                                            </>
                                        )}
                                        </h4>
                                    {message.status === 'accepted' ? (
                                        <div className="status-box">
                                            <div className="status confirmed">
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : message.status === 'declined' && (
                                        <>
                                        <div className="status-box">
                                            <div className="status rejected">
                                                <RejectedIcon />
                                                Declined
                                            </div>
                                        </div>
                                        <div className="counter-offer">
                                            <input
                                                type="text"
                                                className="input"
                                                value={newCounterOffer}
                                                onChange={(e) => handleCounterOffer(e)}
                                                placeholder="Propose a new fee"
                                            />
                                            <button
                                                className="btn primary-alt"
                                                onClick={() => handleSendCounterOffer(newCounterOffer)}
                                            >
                                                Send
                                            </button>
                                        </div>
                                        </>
                                    )}
                                </>
                            ) 
                            : (message.type === 'application' || message.type === 'invitation') && message.senderId !== user.uid ? (
                                <>
                                    <h4>{message.text}</h4>
                                    {message.status === 'accepted' ? (
                                        <div className="status-box">
                                            <div className="status confirmed">
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : message.status === 'declined' ? (
                                        <div className="status-box">
                                            <div className="status rejected">
                                                <RejectedIcon />
                                                Declined
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="two-buttons">
                                            <button className="btn accept" onClick={(event) => handleAcceptGig(event, message.id)}>
                                                Accept
                                            </button>
                                            <button className="btn danger" onClick={(event) => handleDeclineApplication(event, message.id, message.receiverId)}>
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            ) : 
                            message.type === 'negotiation' && message.senderId === user.uid ? (
                                <>
                                    <h4>{message.newFee}</h4>
                                    <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                                    {message.status === 'accepted' ? (
                                        <div className="status-box">
                                            <div className="status confirmed">
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : message.status === 'declined' && (
                                        <>
                                            <div className="status-box">
                                                <div className="status rejected">
                                                    <RejectedIcon />
                                                    Declined
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : message.type === 'negotiation' && message.senderId !== user.uid ? (
                                <>
                                    <h4>{message.text}</h4>
                                    <div className="fees">
                                        <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                                        <h4>{message.newFee}</h4>
                                    </div>
                                    {message.status === 'accepted' ? (
                                        <div className="status-box">
                                            <div className="status confirmed">
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : message.status === 'declined' ? (
                                        <>
                                            <div className="status-box">
                                                <div className="status rejected">
                                                    <RejectedIcon />
                                                    Declined
                                                </div>
                                            </div>
                                            {allowCounterOffer && (
                                                <div className="counter-offer">
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        value={newCounterOffer}
                                                        onChange={(e) => handleCounterOffer(e)}
                                                        placeholder="Propose a new fee"
                                                    />
                                                    <button
                                                        className="btn primary-alt"
                                                        onClick={() => handleSendCounterOffer(newCounterOffer)}
                                                    >
                                                        Send
                                                    </button>
                                                </div>
                                            )}
                                        </>

                                    ) : (
                                        <div className="two-buttons">
                                            <button className="btn accept" onClick={(event) => handleAcceptNegotiation(event, message.id)}>
                                                Accept
                                            </button>
                                            <button className="btn danger" onClick={(event) => handleDeclineNegotiation(event, message.newFee, message.oldFee, message.id, message.senderId)}>
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
                                        {loadingPaymentDetails || gigData.status === 'payment processing' ? (
                                            <LoadingThreeDots />
                                        ) : (
                                            <button className="btn primary complete-payment" onClick={() => {handleCompletePayment(); setPaymentMessageId(message.id)}}>
                                                Complete Payment
                                            </button>
                                        )}
                                    </>
                                ) : message.status === 'awaiting payment' && userRole === 'musician' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text} Once the venue has paid the fee, the gig will be confirmed.</h4>
                                    </>
                                ) : message.status === 'gig confirmed' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text} Your payment will arrive in your account 24 hours after the gig has been performed.</h4>
                                    </>
                                ) : message.status === 'payment failed' && userRole === 'venue' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                ) : message.status === 'payment failed' && userRole === 'musician' && (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>The gig will be confirmed when the venue has paid the gig fee.</h4>
                                    </>
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
                ))
            )}
            </div>
            <form className="message-input" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    className='input'
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Aa"
                />
                <button type="submit" className='btn primary'><SendMessageIcon /></button>
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
                />
            )}
        </>
    );
};