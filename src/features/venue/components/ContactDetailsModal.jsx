import React from 'react';
import Portal from '@features/shared/components/Portal';
import { CloseIcon } from '@features/shared/ui/extras/Icons';
import { toast } from 'sonner';
import '@styles/host/add-performers-modal.styles.css';

/** Build Instagram profile URL from handle or URL string. */
function getInstagramProfileUrl(value) {
  if (!value || !value.trim()) return null;
  let handle = value.trim().replace(/^@/, '').replace(/^https?:\/\//, '');
  handle = handle.replace(/(www\.)?instagram\.com\//g, '').split('/')[0].split('?')[0].replace(/@/g, '').trim();
  return handle ? `https://www.instagram.com/${handle}` : null;
}

/** Ensure URL has protocol for opening in new tab. */
function ensureUrl(value) {
  if (!value || !value.trim()) return null;
  const s = value.trim();
  return s.startsWith('http://') || s.startsWith('https://') ? s : `https://${s}`;
}

/**
 * Modal showing a CRM contact's details as buttons: Email, Phone, Instagram, Facebook, Other.
 * Email opens mailto:, Phone opens tel:, Instagram/Facebook open in new tab, Other copies to clipboard.
 */
export function ContactDetailsModal({ isOpen, onClose, entry }) {
  if (!isOpen) return null;

  const hasEmail = !!(entry?.email && entry.email.trim());
  const hasPhone = !!(entry?.phone && entry.phone.trim());
  const hasInstagram = !!(entry?.instagram && entry.instagram.trim());
  const hasFacebook = !!(entry?.facebook && entry.facebook.trim());
  const hasOther = !!(entry?.other && entry.other.trim());
  const hasAny =
    hasEmail || hasPhone || hasInstagram || hasFacebook || hasOther;

  const instagramUrl = hasInstagram ? getInstagramProfileUrl(entry.instagram) : null;
  const facebookUrl = hasFacebook ? ensureUrl(entry.facebook) : null;

  const handleOtherClick = () => {
    if (!entry?.other?.trim()) return;
    const text = entry.other.trim();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard')).catch(() => toast.error("Couldn't copy"));
    } else {
      toast.info(text);
    }
  };

  return (
    <Portal>
      <div
        className="modal cancel-gig add-performers-modal"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-details-title"
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="add-performers-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 id="contact-details-title" style={{ margin: 0 }}>Contact details</h3>
            <button type="button" className="btn icon" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {entry && (
            <>
              <p style={{ margin: '0 0 1rem 0', fontSize: '1.0625rem', fontWeight: 600 }}>
                {entry.name || 'Unknown'}
              </p>
              {hasAny ? (
                <div className="contact-details-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {hasEmail && (
                    <a href={`mailto:${entry.email.trim()}`} className="btn secondary" style={{ textDecoration: 'none' }}>
                      Email
                    </a>
                  )}
                  {hasPhone && (
                    <a href={`tel:${entry.phone.trim()}`} className="btn secondary" style={{ textDecoration: 'none' }}>
                      Phone
                    </a>
                  )}
                  {hasInstagram && instagramUrl && (
                    <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="btn secondary" style={{ textDecoration: 'none' }}>
                      Instagram
                    </a>
                  )}
                  {hasFacebook && facebookUrl && (
                    <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="btn secondary" style={{ textDecoration: 'none' }}>
                      Facebook
                    </a>
                  )}
                  {hasOther && (
                    <button type="button" className="btn secondary" onClick={handleOtherClick}>
                      Other
                    </button>
                  )}
                </div>
              ) : (
                <p className="add-performers-muted" style={{ margin: 0 }}>No contact information saved.</p>
              )}
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
