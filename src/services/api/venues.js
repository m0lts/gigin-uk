import { post } from '../http';

// Base: /api/venues

export function transferVenueOwnership({ venueId, recipientEmail }) {
  return post('/venues/transferVenueOwnership', { body: { venueId, recipientEmail } });
}

export function fetchVenueMembersWithUsers({ venueId }) {
  return post('/venues/fetchVenueMembersWithUsers', { body: { venueId } });
}

export function acceptVenueInvite({ inviteId }) {
  return post('/venues/acceptVenueInvite', { body: { inviteId } });
}

export function createVenueInvite({ venueId, email, permissionsInput, invitedByName, ttlDays = 7 }) {
  return post('/venues/createVenueInvite', { body: { venueId, email, permissionsInput, invitedByName, ttlDays } });
}

export function updateVenueMemberPermissions({ venueId, memberUid, permissions }) {
  return post('/venues/updateVenueMemberPermissions', { body: { venueId, memberUid, permissions } });
}

export function removeVenueMember({ venueId, memberUid }) {
  return post('/venues/removeVenueMember', { body: { venueId, memberUid } });
}

export function deleteVenueData({ venueId, confirm = true }) {
  return post('/venues/deleteVenueData', { body: { venueId, confirm } });
}


