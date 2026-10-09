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

export function checkReturningGuest({ email, gigId }) {
  return httpClient.post('/guest-applications/return-check', { auth, body: { email, gigId } });
}

export function redeemReturnToken({ token, gigId }) {
  return httpClient.post('/guest-applications/return', { auth, body: { token, gigId } });
}

export function sendGuestMagicLink({ gigId, email, phone }) {
  return httpClient.post('/guest-applications/magic-link', { auth, body: { gigId, email, phone } });
}

export function createGuestApplication(body) {
  return httpClient.post('/guest-applications', { auth, body });
}

export function markSetChangeSeen(gigId, token) {
  return httpClient.post(`/guest-applications/${encodeURIComponent(token)}/seen`, { auth, body: { gigId } });
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

export function checkGuestEmailAccount(email) {
  return httpClient.post('/guest-applications/account-check', { auth: false, body: { email } });
}

export function decideGuestApplication({ applicationId, status }) {
  return httpClient.post('/guest-applications/decision', { body: { applicationId, status } });
}

function putGuestFile(url, method, headers, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method || 'PUT', url);
    Object.entries(headers).forEach(([key, value]) => {
      if (value != null) xhr.setRequestHeader(key, value);
    });
    xhr.timeout = 3 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || !event.total) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      let message = 'Upload failed';
      try {
        const body = JSON.parse(xhr.responseText || '');
        if (body?.error) message = String(body.error);
      } catch { /* a non-JSON failure is treated as a connection problem */ }
      const error = new Error(message);
      error.code = 'upload';
      reject(error);
    };
    xhr.onerror = () => {
      const error = new Error('Upload failed');
      error.code = 'upload';
      reject(error);
    };
    xhr.ontimeout = () => {
      const error = new Error('Upload failed');
      error.code = 'upload';
      reject(error);
    };
    xhr.send(file);
  });
}

export async function uploadGuestFile({ applicationId, file, kind, contentType, onProgress, gigId, manageToken, ignorePaths }) {
  const type = contentType || file.type || 'application/octet-stream';
  const signed = await httpClient.post('/guest-applications/upload-url', {
    auth,
    body: {
      applicationId,
      kind,
      contentType: type,
      name: file.name,
      size: file.size,
      ...(gigId ? { gigId } : {}),
      ...(manageToken ? { manageToken } : {}),
      ...(ignorePaths?.length ? { ignorePaths } : {}),
    },
  });
  await putGuestFile(signed.uploadUrl, signed.method || 'PUT', {
    'Content-Type': type,
    ...(signed.headers || {}),
  }, file, onProgress);
  return { path: signed.path, name: file.name, size: file.size, contentType: type };
}

export function releaseGuestUpload({ applicationId, path, gigId, manageToken }) {
  return httpClient.post('/guest-applications/delete-upload', {
    auth,
    body: {
      applicationId,
      path,
      ...(gigId ? { gigId } : {}),
      ...(manageToken ? { manageToken } : {}),
    },
  });
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
