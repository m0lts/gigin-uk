import { get, post } from '../http';

export function createOwnVenue(body) {
  return post('/venues', { body });
}

export function requestVenueApproval(venueId) {
  return post(`/venues/${venueId}/request-approval`, { body: {} });
}

export function getVenueApproval(token) {
  return get(`/venues/approval/${encodeURIComponent(token)}`, { auth: false });
}

export function decideVenueApproval(token, decision) {
  return post(`/venues/approval/${encodeURIComponent(token)}`, { auth: false, body: { decision } });
}

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

export async function fetchGigTemplates({ venueIds }) {
  const data = await post('/venues/fetchGigTemplates', { body: { venueIds: venueIds || [] } });
  return Array.isArray(data) ? data : [];
}

export async function saveGigTemplate({ templateData }) {
  const data = await post('/venues/saveGigTemplate', { body: { templateData } });
  return data?.templateId;
}

export async function deleteGigTemplate({ templateId }) {
  await post('/venues/deleteGigTemplate', { body: { templateId } });
}

export async function renameGigTemplate({ templateId, templateName }) {
  await post('/venues/renameGigTemplate', { body: { templateId, templateName } });
}

