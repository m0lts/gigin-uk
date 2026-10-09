import test from 'node:test';
import assert from 'node:assert/strict';
import { reportApplicationActionError } from './applicationActionError.js';

test('a 409 on accept or assign shows the server message and refreshes the night', async () => {
  const shown = [];
  let refreshed = 0;
  await reportApplicationActionError(
    { status: 409, message: 'This act has withdrawn.' },
    {
      notify: (message) => shown.push(message),
      refresh: () => { refreshed += 1; },
      refreshOnConflict: true,
    },
  );
  assert.deepEqual(shown, ['This act has withdrawn.']);
  assert.equal(refreshed, 1);
});

test('other accept failures keep the existing toast and do not refresh', async () => {
  const shown = [];
  let refreshed = 0;
  await reportApplicationActionError(
    { status: 400, message: 'That set is not part of this gig.' },
    {
      notify: (message) => shown.push(message),
      refresh: () => { refreshed += 1; },
      refreshOnConflict: true,
    },
  );
  assert.deepEqual(shown, ['That set is not part of this gig.']);
  assert.equal(refreshed, 0);
});
