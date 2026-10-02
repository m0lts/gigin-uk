import { httpClient } from '../http/client';

export function createGigMediaUploadUrl({ gigId, contentType, name, size }) {
  return httpClient.post('/gig-media/upload-url', { body: { gigId, contentType, name, size } });
}

export function commitGigMedia({ gigId, path, name, contentType }) {
  return httpClient.post('/gig-media/commit', { body: { gigId, path, name, contentType } });
}

export function deleteGigMedia(gigId, mediaId) {
  return httpClient.delete(`/gig-media/item/${encodeURIComponent(gigId)}/${encodeURIComponent(mediaId)}`);
}

export function createGigMediaShare(gigId) {
  return httpClient.post(`/gig-media/${encodeURIComponent(gigId)}/share`);
}

export function revokeGigMediaShare(gigId) {
  return httpClient.delete(`/gig-media/${encodeURIComponent(gigId)}/share`);
}

export function emailGigMediaShare({ gigId, token }) {
  return httpClient.post(`/gig-media/${encodeURIComponent(gigId)}/share/email`, {
    body: { token, origin: window.location.origin },
  });
}

export function getSharedGigMedia(token) {
  return httpClient.get(`/gig-media/share/${encodeURIComponent(token)}`, { auth: false });
}

export function sharedGigMediaFileUrl(token, mediaId, { inline = false } = {}) {
  const base = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  const query = inline ? '?inline=1' : '';
  return `${base}/gig-media/share/${encodeURIComponent(token)}/file/${encodeURIComponent(mediaId)}${query}`;
}

export function sharedGigMediaZipUrl(token) {
  const base = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  return `${base}/gig-media/share/${encodeURIComponent(token)}/zip`;
}
