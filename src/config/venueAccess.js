/**
 * Venue signup stays closed unless venueSignup is on.
 * Editing a venue that already exists, and joining via venueInvites, stay open.
 * A venue created this way is pending until the founder approves it.
 */
export function canCreateVenue(features = {}, { exists = false } = {}) {
  if (exists) return true;
  return features.venueSignup === true;
}

/** Pending and rejected venues can edit their profile and cannot book nights. */
export function venueNeedsApproval(venue) {
  const status = venue?.approvalStatus;
  return status === 'pending' || status === 'rejected';
}

export const NIGHTS_CLOSED_MESSAGE = 'Waiting for approval. You can edit your venue, but you can’t create nights yet.';

export function nightsAreClosed(venues) {
  const list = Array.isArray(venues) ? venues.filter(Boolean) : [];
  return list.length > 0 && list.every(venueNeedsApproval);
}

/**
 * A chosen venue that is pending or rejected cannot open a night.
 * With no venue chosen, nights stay closed only when every venue is waiting.
 */
export function gigCreationClosed(venues, venueId) {
  const list = Array.isArray(venues) ? venues.filter(Boolean) : [];
  if (venueId) {
    const venue = list.find((item) => item?.venueId === venueId || item?.id === venueId);
    if (venue) return venueNeedsApproval(venue);
  }
  return nightsAreClosed(list);
}

export function canJoinInvitedVenue() {
  return true;
}
