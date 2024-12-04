import '/styles/common/messages.styles.css'
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from "react"
import { firestore } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { HouseIcon, LeftChevronIcon, MailboxEmptyIcon, MicrophoneIcon, NewTabIcon, OptionsIcon, QuestionCircleIcon, RightChevronIcon } from '../../components/ui/Extras/Icons';
import { Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { MessageThread } from './MessageThread';
import { GigInformation } from './GigInformation';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export const MessagePage = () => {

    const { user } = useAuth();
    const navigate = useNavigate();

    const [newMessages, setNewMessages] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [gigData, setGigData] = useState();

    const [activeConversation, setActiveConversation] = useState(null);

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const paramsConversationId = queryParams.get('conversationId');

    // Function to handle selecting a conversation
    const handleSelectConversation = async (conversationId, musicianId, gigId) => {
        navigate(`/messages?conversationId=${conversationId}`);
        const conversationRef = doc(firestore, 'conversations', conversationId);
        const lastViewedUpdate = {};
        lastViewedUpdate[`lastViewed.${user.uid}`] = Timestamp.now();
        await updateDoc(conversationRef, lastViewedUpdate);
        const gigRef = doc(firestore, 'gigs', gigId);
        const gigSnapshot = await getDoc(gigRef);
        if (gigSnapshot.exists()) {
            const gigData = gigSnapshot.data();
            const updatedApplicants = gigData.applicants.map(applicant => 
                applicant.id === musicianId ? { ...applicant, viewed: true } : applicant
            );
            await updateDoc(gigRef, { applicants: updatedApplicants });
        } else {
            console.warn('Gig not found.');
        }
    };

    useEffect(() => {
        const updateLastViewed = async () => {
            if (paramsConversationId && user && user.uid) {
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

    const formatGigDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'short' });
        return `${weekday}, ${day} ${month}`;
    };

    console.log(conversations)

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
                                const musicianId = conversation.accountNames.find(account => account.role === 'musician')?.participantId;
                                const lastViewedTimestamp = conversation.lastViewed?.[user.uid]?.seconds || 0;
                                const hasUnreadMessages = conversation.lastMessageTimestamp.seconds > lastViewedTimestamp && conversation?.lastMessageSenderId !== user.uid && !location.pathname.includes(conversation.id);
                                return (
                                    <li className={`conversation ${(activeConversation && conversation.id === activeConversation.id) ? 'active' : ''}`} key={conversation.id} onClick={() => handleSelectConversation(conversation.id, musicianId, conversation.gigId)}>
                                        <div className="conversation-icon">
                                            {otherParticipant.role === 'venue' ? (
                                                    otherParticipant.venueImg ? (
                                                        <img className="participant-img" src={otherParticipant.venueImg} alt='Venue' />
                                                    ) : (
                                                        <HouseIcon />
                                                    )
                                            ) : (
                                                    otherParticipant.musicianImg ? (
                                                        <img className="participant-img" src={otherParticipant.musicianImg} alt='Venue' />
                                                    ) : (
                                                        <MicrophoneIcon />
                                                    )
                                            )}
                                        </div>
                                        <div className="conversation-text">
                                            <div className="conversation-title">
                                                <h3 className='conversation-title-text'>
                                                    {otherParticipant ? otherParticipant.accountName.split(' ')[0] : 'Unknown'}
                                                    {otherParticipant.venueName && (
                                                        <span> - {otherParticipant.venueName}</span>
                                                    )}
                                                </h3>
                                                {hasUnreadMessages && <div className="notification-dot"></div>}
                                            </div>
                                            <h4 className="gig-date">{conversation.gigDate && formatGigDate(conversation.gigDate)}</h4>
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
                                    {(activeConversation.accountNames.find(account => account.accountId === user.uid)?.role === 'venue') && (
                                        <>
                                                <button className="btn primary" onClick={() => openMusician(`/${activeConversation.accountNames.find(account => account.role === 'musician')?.participantId}/null`)}>
                                                    View Musician Profile
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
                                gigData={gigData}
                                setGigData={setGigData}
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
                                <GigInformation gigId={activeConversation.gigId} gigData={gigData} setGigData={setGigData} />
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