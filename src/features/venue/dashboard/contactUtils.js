/** @typedef {'artist' | 'promoter' | 'other' | 'soundEngineer'} ContactType */

/** Stored on CRM documents (`users/.../artistCRM`). */
export const CRM_CONTACT_TYPE_VALUES = ['artist', 'promoter', 'other', 'soundEngineer'];

const SUBTITLE_TYPE_LABELS = {
  artist: 'artists',
  promoter: 'promoters',
  soundEngineer: 'sound engineers',
  other: 'others',
};

const SUBTITLE_TYPE_ORDER = ['artist', 'promoter', 'soundEngineer', 'other'];

function joinSubtitleTypes(parts) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} & ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}`;
}

const AVATAR_PALETTE = [
  '#c8e6e9',
  '#ffe0b2',
  '#e1bee7',
  '#c5e1a5',
  '#b3e5fc',
  '#ffccbc',
  '#d1c4e9',
  '#fff9c4',
  '#f8bbd0',
  '#d7ccc8',
];

/**
 * @param {string | undefined | null} name
 */
export function getContactInitials(name) {
  if (!name || !String(name).trim()) return '?';
  const words = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Stable pastel background from display name.
 * @param {string | undefined | null} name
 */
export function getAvatarBackgroundColor(name) {
  const s = String(name || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/**
 * @param {string | undefined | null} raw
 * @returns {ContactType}
 */
export function normalizeContactType(raw) {
  if (raw === 'promoter' || raw === 'other' || raw === 'soundEngineer') return raw;
  return 'artist';
}

/**
 * @param {Array<{ contactType?: string }>} entries
 */
export function formatContactsSubtitle(entries) {
  const n = entries.length;
  const typesPresent = new Set(entries.map((e) => normalizeContactType(e.contactType)));
  const labels = SUBTITLE_TYPE_ORDER.filter((k) => typesPresent.has(k)).map(
    (k) => SUBTITLE_TYPE_LABELS[k]
  );
  const typePart = joinSubtitleTypes(labels);
  const base = `${n} contact${n === 1 ? '' : 's'}`;
  return typePart ? `${base} · ${typePart}` : base;
}

/**
 * @param {import('@firebase/firestore').DocumentData | null | undefined} profile
 */
export function formatProfileAct(profile) {
  if (!profile) return '';
  if (profile.artistType === 'DJ') return 'DJ';
  const lineup = profile.techRider?.lineup;
  const n = Array.isArray(lineup) ? lineup.length : 0;
  if (n === 1) return 'solo';
  if (n === 2) return 'duo';
  if (n === 3) return 'trio';
  if (n > 3) return 'band';
  return '';
}

/**
 * @param {string | undefined | null} city
 */
function formatLocationCity(profile) {
  const loc = profile?.location;
  if (!loc || typeof loc !== 'object') return '';
  if (typeof loc.city === 'string' && loc.city.trim()) return loc.city.trim();
  if (typeof loc.label === 'string' && loc.label.trim()) return loc.label.trim();
  return '';
}

/**
 * Genre · format · location (for Gigin rows and card subtitle).
 * @param {Record<string, unknown>} entry
 * @param {import('@firebase/firestore').DocumentData | null | undefined} profile
 */
export function buildGenreFormatLocation(entry, profile) {
  const genreFromEntry = typeof entry.genre === 'string' ? entry.genre.trim() : '';
  const genres = profile?.genres;
  const genreFromProfile =
    Array.isArray(genres) && genres.length ? genres.slice(0, 2).join(', ') : '';
  const genre = genreFromEntry || genreFromProfile;

  const format = formatProfileAct(profile);

  const location = formatLocationCity(profile);

  return [genre, format, location].filter(Boolean).join(' · ');
}

/**
 * Map an `artistProfiles` document (e.g. from search) into CRM add-contact field values.
 * @param {import('@firebase/firestore').DocumentData | null | undefined} artist
 */
export function getContactFieldPrefillFromGiginArtist(artist) {
  if (!artist || typeof artist !== 'object') {
    return { genre: '', email: '', phone: '', instagram: '' };
  }
  const genres = Array.isArray(artist.genres) ? artist.genres.filter((g) => typeof g === 'string' && g.trim()) : [];
  const genre = genres.length ? genres.slice(0, 4).join(', ') : '';

  const email = typeof artist.email === 'string' ? artist.email.trim() : '';
  const phone = typeof artist.phone === 'string' ? artist.phone.trim() : '';

  let instagram = '';
  if (typeof artist.instagram === 'string' && artist.instagram.trim()) {
    instagram = artist.instagram.trim();
  } else if (typeof artist.instagramUrl === 'string' && artist.instagramUrl.trim()) {
    instagram = artist.instagramUrl.trim();
  }

  return { genre, email, phone, instagram };
}

/**
 * Fills missing CRM fields from `artistProfiles` for the read-only contact details modal.
 * @param {Record<string, unknown>} entry
 * @param {import('@firebase/firestore').DocumentData | null | undefined} profile
 */
export function mergeCrmEntryWithArtistProfileForDetails(entry, profile) {
  if (!entry || typeof entry !== 'object') return entry;
  if (!profile || typeof profile !== 'object') return entry;

  const entryGenre = typeof entry.genre === 'string' ? entry.genre.trim() : '';
  const profileGenres = Array.isArray(profile.genres)
    ? profile.genres.filter((g) => typeof g === 'string' && g.trim())
    : [];
  const genre = entryGenre || (profileGenres.length ? profileGenres.slice(0, 4).join(', ') : '');

  const email =
    (typeof entry.email === 'string' && entry.email.trim()) ||
    (typeof profile.email === 'string' && profile.email.trim()) ||
    '';

  const phone =
    (typeof entry.phone === 'string' && entry.phone.trim()) ||
    (typeof profile.phone === 'string' && profile.phone.trim()) ||
    '';

  const entryIg = typeof entry.instagram === 'string' ? entry.instagram.trim() : '';
  const profileIg =
    (typeof profile.instagram === 'string' && profile.instagram.trim()) ||
    (typeof profile.instagramUrl === 'string' && profile.instagramUrl.trim()) ||
    '';
  const instagram = entryIg || profileIg;

  const entryFb = typeof entry.facebook === 'string' ? entry.facebook.trim() : '';
  const profileFb =
    (typeof profile.facebook === 'string' && profile.facebook.trim()) ||
    (typeof profile.facebookUrl === 'string' && profile.facebookUrl.trim()) ||
    '';
  const facebook = entryFb || profileFb;

  return { ...entry, genre, email, phone, instagram, facebook };
}

/**
 * Hero / profile image URL from an artistProfiles document.
 * @param {import('@firebase/firestore').DocumentData | null | undefined} profile
 * @returns {string | null}
 */
export function getArtistProfilePhotoUrl(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const url = profile.heroMedia?.url || profile.picture;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}
