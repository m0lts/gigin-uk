import test from 'node:test';
import assert from 'node:assert/strict';
import { crashHomeAction } from './crashHome.js';

test('the crash page sends artists home, venues to the dashboard, and everyone else to the homepage', () => {
  assert.deepEqual(crashHomeAction(null), { href: '/', label: 'Back to Gigin' });
  assert.deepEqual(crashHomeAction(undefined), { href: '/', label: 'Back to Gigin' });
  assert.deepEqual(
    crashHomeAction({ signupAs: 'artist', artistProfileIds: ['ada'] }, { keepProfile: true }),
    { href: '/home', label: 'Go to your home' },
  );
  assert.deepEqual(
    crashHomeAction({ artistProfileIds: ['ada'] }, { keepProfile: false }),
    { href: '/artist/ada', label: 'Go to your home' },
  );
  assert.deepEqual(
    crashHomeAction({ venueProfiles: ['venue-1'], artistProfileIds: ['ada'] }),
    { href: '/venues/dashboard', label: 'Go to dashboard' },
  );
  assert.deepEqual(
    crashHomeAction({ signupAs: 'venue' }),
    { href: '/venues/dashboard', label: 'Go to dashboard' },
  );
  assert.deepEqual(crashHomeAction({ uid: 'signed-in' }), { href: '/', label: 'Back to Gigin' });
});
