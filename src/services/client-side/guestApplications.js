import { httpClient } from '../http/client';

const auth = false;

export function newGuestIds() {
  const applicationId = crypto.randomUUID();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const manageToken = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { applicationId, manageToken };
}

export function lookupGuestApplication({ gigId, email, phone }) {
  return httpClient.post('/guest-applications/lookup', { auth, body: { gigId, email, phone } });
}

export function sendGuestMagicLink({ gigId, email, phone }) {
  return httpClient.post('/guest-applications/magic-link', { auth, body: { gigId, email, phone } });
}

export function createGuestApplication(body) {
  return httpClient.post('/guest-applications', { auth, body });
}

export function getGuestApplication(gigId, token) {
  return httpClient.get(`/guest-applications/${encodeURIComponent(token)}`, { auth, query: { gigId } });
}

export function updateGuestApplication(token, body) {
  return httpClient.patch(`/guest-applications/${encodeURIComponent(token)}`, { auth, body });
}

export function withdrawGuestApplication(gigId, token) {
  return httpClient.post(`/guest-applications/${encodeURIComponent(token)}/withdraw`, { auth, body: { gigId } });
}

export function linkGuestApplication(gigId, token) {
  return httpClient.post(`/guest-applications/${encodeURIComponent(token)}/link`, { body: { gigId } });
}

export function decideGuestApplication({ applicationId, status }) {
  return httpClient.post('/guest-applications/decision', { body: { applicationId, status } });
}

export async function uploadGuestFile({ applicationId, file, kind }) {
  const signed = await httpClient.post('/guest-applications/upload-url', {
    auth,
    body: {
      applicationId,
      kind,
      contentType: file.type || 'application/octet-stream',
      name: file.name,
      size: file.size,
    },
  });
  const response = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!response.ok) {
    const error = new Error('Upload failed');
    error.code = 'upload';
    throw error;
  }
  return { path: signed.path, name: file.name, size: file.size, contentType: file.type };
}

export async function compressGuestPhoto(file) {
  const limit = 10 * 1024 * 1024;
  if (!file.type || !file.type.startsWith('image/') || file.type === 'image/heic' || file.type === 'image/heif') {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  const maxEdge = 2000;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob || blob.size > limit) return file.size <= limit ? file : file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
