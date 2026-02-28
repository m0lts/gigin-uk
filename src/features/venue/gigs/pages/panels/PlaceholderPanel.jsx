import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Empty-state card for gig views not yet implemented.
 * title + subtitle + optional primary CTA.
 */
export function PlaceholderPanel({ message, title, subtitle, normalisedGig, rawGig }) {
  const navigate = useNavigate();
  const displayTitle = title || (message && message.split('.')[0]) || 'Coming soon';
  const displaySubtitle = subtitle || (message && message.replace(/^[^.]*\.\s*/, '')) || 'This view is coming next.';

  const handleViewBookingDetails = () => {
    navigate(-1);
  };

  return (
    <div className="venue-gig-page-panel venue-gig-page-panel--placeholder">
      <h3 className="venue-gig-page-panel__empty-title">{displayTitle}</h3>
      <p className="venue-gig-page-panel__empty-subtitle">{displaySubtitle}</p>
      <div className="venue-gig-page-panel__empty-cta">
        <button type="button" className="btn primary" onClick={handleViewBookingDetails}>
          View booking details
        </button>
      </div>
    </div>
  );
}
