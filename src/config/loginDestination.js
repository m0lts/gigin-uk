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

function isVenueIntent(user) {
  const intent = signupIntent(user);
  return intent === 'venue' || intent === 'booker';
}

function artistRecords(user) {
  const stored = Array.isArray(user?.artistProfiles) ? user.artistProfiles : [];
  const objects = stored.filter((entry) => entry && typeof entry === 'object');
  const ids = [
    ...(Array.isArray(user?.artistProfileIds) ? user.artistProfileIds : []),
    ...stored.filter((entry) => typeof entry === 'string'),
  ].filter(Boolean);
  return { objects, ids };
}

function hasArtist(user) {
  const { objects, ids } = artistRecords(user);
  return objects.length > 0 || ids.length > 0;
}

/**
 * Sign-in waits until the user record and every linked profile have been read.
 * A slow profile keeps this false, so the app stays on the loading skeleton.
 */
export function accountProfilesReady({
  userLoaded = false,
  artistExpected = 0,
  artistLoaded = 0,
  venueExpected = 0,
  venueLoaded = 0,
} = {}) {
  if (!userLoaded) return false;
  if (artistLoaded < artistExpected) return false;
  if (venueLoaded < venueExpected) return false;
  return true;
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

function artistForDestination(user) {
  const { objects, ids } = artistRecords(user);
  const profiles = objects.length ? objects : ids.map((id) => ({ id }));
  return { ...user, artistProfiles: profiles };
}

function artistHome(user, features) {
  return features.keepProfile ? '/home' : artistDestination(artistForDestination(user), features);
}

/**
 * Someone who just logged in and has no artist or venue profile.
 * Only a venue signup opens the builder. Anyone else stays on the homepage.
 */
export function finishSetupPath(user, features = {}) {
  if (isArtistIntent(user) || hasArtist(user)) return artistHome(user, features);
  if (isVenueIntent(user)) return '/venues/add-venue';
  return '/';
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

  const venues = venueList(user);
  const unfinished = venues.filter((venue) => venue.completed === false);
  const finished = venues.filter((venue) => venue.completed !== false);
  const artist = isArtistIntent(user) || hasArtist(user);
  if (artist) return artistHome(user, features);
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
 * The landing header action for someone who is already signed in.
 * Setup still to do uses Continue setting up. A finished account uses Go to dashboard.
 */
export function signedInHomeAction(user, features = {}, options = {}) {
  const path = loginLandingPath(user, features, options);
  const chooser = path === '/' && !isArtistIntent(user) && !hasArtist(user) && !isVenueIntent(user) && venueList(user).length === 0;
  const settingUp = !path || chooser || String(path || '').startsWith('/venues/add-venue');
  return {
    label: settingUp ? 'Continue setting up' : 'Go to dashboard',
    path,
    chooser,
    verify: !path,
  };
}

export function accountInitials(user) {
  const name = String(user?.name || '').trim();
  const email = String(user?.email || '').trim();
  const source = name || email.split('@')[0] || '';
  const words = source.split(/[\s._-]+/).filter(Boolean);
  if (name && words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] || '?').slice(0, 2).toUpperCase();
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
  // "/" with marketing off would render this redirect again. Stay signed in.
  if (bare === '/' && !features.marketingPages) return { stay: true };
  if (bare === '/home' && !features.keepProfile) {
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
