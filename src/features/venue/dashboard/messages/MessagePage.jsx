import '@styles/shared/messages.styles.css'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@hooks/useAuth';
import { 
    HouseIconLight,
    MailboxEmptyIcon,
    MicrophoneIcon,
    NewTabIcon,
} from '@features/shared/ui/extras/Icons';
import { MessageThread } from './MessageThread';
import { ConversationItem } from './ConversationItem';
import { GigInformation } from './GigInformation';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    markGigApplicantAsViewed,
    updateConversationLastViewed,
} from '@services/conversations';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { openInNewTab } from '@services/utils/misc';
import { ArchiveIcon, InboxIcon } from '@features/shared/ui/extras/Icons';
import { updateConversationDocument } from '@services/conversations';

export const MessagePage = ({ user, conversations = [], setConversations, venueGigs }) => {
    const navigate = useNavigate();
    const [gigData, setGigData] = useState();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const paramsConversationId = queryParams.get('conversationId');
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [showArchived, setShowArchived] = useState(false);

    useResizeEffect((width) => {
        setWindowWidth(width);
    });

    const activeConversation = useMemo(() => {
        if (!paramsConversationId || conversations.length === 0) return null;
        return conversations.find(c => c.id === paramsConversationId) || null;
    }, [conversations, paramsConversationId]);

    useEffect(() => {
        if (!user || conversations.length === 0) return;
      
        if (activeConversation) {
          const lastViewed = activeConversation.lastViewed?.[user.uid]?.seconds || 0;
          const lastMessageTime = activeConversation.lastMessageTimestamp?.seconds || 0;
      
          if (lastMessageTime > lastViewed && activeConversation.lastMessageSenderId !== user.uid) {
            updateConversationLastViewed(activeConversation.id, user.uid).catch(err =>
              console.error('Error updating last viewed timestamp:', err)
            );
          }
        } else if (!paramsConversationId && conversations[0]) {
          navigate(`/venues/dashboard/messages?conversationId=${conversations[0].id}`);
        }
    }, [activeConversation, conversations, paramsConversationId, user, navigate]);

    const handleSelectConversation = async (conversationId, musicianId, gigId) => {
        navigate(`/venues/dashboard/messages?conversationId=${conversationId}`);
        await updateConversationLastViewed(conversationId, user.uid);
        await markGigApplicantAsViewed(gigId, musicianId);
    };

    const handleArchiveConversation = async (conversation, shouldArchive) => {
        await updateConversationDocument(conversation.id, {
          status: shouldArchive ? 'archived' : 'open',
        });
      };

    const handleShowArchived = () => {
        setShowArchived(prev => !prev);
      };

      const conversationsToDisplay = useMemo(() => {
        return conversations.filter(conv =>
          showArchived ? conv.status === 'archived' : conv.status !== 'archived'
        );
      }, [conversations, showArchived]);

    if (conversations.length > 0) {
        return (
            <div className='message-page'>
                <div className='column conversations'>
                    <div className='top-banner'>
                        <h2>Messages</h2>
                        <button className="btn secondary" onClick={handleShowArchived}>
                            {showArchived ? <InboxIcon /> : <ArchiveIcon />}
                            {showArchived ? 'Back to Inbox' : 'View Archived'}
                        </button>
                    </div>
                    <ul className='conversations-list'>
                    {conversationsToDisplay.length > 0 ? (
                            conversationsToDisplay.map(conversation => (
                                <ConversationItem
                                    key={conversation.id}
                                    conversation={conversation}
                                    user={user}
                                    isActive={activeConversation?.id === conversation.id}
                                    onClick={handleSelectConversation}
                                    showArchived={showArchived}
                                    onArchiveToggle={handleArchiveConversation}
                                />
                            ))
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
                                <GigInformation gigId={activeConversation.gigId} gigData={gigData} setGigData={setGigData} venueGigs={venueGigs} />
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