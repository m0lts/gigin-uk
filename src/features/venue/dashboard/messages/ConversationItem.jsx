import React from 'react';
import { HouseIconLight, MicrophoneIcon, InboxIcon, ArchiveIcon } from '@features/shared/ui/extras/Icons';

export const ConversationItem = ({
  conversation,
  user,
  isActive,
  onClick
}) => {
  const yourParticipantIds = (conversation.accountNames || [])
    .filter(a => a.accountId === user.uid)
    .map(a => a.participantId);

  const otherParticipant = (conversation.accountNames || []).find(
    a =>
      !yourParticipantIds.includes(a.participantId) &&
      ['venue', 'band', 'musician'].includes(a.role)
  );

  const avatarUrl =
    otherParticipant?.musicianImg ||
    otherParticipant?.accountImg ||
    (otherParticipant?.role === 'venue' ? conversation.venueImg : null);

  const hasUnreadMessages =
    (conversation.lastMessageTimestamp?.seconds || 0) >
      (conversation.lastViewed?.[user.uid]?.seconds || 0) &&
    conversation.lastMessageSenderId !== user.uid;

  const title =
    otherParticipant?.accountName ||
    (otherParticipant?.role === 'band' ? 'Band' : 'Musician');

  const subtitle =
    otherParticipant?.role === 'band'
      ? 'Band'
      : otherParticipant?.role === 'musician'
      ? 'Musician'
      : 'Venue';

  const lastMsgDate = conversation?.lastMessageTimestamp?.seconds
    ? new Date(conversation.lastMessageTimestamp.seconds * 1000)
    : null;

  return (
    <li
      className={`conversation ${isActive ? 'active' : ''}`}
      onClick={() => onClick(conversation.id)}
    >
      <div className='conversation-text'>
        <div className='conversation-title'>
          <div className='conversation-name-icon-cont'>
            <div className='conversation-icon'>
              {avatarUrl ? (
                <img className='participant-img' src={avatarUrl} alt='Participant' />
              ) : (
                // fallback icons
                otherParticipant?.role === 'venue' ? <HouseIconLight /> : <MicrophoneIcon />
              )}
            </div>
            <div className='conversation-name'>
              <h4 className='conversation-title-text'>
                {title}
                {/* keep venue suffix if you like and it exists on this participant */}
                {otherParticipant?.venueName && (
                  <span> - {otherParticipant.venueName}</span>
                )}
              </h4>
              <h5 className='conversation-title-comp'>{subtitle}</h5>
            </div>
          </div>
          {hasUnreadMessages && <div className='notification-dot'></div>}
        </div>

        <div className='conversation-details'>
          <p className='last-message-preview'>{conversation.lastMessage}</p>
          <h6 className='conversation-date'>
            {lastMsgDate
              ? lastMsgDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              : ''}
          </h6>
        </div>
      </div>
    </li>
  );
};

