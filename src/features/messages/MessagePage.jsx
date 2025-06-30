import '@styles/shared/messages.styles.css'
import { useState, useEffect } from 'react'
import { useAuth } from '@hooks/useAuth';
import { 
    HouseIcon,
    MailboxEmptyIcon,
    MicrophoneIcon,
    NewTabIcon,
} from '@features/shared/ui/extras/Icons';
import { MessageThread } from './MessageThread';
import { GigInformation } from './GigInformation';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    listenToUserConversations,
    markGigApplicantAsViewed,
    updateConversationLastViewed,
} from '@services/conversations';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { openInNewTab } from '@services/utils/misc';
import { formatDate } from '@services/utils/dates';

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
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useResizeEffect((width) => {
        setWindowWidth(width);
    });

    useEffect(() => {
        if (!user) return;
        const unsubscribe = listenToUserConversations(user, (updatedConversations, docChanges) => {
          setConversations(prev => {
            const merged = [...prev];
            updatedConversations.forEach(newConv => {
              const index = merged.findIndex(c => c.id === newConv.id);
              if (index !== -1) {
                merged[index] = newConv;
              } else {
                merged.push(newConv);
              }
            });
            merged.sort((a, b) => {
              const aTime = a.lastMessageTimestamp?.seconds || 0;
              const bTime = b.lastMessageTimestamp?.seconds || 0;
              return bTime - aTime;
            });
            return merged;
          });
          docChanges.forEach(change => {
            if (change.type === 'added') {
              setNewMessages(true);
            }
          });
        });
    
        return unsubscribe;
    }, [user]);

    useEffect(() => {
        const updateViewed = async () => {
            if (paramsConversationId && user?.uid) {
            try {
                await updateConversationLastViewed(paramsConversationId, user.uid);
            } catch (err) {
                console.error('Error updating last viewed timestamp:', err);
            }
            }
        };
        updateViewed();
    }, [paramsConversationId, user]);
    
    useEffect(() => {
        if (conversations.length === 0) return;
        const matched = conversations.find(c => c.id === paramsConversationId);
        if (matched) {
          setActiveConversation(matched);
        } else if (!paramsConversationId) {
          const fallbackId = conversations[0]?.id;
          if (fallbackId) navigate(`/messages?conversationId=${fallbackId}`);
        }
    }, [conversations, paramsConversationId, navigate]);

    const handleSelectConversation = async (conversationId, musicianId, gigId) => {
        navigate(`/messages?conversationId=${conversationId}`);
        await updateConversationLastViewed(conversationId, user.uid);
        await markGigApplicantAsViewed(gigId, musicianId);
    };

    if (conversations.length > 0) {
        return (
            <div className='message-page'>
                <div className='column conversations'>
                    <div className='top-banner'>
                        <h2>Messages</h2>
                    </div>
                    <ul className='conversations-list'>
                        {conversations.length > 0 ? (
                            conversations.map(conversation => {
                                const isBandConversation = conversation.bandConversation;

                                const bandAccount = isBandConversation
                                    ? conversation.accountNames.find(account => account.role === 'band')
                                    : null;

                                const musicianAccount = conversation.accountNames.find(account => account.role === 'musician');

                                const yourParticipantIds = conversation.accountNames
                                    .filter(account => account.accountId === user.uid)
                                    .map(account => account.participantId);

                                const otherParticipant = conversation.accountNames.find(
                                    account => !yourParticipantIds.includes(account.participantId) &&
                                            (account.role === 'venue' || account.role === 'band' || account.role === 'musician')
                                );

                                const musicianId = isBandConversation
                                    ? bandAccount?.participantId
                                    : musicianAccount?.participantId;

                                const hasUnreadMessages =
                                    conversation.lastMessageTimestamp.seconds > (conversation.lastViewed?.[user.uid]?.seconds || 0) &&
                                    conversation?.lastMessageSenderId !== user.uid &&
                                    !location.pathname.includes(conversation.id);
                                
                                return (
                                    <li className={`conversation ${(activeConversation && conversation.id === activeConversation.id) ? 'active' : ''}`} key={conversation.id} onClick={() => handleSelectConversation(conversation.id, musicianId, conversation.gigId)}>
                                        <div className='conversation-icon'>
                                            {otherParticipant?.role === 'venue' ? (
                                                    otherParticipant.venueImg ? (
                                                        <img className='participant-img' src={otherParticipant.venueImg} alt='Venue' />
                                                    ) : (
                                                        <HouseIcon />
                                                    )
                                            ) : (
                                                    otherParticipant?.musicianImg ? (
                                                        <img className='participant-img' src={otherParticipant.musicianImg} alt='Venue' />
                                                    ) : (
                                                        <MicrophoneIcon />
                                                    )
                                            )}
                                        </div>
                                        <div className='conversation-text'>
                                            <div className='conversation-title'>
                                                <h3 className='conversation-title-text'>
                                                {isBandConversation
                                                    ? (otherParticipant?.role === 'venue'
                                                        ? otherParticipant?.accountName || 'Venue'
                                                        : bandAccount?.accountName || 'Band')
                                                    : musicianAccount?.accountName || 'Musician'}
                                                {otherParticipant?.venueName && (
                                                    <span> - {otherParticipant.venueName}</span>
                                                )}
                                                </h3>
                                                {hasUnreadMessages && <div className='notification-dot'></div>}
                                            </div>
                                            <h4 className='gig-date'>{conversation.gigDate && formatDate(conversation.gigDate)}</h4>
                                            <div className='conversation-details'>
                                                <p className='last-message-preview'>
                                                    {conversation.lastMessage}
                                                </p>
                                                <h6 className='conversation-date'>
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
                <div className='column message-thread'>
                    {activeConversation && (
                        <>
                            <div className='top-banner'>
                                <h3>
                                    {activeConversation.accountNames.find(account => account.accountId !== user.uid)?.accountName}
                                </h3>
                                <div className='buttons' style={{ display: 'flex', alignItems: 'center', gap:5}}>
                                    {(activeConversation.accountNames.find(account => account.accountId === user.uid)?.role === 'venue') && (
                                        <>
                                            <button className='btn primary' onClick={(e) => openInNewTab(`/${activeConversation.accountNames.find(account => account.role === 'musician' || account.role === 'band')?.participantId}/null`, e)}>
                                                Musician Profile
                                            </button>
                                        </>
                                    )}
                                    {windowWidth < 1000 && (
                                        <button
                                            className='btn secondary'
                                            onClick={(e) => openInNewTab(`/gig/${activeConversation.gigId}`, e)}
                                        >
                                            View Gig
                                        </button>
                                    )}
                                </div>
                            </div>
                            {(() => {
                                const isBand = activeConversation.bandConversation;
                                const bandAccount = isBand
                                ? activeConversation.accountNames.find(account => account.role === 'band')
                                : null;
                                const musicianAccount = activeConversation.accountNames.find(account => account.role === 'musician');
                                console.log({
                                    activeConversation:activeConversation,
                                    conversationId:activeConversation.id,
                                    user:user,
                                    musicianProfileId:
                                        isBand
                                        ? bandAccount?.participantId
                                        : musicianAccount?.participantId
                                    ,
                                    gigId:activeConversation.gigId,
                                    gigData:gigData,
                                })
                                return (
                                    <MessageThread 
                                        activeConversation={activeConversation}
                                        conversationId={activeConversation.id}
                                        user={user}
                                        musicianProfileId={
                                            isBand
                                            ? bandAccount?.participantId
                                            : musicianAccount?.participantId
                                        }
                                        gigId={activeConversation.gigId}
                                        gigData={gigData}
                                        setGigData={setGigData}
                                    />
                                );
                            })()}
                        </>
                    )}
                </div>
                <div className='column information'>
                    {activeConversation && (
                        <>
                            <div className='top-banner'>
                                <h2>Gig Information</h2>
                                <button className='btn tertiary' onClick={(e) => openInNewTab(`/gig/${activeConversation.gigId}`, e)}><NewTabIcon /></button>
                            </div>
                            <div className='gig-information'>
                                <GigInformation gigId={activeConversation.gigId} gigData={gigData} setGigData={setGigData} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    } else {
        return (
            <div className='message-page no-messages'>
                <MailboxEmptyIcon />
                <h3>You have no messages</h3>
                <button className='btn secondary' onClick={() => navigate(-1)}>
                    Go Back
                </button>
            </div>
        )
    }

}