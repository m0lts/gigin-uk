import { artistDestination } from './artistDestination.js';

function signupIntent(user) {
  return String(user?.signupAs || user?.accountType || user?.signedUpAs || '').trim().toLowerCase();
}

/**
 * Someone who just logged in and has no artist or venue profile.
 * A venue signup, or a signup we cannot tell apart, finishes the venue builder.
 * A known artist signup uses the artist destination.
 */
export function finishSetupPath(user, features = {}) {
  const intent = signupIntent(user);
  if (intent === 'artist' || intent === 'musician') {
    return features.keepProfile ? '/home' : artistDestination(user, features);
  }
  return '/venues/add-venue';
}

/**
 * Where to send someone who just logged in.
 * A keep-profile artist often has no artistProfiles on the user doc.
 * hasArtistSession is true when getProfileSession or getArtistHome returned a profile.
 * That check happens before the venue-builder path.
 */
export function loginLandingPath(user, features = {}, { hasArtistSession = false } = {}) {
  if (Array.isArray(user?.artistProfiles) && user.artistProfiles.length > 0) {
    return features.keepProfile ? '/home' : artistDestination(user, features);
  }
  if (Array.isArray(user?.venueProfiles) && user.venueProfiles.length > 0) {
    return '/venues/dashboard';
  }
  if (features.keepProfile && hasArtistSession) return '/home';
  return finishSetupPath(user, features);
}

/**
 * Where to send someone who just logged out.
 * Venue and artist accounts both go to the site root.
 * An explicit redirect (for example an invite page) is kept.
 */
export function logoutDestination(redirect = null) {
  return redirect || '/';
}
