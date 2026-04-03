import React from 'react';
import { SettingsIcon, EditIcon, CancelIcon, DeleteGigIcon } from '@features/shared/ui/extras/Icons';
import '@styles/host/gigs-calendar-react.styles.css';

/**
 * Shared Options button and dropdown for gig details – same in full page and calendar popup.
 * Renders "Edit gig", "Cancel gig" and/or "Delete gig" based on props.
 */
export function GigOptionsMenu({
  isOpen,
  onToggle,
  menuRef,
  canUpdate,
  showEditGig,
  onEditGig,
  showCancelGig,
  onCancelGig,
  showDeleteGig,
  onDeleteGig,
}) {
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
          {showEditGig && canUpdate && (
            <button
              type="button"
              className="gigs-calendar-react__venue-hire-more-menu-item"
              onClick={() => { onEditGig(); onToggle(); }}
            >
              Edit gig <EditIcon />
            </button>
          )}
          {showCancelGig && (
            <button
              type="button"
              className="gigs-calendar-react__venue-hire-more-menu-item gigs-calendar-react__venue-hire-more-menu-item--danger"
              onClick={() => { onCancelGig(); onToggle(); }}
            >
              Cancel gig <CancelIcon />
            </button>
          )}
          {showDeleteGig && (
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
