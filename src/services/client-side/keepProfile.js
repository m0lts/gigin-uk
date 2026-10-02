import { httpClient } from '../http/client';
import { auth } from '../../lib/firebase';

const authFree = { auth: false };

export const PROFILE_ORIGIN = 'https://giginmusic.com';

export function profileLink(slug) {
  return `${PROFILE_ORIGIN}/artist/${slug}`;
}

export function previewSlug(name) {
  const base = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'artist';
}

export function keepGuestProfile(token, body) {
  return httpClient.post(`/guest-applications/${encodeURIComponent(token)}/keep-profile`, { ...authFree, body });
}

export function dismissKeepOffer(token, gigId) {
  return httpClient.post(`/guest-applications/${encodeURIComponent(token)}/keep-dismiss`, { ...authFree, body: { gigId } });
}

export function getPendingProfile(token) {
  return httpClient.get(`/profiles/pending/${encodeURIComponent(token)}`, authFree);
}

export function savePendingProfile(token, body) {
  return httpClient.patch(`/profiles/pending/${encodeURIComponent(token)}`, { ...authFree, body });
}

export function inspectConfirm(token) {
  return httpClient.get(`/profiles/confirm/${encodeURIComponent(token)}`, authFree);
}

export function claimProfileAccount(token, body) {
  return httpClient.post(`/profiles/confirm/${encodeURIComponent(token)}`, { body });
}

export function resendConfirm(token) {
  return httpClient.post(`/profiles/confirm/${encodeURIComponent(token)}/resend`, authFree);
}

export function requestEditLink(email) {
  return httpClient.post('/profiles/edit-link', { ...authFree, body: { email } });
}

export function openEditSession(token) {
  return httpClient.post(`/profiles/edit-session/${encodeURIComponent(token)}`, authFree);
}

export function getProfileSession() {
  return httpClient.get('/profiles/session', authFree);
}

export function forgetProfileSession() {
  return httpClient.post('/profiles/session/forget', authFree);
}

export function getOwnProfile() {
  return httpClient.get('/profiles/me');
}

export function updateOwnProfile(body) {
  return httpClient.patch('/profiles/me', { body });
}

export function hideOwnProfile() {
  return httpClient.post('/profiles/me/hide');
}

export function deleteOwnProfile() {
  return httpClient.delete('/profiles/me');
}

export function getPublicProfile(slug) {
  return httpClient.get(`/profiles/public/${encodeURIComponent(slug)}`, authFree);
}

export function contactArtist(slug, body) {
  return httpClient.post(`/profiles/${encodeURIComponent(slug)}/contact`, { ...authFree, body });
}

export function redeemNudge(token) {
  return httpClient.post(`/profiles/nudge/${encodeURIComponent(token)}`, authFree);
}

export function prefillHint(email) {
  return httpClient.post('/profiles/prefill-hint', { ...authFree, body: { email } });
}

export function sendPrefillLink(email) {
  return httpClient.post('/profiles/prefill-link', { ...authFree, body: { email } });
}

export function consumePrefill(token) {
  return httpClient.post(`/profiles/prefill/${encodeURIComponent(token)}`, authFree);
}

export function getArtistHome() {
  return httpClient.get('/profiles/home');
}

export function getFinderVenues() {
  return httpClient.get('/finder/venues', authFree);
}

export function getFinderVenue(id) {
  return httpClient.get(`/finder/venues/${encodeURIComponent(id)}`, authFree);
}

export function requestArea(body) {
  return httpClient.post('/finder/area-requests', { ...authFree, body });
}

export function claimVenue(id, body) {
  return httpClient.post(`/finder/venues/${encodeURIComponent(id)}/claim`, { ...authFree, body });
}

export function sendProfileRequest(venueId, profileId) {
  return httpClient.post(`/finder/venues/${encodeURIComponent(venueId)}/profile-requests`, { body: { profileId } });
}

export function getFinderSettings(venueId) {
  return httpClient.get(`/finder/settings/${encodeURIComponent(venueId)}`);
}

export function saveFinderSettings(venueId, body) {
  return httpClient.patch(`/finder/settings/${encodeURIComponent(venueId)}`, { body });
}

export function getArtistContact(profileId, venueId) {
  return httpClient.get(`/artists/${encodeURIComponent(profileId)}/contact`, { query: { venueId } });
}

export function getPressKit(profileId, venueId) {
  return httpClient.get(`/artists/${encodeURIComponent(profileId)}/press-kit`, { query: { venueId } });
}

export function requestPressKit(profileId, venueId) {
  return httpClient.post(`/artists/${encodeURIComponent(profileId)}/press-kit/request`, { body: { venueId } });
}

export function getOwnPressKit() {
  return httpClient.get('/profiles/me/press-kit');
}

export function savePressAsset(body) {
  return httpClient.post('/profiles/me/press-kit', { body });
}

export function deletePressAsset(assetId) {
  return httpClient.delete(`/profiles/me/press-kit/${encodeURIComponent(assetId)}`);
}

export async function uploadPressFile(file, kind) {
  const signed = await httpClient.post('/profiles/me/press-kit/upload-url', {
    body: { kind, contentType: file.type, name: file.name, size: file.size },
  });
  const response = await fetch(signed.uploadUrl, {
    method: signed.method || 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!response.ok) throw new Error('Upload failed');
  return { path: signed.path, assetId: signed.assetId };
}

export async function downloadPressZip(profileId, venueId, onProgress) {
  const rawBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
  const root = String(rawBase).replace(/\/+$/, '');
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const response = await fetch(`${root}/artists/${encodeURIComponent(profileId)}/press-kit/zip`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ venueId }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.reason || 'Download failed');
    error.reason = payload.reason;
    throw error;
  }
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body?.getReader();
  if (!reader) {
    const blob = await response.blob();
    onProgress?.(1);
    return blob;
  }
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(total ? received / total : 0);
  }
  onProgress?.(1);
  return new Blob(chunks, { type: 'application/zip' });
}
