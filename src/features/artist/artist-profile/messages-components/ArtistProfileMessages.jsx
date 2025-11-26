import '@styles/artists/messages.styles.css';
import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

export const ArtistProfileMessages = () => {
  const { user } = useAuth();
  const { isLgUp } = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [gigData, setGigData] = useState();

  const { activeArtistProfile } = useArtistDashboard();
  const focusProfileId = activeArtistProfile?.id || null;

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

  const activeConversation = useMemo(() => {
    const list = showArchived ? archivedConversations : conversations;
    if (!paramsConversationId || list.length === 0) return null;
    return list.find((c) => c.id === paramsConversationId) || null;
  }, [
    showArchived,
    archivedConversations,
    conversations,
    paramsConversationId,
  ]);

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
    navigate(`/artist-profile/messages?conversationId=${conversationId}`);
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

  if (conversations.length > 0 || archivedConversations.length > 0) {
    const list = showArchived ? archivedConversations : conversations;

    return (
      <div className="artist-profile-gigs-card">
        {!activeConversation ? (
          <>
            <div className="head gigs">
              <div className="title-container">
                <MailboxFullIconSolid />
                <h3 className="title">Messages</h3>
              </div>
              <div className="filters">
                <button className="btn secondary" onClick={handleShowArchived}>
                  {showArchived ? <InboxIcon /> : <ArchiveIcon />}
                  {showArchived ? 'Inbox' : 'Archive'}
                </button>
              </div>
            </div>
            <div className="artist-profile-gigs-content no-next-gig">
              <section className="artist-profile-gigs-section all-gigs">
                <div className="body gigs musician">
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
                      onClick={() => navigate(-1)}
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
                            openInNewTab(
                              `/gig/${activeConversation.gigId}`,
                              e
                            )
                          }
                        >
                          View Gig
                        </button>
                      </div>
                    </div>
                    {(() => {
                      const isBand = activeConversation.bandConversation;
                      const bandAccount = isBand
                        ? activeConversation.accountNames.find(
                            (account) => account.role === 'band'
                          )
                        : null;
                      const musicianAccount =
                        activeConversation.accountNames.find(
                          (account) => account.role === 'musician'
                        );

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
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="message-page no-messages">
      <MailboxEmptyIcon />
      <h3>You have no messages</h3>
    </div>
  );
};


