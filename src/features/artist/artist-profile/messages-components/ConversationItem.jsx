import React from "react";
import { ArchiveIcon, InboxIcon } from "../../../shared/ui/extras/Icons";

export const ConversationItem = ({
  conversation,
  user,
  isActive,
  onClick,            // (conversationId, musicianId, gigId) -> void
  showArchived = false,
  handleArchiveConversation,
}) => {

  // All of *my* participantIds in this conversation (could be multiple if I'm in a band)
  const yourParticipantIds = conversation.accountNames
    .filter(a => a.accountId === user.uid)
    .map(a => a.participantId);

  // Counterparty we want to display in the list item.
  // For musicians, prefer the venue card; otherwise show band/musician counterpart.
  const otherParticipant =
    conversation.accountNames.find(a => a.role === "venue") ||
    conversation.accountNames.find(
      a =>
        !yourParticipantIds.includes(a.participantId) &&
        (a.role === "band" || a.role === "musician")
    );

  // Unread indicator
  const hasUnreadMessages =
    (conversation.lastMessageTimestamp?.seconds || 0) >
      (conversation.lastViewed?.[user.uid]?.seconds || 0) &&
    conversation.lastMessageSenderId !== user.uid;


  return (
    <li
      className={`conversation ${isActive ? "active" : ""}`}
      onClick={() => onClick(conversation.id, conversation.gigId)}
    >
        <div className="conversation-icon">
            {conversation.venueImg ? (
                <img className="participant-img" src={conversation.venueImg} alt={conversation.venueName} />
            ) : (
                <div className="participant-fallback">
                    {(conversation.venueName?.[0] || "•").toUpperCase()}
                </div>
            )}
        </div>
        <div className="conversation-text">
          <div className="conversation-title">
            <h3 className="conversation-title-text">
                {conversation.venueName}
            </h3>
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

          <div className="conversation-details">
            <p className="last-message-preview">{conversation.lastMessage}</p>
            <h6 className="conversation-date">
              {new Date(
                  (conversation.lastMessageTimestamp?.seconds || 0) * 1000
                  ).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </h6>
          </div>
        </div>
          {hasUnreadMessages && (
            <div className="notification-dot">
              <span className="dot"></span>
            </div>
          )}
    </li>
  );
};