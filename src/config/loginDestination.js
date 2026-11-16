import { artistDestination, artistLoginRedirect } from './artistDestination.js';
import { venueNeedsApproval } from './venueAccess.js';

function signupIntent(user) {
  return String(user?.signupAs || user?.accountType || user?.signedUpAs || '').trim().toLowerCase();
}

function venueList(user) {
  return Array.isArray(user?.venueProfiles) ? user.venueProfiles.filter(Boolean) : [];
}

function isArtistIntent(user) {
  const intent = signupIntent(user);
  return intent === 'artist' || intent === 'musician';
}

/**
 * The venue builder step saved on an unfinished profile.
 * Step numbers match the builder: public venues have an equipment step.
 */
export function venueBuilderPath(profile) {
  const step = Number(profile?.currentStep) || 1;
  const isPublic = profile?.type === 'Public Establishment';
  if (step <= 1) return '/venues/add-venue';
  if (step === 2) return '/venues/add-venue/venue-details';
  if (step === 3) return isPublic ? '/venues/add-venue/equipment' : '/venues/add-venue/photos';
  if (step === 4) return isPublic ? '/venues/add-venue/photos' : '/venues/add-venue/additional-details';
  if (step === 5 && isPublic) return '/venues/add-venue/additional-details';
  return '/venues/add-venue/links';
}

/** A saved return such as a gig or an invite. Account homes are chosen from state. */
function savedReturnPath(stored, user, features) {
  if (!stored) return '';
  const path = artistLoginRedirect(stored, user, features);
  const bare = String(path || '').split('?')[0].replace(/\/$/, '') || '/';
  if (bare === '/' || bare === '/venues/add-venue' || bare === '/venues/dashboard' || bare === '/venues/dashboard/gigs' || bare === '/home') {
    return '';
  }
  return path;
}

function artistHome(user, features) {
  return features.keepProfile ? '/home' : artistDestination(user, features);
}

/**
 * Someone who just logged in and has no artist or venue profile.
 * A venue signup, or a signup we cannot tell apart, finishes the venue builder.
 * A known artist signup uses the artist destination.
 */
export function finishSetupPath(user, features = {}) {
  if (isArtistIntent(user)) return artistHome(user, features);
  return '/venues/add-venue';
}

/**
 * Where to send someone who just signed in.
 * Null means stay signed in and show the Confirm your email card.
 * A keep-profile artist often has no artistProfiles on the user doc.
 * hasArtistSession is true when getProfileSession or getArtistHome returned a profile.
 */
export function loginLandingPath(user, features = {}, { hasArtistSession = false, emailVerified = true, storedRedirect = '' } = {}) {
  if (emailVerified === false) return null;
  const saved = savedReturnPath(storedRedirect, user, features);
  if (saved) return saved;

  const profiles = Array.isArray(user?.artistProfiles) ? user.artistProfiles : [];
  if (profiles.length > 0) return artistHome(user, features);

  const venues = venueList(user);
  const unfinished = venues.filter((venue) => venue.completed === false);
  const finished = venues.filter((venue) => venue.completed !== false);
  if (isArtistIntent(user) && finished.length === 0 && unfinished.length === 0) {
    return artistHome(user, features);
  }
  if (features.keepProfile && hasArtistSession && finished.length === 0 && unfinished.length === 0) {
    return '/home';
  }
  if (finished.length === 0 && unfinished.length > 0) {
    return venueBuilderPath(unfinished[0]);
  }
  if (venues.length === 0) return finishSetupPath(user, features);
  if (finished.every((venue) => venue?.approvalStatus === 'rejected')) return '/venues/dashboard';
  if (finished.every((venue) => venueNeedsApproval(venue))) return '/venues/dashboard';
  return '/venues/dashboard/gigs';
}

/**
 * Venue home already branches on the venue status.
 * Pending shows Waiting for approval. Rejected shows the not-approved message.
 */
export function signInNotice(user) {
  const finished = venueList(user).filter((venue) => venue.completed !== false);
  if (!finished.length) return null;
  if (finished.every((venue) => venue?.approvalStatus === 'rejected')) return 'rejected';
  if (finished.every((venue) => venueNeedsApproval(venue))) return 'pending';
  return null;
}

/** Draft to reopen when sign-in lands in the venue builder. */
export function loginLandingState(user) {
  const venues = venueList(user);
  const finished = venues.some((venue) => venue.completed !== false);
  if (finished) return null;
  const draft = venues.find((venue) => venue.completed === false);
  return draft ? { venue: draft } : null;
}

/**
 * A signed-in visitor on a page that has no marketing screen.
 * Logged out opens sign-in. Unverified email opens the confirm card.
 * Everyone else goes to the same place as sign-in.
 */
export function featureRedirectTarget(user, features = {}, options = {}) {
  if (!user) return { authType: 'login' };
  const path = loginLandingPath(user, features, options);
  if (!path) return { authType: 'verify-email' };
  const bare = String(path).split('?')[0];
  // These routes render FeatureRedirect again when their flag is off.
  if ((bare === '/' && !features.marketingPages) || (bare === '/home' && !features.keepProfile)) {
    return { authType: options.emailVerified === false ? 'verify-email' : 'login' };
  }
  return { path };
}

/**
 * Where to send someone who just logged out.
 * Venue and artist accounts both go to the site root.
 * An explicit redirect (for example an invite page) is kept.
 */
export function logoutDestination(redirect = null) {
  return redirect || '/';
}
