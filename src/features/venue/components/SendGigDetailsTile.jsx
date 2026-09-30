import { CopyIcon, InviteIconSolid, LinkIcon, TickIcon } from '@features/shared/ui/extras/Icons';

/**
 * Gig details: standalone tile with booking link, copy, and optional invite (contacts modal).
 */
export function SendGigDetailsTile({
  bookingLinkUrl,
  onCopyLink,
  linkCopied,
  onInviteArtist,
  showInviteButton,
}) {
  if (!bookingLinkUrl) return null;

  return (
    <div className="venue-hire-confirmed-card venue-hire-confirmed-panel__applications gig-details-tile venue-gig-send-gig-details-tile">
      <div className="venue-hire-confirmed-panel__applications-top">
        <div className="venue-hire-confirmed-panel__applications-title-row">
          <div className="venue-hire-confirmed-panel__applications-title-block fill-this-slot__header fill-this-slot__header--invite-promoter">
            <LinkIcon />
            <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter">Send gig details</h3>
          </div>
        </div>
      </div>
      <div className="venue-hire-confirmed-panel__applications-body">
        <div className="invite-and-share-modal__share-row venue-gig-applications-empty__gig-link-row">
          <input
            type="text"
            className="input invite-and-share-modal__share-input"
            value={bookingLinkUrl}
            readOnly
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.target.select()}
            aria-label="Gig link"
          />
          <button type="button" className="btn secondary invite-and-share-modal__copy-btn" onClick={onCopyLink}>
            {linkCopied ? (
              <>
                <TickIcon /> Copied
              </>
            ) : (
              <>
                <CopyIcon /> Copy
              </>
            )}
          </button>
          {showInviteButton && typeof onInviteArtist === 'function' ? (
            <button
              type="button"
              className="btn artist-profile venue-gig-applications-empty__preview-btn"
              onClick={onInviteArtist}
            >
              <InviteIconSolid /> Invite
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
