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
