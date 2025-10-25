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
    updateConversationLastViewed,
} from '@services/client-side/conversations';
import { 
    markGigApplicantAsViewed,
} from '@services/function-calls/conversations';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { openInNewTab } from '@services/utils/misc';
import { ArchiveIcon, InboxIcon } from '@features/shared/ui/extras/Icons';
import { updateConversationDocument } from '@services/function-calls/conversations';
import { DeleteGigIcon, DeleteIcon, ErrorIcon, OptionsIcon } from '../../../shared/ui/extras/Icons';
import Portal from '../../../shared/components/Portal';
import { LoadingSpinner } from '../../../shared/ui/loading/Loading';

// Given a conversation doc, return the venueId (participantId of a venue entry).
function getVenueIdFromConversation(conv) {
    const v = (conv?.accountNames || []).find(a => a?.role === 'venue');
    return v?.participantId || null; // participantId for venue entries is the venueId
  }
  
  // Return the non-venue “other party” (musician or band) account object
  function getOtherPartyAccount(conv) {
    if (!conv?.accountNames) return null;
    return (
      conv.accountNames.find(a => a?.role === 'band') ||
      conv.accountNames.find(a => a?.role === 'musician') ||
      null
    );
  }
  
  // Return musicianProfileId to use in markGigApplicantAsViewed / message thread
  function getMusicianProfileId(conv) {
    const other = getOtherPartyAccount(conv);
    return other?.participantId || null; // band: bandId, musician: musicianProfileId
  }
  
  // Defensive “last message from me?” check (works even if senderId missing)
  function lastMessageFromMe(conv, myUid) {
    const sender = conv?.lastMessageSenderId;
    return sender && sender === myUid;
  }

export const MessagePage = ({ user, conversations = [], setConversations, venueGigs, venueProfiles, customerDetails, refreshStripe }) => {
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
    const [archiving, setArchiving] = useState(false);
    const menuRef = useRef();

    useResizeEffect((width) => {
        setWindowWidth(width);
    });

    const conversationsToDisplay = useMemo(() => {
        return conversations.filter(conv => {
          const isArchivedMatch = showArchived
            ? conv.archived?.[user?.uid] === true
            : conv.archived?.[user?.uid] !== true;
      
          const convVenueId = getVenueIdFromConversation(conv);
          const isVenueMatch =
            selectedVenueId === 'all' ? true : convVenueId === selectedVenueId;
      
          return isArchivedMatch && isVenueMatch;
        });
      }, [conversations, showArchived, selectedVenueId, user?.uid]);

    const activeConversation = useMemo(() => {
        if (!paramsConversationId || conversationsToDisplay.length === 0) return null;
        return conversationsToDisplay.find(c => c.id === paramsConversationId) || null;
    }, [conversationsToDisplay, paramsConversationId]);

    useEffect(() => {
        if (!user || conversationsToDisplay.length === 0) return;
      
        if (activeConversation) {
          const lastViewedSec = activeConversation.lastViewed?.[user.uid]?.seconds || 0;
          const lastMessageSec = activeConversation.lastMessageTimestamp?.seconds || 0;
          const unseen = lastMessageSec > lastViewedSec && !lastMessageFromMe(activeConversation, user.uid);
          if (unseen) {
            updateConversationLastViewed(activeConversation.id, user.uid)
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

    const handleSelectConversation = async (conversationId) => {
        navigate(`/venues/dashboard/messages?conversationId=${conversationId}`);
        const conv = conversations.find(c => c.id === conversationId);
        const musicianId = conv ? getMusicianProfileId(conv) : null;
        try {
            await updateConversationLastViewed(conversationId, user.uid);
            if (musicianId && conv?.gigId) {
                await markGigApplicantAsViewed(conv.gigId, musicianId);
            }
        } catch (e) {
            console.error('Failed to select conversation:', e);
        }
    };

    const handleArchiveConversation = async (conversation, shouldArchive) => {
        setArchiving(true);
        try {
          await updateConversationDocument(conversation.id, {
            [`archived.${user.uid}`]: shouldArchive
          });
        } catch (err) {
          console.error("Failed to archive conversation:", err);
        } finally {
            setArchiving(false);
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
                                    {showArchived ? 'Inbox' : 'Archived'}
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
                                        <h3
                                            onClick={(e) => {
                                                const other = getOtherPartyAccount(activeConversation);
                                                if (!other) return;
                                                openInNewTab(`/${other.participantId}/${activeConversation.gigId || 'null'}`, e);
                                            }}
                                            >
                                            {getOtherPartyAccount(activeConversation)?.accountName || 'Conversation'}
                                            <NewTabIcon />
                                        </h3>
                                        <div className='buttons' style={{ display: 'flex', alignItems: 'center', gap:5}}>
                                            {gigData && (
                                                <button
                                                    className='btn tertiary'
                                                    onClick={() => setShowGigModal(prev => !prev)}
                                                    >
                                                    Gig Info
                                                </button>
                                            )}
                                            
                                            {showArchived ? (
                                                <button
                                                    className="btn tertiary"
                                                    style={{ display: 'flex', alignItems: 'center', gap:'0.5rem'}}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArchiveConversation(activeConversation, !showArchived);
                                                        setShowArchived(!showArchived)
                                                    }}
                                                >
                                                    {archiving ? (
                                                        <LoadingSpinner width={15} height={15} />
                                                    ) : (
                                                        <>
                                                            Unarchive <InboxIcon /> 
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn tertiary"
                                                    style={{ display: 'flex', alignItems: 'center', gap:'0.5rem'}}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArchiveConversation(activeConversation, !showArchived);
                                                    }}
                                                >
                                                    {archiving ? (
                                                        <LoadingSpinner width={15} height={15} />
                                                    ) : (
                                                        <>
                                                            Archive <ArchiveIcon /> 
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {(() => {
                                        return (
                                            <MessageThread
                                                activeConversation={activeConversation}
                                                conversationId={activeConversation.id}
                                                user={user}
                                                musicianProfileId={getMusicianProfileId(activeConversation)}
                                                gigId={activeConversation.gigId}
                                                gigData={gigData}
                                                setGigData={setGigData}
                                                venues={venueProfiles}
                                                customerDetails={customerDetails}
                                                refreshStripe={refreshStripe}
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
                        <h4>You have no messages</h4>
                    </div>
                )}
                {(showGigModal && activeConversation && gigData) && (
                    <Portal>
                        <div
                            className="modal gig-information"
                            onClick={() => setShowGigModal(false)}
                        >
                            <div
                                className="modal-content"
                                onClick={(e) => e.stopPropagation()}
                            >   
                                <button className="btn close tertiary"
                                    onClick={() => setShowGigModal(false)}>
                                    Close
                                </button>
                                <GigInformation gigId={activeConversation?.gigId} gigData={gigData} setGigData={setGigData} venueGigs={venueGigs} />
                            </div>
                        </div>

                    </Portal>
                )}
            </div>
        </>
    )
}