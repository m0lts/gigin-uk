import { useMemo, useState } from 'react';
import { OptionsIcon, DeleteGigIcon, SavedIcon } from '../../shared/ui/extras/Icons';
import { openInNewTab } from '@services/utils/misc';
import {
  getArtistProfilePhotoUrl,
  getAvatarBackgroundColor,
  getContactInitials,
  mergeCrmEntryWithArtistProfileForDetails,
  normalizeContactType,
} from './contactUtils';
import { ContactDetailsModal } from './ContactDetailsModal';

function instagramHref(raw) {
  if (!raw || !String(raw).trim()) return null;
  let h = String(raw).trim();
  if (/^https?:\/\//i.test(h)) return h;
  h = h.replace(/^@/, '');
  const user = h.split('/')[0].split('?')[0];
  return user ? `https://www.instagram.com/${user}` : null;
}

/**
 * @param {{
 *   entry: Record<string, unknown> & { id: string; name?: string };
 *   artistProfile: import('@firebase/firestore').DocumentData | null | undefined;
 *   menuOpen: boolean;
 *   onToggleMenu: () => void;
 *   onInvite: () => void;
 *   onEdit: () => void;
 *   onDelete: () => void;
 * }} props
 */
export function VenueCRMContactCard({
  entry,
  artistProfile,
  menuOpen,
  onToggleMenu,
  onInvite,
  onEdit,
  onDelete,
}) {
  const displayName = entry.name || 'Unknown';
  const initials = getContactInitials(displayName);
  const bg = getAvatarBackgroundColor(displayName);
  const type = normalizeContactType(entry.contactType);
  const onGigin = !!entry.artistId;

  const notes = typeof entry.notes === 'string' ? entry.notes.trim() : '';
  const email = typeof entry.email === 'string' ? entry.email.trim() : '';
  const ig = typeof entry.instagram === 'string' ? entry.instagram.trim() : '';

  const typeBadgeClass =
    type === 'artist'
      ? 'contacts-badge--type-artist'
      : type === 'promoter'
        ? 'contacts-badge--type-promoter'
        : type === 'soundEngineer'
          ? 'contacts-badge--type-sound-engineer'
          : 'contacts-badge--type-other';

  const otherDescription =
    typeof entry.otherTypeLabel === 'string' ? entry.otherTypeLabel.trim() : '';

  const typeLabel =
    type === 'artist'
      ? 'Artist'
      : type === 'promoter'
        ? 'Promoter'
        : type === 'soundEngineer'
          ? 'Sound Engineer'
          : otherDescription || 'Other';

  const [photoFailed, setPhotoFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const photoUrl =
    onGigin && artistProfile && !photoFailed ? getArtistProfilePhotoUrl(artistProfile) : null;
  const showPhoto = !!photoUrl;
  const heroY = typeof artistProfile?.heroPositionY === 'number' ? artistProfile.heroPositionY : 50;

  const detailEntry = useMemo(() => {
    if (!onGigin || !artistProfile) return entry;
    return mergeCrmEntryWithArtistProfileForDetails(entry, artistProfile);
  }, [entry, artistProfile, onGigin]);

  const openProfileOrDetails = () => {
    setDetailsOpen(true);
  };

  const onHitKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openProfileOrDetails();
  };

  const hitAriaLabel = `View full details for ${displayName}`;

  return (
    <div className="contacts-card contacts-card--interactive">
      <div
        className="contacts-card-hit-target"
        role="button"
        tabIndex={0}
        onClick={openProfileOrDetails}
        onKeyDown={onHitKeyDown}
        aria-label={hitAriaLabel}
      >
        <div
          className={`contacts-card-avatar${showPhoto ? ' contacts-card-avatar--image' : ''}`}
          style={!showPhoto ? { backgroundColor: bg } : undefined}
        >
          {showPhoto ? (
            <img
              src={photoUrl}
              alt=""
              loading="lazy"
              style={{ objectPosition: `50% ${heroY}%` }}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            initials
          )}
        </div>
        <div
          className={`contacts-card-main${!notes ? ' contacts-card-main--centered' : ''}`}
        >
          <div className="contacts-card-name-row">
            <span className="contacts-card-name">{displayName}</span>
            {onGigin ? (
              <span className="contacts-badge contacts-badge--gigin-yes">On Gigin</span>
            ) : null}
            <span className={`contacts-badge ${typeBadgeClass}`}>{typeLabel}</span>
          </div>
          {notes ? <div className="contacts-card-notes">&ldquo;{notes}&rdquo;</div> : null}
        </div>
      </div>
      <div className="contacts-card-actions">
        {email ? (
          <button
            type="button"
            className="contacts-link-pill"
            onClick={(e) => {
              e.stopPropagation();
              if (
                window.confirm(
                  `Open your email app to send a message to ${email}?`
                )
              ) {
                window.location.href = `mailto:${encodeURIComponent(email)}`;
              }
            }}
          >
            Email
          </button>
        ) : null}
        {ig ? (
          <a
            className="contacts-link-pill"
            href={instagramHref(ig) || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Instagram
          </a>
        ) : null}
        <button
          type="button"
          className="btn artist-profile contacts-invite-btn"
          onClick={(e) => {
            e.stopPropagation();
            onInvite();
          }}
        >
          Offer Gig
        </button>
        <div className="contacts-overflow-wrap">
          <button
            type="button"
            className="btn icon contacts-overflow-btn"
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
          >
            <OptionsIcon />
          </button>
          {menuOpen ? (
            <div className="contacts-overflow-menu" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                {entry.artistId ? (
                  <>
                    Unsave
                    <SavedIcon />
                  </>
                ) : (
                  <>
                    Delete
                    <DeleteGigIcon />
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {detailsOpen ? (
        <ContactDetailsModal
          entry={detailEntry}
          onClose={() => setDetailsOpen(false)}
          onEdit={
            onGigin
              ? undefined
              : () => {
                  setDetailsOpen(false);
                  onEdit();
                }
          }
          onViewProfile={
            onGigin && entry.artistId
              ? () => {
                  setDetailsOpen(false);
                  openInNewTab(`/artist/${encodeURIComponent(entry.artistId)}`, {
                    stopPropagation() {},
                  });
                }
              : undefined
          }
          onInvite={() => {
            setDetailsOpen(false);
            onInvite();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   artist: { id: string; name?: string };
 *   profile: import('@firebase/firestore').DocumentData | null | undefined;
 *   saving: boolean;
 *   onInvite: () => void;
 *   onSave: () => void;
 * }} props
 */
export function PreviouslyBookedContactCard({ artist, profile, saving, onInvite, onSave }) {
  const displayName = artist.name || profile?.name || 'Unknown';
  const initials = getContactInitials(displayName);
  const bg = getAvatarBackgroundColor(displayName);

  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUrl = profile && !photoFailed ? getArtistProfilePhotoUrl(profile) : null;
  const showPhoto = !!photoUrl;
  const heroY = typeof profile?.heroPositionY === 'number' ? profile.heroPositionY : 50;

  return (
    <div className="contacts-card contacts-card--interactive">
      <div
        className="contacts-card-hit-target"
        role="button"
        tabIndex={0}
        onClick={(e) => openInNewTab(`/artist/${encodeURIComponent(artist.id)}`, e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openInNewTab(`/artist/${encodeURIComponent(artist.id)}`, e);
          }
        }}
        aria-label={`Open ${displayName} on Gigin`}
      >
        <div
          className={`contacts-card-avatar${showPhoto ? ' contacts-card-avatar--image' : ''}`}
          style={!showPhoto ? { backgroundColor: bg } : undefined}
        >
          {showPhoto ? (
            <img
              src={photoUrl}
              alt=""
              loading="lazy"
              style={{ objectPosition: `50% ${heroY}%` }}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            initials
          )}
        </div>
        <div className="contacts-card-main contacts-card-main--centered">
          <div className="contacts-card-name-row">
            <span className="contacts-card-name">{displayName}</span>
            <span className="contacts-badge contacts-badge--gigin-yes">On Gigin</span>
            <span className="contacts-badge contacts-badge--type-artist">Artist</span>
          </div>
        </div>
      </div>
      <div className="contacts-card-actions">
        <button
          type="button"
          className="btn artist-profile contacts-invite-btn"
          onClick={(e) => {
            e.stopPropagation();
            onInvite();
          }}
        >
          Offer Gig
        </button>
        <button
          type="button"
          className="btn secondary contacts-invite-btn"
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save contact'}
        </button>
      </div>
    </div>
  );
}
