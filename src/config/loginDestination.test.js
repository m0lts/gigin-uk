import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { accountInitials, accountProfilesReady, featureRedirectTarget, finishSetupPath, loginLandingPath, loginLandingState, logoutDestination, signInNotice, signedInHomeAction, venueBuilderPath } from './loginDestination.js';

test('a login with no profile stays on the homepage unless they book live music', () => {
  assert.equal(finishSetupPath({}), '/');
  assert.equal(finishSetupPath({ artistProfiles: [], venueProfiles: [] }), '/');
  assert.equal(finishSetupPath({ signupAs: 'venue' }), '/venues/add-venue');
  assert.equal(finishSetupPath({ accountType: '' }), '/');
  assert.equal(loginLandingPath({ email: 'a@gigin.com' }), '/');
  assert.equal(signedInHomeAction({ email: 'a@gigin.com' }).label, 'Continue setting up');
  assert.equal(signedInHomeAction({ email: 'a@gigin.com' }).chooser, true);
  assert.equal(signedInHomeAction({ email: 'a@gigin.com' }).path, '/');
});

test('artist sign-in opens the artist home', () => {
  assert.equal(
    loginLandingPath({ signupAs: 'artist', artistProfiles: [{ id: 'abc', slug: 'the-act' }] }, { keepProfile: false }),
    '/artist/the-act',
  );
  assert.equal(
    loginLandingPath({ artistProfileIds: ['abc'], artistProfiles: [{ id: 'abc' }] }, { keepProfile: true }),
    '/home',
  );
  assert.equal(loginLandingPath({ signupAs: 'artist' }, { keepProfile: true }), '/home');
});

test('venue sign-in opens the venue home', () => {
  assert.equal(loginLandingPath({ signupAs: 'venue', venueProfiles: [] }), '/venues/add-venue');
  assert.equal(
    loginLandingPath({ signupAs: 'venue', venueProfiles: [{ id: 'venue-1', completed: true, approvalStatus: 'approved' }] }),
    '/venues/dashboard/gigs',
  );
  assert.equal(
    loginLandingPath({ venueProfiles: [{ id: 'venue-1', completed: false, currentStep: 2 }] }),
    '/venues/add-venue/venue-details',
  );
});

test('a slow-loading profile waits instead of opening the venue builder', () => {
  assert.equal(accountProfilesReady({
    userLoaded: true,
    artistExpected: 1,
    artistLoaded: 0,
    venueExpected: 0,
    venueLoaded: 0,
  }), false);
  assert.equal(accountProfilesReady({
    userLoaded: false,
    artistExpected: 0,
    artistLoaded: 0,
    venueExpected: 1,
    venueLoaded: 0,
  }), false);
  assert.equal(accountProfilesReady({
    userLoaded: true,
    artistExpected: 1,
    artistLoaded: 1,
    venueExpected: 1,
    venueLoaded: 1,
  }), true);
  const pending = { email: 'a@gigin.com', artistProfileIds: ['abc'], artistProfiles: [] };
  assert.equal(accountProfilesReady({
    userLoaded: true,
    artistExpected: 1,
    artistLoaded: 0,
    venueExpected: 0,
    venueLoaded: 0,
  }), false);
  assert.notEqual(loginLandingPath({ ...pending, artistProfiles: [{ id: 'abc' }] }, { keepProfile: false }), '/venues/add-venue');
  assert.equal(loginLandingPath({ ...pending, artistProfiles: [{ id: 'abc' }] }, { keepProfile: false }), '/artist/abc');
});

test('a keep-profile login with no artistProfiles on the user doc goes home', () => {
  const user = { artistProfiles: [], venueProfiles: [] };
  const features = { keepProfile: true };
  assert.equal(loginLandingPath(user, features, { hasArtistSession: false }), '/');
  assert.equal(loginLandingPath(user, features, { hasArtistSession: true }), '/home');
  assert.equal(loginLandingPath({}, features, { hasArtistSession: true }), '/home');
  assert.equal(
    loginLandingPath({ venueProfiles: [{ id: 'venue-1' }] }, features, { hasArtistSession: true }),
    '/venues/dashboard/gigs',
  );
});

test('logout sends a venue and an artist to the site root', () => {
  assert.equal(logoutDestination(), '/');
  assert.equal(logoutDestination(null), '/');
  assert.equal(logoutDestination('/join-venue?invite=abc'), '/join-venue?invite=abc');
});

test('a known artist signup still uses the artist destination', () => {
  assert.equal(finishSetupPath({ signupAs: 'artist' }, { keepProfile: true }), '/home');
  assert.equal(finishSetupPath({ signedUpAs: 'musician' }, { keepProfile: false }), '/');
  assert.equal(loginLandingPath({ signupAs: 'artist' }, { keepProfile: true }), '/home');
  assert.equal(
    loginLandingPath({ artistProfiles: [{ id: 'abc', slug: 'the-act' }] }, { keepProfile: false }),
    '/artist/the-act',
  );
});

test('an unverified email stays signed in on the confirm card', () => {
  assert.equal(loginLandingPath({ signupAs: 'venue' }, {}, { emailVerified: false }), null);
  assert.equal(
    loginLandingPath({ venueProfiles: [{ id: 'venue-1', approvalStatus: 'approved' }] }, {}, { emailVerified: false }),
    null,
  );
  assert.deepEqual(featureRedirectTarget({ uid: 'a' }, {}, { emailVerified: false }), { authType: 'verify-email' });
});

