import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { TickIcon } from '../../components/ui/Extras/Icons';
import '/styles/common/messages.styles.css';

export const MessageThread = ({ activeConversation, conversationId, user, musicianProfileId, gigId }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [userRole, setUserRole] = useState('');

    useEffect(() => {
        if (activeConversation) {
            if (activeConversation.accountNames.find(account => account.accountId === user.uid)?.role === 'venue') {
                setUserRole('venue')
            } else {
                setUserRole('musician')
            }
        }
    }, [activeConversation])

    console.log(userRole)

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
                        return { ...applicant, status: 'Rejected' };
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
        
                // Add the new message to the 'messages' subcollection
                if (userRole === 'venue') {
                    await addDoc(messagesRef, {
                        senderId: user.uid,
                        text: `The gig has been accepted with a fee of ${agreedFee}. Please follow the instructions to pay.`,
                        timestamp: timestamp,
                        type: 'announcement',
                    });
                } else {
                    await addDoc(messagesRef, {
                        senderId: user.uid,
                        text: `The gig has been accepted with a fee of ${agreedFee}. Once the host has paid the fee, the gig will be confirmed. You will receive payment once the gig has been performed.`,
                        timestamp: timestamp,
                        type: 'announcement',
                    });
                }
        
                // Update the 'lastMessage' and 'lastMessageTimestamp' in the parent 'conversation' document
                const conversationRef = doc(firestore, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    lastMessage: 'Gig Accepted',
                    lastMessageTimestamp: timestamp,
                });
        
            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleDeclineGig = async (event, newFee, oldFee, messageId) => {
        event.stopPropagation();
    
        try {
            const gigRef = doc(firestore, 'gigs', activeConversation.gigId);
            const gigSnapshot = await getDoc(gigRef);
    
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();
                const updatedApplicants = gigData.applicants.map(applicant => {
                    if (applicant.id === musicianProfileId) {
                        return { ...applicant, status: 'Rejected' };
                    }
                });
                await updateDoc(gigRef, { applicants: updatedApplicants });

                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                await updateDoc(messageRef, {
                    status: 'Rejected',
                });

                // Send a new message to Firestore
                const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                const timestamp = Timestamp.now(); // Store the timestamp for reuse
        
                // Add the new message to the 'messages' subcollection
                await addDoc(messagesRef, {
                    senderId: user.uid, // The current user's ID
                    text: `Your offer of ${newFee} was declined.`,
                    oldFee: newFee,
                    newFee: oldFee,
                    timestamp: timestamp,
                    type: 'negotiation',
                });
        
                // Update the 'lastMessage' and 'lastMessageTimestamp' in the parent 'conversation' document
                const conversationRef = doc(firestore, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    lastMessage: newMessage,
                    lastMessageTimestamp: timestamp,
                });
        
            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    return (
        <div className="message-thread">
            <div className="messages-container">
                {messages.length > 0 && (
                    messages.map(message => (
                        <div key={message.id} className={`message ${message.senderId === user.uid ? 'sent' : 'received'} ${message.type === 'negotiation' ? 'negotiation' : ''} ${message.type === 'announcement' ? 'announcement' : ''}`}>
                            {/* SENT NEGOTIATION */}
                            {message.type === 'negotiation' && message.senderId === user.uid ? (
                                <>
                                    <h4>{message.newFee}</h4>
                                    <h4 style={{ textDecoration: 'line-through'}}>{message.oldFee}</h4>
                                </>
                            ) 
                            // RECIEVED NEGOTIATION
                            : message.type === 'negotiation' && message.receiverId === user.uid ? (
                                <>
                                    <h4>{message.text}</h4>
                                    <div className="fees">
                                        <h3 style={{ textDecoration: 'line-through'}}>{message.oldFee}</h3>
                                        <h3>{message.newFee}</h3>
                                    </div>
                                    {userRole === 'venue' && (
                                        <button className="btn secondary" onClick={() => openMusicianProfile(musicianProfileId)}>Visit Profile</button>
                                    )}
                                    {message.status === 'Accepted' ? (
                                        <div className="status-box">
                                            <div className="status confirmed">
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : message.status === 'Rejected' ? (
                                        <div className="status-box">
                                            <div className="status rejected">
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>                                    ) : (
                                        <div className="two-buttons">
                                            <button className="btn accept" onClick={(event) => handleAcceptGig(event, message.id)}>
                                                Accept
                                            </button>
                                            <button className="btn danger" onClick={(event) => handleDeclineGig(event, newFee, oldFee, message.id)}>
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            ) 
                            // SENT APPLICATION
                            : message.type === 'application' && message.senderId === user.uid ? (
                                // Add a fallback or handle other message types if necessary
                                <>
                                    <h4>Gig application sent.</h4>
                                </>
                            )
                            // RECEIVED APPLICATION
                            : message.type === 'application' && message.receiverId === user.uid ? (
                                // Add a fallback or handle other message types if necessary
                                <>
                                    <h4>{message.text}</h4>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            ) : message.type === 'announcement' ? (
                                <>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                    <h4>{message.text}</h4>
                                </>
                            ) : (
                                <>
                                    <h4>{message.text}</h4>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            )}
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
                    placeholder="Type a message..."
                />
                <button type="submit" className='btn primary'>Send</button>
            </form>
        </div>
    );
};