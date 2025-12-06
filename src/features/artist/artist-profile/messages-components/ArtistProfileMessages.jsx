import '@styles/artists/messages.styles.css';
import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { useBreakpoint } from '@hooks/useBreakpoint';
import {
  InboxIcon,
  ArchiveIcon,
  MailboxEmptyIcon,
} from '@features/shared/ui/extras/Icons';
import { LeftArrowIcon } from '@features/shared/ui/extras/Icons';
import { ConversationItem } from './ConversationItem';
import { MessageThread } from './MessageThread';
import {
  listenToUserConversations,
  updateConversationLastViewed,
} from '@services/client-side/conversations';
import { updateConversationDocument } from '@services/api/conversations';
import { openInNewTab } from '@services/utils/misc';
import { useArtistDashboard } from '../../../../context/ArtistDashboardContext';
import { MailboxFullIconSolid } from '../../../shared/ui/extras/Icons';
import { getGigById } from '@services/client-side/gigs';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@lib/firebase';

export const ArtistProfileMessages = () => {
  const { user } = useAuth();
  const { isLgUp } = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const { profileId: urlProfileId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [gigData, setGigData] = useState();
  const [directConversation, setDirectConversation] = useState(null);

  const { activeArtistProfile } = useArtistDashboard();
  // Use activeArtistProfile from context (which is filtered by activeProfileId prop)
  const focusProfileId = activeArtistProfile?.id || activeArtistProfile?.profileId || null;

  const queryParams = new URLSearchParams(location.search);
  const paramsConversationId = queryParams.get('conversationId');

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserConversations(
      user,
      (updatedConversations) => {
        // Filter to conversations involving the active artist profile when available
        const filtered = focusProfileId
          ? updatedConversations.filter((c) =>
              Array.isArray(c.accountNames)
                ? c.accountNames.some(
                    (a) =>
                      (a.role === 'musician' || a.role === 'band') &&
                      a.participantId === focusProfileId
                  )
                : true
            )
          : updatedConversations;

        const open = filtered
          .filter((c) => !c.archived?.[user?.uid])
          .sort(
            (a, b) =>
              (b.lastMessageTimestamp?.seconds || 0) -
              (a.lastMessageTimestamp?.seconds || 0)
          );
        const archived = filtered
          .filter((c) => c.archived?.[user?.uid])
          .sort(
            (a, b) =>
              (b.lastMessageTimestamp?.seconds || 0) -
              (a.lastMessageTimestamp?.seconds || 0)
          );

        setConversations(open);
        setArchivedConversations(archived);
      }
    );

    return unsubscribe;
  }, [user, focusProfileId]);

  // Fetch conversation directly if it's not in the filtered list but we have conversationId in URL
  useEffect(() => {
    if (!paramsConversationId || !user?.uid) {
      // Only clear directConversation if paramsConversationId is actually removed
      // Don't clear it if we still have a conversationId in the URL
      if (!paramsConversationId) {
        setDirectConversation(null);
      }
      return;
    }

    const list = showArchived ? archivedConversations : conversations;
    const foundInList = list.find((c) => c.id === paramsConversationId);
    
    // If conversation is already in the list, we can clear direct fetch
    // BUT only if the merged list will actually include it (which it should)
    if (foundInList) {
      // Don't clear immediately - wait a tick to ensure merged list is updated
      // This prevents race conditions where we clear before the merged list includes it
      const timeoutId = setTimeout(() => {
        // Double-check that the conversation is still in the list before clearing
        const currentList = showArchived ? archivedConversations : conversations;
        const stillInList = currentList.find((c) => c.id === paramsConversationId);
        if (stillInList) {
          setDirectConversation(null);
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    // If we already have the direct conversation with the correct ID, don't refetch
    if (directConversation && directConversation.id === paramsConversationId) {
      return;
    }

    // If not in list, try to fetch it directly
    let cancelled = false;
    const fetchConversation = async () => {
      try {
        const conversationRef = doc(firestore, 'conversations', paramsConversationId);
        const conversationSnap = await getDoc(conversationRef);
        
        if (!cancelled && conversationSnap.exists()) {
          const conversationData = { id: conversationSnap.id, ...conversationSnap.data() };
          // Check if user is authorized to view this conversation
          const authorizedUserIds = conversationData.authorizedUserIds || [];
          if (authorizedUserIds.includes(user.uid)) {
            setDirectConversation(conversationData);
          } else {
            setDirectConversation(null);
          }
        } else if (!cancelled) {
          setDirectConversation(null);
        }
      } catch (error) {
        console.error('Error fetching conversation directly:', error);
        if (!cancelled) setDirectConversation(null);
      }
    };

    fetchConversation();
    return () => {
      cancelled = true;
    };
  }, [paramsConversationId, user?.uid, conversations, archivedConversations, showArchived, directConversation]);

  // Merge direct conversation into the appropriate list if it's not already there
  const mergedConversations = useMemo(() => {
    if (!directConversation || !paramsConversationId) return conversations;
    // Check if conversation is already in the list
    const alreadyInList = conversations.some(c => c.id === paramsConversationId);
    if (alreadyInList) return conversations;
    // Add direct conversation to the list
    return [directConversation, ...conversations];
  }, [conversations, directConversation, paramsConversationId]);

  const mergedArchivedConversations = useMemo(() => {
    if (!directConversation || !paramsConversationId) {
      return archivedConversations;
    }
    // Check if conversation is already in the archived list
    const alreadyInList = archivedConversations.some(c => c.id === paramsConversationId);
    if (alreadyInList) return archivedConversations;
    // Add direct conversation to the archived list if it's archived
    if (directConversation.archived?.[user?.uid]) {
      return [directConversation, ...archivedConversations];
    }
    return archivedConversations;
  }, [archivedConversations, directConversation, paramsConversationId, user?.uid]);

  const activeConversation = useMemo(() => {
    if (!paramsConversationId) return null;
    
    // Prioritize directConversation if it matches the paramsConversationId
    // This ensures we show the conversation immediately when it's fetched
    if (directConversation && directConversation.id === paramsConversationId) {
      return directConversation;
    }
    
    // Otherwise, look in the merged lists
    const list = showArchived ? mergedArchivedConversations : mergedConversations;
    const found = list.find((c) => c.id === paramsConversationId);
    return found || null;
  }, [
    showArchived,
    mergedArchivedConversations,
    mergedConversations,
    paramsConversationId,
    directConversation,
  ]);

  // Load gig data whenever the active conversation changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeConversation?.gigId) {
        if (!cancelled) setGigData(undefined);
        return;
      }
      try {
        const gig = await getGigById(activeConversation.gigId);
        if (!cancelled) setGigData(gig || undefined);
      } catch (err) {
        console.error('Failed to load gig for conversation:', err);
        if (!cancelled) setGigData(undefined);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeConversation]);

  useEffect(() => {
    if (!user || !activeConversation) return;
    const lastViewed = activeConversation.lastViewed?.[user.uid]?.seconds || 0;
    const lastMessageTime =
      activeConversation.lastMessageTimestamp?.seconds || 0;
    if (
      lastMessageTime > lastViewed &&
      activeConversation.lastMessageSenderId !== user.uid
    ) {
      updateConversationLastViewed(activeConversation.id, user.uid).catch(
        (err) =>
          console.error('Error updating last viewed timestamp:', err)
      );
    }
  }, [activeConversation, user]);

  const handleSelectConversation = async (conversationId) => {
    // Include profileId in the route if it exists in the URL
    const basePath = urlProfileId 
      ? `/artist-profile/${urlProfileId}/messages`
      : '/artist-profile/messages';
    navigate(`${basePath}?conversationId=${conversationId}`);
    if (user?.uid) {
      await updateConversationLastViewed(conversationId, user.uid);
    }
  };

  const handleArchiveConversation = async (conversation, shouldArchive) => {
    if (!user?.uid) return;
    try {
      await updateConversationDocument({
        convId: conversation.id,
        updates: {
          [`archived.${user.uid}`]: shouldArchive,
        },
      });
    } catch (err) {
      console.error('Failed to archive conversation:', err);
    }
  };

  const handleShowArchived = () => {
    setShowArchived((prev) => !prev);
  };

  const hasAnyConversations =
    mergedConversations.length > 0 || mergedArchivedConversations.length > 0;
  const list = showArchived ? mergedArchivedConversations : mergedConversations;

  return (
    <div className="artist-profile-gigs-card">
      {!activeConversation ? (
        <>
          <div className="head gigs">
            <div className="title-container">
              <MailboxFullIconSolid />
              <h3 className="title">Messages</h3>
            </div>
            {hasAnyConversations && (
              <div className="filters">
                <button className="btn secondary" onClick={handleShowArchived} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {showArchived ? <InboxIcon /> : <ArchiveIcon />}
                  {showArchived ? 'Inbox' : 'Archive'}
                </button>
              </div>
            )}
          </div>
          <div className="artist-profile-gigs-content no-next-gig">
            <section className="artist-profile-gigs-section all-gigs">
              <div className="body gigs musician">
                {hasAnyConversations ? (
                  <ul className="conversations-list">
                    {list.length > 0 ? (
                      list.map((conversation) => {
                        const isActive =
                          !!(
                            activeConversation &&
                            conversation.id === activeConversation.id
                          );

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
                ) : (
                  <div className="no-messages-empty-state">
                    <MailboxEmptyIcon />
                    <h4>You have no messages yet.</h4>
                    <p>
                      When you apply to gigs or venues contact you about gigs, your conversations will
                      appear here.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="head gigs">
            <div className="title-container">
              <MailboxFullIconSolid />
              <h3 className="title">Messages</h3>
            </div>
          </div>
          <div className="artist-profile-gigs-content no-next-gig">
            <section className="artist-profile-gigs-section all-gigs">
              <div className="message-page">
                <div className="column message-thread">
                  <button
                    className="btn tertiary"
                    onClick={() => {
                      // Navigate back to messages list (remove conversationId from URL)
                      const basePath = urlProfileId 
                        ? `/artist-profile/${urlProfileId}/messages`
                        : '/artist-profile/messages';
                      navigate(basePath);
                    }}
                    style={{ marginBottom: '0.5rem' }}
                  >
                    <LeftArrowIcon /> Back
                  </button>
                  <div className="top-banner">
                    <h3>
                      {activeConversation.venueName ??
                        activeConversation.accountNames.find(
                          (a) => a.role === 'venue'
                        )?.accountName ??
                        'Venue'}
                    </h3>
                    <div
                      className="buttons"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'flex-end',
                        gap: 5,
                      }}
                    >
                      <button
                        className="btn secondary"
                        onClick={(e) =>
                          openInNewTab(
                            `/venues/${
                              activeConversation.accountNames.find(
                                (account) => account.role === 'venue'
                              )?.participantId
                            }`,
                            e
                          )
                        }
                      >
                        Venue Profile
                      </button>
                      <button
                        className="btn secondary"
                        onClick={(e) =>
                          openInNewTab(`/gig/${activeConversation.gigId}`, e)
                        }
                      >
                        View Gig
                      </button>
                    </div>
                  </div>
                  {(() => {
                    // Artist profiles now cover both bands and solo musicians.
                    // Use the first musician/band participant as the artist side id.
                    const artistAccount =
                      activeConversation.accountNames.find(
                        (account) =>
                          account.role === 'musician' || account.role === 'band'
                      );

                    return (
                      <MessageThread
                        activeConversation={activeConversation}
                        conversationId={activeConversation.id}
                        user={user}
                        musicianProfileId={artistAccount?.participantId}
                        gigId={activeConversation.gigId}
                        gigData={gigData}
                        setGigData={setGigData}
                      />
                    );
                  })()}
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};


