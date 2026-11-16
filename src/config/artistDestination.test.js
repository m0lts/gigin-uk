import test from 'node:test';
import assert from 'node:assert/strict';
import { artistDestination, artistLoginRedirect, hasArtistProfile } from './artistDestination.js';

const off = { keepProfile: false };
const homeOn = { keepProfile: true };

test('artists go to the new home when keep-profile is on', () => {
  assert.equal(artistDestination({ artistProfiles: [{ id: 'abc', slug: 'the-act' }] }, homeOn), '/home');
  assert.equal(artistDestination(null, homeOn), '/home');
});

test('otherwise artists go to their public profile, slug before id', () => {
  assert.equal(artistDestination({ artistProfiles: [{ id: 'abc', slug: 'the-act' }] }, off), '/artist/the-act');
  assert.equal(artistDestination({ artistProfiles: [{ profileId: 'abc' }] }, off), '/artist/abc');
});

test('an artist id still opens that profile when keep-profile is off', () => {
  assert.equal(artistDestination({ artistProfileIds: ['ada'] }, off), '/artist/ada');
  assert.equal(hasArtistProfile({ artistProfileIds: ['ada'] }), true);
  assert.equal(hasArtistProfile({ venueProfiles: ['venue-1'] }), false);
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
});
