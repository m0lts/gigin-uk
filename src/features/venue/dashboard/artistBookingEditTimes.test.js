import test from 'node:test';
import assert from 'node:assert/strict';
import { artistBookingEditTimes } from './artistBookingEditTimes.js';

test('a single-set edit writes the new music start, end, and date', () => {
  const times = artistBookingEditTimes({
    gig: {
      startTime: '19:00',
      duration: 120,
      timingMusicStartTime: '20:30',
      timingMusicStopTime: '22:00',
    },
    slot: { startTime: '19:00', duration: 120 },
    slotIndex: 0,
    slotCount: 1,
    dateIso: '2026-11-02',
  });

  assert.equal(times.startTime, '20:30');
  assert.equal(times.duration, 90);
  assert.equal(times.endTime, '22:00');
  assert.equal(times.startDateTime.getFullYear(), 2026);
  assert.equal(times.startDateTime.getMonth(), 10);
  assert.equal(times.startDateTime.getDate(), 2);
  assert.equal(times.startDateTime.getHours(), 20);
  assert.equal(times.startDateTime.getMinutes(), 30);
  assert.equal(times.date.getTime(), times.startDateTime.getTime());
});

test('moving the first set on a multi-set night leaves the later set alone', () => {
  const first = artistBookingEditTimes({
    gig: {
      startTime: '19:30',
      duration: 60,
      extraSlots: [{ startTime: '21:00', duration: 45 }],
      timingMusicStartTime: '19:30',
      timingMusicStopTime: '21:45',
    },
    slot: { startTime: '19:30', duration: 60 },
    slotIndex: 0,
    slotCount: 2,
    dateIso: '2026-11-02',
  });
  const second = artistBookingEditTimes({
    gig: {
      startTime: '19:30',
      duration: 60,
      timingMusicStartTime: '19:30',
      timingMusicStopTime: '21:45',
    },
    slot: { startTime: '21:00', duration: 45 },
    slotIndex: 1,
    slotCount: 2,
    dateIso: '2026-11-02',
  });

  assert.equal(first.startTime, '19:30');
  assert.equal(first.duration, 60);
  assert.equal(first.endTime, '20:30');
  assert.equal(second.startTime, '21:00');
  assert.equal(second.duration, 45);
  assert.equal(second.endTime, '21:45');
  assert.equal(second.startDateTime.getHours(), 21);
});
