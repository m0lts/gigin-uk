import '@styles/host/messages.styles.css'
import { useState, useEffect, useMemo, useRef } from 'react'
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
import { DeleteGigIcon, DeleteIcon, ErrorIcon, OptionsIcon } from '../../../shared/ui/extras/Icons';

export const MessagePage = ({ user, conversations = [], setConversations, venueGigs, venueProfiles }) => {
    const navigate = useNavigate();
    const [gigData, setGigData] = useState();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const paramsConversationId = queryParams.get('conversationId');
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [showArchived, setShowArchived] = useState(false);
    const [selectedVenueId, setSelectedVenueId] = useState('all');
    const [menuOpen, setMenuOpen] = useState(false);
    const [showGigModal, setShowGigModal] = useState(false);
    const menuRef = useRef();

    useResizeEffect((width) => {
        setWindowWidth(width);
    });

    const conversationsToDisplay = useMemo(() => {
        return conversations
          .filter(conv => {
            const isArchivedMatch = showArchived
                ? conv.archived?.[user?.uid] === true
                : conv.archived?.[user?.uid] !== true;
            const isVenueMatch = selectedVenueId === 'all' || (
                conv.accountNames.find(p => p.role === 'venue')?.participantId === selectedVenueId
              );
      
            return isArchivedMatch && isVenueMatch;
          })
    }, [conversations, showArchived, selectedVenueId]);

    const activeConversation = useMemo(() => {
        if (!paramsConversationId || conversationsToDisplay.length === 0) return null;
        return conversationsToDisplay.find(c => c.id === paramsConversationId) || null;
    }, [conversationsToDisplay, paramsConversationId]);

    useEffect(() => {
        if (!user || conversationsToDisplay.length === 0) return;
      
        if (activeConversation) {
          const lastViewed = activeConversation.lastViewed?.[user.uid]?.seconds || 0;
          const lastMessageTime = activeConversation.lastMessageTimestamp?.seconds || 0;
      
          if (lastMessageTime > lastViewed && activeConversation.lastMessageSenderId !== user.uid) {
            updateConversationLastViewed(activeConversation.id, user.uid).catch(err =>
              console.error('Error updating last viewed timestamp:', err)
            );
          }
        } else if (!paramsConversationId && conversationsToDisplay[0]) {
          navigate(`/venues/dashboard/messages?conversationId=${conversationsToDisplay[0].id}`);
        }
    }, [activeConversation, conversationsToDisplay, paramsConversationId, user, navigate]);

    useEffect(() => {
        const handleClickOutside = (e) => {
          if (menuRef.current && !menuRef.current.contains(e.target)) {
            setMenuOpen(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!activeConversation) return;
        if (venueGigs.length < 1) return;
        const found = venueGigs.find(g => g.gigId === activeConversation.gigId);
        if (found) {
          setGigData(found);
          return;
        }
      }, [activeConversation, venueGigs]);

    const handleSelectConversation = async (conversationId, musicianId, gigId) => {
        navigate(`/venues/dashboard/messages?conversationId=${conversationId}`);
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

    return (
        <>
            <div className="head">
                <h1 className="title">Messages</h1>
            </div>
            <div className="body messages">
                {conversations.length > 0 ? (
                    <>
                        <div className='column conversations'>
                            <div className='filters'>
                                <select
                                    className="venue-filter"
                                    value={selectedVenueId}
                                    onChange={(e) => setSelectedVenueId(e.target.value)}
                                >
                                    <option value="all">Filter By Venue</option>
                                    {venueProfiles.map(venue => (
                                        <option key={venue.id} value={venue.id}>{venue.name}</option>
                                    ))}
                                </select>
                                <button className="btn tertiary" onClick={handleShowArchived}>
                                    {showArchived ? <InboxIcon /> : <ArchiveIcon />}
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
                                        />
                                    ))
                                ) : (
                                    <div className='no-conversations'>
                                        <InboxIcon />
                                        <h4>No messages to show.</h4>
                                    </div>
                                )}
                            </ul>
                        </div>
                        <div className={`column message-thread ${!activeConversation ? 'empty' : ''}`}>
                            {activeConversation && (
                                <>
                                    <div className='top-banner'>
                                        <h3 onClick={(e) => {
                                                    openInNewTab(`/${activeConversation.accountNames.find(account => account.role === 'musician' || account.role === 'band')?.participantId}/null`, e);
                                                }}>
                                            {activeConversation.accountNames.find(account => account.accountId !== user.uid)?.accountName}
                                            <NewTabIcon />
                                        </h3>
                                        <div className='buttons' style={{ display: 'flex', alignItems: 'center', gap:5}}>
                                            <button
                                                className='btn tertiary'
                                                onClick={() => setShowGigModal(prev => !prev)}
                                                >
                                                Gig Info
                                            </button>
                                            <button
                                                className="btn icon"
                                                onClick={(e) => {
                                                e.stopPropagation();
                                                handleArchiveConversation(activeConversation, !showArchived);
                                                }}
                                            >
                                                <ArchiveIcon />
                                            </button>
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
                    </>
                ) : (
                    <div className='message-page no-messages'>
                        <MailboxEmptyIcon />
                        <h3>You have no messages</h3>
                    </div>
                )}
                {(showGigModal && activeConversation) && (
                    <div
                    className="modal"
                    onClick={() => setShowGigModal(false)}
                >
                    <div
                    className="modal-content gig-information"
                    onClick={(e) => e.stopPropagation()}
                    >   
                        <button className="btn close tertiary"
                        onClick={() => setShowGigModal(false)}>
                            Close
                        </button>
                            <GigInformation gigId={activeConversation?.gigId} gigData={gigData} setGigData={setGigData} venueGigs={venueGigs} />
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}