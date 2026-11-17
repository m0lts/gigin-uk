import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarUrl, clipQuickPick, clipWindow, clock, offerDeadline, tonightRows } from './actNight.js';

test('a clip stays at 90 seconds and the quick picks sit at the start, middle, and end', () => {
  const duration = 6 * 60 + 24;
  assert.equal(clipWindow(duration, 72).length, 90);
  assert.equal(clock(clipWindow(duration, 72).start), '1:12');
  assert.equal(clock(clipWindow(duration, 72).end), '2:42');
  assert.equal(clipQuickPick(duration, 'start').start, 0);
  assert.equal(clipQuickPick(duration, 'ending').end, duration);
  assert.equal(clipWindow(30, 0).length, 30);
});

test('the phone handbook only lists the details the venue actually gave', () => {
  const rows = tonightRows({ startTime: '19:30', arriveBy: '18:45', arrivalNote: 'Side door', soundcheck: 'PA and 2 vocal mics', parking: 'Mill Road', contactPhone: '07700 900456' });
  assert.equal(rows.map((row) => row.id).join(','), 'arrive,sound,parking,night');
  assert.equal(tonightRows({}).length, 0);
  assert.equal(calendarUrl({ gigName: 'Discovery Sessions' }).includes('Discovery%20Sessions'), true);
});

test('an offer reply date counts the days left', () => {
  const sent = new Date('2026-11-13T12:00:00Z');
  const now = new Date('2026-11-15T12:00:00Z');
  const due = offerDeadline(sent, 7, now);
  assert.equal(due.left, '5 days left');
});
