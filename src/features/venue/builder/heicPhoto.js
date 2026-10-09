const HEIC_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

export function isHeicFile(file) {
  const type = String(file?.type || '').split(';')[0].trim().toLowerCase();
  if (HEIC_TYPES.has(type)) return true;
  return /\.(heic|heif)$/i.test(String(file?.name || ''));
}

export async function jpegFromHeic(file) {
  const loaded = await import('heic2any');
  const heic2any = loaded.default || loaded;
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted.find((item) => item?.size) : converted;
  if (!blob?.size) throw new Error('empty heic conversion');
  const stem = String(file?.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${stem}.jpg`, {
    type: 'image/jpeg',
    lastModified: file?.lastModified || Date.now(),
  });
}
