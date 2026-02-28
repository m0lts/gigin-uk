import React from 'react';
import { ArtistBookingOpenPanel } from './ArtistBookingOpenPanel';
import { PlaceholderPanel } from './PlaceholderPanel';
import { VenueHireDetailsPanel } from './VenueHireDetailsPanel';

/**
 * Resolves the main panel component for a normalised gig based on bookingMode + status.
 * Event type (kind) is display-only and does NOT drive which panel is shown.
 * Venue hire (confirmed or unconfirmed) uses the same VenueHireDetailsPanel.
 */
export function getMainPanelComponent(normalisedGig) {
  if (!normalisedGig) return () => <PlaceholderPanel message="Loading…" />;

  const { bookingMode, status } = normalisedGig;

  if (bookingMode === 'artist_booking' && status === 'open') {
    return ArtistBookingOpenPanel;
  }

  if (bookingMode === 'artist_booking' && status === 'confirmed') {
    return (props) => (
      <PlaceholderPanel
        {...props}
        title="Confirmed artist booking"
        subtitle="This view is coming next."
      />
    );
  }

  if (bookingMode === 'venue_hire') {
    return VenueHireDetailsPanel;
  }

  return (props) => (
    <PlaceholderPanel {...props} title="Coming soon" subtitle="This view is coming next." />
  );
}

export { ArtistBookingOpenPanel } from './ArtistBookingOpenPanel';
export { PlaceholderPanel } from './PlaceholderPanel';
export { VenueHireDetailsPanel } from './VenueHireDetailsPanel';
export { VenueHireConfirmedPanel } from './VenueHireConfirmedPanel';
