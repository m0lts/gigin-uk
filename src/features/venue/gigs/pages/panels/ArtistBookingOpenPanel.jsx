import React from 'react';
import { GigApplications } from '@features/venue/dashboard/GigApplications';

/**
 * Main panel for artist_booking + open status.
 * Reuses the full Gig Applications UI without the page header (handled by VenueGigPageShell).
 */
export function ArtistBookingOpenPanel(props) {
  const {
    rawGig,
    setGigInfo,
    gigs,
    venues,
    refreshGigs,
    setGigPostModal,
    setEditGigData,
    refreshStripe,
    customerDetails,
    copyToClipboard,
    showInvitesModal,
    setShowInvitesModal,
  } = props;

  return (
    <GigApplications
      rawGig={rawGig}
      setGigInfo={setGigInfo}
      skipHeader
      showInvitesModalFromParent={showInvitesModal}
      setShowInvitesModalFromParent={setShowInvitesModal}
      gigs={gigs}
      venues={venues}
      refreshGigs={refreshGigs}
      setGigPostModal={setGigPostModal}
      setEditGigData={setEditGigData}
      refreshStripe={refreshStripe}
      customerDetails={customerDetails}
      copyToClipboard={copyToClipboard}
    />
  );
}