test('a verified venue account with no venue opens the builder', () => {
  assert.equal(loginLandingPath({ signupAs: 'venue', venueProfiles: [] }), '/venues/add-venue');
  assert.equal(loginLandingPath({ email: 'a@gigin.com' }), '/');
  assert.equal(loginLandingState({ venueProfiles: [] }), null);
});

test('an unfinished venue reopens the builder at the saved step', () => {
  const draft = { id: 'venue-1', completed: false, currentStep: 3, type: 'Public Establishment', name: 'The Room' };
  assert.equal(venueBuilderPath(draft), '/venues/add-venue/equipment');
  assert.equal(loginLandingPath({ venueProfiles: [draft] }), '/venues/add-venue/equipment');
  assert.deepEqual(loginLandingState({ venueProfiles: [draft] }), { venue: draft });
  assert.equal(
    venueBuilderPath({ completed: false, currentStep: 3, type: 'Private Event' }),
    '/venues/add-venue/photos',
  );
  assert.equal(venueBuilderPath({ completed: false, currentStep: 2 }), '/venues/add-venue/venue-details');
});

test('a pending venue opens venue home', () => {
  const user = { venueProfiles: [{ id: 'venue-1', completed: true, approvalStatus: 'pending', name: 'The Room' }] };
  assert.equal(loginLandingPath(user), '/venues/dashboard');
  assert.equal(signInNotice(user), 'pending');
});

test('a rejected venue opens venue home for the not-approved message', () => {
  const user = { venueProfiles: [{ id: 'venue-1', completed: true, approvalStatus: 'rejected' }] };
  assert.equal(loginLandingPath(user), '/venues/dashboard');
  assert.equal(signInNotice(user), 'rejected');
});

test('an approved venue opens the gigs dashboard', () => {
  assert.equal(
    loginLandingPath({ venueProfiles: [{ id: 'venue-1', completed: true, approvalStatus: 'approved' }] }),
    '/venues/dashboard/gigs',
  );
  assert.equal(loginLandingPath({ venueProfiles: [{ id: 'venue-1' }] }), '/venues/dashboard/gigs');
  assert.equal(signInNotice({ venueProfiles: [{ id: 'venue-1', approvalStatus: 'approved' }] }), null);
});

test('a stored landing path does not override the account state', () => {
  const approved = { venueProfiles: [{ id: 'venue-1', approvalStatus: 'approved' }] };
  assert.equal(loginLandingPath(approved, {}, { storedRedirect: '/' }), '/venues/dashboard/gigs');
  assert.equal(loginLandingPath({ signupAs: 'venue' }, {}, { storedRedirect: '/' }), '/venues/add-venue');
  assert.equal(
    loginLandingPath(approved, {}, { storedRedirect: '/gig/night-1' }),
    '/gig/night-1',
  );
});

test('the landing header offers setup or the dashboard', () => {
  assert.deepEqual(signedInHomeAction({ signupAs: 'venue', name: 'Maya Reid' }), {
    label: 'Continue setting up',
    path: '/venues/add-venue',
    chooser: false,
    verify: false,
  });
  assert.equal(signedInHomeAction({ signupAs: 'venue' }, {}, { emailVerified: false }).label, 'Continue setting up');
  assert.equal(signedInHomeAction({ signupAs: 'venue' }, {}, { emailVerified: false }).verify, true);
  const pending = { venueProfiles: [{ id: 'venue-1', completed: true, approvalStatus: 'pending' }] };
  assert.equal(signedInHomeAction(pending).label, 'Go to dashboard');
  assert.equal(signedInHomeAction(pending).path, '/venues/dashboard');
  assert.equal(
    signedInHomeAction({ venueProfiles: [{ id: 'venue-1', approvalStatus: 'approved' }] }).path,
    '/venues/dashboard/gigs',
  );
  assert.equal(signedInHomeAction({ signupAs: 'artist' }, { keepProfile: true }).path, '/home');
  assert.equal(
    signedInHomeAction({ venueProfiles: [{ id: 'venue-1', approvalStatus: 'approved' }] }).label,
    'Go to dashboard',
  );
  const header = fs.readFileSync(new URL('../features/shared/components/LaunchHeader.jsx', import.meta.url), 'utf8');
  assert.equal(header.includes('label="Go to dashboard"'), false);
  assert.equal(accountInitials({ name: 'Maya Reid' }), 'MR');
  assert.equal(accountInitials({ email: 'maya.reid@gmail.com' }), 'MA');
});

test('a signed-out feature redirect opens sign-in, and a signed-in one follows the account', () => {
  assert.deepEqual(featureRedirectTarget(null), { authType: 'login' });
  assert.deepEqual(
    featureRedirectTarget({ signupAs: 'venue', venueProfiles: [] }),
    { path: '/venues/add-venue' },
  );
  assert.deepEqual(
    featureRedirectTarget({ venueProfiles: [{ id: 'venue-1', approvalStatus: 'pending', completed: true }] }),
    { path: '/venues/dashboard' },
  );
  assert.deepEqual(
    featureRedirectTarget({ signupAs: 'artist' }, { keepProfile: false, marketingPages: false }),
    { stay: true },
  );
  assert.deepEqual(
    featureRedirectTarget({ email: 'a@gigin.com' }, { marketingPages: false }),
    { stay: true },
  );
});
