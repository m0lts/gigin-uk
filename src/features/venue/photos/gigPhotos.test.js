import test from 'node:test';
import assert from 'node:assert/strict';
import { assignPhotos, movePhoto, photosForSet, togglePicked } from './gigPhotos.js';

test('photos land on the set that was playing when they were taken', () => {
  const sets = [
    { gigId: 'a', name: 'Maya Reid', start: '19:30', end: '20:15' },
    { gigId: 'b', name: 'The Fen Street Trio', start: '20:30', end: '21:15' },
  ];
  const photos = assignPhotos([
    { id: '1', takenAt: new Date(2026, 11, 10, 19, 40) },
    { id: '2', takenAt: new Date(2026, 11, 10, 20, 40) },
  ], sets);
  assert.equal(photosForSet(photos, 'a').length, 1);
  assert.equal(photosForSet(photos, 'b')[0].id, '2');
  const moved = movePhoto(photos, '1', 'b');
  assert.equal(photosForSet(moved, 'b').length, 2);
  assert.deepEqual(togglePicked(['1'], '2'), ['1', '2']);
  assert.deepEqual(togglePicked(['1', '2'], '1'), ['2']);
});
