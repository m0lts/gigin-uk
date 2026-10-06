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

export function nightsAreClosed(venues) {
  const list = Array.isArray(venues) ? venues.filter(Boolean) : [];
  return list.length > 0 && list.every(venueNeedsApproval);
}

export function canJoinInvitedVenue() {
  return true;
}
