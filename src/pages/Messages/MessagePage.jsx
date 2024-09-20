import '/styles/common/messages.styles.css'
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from "react"
import { firestore } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { HouseIcon, LeftChevronIcon, MailboxEmptyIcon, MicrophoneIcon, NewTabIcon, OptionsIcon, QuestionCircleIcon, RightChevronIcon } from '../../components/ui/Extras/Icons';
import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { MessageThread } from './MessageThread';
import { GigInformation } from './GigInformation';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export const MessagePage = () => {

    const { user } = useAuth();
    const navigate = useNavigate();

    const [newMessages, setNewMessages] = useState(false);
    const [conversations, setConversations] = useState([]);

    const [activeConversation, setActiveConversation] = useState(null);

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const paramsConversationId = queryParams.get('conversationId');

    // Function to handle selecting a conversation
    const handleSelectConversation = async (conversationId) => {
        navigate(`/messages?conversationId=${conversationId}`);
    
        // Update the lastViewed timestamp for the user in Firestore
        const conversationRef = doc(firestore, 'conversations', conversationId);
        const lastViewedUpdate = {};
        lastViewedUpdate[`lastViewed.${user.uid}`] = Timestamp.now();
        await updateDoc(conversationRef, lastViewedUpdate);
    };

    useEffect(() => {
        const updateLastViewed = async () => {
            if (paramsConversationId && user.uid) {
                try {
                    const conversationRef = doc(firestore, 'conversations', paramsConversationId);
                    const lastViewedUpdate = {};
                    lastViewedUpdate[`lastViewed.${user.uid}`] = Timestamp.now();
                    await updateDoc(conversationRef, lastViewedUpdate);
                } catch (error) {
                    console.error('Error updating last viewed timestamp:', error);
                }
            }
        };
    
        updateLastViewed();
    }, [paramsConversationId, user]);


    useEffect(() => {
        if (!user) return;

        // Check for conversations where the user is a participant
        const checkForNewMessages = () => {
            const conversationsRef = collection(firestore, 'conversations');
            const queries = [];

            // Query by musicianProfile ID
            if (user.musicianProfile) {
                const musicianQuery = query(conversationsRef, where('participants', 'array-contains', user.musicianProfile.musicianId));
                queries.push(musicianQuery);
            }

            // Query by each venueProfile ID
            if (user.venueProfiles && user.venueProfiles.length > 0) {
                user.venueProfiles.forEach(venue => {
                    const venueQuery = query(conversationsRef, where('participants', 'array-contains', venue.id));
                    queries.push(venueQuery);
                });
            }

            // Set up listeners for each query
            const unsubscribeFunctions = queries.map(q => 
                onSnapshot(q, snapshot => {
                    if (!snapshot.empty) {
                        const newConversations = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                        }));
                        
                        setConversations(prevConversations => {
                            // Merge new conversations into the existing state
                            const updatedConversations = [...prevConversations];
                            newConversations.forEach(newConv => {
                                const existingIndex = updatedConversations.findIndex(conv => conv.id === newConv.id);
                                if (existingIndex !== -1) {
                                    updatedConversations[existingIndex] = newConv;
                                } else {
                                    updatedConversations.push(newConv);
                                }
                            });
                            updatedConversations.sort((a, b) => {
                                const timeA = a.lastMessageTimestamp ? a.lastMessageTimestamp.seconds : 0;
                                const timeB = b.lastMessageTimestamp ? b.lastMessageTimestamp.seconds : 0;
                                return timeB - timeA;
                            });
            
                            return updatedConversations;
                        });
                        // Check if there are any new messages
                        snapshot.docChanges().forEach(change => {
                            if (change.type === 'added') {
                                setNewMessages(true); // New message detected
                            }
                        });
                    }
                })
            );

            // Clean up the listeners when the component unmounts
            return () => {
                unsubscribeFunctions.forEach(unsub => unsub());
            };
        };

        checkForNewMessages();
    }, [user]);

    useEffect(() => {
        if (conversations.length > 0 && paramsConversationId) {
            const conversation = conversations.find(c => c.id === paramsConversationId)
            setActiveConversation(conversation)
        }
        if (conversations.length > 0 && !paramsConversationId) {
            const firstConversationId = conversations[0]?.id;
            navigate(`/messages?conversationId=${firstConversationId}`);
        }
    }, [paramsConversationId, conversations, navigate])

    const openGig = (gigId) => {
        const url = `/gig/${gigId}`;
        window.open(url, '_blank');
    };

    const openMusician = (url) => {
        window.open(url, '_blank');
    };

    const handleNegotiateFee = async (activeConversation) => {
        console.log(activeConversation)
    }

    if (conversations.length > 0) {

        return (
            <div className="message-page">
                <div className="column conversations">
                    <div className="top-banner">
                        <h2>Messages</h2>
                    </div>
                    <ul className="conversations-list">
                        {conversations.length > 0 ? (
                            conversations.map(conversation => {
                                const otherParticipant = conversation.accountNames.find(account => account.accountId !== user.uid);
    
                                // Get the last viewed timestamp for the current user
                                const lastViewedTimestamp = conversation.lastViewed?.[user.uid]?.seconds || 0;
    
                                // Check if there are unread messages
                                const hasUnreadMessages = conversation.lastMessageTimestamp.seconds > lastViewedTimestamp && conversation?.lastMessageSenderId !== user.uid;
    
                                return (
                                    <li className={`conversation ${(activeConversation && conversation.id === activeConversation.id) ? 'active' : ''}`} key={conversation.id} onClick={() => handleSelectConversation(conversation.id)}>
                                        <div className="conversation-icon">
                                            {otherParticipant.role === 'venue' ? (
                                                <div className="icon-circle">
                                                    <HouseIcon />
                                                </div>
                                            ) : (
                                                <div className="icon-circle">
                                                    <MicrophoneIcon />
                                                </div>
                                            )}
                                        </div>
                                        <div className="conversation-text">
                                            <div className="conversation-title">
                                                <h3>
                                                    {otherParticipant ? otherParticipant.accountName : 'Unknown'}
                                                    {otherParticipant.venueName && (
                                                        <span>- {otherParticipant.venueName}</span>
                                                    )}
                                                </h3>
                                                {hasUnreadMessages && <div className="notification-dot"></div>}
                                            </div>
                                            <div className="conversation-details">
                                                <p className="last-message-preview">
                                                    {conversation.lastMessage}
                                                </p>
                                                <h6 className="conversation-date">
                                                    {new Date(conversation.lastMessageTimestamp.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </h6>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })
                        ) : (
                            <p>No messages yet.</p>
                        )}
                    </ul>
                </div>
                <div className="column message-thread">
                    {activeConversation && (
                        <>
                            <div className="top-banner">
                                    <h3>
                                        {activeConversation.accountNames.find(account => account.accountId !== user.uid)?.accountName}
                                    </h3>
                                    {(activeConversation.accountNames.find(account => account.accountId === user.uid)?.role === 'venue') ? (
                                        <>
                                                <button className="btn primary-alt" onClick={() => openMusician(`/${activeConversation.accountNames.find(account => account.role === 'musician')?.participantId}/null`)}>
                                                    View Musician Profile
                                                </button>
                                        </>
                                    ) : activeConversation.status === "open" && (
                                        <>
                                            <button className="btn primary-alt" onClick={() => handleNegotiateFee(activeConversation)}>
                                                Negotiate Fee
                                            </button>
                                        </>
                                    )}
    
                            </div>
                            <MessageThread 
                                activeConversation={activeConversation}
                                conversationId={activeConversation.id}
                                user={user}
                                musicianProfileId={activeConversation.accountNames.find(account => account.role === 'musician')?.participantId}
                                gigId={activeConversation.gigId}
                            />
                        </>
                    )}
                </div>
                <div className="column information">
                    {activeConversation && (
                        <>
                            <div className="top-banner">
                                <h2>Gig Information</h2>
                                <button className="btn tertiary" onClick={() => openGig(activeConversation.gigId)}><NewTabIcon /></button>
                            </div>
                            <div className="gig-information">
                                <GigInformation gigId={activeConversation.gigId} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    } else {
        return (
            <div className="message-page no-messages">
                <MailboxEmptyIcon />
                <h3>You have no messages</h3>
                <button className="btn secondary" onClick={() => navigate(-1)}>
                    Go Back
                </button>
            </div>
        )
    }

}