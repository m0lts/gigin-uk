import { useEffect } from 'react';
import Portal from '../../shared/components/Portal';
import { CloseIcon } from '../../shared/ui/extras/Icons';
import {
  getAvatarBackgroundColor,
  getContactInitials,
  normalizeContactType,
} from './contactUtils';
import './contacts-page.css';

/** @param {string | undefined | null} raw */
function trimStr(raw) {
  return typeof raw === 'string' ? raw.trim() : '';
}

/** tel: href — digits and leading + only */
function phoneTelHref(raw) {
  const t = trimStr(raw);
  if (!t) return '#';
  const normalized = t.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '#';
}

/** Readable display; keeps sensible spacing for common UK +44 mobiles */
function formatPhoneDisplay(raw) {
  const s = trimStr(raw);
  if (!s) return '';
  const compact = s.replace(/[\s().-]/g, '');
  if (/^\+44\d{10}$/.test(compact)) {
    return `+44 ${compact.slice(3, 7)} ${compact.slice(7)}`;
  }
  if (/^\+1\d{10}$/.test(compact)) {
    return `+1 (${compact.slice(2, 5)}) ${compact.slice(5, 8)}-${compact.slice(8)}`;
  }
  return s;
}

/** Instagram profile URL from handle or pasted URL */
function instagramProfileUrl(raw) {
  const v = trimStr(raw);
  if (!v) return null;
  let h = v.replace(/^@/, '');
  if (/^https?:\/\//i.test(h)) return h.split('?')[0];
  h = h.replace(/^(www\.)?instagram\.com\//i, '').split('/')[0].replace(/^@/, '');
  return h ? `https://www.instagram.com/${h}` : null;
}

/**
 * Read-only contact details (My Contacts). Visual layout only — no data fetching.
 * @param {{
 *   entry: Record<string, unknown>;
 *   onClose: () => void;
 *   onEdit?: () => void;
 *   onViewProfile?: () => void;
 *   onInvite?: () => void;
 * }} props
 */
export function ContactDetailsModal({ entry, onClose, onEdit, onViewProfile, onInvite }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const displayName = trimStr(entry.name) || 'Unknown';
  const initials = getContactInitials(displayName);
  const avatarBg = getAvatarBackgroundColor(displayName);
  const type = normalizeContactType(entry.contactType);
  const otherDescription =
    typeof entry.otherTypeLabel === 'string' ? entry.otherTypeLabel.trim() : '';
  const onGigin = !!entry.artistId;

  const typeBadgeLabel =
    type === 'artist'
      ? 'Artist'
      : type === 'promoter'
        ? 'Promoter'
        : type === 'soundEngineer'
          ? 'Sound Engineer'
          : otherDescription || 'Other';

  const typeBadgeModifier =
    type === 'artist'
      ? 'contacts-detail-type--artist'
      : type === 'promoter'
        ? 'contacts-detail-type--promoter'
        : type === 'soundEngineer'
          ? 'contacts-detail-type--sound-engineer'
          : 'contacts-detail-type--other';

  const genre = trimStr(entry.genre);
  const email = trimStr(entry.email);
  const phone = trimStr(entry.phone);
  const instagram = trimStr(entry.instagram);
  const facebook = trimStr(entry.facebook);
  const other = trimStr(entry.other);
  const notes = typeof entry.notes === 'string' ? entry.notes.trim() : '';

  const igUrl = instagram ? instagramProfileUrl(instagram) : null;
  const fbUrl = facebook
    ? facebook.startsWith('http://') || facebook.startsWith('https://')
      ? facebook
      : `https://${facebook}`
    : null;

  const showPhoneRow = !!phone;
  const showInstagramRow = !!instagram;
  const showContactGrid = showPhoneRow && showInstagramRow;

  return (
    <Portal>
      <div className="modal add-contact-modal contacts-detail-modal" onClick={onClose}>
        <div className="modal-content scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="contacts-detail-header">
            <div className="contacts-detail-header-main">
              <div
                className="contacts-detail-avatar"
                style={{ backgroundColor: avatarBg }}
                aria-hidden
              >
                {initials}
              </div>
              <div className="contacts-detail-header-text">
                <div className="contacts-detail-name">{displayName}</div>
                <div className="contacts-detail-badges">
                  <span className={`contacts-detail-type-pill ${typeBadgeModifier}`}>
                    {typeBadgeLabel}
                  </span>
                  <span
                    className={
                      onGigin
                        ? 'contacts-detail-gigin-pill contacts-detail-gigin-pill--yes'
                        : 'contacts-detail-gigin-pill contacts-detail-gigin-pill--no'
                    }
                  >
                    {onGigin ? 'On Gigin' : 'Not on Gigin'}
                  </span>
                </div>
              </div>
            </div>
            <button type="button" className="btn icon contacts-detail-close" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          <div className="contacts-detail-header-rule" aria-hidden />

          <div className="contacts-detail-body">
            {genre ? (
              <div className="contacts-detail-field">
                <div className="contacts-detail-label">Genre</div>
                <div className="contacts-detail-value">{genre}</div>
              </div>
            ) : null}

            {email ? (
              <div className="contacts-detail-field">
                <div className="contacts-detail-label">Email</div>
                <a className="contacts-detail-value contacts-detail-value--link" href={`mailto:${email}`}>
                  {email}
                </a>
              </div>
            ) : null}

            {showContactGrid ? (
              <div className="contacts-detail-contact-grid">
                <div className="contacts-detail-field">
                  <div className="contacts-detail-label">Phone</div>
                  <a className="contacts-detail-value contacts-detail-value--link" href={phoneTelHref(entry.phone)}>
                    {formatPhoneDisplay(entry.phone)}
                  </a>
                </div>
                <div className="contacts-detail-field">
                  <div className="contacts-detail-label">Instagram</div>
                  {igUrl ? (
                    <a
                      className="contacts-detail-value contacts-detail-value--link"
                      href={igUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {/^https?:\/\//i.test(instagram) ? instagram : instagram.startsWith('@') ? instagram : `@${instagram}`}
                    </a>
                  ) : (
                    <div className="contacts-detail-value">{instagram}</div>
                  )}
                </div>
              </div>
            ) : showPhoneRow ? (
              <div className="contacts-detail-field">
                <div className="contacts-detail-label">Phone</div>
                <a className="contacts-detail-value contacts-detail-value--link" href={phoneTelHref(entry.phone)}>
                  {formatPhoneDisplay(entry.phone)}
                </a>
              </div>
            ) : showInstagramRow ? (
              <div className="contacts-detail-field">
                <div className="contacts-detail-label">Instagram</div>
                {igUrl ? (
                  <a
                    className="contacts-detail-value contacts-detail-value--link"
                    href={igUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {/^https?:\/\//i.test(instagram) ? instagram : instagram.startsWith('@') ? instagram : `@${instagram}`}
                  </a>
                ) : (
                  <div className="contacts-detail-value">{instagram}</div>
                )}
              </div>
            ) : null}

            {facebook ? (
              <div className="contacts-detail-field">
                <div className="contacts-detail-label">Facebook</div>
                <a
                  className="contacts-detail-value contacts-detail-value--link"
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {facebook}
                </a>
              </div>
            ) : null}

            {other ? (
              <div className="contacts-detail-field">
                <div className="contacts-detail-label">Other</div>
                <div className="contacts-detail-value">{other}</div>
              </div>
            ) : null}

            {notes ? (
              <div className="contacts-detail-field">
                <div className="contacts-detail-label">Notes</div>
                <div className="contacts-detail-value contacts-detail-value--notes">{notes}</div>
              </div>
            ) : null}
          </div>

          {typeof onInvite === 'function' &&
          (typeof onEdit === 'function' || typeof onViewProfile === 'function') ? (
            <div className="contacts-detail-footer">
              {typeof onViewProfile === 'function' ? (
                <button type="button" className="btn contacts-detail-footer-edit" onClick={onViewProfile}>
                  View profile
                </button>
              ) : (
                <button type="button" className="btn contacts-detail-footer-edit" onClick={onEdit}>
                  Edit contact
                </button>
              )}
              <button type="button" className="btn artist-profile contacts-detail-footer-invite" onClick={onInvite}>
                Offer Gig
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
