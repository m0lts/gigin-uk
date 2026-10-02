/**
 * Venue signup is invite or approval only unless openVenueCreation is on.
 * Editing a venue that already exists, and joining via venueInvites, stay open.
 */
export function canCreateVenue(features = {}, { exists = false } = {}) {
  if (exists) return true;
  return features.openVenueCreation === true;
}

export function canJoinInvitedVenue() {
  return true;
}
