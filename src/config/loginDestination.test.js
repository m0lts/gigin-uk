import test from 'node:test';
import assert from 'node:assert/strict';
import { finishSetupPath } from './loginDestination.js';

test('a login with no profile finishes venue setup', () => {
  assert.equal(finishSetupPath({}), '/venues/add-venue');
  assert.equal(finishSetupPath({ artistProfiles: [], venueProfiles: [] }), '/venues/add-venue');
  assert.equal(finishSetupPath({ signupAs: 'venue' }), '/venues/add-venue');
  assert.equal(finishSetupPath({ accountType: '' }), '/venues/add-venue');
});

test('a known artist signup still uses the artist destination', () => {
  assert.equal(finishSetupPath({ signupAs: 'artist' }, { keepProfile: true }), '/home');
  assert.equal(finishSetupPath({ signedUpAs: 'musician' }, { keepProfile: false }), '/');
});

// How to check a saved venue draft after this redirect:
// The builder does not keep a separate browser draft. Save and exit writes an
// incomplete venueProfiles entry (completed: false, plus currentStep). Login
// still sends that account to /venues/dashboard, because a venue profile
// exists. Opening /venues/add-venue afterwards reads that entry and asks
// "Continue Building {name}?" — this login change does not pass location
// state, so it does not replace that saved profile.
