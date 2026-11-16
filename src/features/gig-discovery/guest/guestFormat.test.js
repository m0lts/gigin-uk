import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bandMemberPhrase,
  bookerLine,
  filledBandMembers,
  forgetApplication,
  isGuestApplyGig,
  keepRememberedApplication,
  launchVenueIds,
  rememberApplication,
  rememberedApplication,
  showsManageReview,
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

test('guest apply is on for the built-in launch venue and ids from the env list', () => {
  const builtIn = 'a622f269-1866-44f8-b3f0-bb9ca38eeefe';
  assert.equal(isGuestApplyGig({ kind: 'Live Music' }, { venueId: builtIn }), true);
  assert.equal(isGuestApplyGig({ kind: 'Venue Rental' }, { venueId: builtIn }), false);
  const ids = launchVenueIds(' hot-numbers , second ');
  assert.equal(ids.has(builtIn), true);
  assert.equal(ids.has('hot-numbers'), true);
  assert.equal(ids.has('second'), true);
  assert.equal(launchVenueIds('').has('hot-numbers'), false);
  assert.equal(launchVenueIds(' , ').size, 1);
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

test('a withdrawn application shows the explainer without the review list', () => {
  assert.equal(showsManageReview({ status: 'withdrawn' }), false);
  assert.equal(showsManageReview({ status: 'declined' }), false);
  assert.equal(showsManageReview({ status: 'accepted', accepted: true }), false);
  assert.equal(showsManageReview({ status: 'pending' }), true);
  assert.equal(showsManageReview({ status: 'sent' }), true);
});

test('the withdrawn page and the sent page each have one Back to the gig control', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const manage = readFileSync(join(dir, 'ManageGuestApplication.jsx'), 'utf8');
  const applied = readFileSync(join(dir, 'GuestApplied.jsx'), 'utf8');
  assert.equal(manage.split('Back to the gig').length - 1, 1);
  assert.equal(applied.split('Back to the gig').length - 1, 1);
  assert.equal(manage.includes('GuestApplied'), false);
});

test('an empty band is left off the application', () => {
  assert.equal(bandMemberPhrase([{ name: '', instruments: [] }]), '');
  assert.equal(bandMemberPhrase(undefined), '');
  assert.equal(filledBandMembers([{ name: '  ', instruments: [''] }]).length, 0);
  assert.equal(bandMemberPhrase([{ name: 'Ada', instruments: ['Vocals'] }]), '1 member');
  assert.equal(bandMemberPhrase([{ name: 'Ada' }, { instruments: ['Guitar'] }]), '2 members');
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
