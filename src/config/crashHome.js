import { artistDestination } from './artistDestination.js';

function intent(user) {
  return String(user?.signupAs || user?.accountType || user?.signedUpAs || '').trim().toLowerCase();
}

function hasVenue(user) {
  return Array.isArray(user?.venueProfiles) && user.venueProfiles.some(Boolean);
}

function artistProfiles(user) {
  const stored = Array.isArray(user?.artistProfiles) ? user.artistProfiles : [];
  const objects = stored.filter((entry) => entry && typeof entry === 'object');
  if (objects.length) return objects;
  const ids = Array.isArray(user?.artistProfileIds) ? user.artistProfileIds : stored;
  return ids.filter((entry) => typeof entry === 'string' && entry).map((id) => ({ id }));
}

/**
 * Where the crash page sends someone.
 * Artists go to their own home. Venues go to the venue dashboard.
 * Signed-out people, and a signed-in account we cannot place, go to the homepage.
 */
export function crashHomeAction(user, features = {}) {
  if (!user) return { href: '/', label: 'Back to Gigin' };
  const kind = intent(user);
  if (hasVenue(user) || kind === 'venue') {
    return { href: '/venues/dashboard', label: 'Go to dashboard' };
  }
  const profiles = artistProfiles(user);
  const artist = kind === 'artist' || kind === 'musician' || profiles.length > 0;
  if (artist) {
    const href = artistDestination({ ...user, artistProfiles: profiles }, features);
    if (href && href !== '/') return { href, label: 'Go to your home' };
  }
  return { href: '/', label: 'Back to Gigin' };
}
