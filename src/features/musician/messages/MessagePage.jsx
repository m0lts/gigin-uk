import '@styles/musician/messages.styles.css'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@hooks/useAuth';
import { 
    HouseIconLight,
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
import { ArchiveIcon, InboxIcon, SaveIcon, SendMessageIcon } from '@features/shared/ui/extras/Icons';
import { updateConversationDocument } from '@services/conversations';

export const MessagePage = () => {

    const { user } = useAuth();
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [gigData, setGigData] = useState();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const paramsConversationId = queryParams.get('conversationId');
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [showArchived, setShowArchived] = useState(false);
    const [archivedConversations, setArchivedConversations] = useState([]);

    useResizeEffect((width) => {
        setWindowWidth(width);
    });

    useEffect(() => {
        if (!user) return;
        const unsubscribe = listenToUserConversations(user, (updatedConversations, docChanges) => {
            const open = updatedConversations
                .filter(c => !c.archived?.[user?.uid])
                .sort((a, b) => (b.lastMessageTimestamp?.seconds || 0) - (a.lastMessageTimestamp?.seconds || 0));
            setConversations(open);
            const archived = updatedConversations
                .filter(c => c.archived?.[user?.uid])
                .sort((a, b) => (b.lastMessageTimestamp?.seconds || 0) - (a.lastMessageTimestamp?.seconds || 0));
            setArchivedConversations(archived);
        });
        return unsubscribe;
    }, [user]);

    const activeConversation = useMemo(() => {
        if (showArchived) {
            if (!paramsConversationId || archivedConversations.length === 0) return null;
            return archivedConversations.find(c => c.id === paramsConversationId) || null;
        }
        if (!showArchived) {
            if (!paramsConversationId || conversations.length === 0) return null;
            return conversations.find(c => c.id === paramsConversationId) || null;
        }
    }, [conversations, paramsConversationId]);

    useEffect(() => {
        if (!user || !activeConversation) return;
        const lastViewed = activeConversation.lastViewed?.[user.uid]?.seconds || 0;
        const lastMessageTime = activeConversation.lastMessageTimestamp?.seconds || 0;
        if (lastMessageTime > lastViewed && activeConversation.lastMessageSenderId !== user.uid) {
          updateConversationLastViewed(activeConversation.id, user.uid).catch(err =>
            console.error('Error updating last viewed timestamp:', err)
          );
        }
    }, [activeConversation, user]);
    
    useEffect(() => {
        if (!paramsConversationId && conversations.length > 0) {
          navigate(`/messages?conversationId=${conversations[0].id}`);
        }
    }, [paramsConversationId, conversations, navigate]);

    const handleSelectConversation = async (conversationId, musicianId, gigId) => {
        navigate(`/messages?conversationId=${conversationId}`);
        await updateConversationLastViewed(conversationId, user.uid);
        await markGigApplicantAsViewed(gigId, musicianId);
    };

    const handleArchiveConversation = async (conversation, shouldArchive) => {
        try {
          await updateConversationDocument(conversation.id, {
            [`archived.${user.uid}`]: shouldArchive
          });
        } catch (err) {
          console.error("Failed to archive conversation:", err);
        }
      };

    const handleShowArchived = () => {
        setShowArchived(prev => !prev);
    };

    if (conversations.length > 0 || archivedConversations.length > 0) {
        return (
            <div className='message-page'>
                <div className='column conversations'>
                    <div className='top-banner'>
                        <h2>Messages</h2>
                        <button className="btn secondary" onClick={handleShowArchived}>
                            {showArchived ? <InboxIcon /> : <ArchiveIcon />}
                            {showArchived ? 'Inbox' : 'Archive'}
                        </button>
                    </div>
                    <ul className='conversations-list'>
                        {conversations.length > 0 || archivedConversations.length > 0 ? (
                            (showArchived ? archivedConversations : conversations).map(conversation => {
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
                                    conversation.lastMessageTimestamp?.seconds > (conversation.lastViewed?.[user.uid]?.seconds || 0) &&
                                    conversation?.lastMessageSenderId !== user.uid &&
                                    !location.pathname.includes(conversation.id);
                                
                                return (
                                    <li className={`conversation ${(activeConversation && conversation.id === activeConversation.id) ? 'active' : ''}`} key={conversation.id} onClick={() => handleSelectConversation(conversation.id, musicianId, conversation.gigId)}>
                                        <div className='conversation-icon'>
                                            {otherParticipant?.role === 'venue' ? (
                                                    otherParticipant.venueImg ? (
                                                        <img className='participant-img' src={otherParticipant.venueImg} alt='Venue' />
                                                    ) : (
                                                        <HouseIconLight />
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
                                                <div className='conversation-title-text'>
                                                    <h3>{otherParticipant?.role === 'venue' ? otherParticipant?.accountName : 'Venue'}</h3>
                                                    <h4>{otherParticipant.venueName}</h4>
                                                </div>
                                                {showArchived ? (
                                                    <button
                                                    className='btn text'
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArchiveConversation(conversation, false); // Restore to inbox
                                                    }}
                                                    >
                                                    <InboxIcon />
                                                    </button>
                                                ) : (
                                                    <button
                                                    className='btn text'
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArchiveConversation(conversation, true); // Archive
                                                    }}
                                                    >
                                                    <ArchiveIcon />
                                                    </button>
                                                )}
                                            </div>
                                            <div className='conversation-details'>
                                                <p className='last-message-preview'>
                                                    {conversation.lastMessage}
                                                </p>
                                                <h6 className='conversation-date'>
                                                    {new Date(conversation?.lastMessageTimestamp?.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </h6>
                                            </div>
                                        </div>
                                        {hasUnreadMessages && (
                                            <div className='notification-dot'>
                                                <span className="dot"></span>
                                            </div>
                                        )}
                                    </li>
                                );
                            })
                        ) :  (
                            <h4>You have no messages.</h4>
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
                                    <button
                                        className='btn tertiary'
                                        onClick={(e) =>
                                        gigData.privateApplications
                                            ? openInNewTab(
                                                `/gig/${activeConversation.gigId}?token=${gigData.privateApplicationToken}`,
                                                e
                                            )
                                            : openInNewTab(
                                                `/gig/${activeConversation.gigId}?appliedAs=${
                                                activeConversation.accountNames.find(
                                                    a => a.role === 'musician' || a.role === 'band'
                                                )?.participantId
                                                }`,
                                                e
                                            )
                                        }
                                    >
                                        <NewTabIcon />
                                    </button>
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
            </div>
        )
    }

}