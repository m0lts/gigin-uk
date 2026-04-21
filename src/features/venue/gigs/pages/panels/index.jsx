import React from 'react';
import { PlaceholderPanel } from './PlaceholderPanel';
import { GigDetailsPanel } from './GigDetailsPanel';

/**
 * Resolves the main panel component for a normalised gig based on bookingMode + status.
 * Event type (kind) is display-only and does NOT drive which panel is shown.
 *
 * Venue hire (any state) and artist bookings in 'open' or 'confirmed' status all use
 * the unified GigDetailsPanel, which branches internally on bookingMode + status.
 * Completed / cancelled artist bookings still fall through to the placeholder until
 * those views are designed.
 */
export function getMainPanelComponent(normalisedGig) {
  if (!normalisedGig) return () => <PlaceholderPanel message="Loading…" />;

  const { bookingMode, status } = normalisedGig;

  if (bookingMode === 'artist_booking' && (status === 'open' || status === 'confirmed')) {
    return GigDetailsPanel;
  }

  if (bookingMode === 'venue_hire') {
    return GigDetailsPanel;
  }

  return (props) => (
    <PlaceholderPanel {...props} title="Coming soon" subtitle="This view is coming next." />
  );
}

export { PlaceholderPanel } from './PlaceholderPanel';
export { GigDetailsPanel } from './GigDetailsPanel';
export { VenueHireDetailsPanel } from './VenueHireConfirmedPanel';
export { VenueHireConfirmedPanel } from './VenueHireConfirmedPanel';
