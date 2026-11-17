import test from 'node:test';
import assert from 'node:assert/strict';
import { openGigRows, pagePatch, techLines } from './venuePublic.js';

test('open gigs stay in the future and the editor keeps the existing fee note', () => {
  const rows = openGigRows([
    { id: 'past', gigName: 'Old', date: '2020-01-01', applicationsOpen: true },
    { id: 'next', gigName: 'Discovery Sessions', date: '2027-01-10', startTime: '19:30', applicationsOpen: true },
    { id: 'closed', gigName: 'Closed', date: '2027-02-01', applicationsOpen: false },
  ], new Date('2026-11-17'));
  assert.deepEqual(rows.map((row) => row.id), ['next']);
  const patch = pagePatch({ about: 'A room', pa: 'Yes', fee: '' }, { actsShouldKnow: { fee: '£80' } });
  assert.equal(patch.actsShouldKnow.fee, '£80');
  assert.equal(patch.actsShouldKnow.about, 'A room');
  assert.equal(techLines({ pageTech: { vocalMics: '2', pa: 'In-house PA' } }).length, 2);
});
