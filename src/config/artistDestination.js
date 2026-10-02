/**
 * Where an artist should land once the old artist app is hidden.
 * The new home is used when keep-profile is on. Otherwise the public profile.
 * A brand-new account with no profile goes to the site root.
 */
export function artistDestination(user, features = {}) {
  if (features.keepProfile) return '/home';
  const profiles = Array.isArray(user?.artistProfiles) ? user.artistProfiles : [];
  const profile = profiles.find((entry) => entry && (entry.slug || entry.id || entry.profileId));
  if (!profile) return '/';
  const ref = profile.slug || profile.id || profile.profileId;
  return ref ? `/artist/${ref}` : '/';
}

/** Stored login redirects that used to open the old artist dashboard. */
export function artistLoginRedirect(stored, user, features = {}) {
  if (!stored || stored === 'create-musician-profile') return artistDestination(user, features);
  const path = String(stored);
  const legacyDashboard = path === '/artist-profile'
    || path.startsWith('/artist-profile/')
    || path.startsWith('/artist-profile?');
  if (legacyDashboard && !features.legacyArtist) return artistDestination(user, features);
  return path;
}
