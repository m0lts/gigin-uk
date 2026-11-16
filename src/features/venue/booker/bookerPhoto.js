import { isHeicFile, jpegFromHeic } from '../builder/heicPhoto.js';

export const BOOKER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const BOOKER_PHOTO_COPY = {
  title: 'Add a photo of yourself',
  text: "Artists are more likely to get in touch when they can see who they're talking to. A friendly photo shows there's a real person reading their message.",
  hint: "A clear photo of your face works best: it's shown next to your name on your gigs and emails.",
};

const HEIC_READ_ERROR = "We couldn't read that photo. Try a JPG or PNG.";

export function bookerPhotoError(file) {
  if (!file) return 'Choose a photo.';
  const type = String(file.type || '').split(';')[0].trim().toLowerCase();
  if (!isHeicFile(file) && type && !type.startsWith('image/')) return 'Choose a photo.';
  if (!isHeicFile(file) && !type && !/\.(jpe?g|png|webp|gif)$/i.test(String(file.name || ''))) return 'Choose a photo.';
  if (Number(file.size) > BOOKER_PHOTO_MAX_BYTES) return 'That photo is larger than 5 MB.';
  return '';
}

/** A public photo URL. Anything else, including an email address, is left out. */
export function publicBookerPhoto(value) {
  const raw = String(value || '').trim();
  if (!/^https?:\/\//i.test(raw) || raw.includes('@')) return '';
  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1';
  if (url.protocol === 'http:' && !local) return '';
  return raw;
}

/** The venue home asks for a face when this booker and the venues on screen have none. */
export function showBookerNudge({ userPhoto, venuePhotos, dismissed }) {
  if (dismissed) return false;
  if (publicBookerPhoto(userPhoto)) return false;
  const photos = Array.isArray(venuePhotos) ? venuePhotos : [];
  if (!photos.length) return false;
  return photos.some((photo) => !publicBookerPhoto(photo));
}

export function venueIdsForBooker(profiles) {
  return [...new Set((profiles || []).map((profile) => {
    if (typeof profile === 'string') return profile;
    return profile?.id || profile?.venueId || '';
  }).filter(Boolean))];
}

async function squareJpegFile(file) {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height) || 1;
  const size = Math.min(512, side);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const sx = Math.max(0, Math.floor((bitmap.width - side) / 2));
  const sy = Math.max(0, Math.floor((bitmap.height - side) / 2));
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error(HEIC_READ_ERROR);
  return new File([blob], 'booker.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

/** HEIC becomes JPEG, then a centre square so the round frame shows the face. */
export async function prepareBookerPhoto(file) {
  const problem = bookerPhotoError(file);
  if (problem) throw new Error(problem);
  let jpeg = file;
  if (isHeicFile(file)) {
    try {
      jpeg = await jpegFromHeic(file);
    } catch {
      throw new Error(HEIC_READ_ERROR);
    }
  }
  if (jpeg.size > BOOKER_PHOTO_MAX_BYTES) throw new Error('That photo is larger than 5 MB.');
  return squareJpegFile(jpeg);
}
