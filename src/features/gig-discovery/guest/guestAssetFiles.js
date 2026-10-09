export const ASSET_LIMIT = 20 * 1024 * 1024;
export const AUDIO_LIMIT = 15 * 1024 * 1024;
export const AUDIO_CAP = 3;
export const ASSET_CAP = 5;

const IMAGE_EXT = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/heic': ['heic'],
  'image/heif': ['heif'],
};

const AUDIO_RULES = [
  { extensions: ['mp3'], types: ['audio/mpeg'], aliases: ['audio/mp3'] },
  { extensions: ['m4a'], types: ['audio/mp4', 'audio/x-m4a'], aliases: ['audio/m4a'] },
  { extensions: ['wav'], types: ['audio/wav', 'audio/x-wav'], aliases: ['audio/wave'] },
];

const AUDIO_EXTENSIONS = new Set(AUDIO_RULES.flatMap((rule) => rule.extensions));

export const SUPPORTED_FILE = 'Use a photo or PDF (up to 20 MB) or audio (MP3, M4A, WAV, up to 15 MB), or add a Spotify or YouTube link above.';

export function fileExtension(name) {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

export function sizeLabel(bytes) {
  const size = Number(bytes) || 0;
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function rawType(file) {
  return String(file?.type || '').split(';')[0].trim().toLowerCase();
}

export function declaredContentType(file) {
  const type = rawType(file);
  const ext = fileExtension(file?.name);
  const rule = AUDIO_RULES.find((item) => item.extensions.includes(ext));
  if (!rule) return type;
  if (rule.types.includes(type)) return type;
  if (!type || rule.aliases.includes(type)) return rule.types[0];
  return type;
}

export function audioRuleFor(name, contentType) {
  const ext = fileExtension(name);
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  return AUDIO_RULES.find((rule) => rule.extensions.includes(ext) && rule.types.includes(type)) || null;
}

export function isAudioAsset(asset) {
  return Boolean(audioRuleFor(asset?.name, asset?.contentType || asset?.type));
}

function unsupported(name) {
  return `${name || 'That file'} isn't supported. ${SUPPORTED_FILE}`;
}

function extensionMatchesFile(ext, type) {
  if (type === 'application/pdf') return ext === 'pdf';
  const allowed = IMAGE_EXT[type];
  return Array.isArray(allowed) && allowed.includes(ext);
}

export function guestFileProblem(file, { audioCount = 0, assetCount = 0 } = {}) {
  const name = file?.name || 'That file';
  const type = declaredContentType(file);
  const size = Number(file?.size) || 0;
  if (size <= 0) return `${name} is empty.`;
  const ext = fileExtension(name);
  const audio = audioRuleFor(name, type);
  if (audio || AUDIO_EXTENSIONS.has(ext) || rawType(file).startsWith('audio/') || type.startsWith('audio/')) {
    if (!audio) return unsupported(name);
    if (size > AUDIO_LIMIT) return `${name} is ${sizeLabel(size)}, and the limit for audio is 15 MB. Nothing else you've added has been lost.`;
    if (audioCount >= AUDIO_CAP) return `You can add up to 3 audio files. ${name} wasn't added. Nothing else you've added has been lost.`;
    if (assetCount >= ASSET_CAP) return `You can add up to 5 files. ${name} wasn't added. Nothing else you've added has been lost.`;
    return '';
  }
  const imageOrPdf = extensionMatchesFile(ext, type);
  if (!imageOrPdf) return unsupported(name);
  if (size > ASSET_LIMIT) return `${name} is ${sizeLabel(size)}, and the limit is 20 MB. Nothing else you've added has been lost.`;
  if (assetCount >= ASSET_CAP) return `You can add up to 5 files. ${name} wasn't added. Nothing else you've added has been lost.`;
  return '';
}
