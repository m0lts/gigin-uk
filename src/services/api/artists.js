import { post } from '../http';

export function cancelledGigMusicianProfileUpdate({ musicianId, gigId }) {
  return post('/artists/cancelledGigMusicianProfileUpdate', { body: { musicianId, gigId } });
}

export function findPendingFeeByGigId({ musicianId, gigId }) {
  return post('/artists/findPendingFeeByGigId', { body: { musicianId, gigId } });
}

export function markPendingFeeInDispute({ musicianId, docId, gigId, disputeReason, details, venueId }) {
  return post('/artists/markPendingFeeInDispute', { body: { musicianId, docId, gigId, disputeReason, details, venueId } });
}

export function markInviteAsViewed({ gigId, applicantId }) {
  return post('/artists/markInviteAsViewed', { body: { gigId, applicantId } });
}

export function createArtistInvite({ artistProfileId, email, permissionsInput, invitedByName, ttlDays = 7 }) {
  return post('/artists/createArtistInvite', { body: { artistProfileId, email, permissionsInput, invitedByName, ttlDays } });
}

