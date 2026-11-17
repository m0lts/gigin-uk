import test from 'node:test';
import assert from 'node:assert/strict';
import { claimRequest } from './venueJoin.js';

test('claiming a venue asks for the same approval as a new venue request', () => {
  const body = claimRequest({
    venueName: 'Hot Numbers',
    role: 'I book the music',
    howOften: '4',
    name: 'Toby Gardner',
    email: 'toby@giginmusic.com',
    city: 'Cambridge',
    fromGig: 'Discovery Sessions',
  });
  assert.equal(body.nightsPerMonth, 4);
  assert.equal(body.message.includes('claim request'), true);
  assert.equal(body.message.includes('Discovery Sessions'), true);
  assert.equal(body.company, '');
});
