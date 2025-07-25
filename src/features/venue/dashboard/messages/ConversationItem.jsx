import React from 'react';
import { HouseIconLight, MicrophoneIcon, InboxIcon, ArchiveIcon } from '@features/shared/ui/extras/Icons';
import { formatDate } from '@services/utils/dates';

export const ConversationItem = ({
  conversation,
  user,
  isActive,
  onClick
}) => {
  const isBandConversation = conversation.bandConversation;

  const bandAccount = isBandConversation
    ? conversation.accountNames.find(account => account.role === 'band')
    : null;

  const musicianAccount = conversation.accountNames.find(account => account.role === 'musician');

  const yourParticipantIds = conversation.accountNames
    .filter(account => account.accountId === user.uid)
    .map(account => account.participantId);

  const otherParticipant = conversation.accountNames.find(
    account =>
      !yourParticipantIds.includes(account.participantId) &&
      ['venue', 'band', 'musician'].includes(account.role)
  );

  const musicianId = isBandConversation
    ? bandAccount?.participantId
    : musicianAccount?.participantId;

  const hasUnreadMessages =
    conversation.lastMessageTimestamp.seconds > (conversation.lastViewed?.[user.uid]?.seconds || 0) &&
    conversation?.lastMessageSenderId !== user.uid;

  return (
    <li
      className={`conversation ${isActive ? 'active' : ''}`}
      onClick={() => onClick(conversation.id, musicianId, conversation.gigId)}
    >
      <div className='conversation-text'>
        <div className='conversation-title'>
          <div className='conversation-name-icon-cont'>
            <div className='conversation-icon'>
              {otherParticipant?.role === 'venue' ? (
                otherParticipant.venueImg ? (
                  <img className='participant-img' src={otherParticipant.venueImg} alt='Venue' />
                ) : (
                  <HouseIconLight />
                )
              ) : otherParticipant?.musicianImg ? (
                <img className='participant-img' src={otherParticipant.musicianImg} alt='Musician' />
              ) : (
                <MicrophoneIcon />
              )}
            </div>
            <div className='conversation-name'>
              <h3 className='conversation-title-text'>
                {isBandConversation
                  ? otherParticipant?.role === 'venue'
                    ? otherParticipant?.accountName || 'Venue'
                    : bandAccount?.accountName || 'Band'
                  : musicianAccount?.accountName || 'Musician'}
                {otherParticipant?.venueName && (
                  <span> - {otherParticipant.venueName}</span>
                )}
              </h3>
              <h4 className='conversation-title-comp'>
                {isBandConversation
                  ? 'Band'
                  : 'Musician'}
              </h4>
            </div>
          </div>
          {hasUnreadMessages && <div className='notification-dot'></div>}
        </div>
        <div className='conversation-details'>
          <p className='last-message-preview'>{conversation.lastMessage}</p>
          <h6 className='conversation-date'>
            {new Date(conversation.lastMessageTimestamp.seconds * 1000).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short'
            })}
          </h6>
        </div>
      </div>
    </li>
  );
};

