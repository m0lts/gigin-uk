import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlaneTop } from '@fortawesome/pro-solid-svg-icons';
import Portal from '@features/shared/components/Portal';
import { AddressBookIcon, CloseIcon, CopyIcon, EditIcon, InviteIconSolid, ShareIcon, TickIcon } from '@features/shared/ui/extras/Icons';

/**
 * Grey tile: title, nested shareable-link card (Copy + Share), hint, footer with optional
 * visibility toggle + Confirm Manually; Share opens Contacts / Email in a submodal.
 */
export function InviteArtistPromoterTile({
  className = '',
  titleId = 'invite-artist-promoter-tile-title',
  showHeader = true,
  bookingLinkUrl,
  linkHelperText,
  onCopyLink,
  linkCopied,
  showManualOption = true,
  /** Shown bottom-left (e.g. venue profile visibility toggle). */
  footerStart = null,
  contactsButtonDisabled = false,
  emailButtonDisabled = false,
  manualButtonDisabled = false,
  sharePopupTitle = 'Share',
  contactsPopupTitle = 'Invite from Contacts',
  emailPopupTitle = 'Invite by email',
  manualPopupTitle = 'Confirm manually',
  contactsBody,
  emailBody,
  manualBody,
}) {
  const [popup, setPopup] = useState(null);

  return (
    <div className={`fill-this-slot fill-this-slot--invite-promoter ${className}`.trim()}>
      {showHeader ? (
        <div className="fill-this-slot__header fill-this-slot__header--invite-promoter">
          <FontAwesomeIcon icon={faPaperPlaneTop} className="icon" aria-hidden />
          <h3 id={titleId} className="fill-this-slot__title fill-this-slot__title--invite-promoter">
            Invite artist or promoter
          </h3>
        </div>
      ) : null}

      <div className="fill-this-slot__share-tile">
        <p className="fill-this-slot__share-tile-label">Shareable link</p>
        <div className="fill-this-slot__share-row fill-this-slot__share-row--in-tile">
          <input
            type="text"
            className="input fill-this-slot__input"
            value={bookingLinkUrl || ''}
            readOnly
            onFocus={(e) => e.target.select()}
            aria-label="Booking link"
          />
          <button
            type="button"
            className="btn secondary fill-this-slot__copy-btn fill-this-slot__copy-btn--tile"
            onClick={onCopyLink}
          >
            {linkCopied ? <TickIcon /> : <CopyIcon />}
            <span className="fill-this-slot__copy-btn-text">{linkCopied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            className="btn fill-this-slot__share-btn fill-this-slot__share-btn--tile"
            onClick={() => setPopup('share')}
          >
            <ShareIcon />
            <span className="fill-this-slot__copy-btn-text">Share</span>
          </button>
        </div>
      </div>

      {linkHelperText ? (
        <p className="fill-this-slot__invite-promoter-hint">{linkHelperText}</p>
      ) : null}

      {footerStart || showManualOption ? (
        <div
          className={`fill-this-slot__invite-footer${!footerStart && showManualOption ? ' fill-this-slot__invite-footer--manual-only' : ''}`.trim()}
        >
          {footerStart ? <div className="fill-this-slot__invite-footer-left">{footerStart}</div> : null}
          {showManualOption ? (
            <div className="fill-this-slot__invite-footer-right">
              <button
                type="button"
                className="btn fill-this-slot__invite-action-btn"
                onClick={() => setPopup('manual')}
                disabled={manualButtonDisabled}
              >
                <EditIcon /> Confirm Manually
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {popup && (
        <Portal>
          <div
            className="modal cancel-gig fill-this-slot__submodal-overlay"
            onClick={() => setPopup(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`fill-slot-submodal-${popup}`}
          >
            <div
              className="modal-content fill-this-slot__submodal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fill-this-slot__submodal-header">
                <h3 id={`fill-slot-submodal-${popup}`} className="fill-this-slot__submodal-title">
                  {popup === 'share' && sharePopupTitle}
                  {popup === 'contacts' && contactsPopupTitle}
                  {popup === 'email' && emailPopupTitle}
                  {popup === 'manual' && manualPopupTitle}
                </h3>
                <button
                  type="button"
                  className="btn icon tertiary fill-this-slot__submodal-close"
                  onClick={() => setPopup(null)}
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="fill-this-slot__submodal-body">
                {popup === 'share' && (
                  <div className="fill-this-slot__share-popup-actions">
                    <button
                      type="button"
                      className="btn fill-this-slot__invite-action-btn fill-this-slot__share-popup-action"
                      onClick={() => setPopup('contacts')}
                      disabled={contactsButtonDisabled}
                    >
                      <AddressBookIcon /> Contacts
                    </button>
                    <button
                      type="button"
                      className="btn fill-this-slot__invite-action-btn fill-this-slot__share-popup-action"
                      onClick={() => setPopup('email')}
                      disabled={emailButtonDisabled}
                    >
                      <InviteIconSolid /> Email
                    </button>
                  </div>
                )}
                {popup === 'contacts' && contactsBody}
                {popup === 'email' && emailBody}
                {popup === 'manual' && manualBody}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
