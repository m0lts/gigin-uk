import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bookerLine,
  forgetApplication,
  keepRememberedApplication,
  rememberApplication,
  rememberedApplication,
} from './guestFormat.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

function installStorage() {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
}

test('withdrawing forgets the remembered application for that gig', () => {
  installStorage();
  rememberApplication('gig-1', 'token-1');
  assert.deepEqual(rememberedApplication(['gig-1']), { gigId: 'gig-1', token: 'token-1' });
  forgetApplication('gig-1', 'token-1');
  assert.equal(rememberedApplication(['gig-1']), null);
  assert.equal(localStorage.getItem('guestApplicationLink'), null);
  assert.equal(sessionStorage.getItem('guestApplicationLink'), null);
});

test('forgetting one gig leaves a different remembered application', () => {
  installStorage();
  rememberApplication('gig-2', 'token-2');
  forgetApplication('gig-1', 'token-1');
  assert.deepEqual(rememberedApplication(['gig-2']), { gigId: 'gig-2', token: 'token-2' });
});

test('booker wording uses the venue owner first name', () => {
  assert.equal(bookerLine({ accountName: 'Sam Hart', name: 'Jesus College Bar', bookerDisplayName: 'Jez' }).name, 'Sam');
  assert.equal(bookerLine({ name: 'Jesus College Bar' }).name, 'Jesus College Bar');
  assert.equal(bookerLine({ venueName: 'The Bar' }).name, 'The Bar');
  assert.equal(bookerLine({}, { venue: { venueName: 'The Bar' } }).name, 'The Bar');
  assert.equal(bookerLine({}).name, 'the venue');
  assert.equal(bookerLine({ accountName: 'Sam Hart', bookerRole: 'Bar manager' }).role, 'Bar manager');
  assert.equal(bookerLine({ name: 'Jesus College Bar' }).role, '');
});

test('a withdrawn or missing application does not keep the applied banner', () => {
  assert.equal(keepRememberedApplication({ status: 'sent' }), true);
  assert.equal(keepRememberedApplication({ status: 'pending' }), true);
  assert.equal(keepRememberedApplication({ status: 'accepted' }), true);
  assert.equal(keepRememberedApplication({ status: 'withdrawn' }), false);
  assert.equal(keepRememberedApplication({ httpStatus: 404 }), false);
  assert.equal(keepRememberedApplication({ httpStatus: 410 }), false);
  assert.equal(keepRememberedApplication({ httpStatus: 500, status: 'sent' }), true);
});
