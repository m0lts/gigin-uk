import React from 'react';
import { SettingsIcon, EditIcon, CancelIcon, DeleteGigIcon, NewTabIcon } from '@features/shared/ui/extras/Icons';
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
}) {
  const hasPreview = Boolean(showPreviewGigPost && onPreviewGigPost);
  const hasEdit = Boolean(showEditGig && onEditGig);
  const hasCancel = Boolean(showCancelGig && onCancelGig);
  const hasDelete = Boolean(showDeleteGig && onDeleteGig);
  if (!hasPreview && !hasEdit && !hasCancel && !hasDelete) {
    return null;
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`btn tertiary gigs-calendar-react__venue-hire-options-btn${isOpen ? ' active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Options"
      >
        <SettingsIcon /> Options
      </button>
      {isOpen && (
        <div className="gigs-calendar-react__venue-hire-more-menu" onClick={(e) => e.stopPropagation()}>
          {hasPreview && (
            <button
              type="button"
              className="gigs-calendar-react__venue-hire-more-menu-item"
              title={previewGigPostTitle}
              onClick={(e) => { onPreviewGigPost(e); onToggle(); }}
            >
              {previewGigPostLabel} <NewTabIcon />
            </button>
          )}
          {hasEdit && (
            <button
              type="button"
              className="gigs-calendar-react__venue-hire-more-menu-item"
              onClick={() => { onEditGig(); onToggle(); }}
            >
              Edit gig <EditIcon />
            </button>
          )}
          {hasCancel && (
            <button
              type="button"
              className="gigs-calendar-react__venue-hire-more-menu-item gigs-calendar-react__venue-hire-more-menu-item--danger"
              onClick={() => { onCancelGig(); onToggle(); }}
            >
              Cancel gig <CancelIcon />
            </button>
          )}
          {hasDelete && (
            <button
              type="button"
              className="gigs-calendar-react__venue-hire-more-menu-item gigs-calendar-react__venue-hire-more-menu-item--danger"
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
