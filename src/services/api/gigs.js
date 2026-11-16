import { auth } from '@lib/firebase';
import { post } from '../http';
import { joinApiUrl, normalizeBaseUrl } from '../http/url';

// Base: /api/gigs

export function postMultipleGigs({ venueId, gigDocuments }) {
  return post('/gigs/postMultipleGigs', { body: { venueId, gigDocuments } });
}

export function getGigPrivateBundle(gigIds) {
  return post('/gigs/privateBundle', { body: { gigIds } });
}

export function updateGigDocument({ gigId, action, updates }) {
  return post('/gigs/updateGigDocument', { body: { gigId, action, updates } });
}

export function applyToGig({ gigId, musicianProfile, inviteId, techSetup, applicationMessage, preferredSlotGigIds }) {
  return post('/gigs/applyToGig', { body: { gigId, musicianProfile, inviteId, techSetup, applicationMessage, preferredSlotGigIds } });
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

export function acceptNightApplication({ rootGigId, applicantId, slotGigId = null }) {
  return post(`/gigs/${rootGigId}/applications/${applicantId}/accept`, { body: { slotGigId } });
}

export function assignNightApplication({ rootGigId, applicantId, slotGigId = null }) {
  return post(`/gigs/${rootGigId}/applications/${applicantId}/assign`, { body: { slotGigId } });
}

export function declineNightApplication({ rootGigId, applicantId }) {
  return post(`/gigs/${rootGigId}/applications/${applicantId}/decline`, { body: {} });
}

export function undoNightApplication({ rootGigId, applicantId }) {
  return post(`/gigs/${rootGigId}/applications/${applicantId}/undo`, { body: {} });
}

export function closeNightApplications({ rootGigId, declineWaiting = true }) {
  return post(`/gigs/${rootGigId}/close`, { body: { declineWaiting } });
}

export function undoCloseNightApplications({ rootGigId }) {
  return post(`/gigs/${rootGigId}/close/undo`, { body: {} });
}

export function reopenNightApplications({ rootGigId }) {
  return post(`/gigs/${rootGigId}/reopen`, { body: {} });
}

export function sendPromoReminder({ rootGigId, applicantId }) {
  return post(`/gigs/${rootGigId}/promo-reminder`, { body: { applicantId } });
}

export async function downloadPromoZip({ rootGigId, applicantId, filename }) {
  const base = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL);
  const query = applicantId ? `?applicant=${encodeURIComponent(applicantId)}` : '';
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(joinApiUrl(base, `/gigs/${rootGigId}/promo.zip${query}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || payload?.message || 'Could not download the promo.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'promo.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function saveNightSoundTech({ rootGigId, soundTech }) {
  return post(`/gigs/${rootGigId}/sound-tech`, { body: { soundTech } });
}

export function cancelNight({ rootGigId, reason }) {
  return post(`/gigs/${rootGigId}/cancel`, { body: { reason: reason || '' } });
}

export function undoCancelNight({ rootGigId }) {
  return post(`/gigs/${rootGigId}/cancel/undo`, { body: {} });
}


