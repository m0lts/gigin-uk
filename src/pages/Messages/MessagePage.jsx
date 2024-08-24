import '/styles/common/messages.styles.css'
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from "react"
import { firestore } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { LeftChevronIcon, NewTabIcon, OptionsIcon, QuestionCircleIcon, RightChevronIcon } from '../../components/ui/Extras/Icons';
import { MessageThread } from './MessageThread';
import { GigInformation } from './GigInformation';
import { Link } from 'react-router-dom';

export const MessagePage = () => {

    const { user } = useAuth();

    const [newMessages, setNewMessages] = useState(false);
    const [conversations, setConversations] = useState([]);

    const [activeConversation, setActiveConversation] = useState(null);

    // Function to handle selecting a conversation
    const handleSelectConversation = (conversationId) => {
        const conversation = conversations.find(c => c.id === conversationId)
        setActiveConversation(conversation);
    };


    useEffect(() => {
        if (!user) return;

        // Check for conversations where the user is a participant
        const checkForNewMessages = () => {
            const conversationsRef = collection(firestore, 'conversations');
            const queries = [];

            // Query by musicianProfile ID
            if (user.musicianProfile && user.musicianProfile.length > 0) {
                const musicianQuery = query(conversationsRef, where('participants', 'array-contains', user.musicianProfile[0]));
                queries.push(musicianQuery);
            }

            // Query by each venueProfile ID
            if (user.venueProfiles && user.venueProfiles.length > 0) {
                user.venueProfiles.forEach(venueProfileId => {
                    const venueQuery = query(conversationsRef, where('participants', 'array-contains', venueProfileId));
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

    const openGig = (gigId) => {
        const url = `/gig/${gigId}`;
        window.open(url, '_blank');
    };

    return (
        <div className="message-page">
            <div className="column conversations">
                <div className="top-banner">
                    <div className="left">
                        <button className="btn tertiary"><LeftChevronIcon /></button>
                        <h3>Messages</h3>
                    </div>
                    <div className="right">
                        <button className="btn tertiary"><OptionsIcon /></button>
                        <button className="btn tertiary"><QuestionCircleIcon /></button>
                    </div>
                </div>
                <ul className="conversations-list">
                    {conversations.length > 0 ? (
                        conversations.map(conversation => {
                            const otherParticipant = conversation.accountNames.find(account => account.accountId !== user.uid);

                            return (
                                <li className={`conversation ${(activeConversation && conversation.id === activeConversation.id) ? 'active' : ''}`} key={conversation.id} onClick={() => handleSelectConversation(conversation.id)}>
                                    <div className="conversation-header">
                                        <h3 className="participant-name">
                                            {otherParticipant ? otherParticipant.accountName : 'Unknown'}
                                        </h3>
                                        <h6 className="conversation-date">
                                            {new Date(conversation.lastMessageTimestamp.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </h6>
                                    </div>
                                    <div className="conversation-body">
                                        <p className="last-message-preview">
                                            {conversation.lastMessage}
                                        </p>
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
                {activeConversation ? (
                    <>
                        <div className="top-banner">
                            <div className="participant">
                                <h3>{activeConversation.accountNames.find(account => account.accountId !== user.uid)?.accountName}</h3>
                                <button className="btn tertiary"><QuestionCircleIcon /></button>
                            </div>
                            <div className="participant-options">
                                {(activeConversation.accountNames.find(account => account.accountId === user.uid)?.role === 'venue') ? (
                                    <>
                                        <Link className='link' to={`/musician/${activeConversation.accountNames.find(account => account.role === 'musician')?.participantId}/null`}>
                                            <button className="btn primary-alt">
                                                View Musician Profile
                                            </button>
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <button className="btn primary-alt">
                                            Negotiate Fee
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="messages">
                            <MessageThread 
                                activeConversation={activeConversation}
                                conversationId={activeConversation.id}
                                user={user}
                                musicianProfileId={activeConversation.accountNames.find(account => account.role === 'musician')?.participantId}
                                gigId={activeConversation.gigId}
                            />
                        </div>
                    </>
                ) : (
                    <h2>Select a conversation</h2>
                )}
            </div>
            <div className="column information">
                <div className="top-banner">
                    <h3>Gig Information</h3>
                    <button className="btn tertiary" onClick={() => openGig(activeConversation.gigId)}><NewTabIcon /></button>
                </div>
                {activeConversation && (
                    <div className="gig-information">
                        <GigInformation gigId={activeConversation.gigId} />
                    </div>
                )}
            </div>
        </div>
    )
}