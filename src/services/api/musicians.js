import { post } from '../http';

export function cancelledGigMusicianProfileUpdate({ musicianId, gigId }) {
  return post('/musicians/cancelledGigMusicianProfileUpdate', { body: { musicianId, gigId } });
}

export function findPendingFeeByGigId({ musicianId, gigId }) {
  return post('/musicians/findPendingFeeByGigId', { body: { musicianId, gigId } });
}

export function markPendingFeeInDispute({ musicianId, docId, gigId, disputeReason, details, venueId }) {
  return post('/musicians/markPendingFeeInDispute', { body: { musicianId, docId, gigId, disputeReason, details, venueId } });
}

export function markInviteAsViewed({ gigId, applicantId }) {
  return post('/musicians/markInviteAsViewed', { body: { gigId, applicantId } });
}


