import { get, post, put, del } from '../http';

/**
 * Get all invites for a gig
 */
export const getGigInvites = async (gigId) => {
  const response = await get('/gigs/invites', { query: { gigId } });
  return response || [];
};

/**
 * Create a new gig invite
 */
export const createGigInvite = async ({ gigId, expiresAt, artistId, crmEntryId, artistName }) => {
  const response = await post('/gigs/invites', { body: { gigId, expiresAt, artistId, crmEntryId, artistName } });
  return response;
};

/**
 * Update a gig invite
 */
export const updateGigInvite = async ({ inviteId, active, expiresAt }) => {
  const response = await put(`/gigs/invites/${inviteId}`, { body: { active, expiresAt } });
  return response;
};

/**
 * Delete a gig invite
 */
export const deleteGigInvite = async (inviteId) => {
  const response = await del(`/gigs/invites/${inviteId}`);
  return response;
};
