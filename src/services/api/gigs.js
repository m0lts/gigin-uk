import { post } from '../http';

// Base: /api/gigs

export function postMultipleGigs({ venueId, gigDocuments }) {
  return post('/gigs/postMultipleGigs', { body: { venueId, gigDocuments } });
}

export function updateGigDocument({ gigId, action, updates }) {
  return post('/gigs/updateGigDocument', { body: { gigId, action, updates } });
}

export function applyToGig({ gigId, musicianProfile, inviteId }) {
  return post('/gigs/applyToGig', { body: { gigId, musicianProfile, inviteId } });
}

export function inviteToGig({ gigId, musicianProfile }) {
  return post('/gigs/inviteToGig', { body: { gigId, musicianProfile } });
}

export function negotiateGigFee({ gigId, musicianProfile, newFee, sender }) {
  return post('/gigs/negotiateGigFee', { body: { gigId, musicianProfile, newFee, sender } });
}

export function duplicateGig({ gigId }) {
  return post('/gigs/duplicateGig', { body: { gigId } });
}

export function acceptGigOffer({ gigData, musicianProfileId, nonPayableGig = false, role, inviteId }) {
  return post('/gigs/acceptGigOffer', { body: { gigData, musicianProfileId, nonPayableGig, role, inviteId } });
}

export function acceptGigOfferOM({ gigData, musicianProfileId, role, inviteId }) {
  return post('/gigs/acceptGigOfferOM', { body: { gigData, musicianProfileId, role, inviteId } });
}

export function declineGigApplication({ gigData, musicianProfileId, role = 'venue' }) {
  return post('/gigs/declineGigApplication', { body: { gigData, musicianProfileId, role } });
}

export function updateGigWithCounterOffer({ gigData, musicianProfileId, newFee, sender }) {
  return post('/gigs/updateGigWithCounterOffer', { body: { gigData, musicianProfileId, newFee, sender } });
}

export function removeGigApplicant({ gigId, musicianId }) {
  return post('/gigs/removeGigApplicant', { body: { gigId, musicianId } });
}

export function revertGigAfterCancellation({ gigData, musicianId, cancellationReason }) {
  return post('/gigs/revertGigAfterCancellation', { body: { gigData, musicianId, cancellationReason } });
}

export function revertGigAfterCancellationVenue({ gigData, musicianId, cancellationReason }) {
  return post('/gigs/revertGigAfterCancellationVenue', { body: { gigData, musicianId, cancellationReason } });
}

export function deleteGigAndInformation({ gigId }) {
  return post('/gigs/deleteGigAndInformation', { body: { gigId } });
}

export function logGigCancellation({ gigId, musicianId = null, venueId = null, reason, cancellingParty = 'musician' }) {
  return post('/gigs/logGigCancellation', { body: { gigId, musicianId, venueId, reason, cancellingParty } });
}

export function markApplicantsViewed({ venueId, gigId, applicantIds }) {
  return post('/gigs/markApplicantsViewed', { body: { venueId, gigId, applicantIds } });
}


