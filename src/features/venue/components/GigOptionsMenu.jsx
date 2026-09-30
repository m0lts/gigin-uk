import React from 'react';
import { SettingsIcon, EditIcon, CancelIcon, DeleteGigIcon, NewTabIcon, OptionsIcon } from '@features/shared/ui/extras/Icons';
import '@styles/host/gigs-calendar-react.styles.css';

/**
 * Shared Options button and dropdown for gig details – same in full page and calendar popup.
 * Renders optional preview, "Edit gig", "Cancel gig" and/or "Delete gig" based on props.
 */
export function GigOptionsMenu({
  isOpen,
  onToggle,
  menuRef,
  showPreviewGigPost,
  onPreviewGigPost,
  previewGigPostLabel = 'Preview gig post',
  previewGigPostTitle,
  /** When true, shows "Edit gig". Parent should include permission and booking rules (e.g. VenueGigPageShell `showEditGigOption`). */
  showEditGig,
  onEditGig,
  showCancelGig,
  onCancelGig,
  showDeleteGig,
  onDeleteGig,
  /** `icon` is the 34×34 ellipsis trigger used on the console gig-details bar. */
  appearance = 'default',
}) {
  const hasPreview = Boolean(showPreviewGigPost && onPreviewGigPost);
  const hasEdit = Boolean(showEditGig && onEditGig);
  const hasCancel = Boolean(showCancelGig && onCancelGig);
  const hasDelete = Boolean(showDeleteGig && onDeleteGig);
  if (!hasPreview && !hasEdit && !hasCancel && !hasDelete) {
    return null;
  }

  const icon = appearance === 'icon';
  const itemClass = icon
    ? 'venue-gig-page__menu-item'
    : 'gigs-calendar-react__venue-hire-more-menu-item';
  const dangerClass = icon
    ? ' venue-gig-page__menu-item--danger'
    : ' gigs-calendar-react__venue-hire-more-menu-item--danger';

  return (
    <div ref={menuRef} className={icon ? 'venue-gig-page__menu' : undefined} style={{ position: 'relative' }}>
      <button
        type="button"
        className={icon
          ? `venue-gig-page__icon-btn${isOpen ? ' is-open' : ''}`
          : `btn tertiary gigs-calendar-react__venue-hire-options-btn${isOpen ? ' active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Options"
      >
        {icon ? <OptionsIcon /> : (<><SettingsIcon /> Options</>)}
      </button>
      {isOpen && (
        <div
          className={icon ? 'venue-gig-page__menu-panel' : 'gigs-calendar-react__venue-hire-more-menu'}
          onClick={(e) => e.stopPropagation()}
        >
          {hasPreview && (
            <button
              type="button"
              className={itemClass}
              title={previewGigPostTitle}
              onClick={(e) => { onPreviewGigPost(e); onToggle(); }}
            >
              {previewGigPostLabel} <NewTabIcon />
            </button>
          )}
          {hasEdit && (
            <button
              type="button"
              className={itemClass}
              onClick={() => { onEditGig(); onToggle(); }}
            >
              Edit gig <EditIcon />
            </button>
          )}
          {hasCancel && (
            <button
              type="button"
              className={`${itemClass}${dangerClass}`}
              onClick={() => { onCancelGig(); onToggle(); }}
            >
              Cancel gig <CancelIcon />
            </button>
          )}
          {hasDelete && (
            <button
              type="button"
              className={`${itemClass}${dangerClass}`}
              onClick={() => { onDeleteGig(); onToggle(); }}
            >
              Delete gig <DeleteGigIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
