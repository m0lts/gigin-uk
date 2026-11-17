import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, monthGrid, splitGigs, toggleDayOff } from './artistGigs.js';

test('gigs split into upcoming, past, and applications still waiting', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const split = splitGigs([
    { id: 'soon', date: '2026-12-10', status: 'accepted' },
    { id: 'old', date: '2026-10-01', status: 'accepted' },
    { id: 'wait', date: '2026-12-18', status: 'pending' },
  ], now);
  assert.equal(split.past.map((gig) => gig.id).join(), 'old');
  assert.equal(split.applied.map((gig) => gig.id).join(), 'wait');
  assert.equal(split.upcoming.some((gig) => gig.id === 'soon'), true);
});

test('a day off toggles and the month grid always has six weeks', () => {
  assert.deepEqual(toggleDayOff([], '2026-12-25'), ['2026-12-25']);
  assert.deepEqual(toggleDayOff(['2026-12-25'], '2026-12-25'), []);
  const grid = monthGrid(2026, 11);
  assert.equal(grid.length, 42);
  assert.equal(dayKey(new Date(2026, 11, 10)), '2026-12-10');
});
