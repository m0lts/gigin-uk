import React from 'react';

/**
 * One slot in the venue Gig Applications (artist_booking) card layout.
 * Status: Empty | Applications received | Confirmed.
 * Actions: Find artist; View applications (with count); View profile + Replace.
 */
export function SlotCard({
  slotNumber,
  status,
  applicationsCount,
  confirmedArtistName,
  gigClosed,
  canInvite,
  onFindArtist,
  onViewApplications,
  onViewProfile,
  onReplace,
  expanded,
  applicationsContent,
  onReopenGig,
  canReopenGig,
}) {
  const isEmpty = status === 'empty';
  const hasApplications = status === 'applications';
  const isConfirmed = status === 'confirmed';

  return (
    <div className="venue-slot-card venue-hire-confirmed-card">
      <div className="venue-slot-card__header">
        <h3 className="venue-hire-confirmed-card__title">Slot {slotNumber} applications</h3>
        {!isEmpty && (
          <span
            className={`venue-slot-card__status venue-slot-card__status--${status}`}
            aria-label={`Slot status: ${status === 'applications' ? 'Applications received' : 'Confirmed'}`}
          >
            {hasApplications && 'Applications received'}
            {isConfirmed && 'Confirmed'}
          </span>
        )}
      </div>

      {isEmpty && (
        <div className="venue-hire-confirmed-card__empty">
          {gigClosed ? (
            <p className="venue-hire-confirmed-card__empty-text">This gig has been closed.</p>
          ) : (
            <span
              className="venue-slot-card__status venue-slot-card__status--empty"
              aria-label="Slot status: Empty"
            >
              No applications
            </span>
          )}
          {gigClosed && canReopenGig && (
            <button type="button" className="btn primary" onClick={onReopenGig}>
              Reopen gig to applications
            </button>
          )}
        </div>
      )}

      {hasApplications && (
        <div className="venue-slot-card__applications">
          <div className="venue-slot-card__applications-actions">
            <span className="venue-slot-card__badge" aria-hidden="true">
              {applicationsCount}
            </span>
            <button
              type="button"
              className="btn secondary"
              onClick={onViewApplications}
              aria-expanded={expanded}
            >
              {expanded ? 'Hide applications' : 'View applications'}
            </button>
          </div>
          {expanded && applicationsContent && (
            <div className="venue-slot-card__applications-content">
              {applicationsContent}
            </div>
          )}
        </div>
      )}

      {isConfirmed && confirmedArtistName && (
        <div className="venue-slot-card__confirmed">
          <p className="venue-slot-card__confirmed-name">{confirmedArtistName}</p>
          <div className="venue-hire-confirmed-card__actions venue-slot-card__actions">
            {typeof onViewProfile === 'function' && (
              <button type="button" className="btn tertiary" onClick={onViewProfile}>
                View profile
              </button>
            )}
            {canInvite && (
              <button type="button" className="btn tertiary" onClick={onReplace}>
                Replace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
