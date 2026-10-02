import test from 'node:test';
import assert from 'node:assert/strict';
import { artistDestination, artistLoginRedirect } from './artistDestination.js';

const off = { keepProfile: false, legacyArtist: false };
const homeOn = { keepProfile: true, legacyArtist: false };

test('artists go to the new home when keep-profile is on', () => {
  assert.equal(artistDestination({ artistProfiles: [{ id: 'abc', slug: 'the-act' }] }, homeOn), '/home');
  assert.equal(artistDestination(null, homeOn), '/home');
});

test('otherwise artists go to their public profile, slug before id', () => {
  assert.equal(artistDestination({ artistProfiles: [{ id: 'abc', slug: 'the-act' }] }, off), '/artist/the-act');
  assert.equal(artistDestination({ artistProfiles: [{ profileId: 'abc' }] }, off), '/artist/abc');
});

test('a new account with no profile stays on the site root', () => {
  assert.equal(artistDestination({ artistProfiles: [] }, off), '/');
  assert.equal(artistDestination(null, off), '/');
});

test('login no longer opens the old artist dashboard', () => {
  const user = { artistProfiles: [{ id: 'abc', slug: 'the-act' }] };
  assert.equal(artistLoginRedirect('create-musician-profile', user, off), '/artist/the-act');
  assert.equal(artistLoginRedirect('/artist-profile', user, off), '/artist/the-act');
  assert.equal(artistLoginRedirect('/artist-profile/abc/gigs', user, homeOn), '/home');
  assert.equal(artistLoginRedirect('/venues/dashboard/gigs', user, off), '/venues/dashboard/gigs');
  assert.equal(
    artistLoginRedirect('/artist-profile', user, { keepProfile: false, legacyArtist: true }),
    '/artist-profile',
  );
});
