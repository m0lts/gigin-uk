import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { CloseIcon, DownChevronIcon, RejectedIcon, SendMessageIcon, TickIcon } from '../../components/ui/Extras/Icons';
import '/styles/common/messages.styles.css';

export const MessageThread = ({ activeConversation, conversationId, user, musicianProfileId, gigId }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [userRole, setUserRole] = useState('');
    const [allowCounterOffer, setAllowCounterOffer] = useState(false);
    const [newCounterOffer, setNewCounterOffer] = useState('');

    // Create a ref to the messages container
    const messagesEndRef = useRef(null);

    // Function to scroll to the bottom
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

        // Fetch messages in real-time for this conversation
        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(messagesQuery, snapshot => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setMessages(fetchedMessages);
        });

        // Clean up the listener when the component unmounts
        return () => unsubscribe();
    }, [conversationId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
    
        if (!newMessage.trim()) return;
    
        try {
            // Send a new message to Firestore
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            const timestamp = Timestamp.now(); // Store the timestamp for reuse
    
            // Add the new message to the 'messages' subcollection
            await addDoc(messagesRef, {
                senderId: user.uid, // The current user's ID
                text: newMessage,
                timestamp: timestamp,
                type: 'text',
            });
    
            // Update the 'lastMessage' and 'lastMessageTimestamp' in the parent 'conversation' document
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: newMessage,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
            });
    
            setNewMessage(''); // Clear the input field
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

        // TAKE PAYMENT FROM HOST IF USER ROLE IS VENUE
    
        try {
            const gigRef = doc(firestore, 'gigs', activeConversation.gigId);
            const gigSnapshot = await getDoc(gigRef);
    
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();
                let agreedFee;
                const updatedApplicants = gigData.applicants.map(applicant => {
                    if (applicant.id === musicianProfileId) {
                        agreedFee = applicant.fee;
                        return { ...applicant, status: 'Accepted' };
                    } else {
                        return { ...applicant, status: 'Declined' };
                    }
                });
                await updateDoc(gigRef, { applicants: updatedApplicants, budget: `${agreedFee}` });

                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                await updateDoc(messageRef, {
                    status: 'Accepted',
                });

                // Send a new message to Firestore
                const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                const timestamp = Timestamp.now(); // Store the timestamp for reuse
        

                await addDoc(messagesRef, {
                    senderId: user.uid,
                    text: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                    timestamp: timestamp,
                    type: 'announcement',
                    status: 'awaiting payment',
                });
        
                // Update the 'lastMessage' and 'lastMessageTimestamp' in the parent 'conversation' document
                const conversationRef = doc(firestore, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    lastMessage: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                    lastMessageTimestamp: timestamp,
                    lastMessageSenderId: user.uid,
                    status: 'closed',
                });
        
            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleAcceptNegotiation = async (event, messageId) => {
        event.stopPropagation();

        // TAKE PAYMENT FROM HOST IF USER ROLE IS VENUE
    
        try {
            const gigRef = doc(firestore, 'gigs', activeConversation.gigId);
            const gigSnapshot = await getDoc(gigRef);
    
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();
                let agreedFee;
                const updatedApplicants = gigData.applicants.map(applicant => {
                    if (applicant.id === musicianProfileId) {
                        agreedFee = applicant.fee;
                        return { ...applicant, status: 'Accepted' };
                    } else {
                        return { ...applicant, status: 'Declined' };
                    }
                });
                await updateDoc(gigRef, { applicants: updatedApplicants, negotiatedFee: `${agreedFee}`, status: 'awaiting payment' });

                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                await updateDoc(messageRef, {
                    status: 'Accepted',
                });

                // Send a new message to Firestore
                const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                const timestamp = Timestamp.now(); // Store the timestamp for reuse
        

                await addDoc(messagesRef, {
                    senderId: user.uid,
                    text: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                    timestamp: timestamp,
                    type: 'announcement',
                    status: 'awaiting payment',
                });
        
                // Update the 'lastMessage' and 'lastMessageTimestamp' in the parent 'conversation' document
                const conversationRef = doc(firestore, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    lastMessage: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                    lastMessageTimestamp: timestamp,
                    lastMessageSenderId: user.uid,
                    status: 'closed',
                });
        
            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };


    const handleDeclineNegotiation = async (event, newFee, oldFee, messageId, receiverId) => {
        event.stopPropagation();

        try {
            const gigRef = doc(firestore, 'gigs', activeConversation.gigId);
            const gigSnapshot = await getDoc(gigRef);
    
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();
                const updatedApplicants = gigData.applicants.map(applicant => {
                    if (applicant.id === musicianProfileId) {
                        return { ...applicant, status: 'Declined' };
                    } else {
                        return { ...applicant };
                    }
                });

                await updateDoc(gigRef, { applicants: updatedApplicants });

                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                const timestamp = Timestamp.now(); // Store the timestamp for reuse
                await updateDoc(messageRef, {
                    status: 'Declined',
                    timestamp: timestamp,
                });
        
                // Update the 'lastMessage' and 'lastMessageTimestamp' in the parent 'conversation' document
                const conversationRef = doc(firestore, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    lastMessage: `The fee of ${newFee} was declined by the ${userRole}.`,
                    lastMessageTimestamp: timestamp,
                    lastMessageSenderId: user.uid,
                });

                setAllowCounterOffer(true);
        
            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleDeclineApplication = async (event, messageId, receiverId) => {
        event.stopPropagation();
    
        try {
            const gigRef = doc(firestore, 'gigs', activeConversation.gigId);
            const gigSnapshot = await getDoc(gigRef);
        
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();
                const updatedApplicants = gigData.applicants.map(applicant => {
                    if (applicant.id === musicianProfileId) {
                        return { ...applicant, status: 'Declined' };
                    } else {
                        return { ...applicant };
                    }
                });
                await updateDoc(gigRef, { applicants: updatedApplicants });
    
                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                const timestamp = Timestamp.now(); // Store the timestamp for reuse
                await updateDoc(messageRef, {
                    status: 'Declined',
                    timestamp: timestamp,
                });
    
                // Update the 'lastMessage' and 'lastMessageTimestamp' in the parent 'conversation' document
                const conversationRef = doc(firestore, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    lastMessage: `The gig application has been declined.`,
                    lastMessageTimestamp: timestamp,
                    lastMessageSenderId: user.uid,
                });

            
            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleSendCounterOffer = async (newFee) => {
        try {
            const gigRef = doc(firestore, 'gigs', activeConversation.gigId);
            const gigSnapshot = await getDoc(gigRef);
        
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();
                const applicants = gigData.applicants;

                // Find the relevant applicant and update their fee
                const updatedApplicants = applicants.map(applicant => {
                    if (applicant.id === musicianProfileId) {
                        return {
                            ...applicant,
                            fee: newFee, // Update with the new fee
                            timestamp: Timestamp.now(), // Update the timestamp
                            status: 'Pending' // Set the status back to Pending
                        };
                    } else {
                        return { ...applicant }
                    }
                });

                // Update the gig document with the updated applicants array
                await updateDoc(gigRef, { applicants: updatedApplicants });

                const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                const timestamp = Timestamp.now(); // Store the timestamp for reuse
        
                // Send the new counter-offer from the venue
                await addDoc(messagesRef, {
                    senderId: user.uid,
                    text: `The ${userRole} proposes a new fee of ${newFee}.`,
                    timestamp: timestamp,
                    type: 'negotiation',
                    status: 'Pending',
                    oldFee: gigData.budget, // Original budget or last offered fee
                    newFee: newFee, // New proposed fee
                });
        
                // Update the conversation
                const conversationRef = doc(firestore, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    lastMessage: `The ${userRole} proposes a new fee of ${newFee}.`,
                    lastMessageTimestamp: timestamp,
                    lastMessageSenderId: user.uid,
                });
        
                // Close the counter-offer input
                setAllowCounterOffer(false);
            }
        } catch (error) {
            console.error('Error sending counter-offer:', error);
        }
    };

    
    return (
        <>
        <div className="messages">
            {messages.length > 0 && (
                messages.map((message) => (
                    <>
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
                                {message.status === 'Accepted' ? (
                                    <div className="status-box">
                                        <div className="status confirmed">
                                            <TickIcon />
                                            Accepted
                                        </div>
                                    </div>
                                ) : message.status === 'Declined' && (
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
                                {message.status === 'Accepted' ? (
                                    <div className="status-box">
                                        <div className="status confirmed">
                                            <TickIcon />
                                            Accepted
                                        </div>
                                    </div>
                                ) : message.status === 'Declined' ? (
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
                                {message.status === 'Accepted' ? (
                                    <div className="status-box">
                                        <div className="status confirmed">
                                            <TickIcon />
                                            Accepted
                                        </div>
                                    </div>
                                ) : message.status === 'Declined' && (
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
                                {message.status === 'Accepted' ? (
                                    <div className="status-box">
                                        <div className="status confirmed">
                                            <TickIcon />
                                            Accepted
                                        </div>
                                    </div>
                                ) : message.status === 'Declined' ? (
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
                                    <button className="btn primary">
                                        Complete Payment
                                    </button>
                                </>
                            ) : message.status === 'awaiting payment' && userRole === 'musician' && (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>{message.text} Once the venue has paid the fee, the gig will be confirmed.</h4>
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
                    </>
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
            </>
    );
};
{/*
<div key={message.id} className={`message ${message.senderId === user.uid ? 'sent' : 'received'} ${message.type === 'negotiation' || message.type === 'negotiation-counter' ? 'negotiation' : ''} ${message.type === 'application' ? 'application' : ''} ${message.type === 'announcement' ? 'announcement' : ''} ${message.type === 'application-response' ? 'announcement' : ''} ${message.type === 'negotiation-response' ? 'announcement' : ''}`}>
                         
                        {message.type === 'negotiation' && message.senderId === user.uid ? (
                            <>
                                <h4>{message.newFee}</h4>
                                <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                            </>
                        ) 
                        // RECEIVED NEGOTIATION
                        : message.type === 'negotiation' && message.receiverId === user.uid ? (
                            <>
                                <h4>{message.text}</h4>
                                <div className="fees">
                                    <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                                    <h4>{message.newFee}</h4>
                                </div>
                                {message.status === 'Accepted' ? (
                                    <div className="status-box">
                                        <div className="status confirmed">
                                            <TickIcon />
                                            Accepted
                                        </div>
                                    </div>
                                ) : message.status === 'Declined' ? (
                                    <div className="status-box">
                                        <div className="status rejected">
                                            <RejectedIcon />
                                            Declined
                                        </div>
                                    </div>
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
                        )
                        // SENT NEGOTIATION RESPONSE
                        : message.type === 'negotiation-response' && message.senderId === user.uid ? (
                            message.status === 'Accepted' ? (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>The gig application has been accepted.</h4>
                                </>
                            ) : (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>The gig application has been declined.</h4>
                                    {allowCounterOffer && (
                                        <div className="counter-offer">
                                            <input
                                                type="text"
                                                className="input"
                                                value={newCounterOffer}
                                                onChange={(e) => setNewCounterOffer(e.target.value)}
                                                placeholder="Propose a new fee"
                                            />
                                            <button
                                                className="btn primary"
                                                onClick={() => handleSendCounterOffer(newCounterOffer)}
                                            >
                                                Send Counter Offer
                                            </button>
                                        </div>
                                    )}
                                </>
                            )
                        )
                        // RECEIVED NEGOTIATION RESPONSE
                        : message.type === 'negotiation-response' && message.receiverId === user.uid ? (
                            <>
                                <h4>{message.text}</h4>
                                {message.status === 'Accepted' ? (
                                    <div className="status-box">
                                        <div className="status confirmed">
                                            <TickIcon />
                                            Accepted
                                        </div>
                                    </div>
                                ) : message.status === 'Declined' && (
                                    <div className="status-box">
                                        <div className="status rejected">
                                            <RejectedIcon />
                                            Declined
                                        </div>
                                    </div>
                                )}
                            </>
                        )
                        // SENT APPLICATION
                        : message.type === 'application' && message.senderId === user.uid ? (
                            <>
                                <h4>Gig application sent.</h4>
                            </>
                        ) 
                        // RECEIVED APPLICATION RESPONSE
                        : message.type === 'application-response' && message.receiverId === user.uid ? (
                            message.status === 'Accepted' ? (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>The gig application has been accepted.</h4>
                                </>
                            ) : (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>The gig application has been declined.</h4>
                                </>
                            )
                        ) 
                        : message.type === 'application-response' && message.receiverId !== user.uid ? (
                            message.status === 'Accepted' ? (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>The gig application has been accepted.</h4>
                                </>
                            ) : (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>The gig application has been declined.</h4>
                                </>
                            )
                        )
                        // RECEIVED APPLICATION (Visible only to the musician)
                        : message.type === 'application' && message.senderId !== user.uid ? (
                            <>
                                <h4>{message.text}</h4>
                                {message.status === 'Accepted' ? (
                                    <div className="status-box">
                                        <div className="status confirmed">
                                            <TickIcon />
                                            Accepted
                                        </div>
                                    </div>
                                ) : message.status === 'Declined' ? (
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
                        ) : message.type === 'announcement' ? (
                            <>
                            {message.status === 'awaiting payment' && userRole === 'venue' ? (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>{message.text} Please click the button below to pay.</h4>
                                    <button className="btn primary">
                                        Complete Payment
                                    </button>
                                </>
                            ) : message.status === 'awaiting payment' && userRole === 'musician' && (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>{message.text} Once the venue has paid the fee, the gig will be confirmed.</h4>
                                </>
                            )}
                            </>
                        ) : (
                            <>
                                <h4>{message.text}</h4>
                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                            </>
                        )} */}