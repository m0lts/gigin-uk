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
import { ConversationItem } from './ConversationItem';

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
        const list = showArchived ? archivedConversations : conversations;
        if (!paramsConversationId || list.length === 0) return null;
        return list.find(c => c.id === paramsConversationId) || null;
      }, [showArchived, archivedConversations, conversations, paramsConversationId]);

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
        const list = showArchived ? archivedConversations : conversations;
        if (!paramsConversationId && list.length > 0) {
          navigate(`/messages?conversationId=${list[0].id}`);
        }
      }, [showArchived, archivedConversations, conversations, paramsConversationId, navigate]);
    

    const handleSelectConversation = async (conversationId, musicianId, gigId) => {
        navigate(`/messages?conversationId=${conversationId}`);
        await updateConversationLastViewed(conversationId, user.uid);
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
                        {(showArchived ? archivedConversations : conversations).length > 0 ? (
                            (showArchived ? archivedConversations : conversations).map(conversation => {
                            const isActive = !!(activeConversation && conversation.id === activeConversation.id);

                            return (
                                <ConversationItem
                                    key={conversation.id}
                                    conversation={conversation}
                                    user={user}
                                    isActive={isActive}
                                    onClick={handleSelectConversation}
                                    showArchived={showArchived}
                                    handleArchiveConversation={handleArchiveConversation}
                                />
                            );
                            })
                        ) : (
                            <h4>You have no messages.</h4>
                        )}
                    </ul>
                </div>
                <div className='column message-thread'>
                    {activeConversation && (
                        <>
                            <div className='top-banner'>
                                <h3>
                                    {activeConversation.venueName ??
                                    activeConversation.accountNames.find(a => a.role === 'venue')?.accountName ??
                                    'Venue'}
                                </h3>
                                <div className='buttons' style={{ display: 'flex', alignItems: 'center', gap:5}}>
                                    <button className='btn primary' onClick={(e) => openInNewTab(`/venues/${activeConversation.accountNames.find(account => account.role === 'venue')?.participantId}`, e)}>
                                        Venue Profile
                                    </button>
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