import test from 'node:test';
import assert from 'node:assert/strict';
import { canAdvance, daysUntil, nextStep, profileFromDraft } from './artistJoin.js';

test('artist sign-up walks five steps and keeps the public profile fields', () => {
  assert.equal(nextStep('start'), 'about');
  assert.equal(nextStep('live'), 'live');
  assert.equal(canAdvance('start', { name: 'Maya' }), true);
  assert.equal(canAdvance('music', { link: '' }), false);
  const profile = profileFromDraft({ name: 'Maya Reid', city: 'Cambridge', genres: 'Folk, Jazz', bio: 'Songs', link: 'https://open.spotify.com/x' });
  assert.deepEqual(profile.genres, ['Folk', 'Jazz']);
  assert.equal(profile.links.spotify.includes('spotify'), true);
});

test('the home line counts days until the next gig', () => {
  const now = new Date('2026-11-16T00:00:00Z');
  assert.equal(daysUntil('2026-12-11T00:00:00Z', now), 25);
  assert.equal(daysUntil('', now), null);
});
