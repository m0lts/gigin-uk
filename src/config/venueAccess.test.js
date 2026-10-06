import test from 'node:test';
import assert from 'node:assert/strict';
import { canCreateVenue, canJoinInvitedVenue } from './venueAccess.js';

const ciBuild = {};

test('a new signup cannot create a venue', () => {
  assert.equal(canCreateVenue(ciBuild, { exists: false }), false);
  assert.equal(canCreateVenue({ venueSignup: false }, { exists: false }), false);
  assert.equal(canCreateVenue({ openVenueCreation: true }, { exists: false }), false);
});

test('an invited venue member can still join', () => {
  assert.equal(canJoinInvitedVenue(ciBuild), true);
  assert.equal(canJoinInvitedVenue({ venueSignup: false }), true);
});

test('an existing venue can still be edited when creation is closed', () => {
  assert.equal(canCreateVenue(ciBuild, { exists: true }), true);
});

test('the venue signup flag turns self-serve venue creation on', () => {
  assert.equal(canCreateVenue({ venueSignup: true }, { exists: false }), true);
});
