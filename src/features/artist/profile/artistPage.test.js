import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingPackLines, profilePatch, publicProfile } from './artistPage.js';

test('a public page leaves the email off and a booking pack lists recent rooms', () => {
  const profile = { name: 'Maya Reid', city: 'Cambridge', bio: 'Songs', email: 'maya@example.com', genres: ['Folk'], links: { spotify: 'https://open.spotify.com/maya' } };
  const page = publicProfile(profile);
  assert.equal(page.email, undefined);
  assert.equal(page.link.includes('spotify'), true);
  const lines = bookingPackLines(profile, [{ venueName: 'Hot Numbers', gigName: 'Discovery Sessions' }]);
  assert.equal(lines.includes('maya@example.com'), false);
  assert.equal(lines.some((line) => line.includes('Hot Numbers')), true);
  assert.deepEqual(profilePatch({ name: 'Maya', city: 'Cambridge', bio: 'Songs', genres: 'Folk, Jazz' }).genres, ['Folk', 'Jazz']);
});
