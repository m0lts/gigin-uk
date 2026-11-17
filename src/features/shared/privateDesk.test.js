import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseDeskValue, hasDeskData } from './privateDesk.js';

test('a missing Firestore document imports local storage once', () => {
  assert.equal(hasDeskData([]), false);
  assert.equal(hasDeskData({ website: true }), true);
  const imported = chooseDeskValue(null, ['2026-11-17'], []);
  assert.deepEqual(imported, { value: ['2026-11-17'], write: true });
  const kept = chooseDeskValue([], ['2026-11-17'], []);
  assert.deepEqual(kept, { value: [], write: false });
  const empty = chooseDeskValue(undefined, {}, {});
  assert.deepEqual(empty, { value: {}, write: false });
});
