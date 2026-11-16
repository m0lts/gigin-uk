import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atThePlace,
  actTypeLine,
  bandMemberPhrase,
  bookerLine,
  filledBandMembers,
  forgetApplication,
  formatDurationLabel,
  formatGuestDesktopDate,
  formatGuestPhoneDate,
  formatSetLine,
  guestFeeLabel,
  isGuestApplyGig,
  keepRememberedApplication,
  launchVenueIds,
  openSetsSummary,
  providedKitPhrase,
  rememberApplication,
  rememberedApplication,
  showsManageReview,
  venueIsBar,
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
  const photo = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Fuid%2Fbooker%2Fphoto.jpg?alt=media&token=abc';
  const line = bookerLine({ accountName: 'Sam Hart', bookerPhoto: photo, email: 'sam@venue.test' });
  assert.equal(line.name, 'Sam');
  assert.equal(line.photo, photo);
  assert.equal(Object.hasOwn(line, 'email'), false);
  assert.equal(bookerLine({ accountName: 'Sam Hart', bookerPhoto: 'https://example.com/sam.hart@venue.test' }).photo, '');
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
  assert.equal(applied.includes('tech rider'), false);
  assert.equal(applied.includes('✓'), false);
  assert.equal(applied.includes("It's free"), false);
  assert.equal(applied.includes('Save your details for next time') || applied.includes('SaveDetailsCard'), true);
  assert.equal(applied.includes('<svg'), true);
});

test('an empty band is left off the application', () => {
  assert.equal(bandMemberPhrase([{ name: '', instruments: [] }]), '');
  assert.equal(bandMemberPhrase(undefined), '');
  assert.equal(filledBandMembers([{ name: '  ', instruments: [''] }]).length, 0);
  assert.equal(bandMemberPhrase([{ name: 'Ada', instruments: ['Vocals'] }]), '1 member');
  assert.equal(bandMemberPhrase([{ name: 'Ada' }, { instruments: ['Guitar'] }]), '2 members');
  assert.equal(actTypeLine([{ name: '', instruments: [] }]), '');
  assert.equal(actTypeLine([{ name: 'Ada', instruments: ['Vocals'] }, { instruments: ['Guitar'] }]), 'Duo · vocals, guitar');
  assert.equal(actTypeLine([{ instruments: ['Vocals', 'Guitar'] }]), 'Solo · vocals, guitar');
  assert.equal(actTypeLine([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]), '4-piece');
});

test('the guest gig date is sentence case on desktop and short caps on a phone', () => {
  const gig = { startDateTime: '2026-12-01T18:00:00', startTime: '18:00' };
  const slots = [
    { startTime: '18:00', endTime: '20:00', duration: 120 },
    { startTime: '20:00', endTime: '21:00', duration: 60 },
  ];
  assert.equal(
    formatGuestDesktopDate(gig, slots, 'JBar, 7b Jesus Lane, Cambridge'),
    'Tue 1 Dec · 18:00 to 21:00 · JBar, 7b Jesus Lane, Cambridge',
  );
  assert.equal(formatGuestPhoneDate(gig, slots), 'TUE 1 DEC · 18:00 TO 21:00');
  assert.equal(formatSetLine(slots[0], 0), 'Set 1 · 18:00 to 20:00 · 2 hrs');
  assert.equal(formatDurationLabel(45), '45 min');
  assert.equal(formatDurationLabel(60), '1 hr');
  assert.equal(formatDurationLabel(90), '1 hr 30 min');
});

test('a fee and kit line appear only for what the venue actually offers', () => {
  assert.equal(guestFeeLabel({ budget: '£80' }), '£80');
  assert.equal(guestFeeLabel({ budget: '£' }), '');
  assert.equal(guestFeeLabel({ budget: 'Free' }), '');
  assert.equal(guestFeeLabel({ fee: '' }, [{ budget: '£0' }]), '');
  assert.equal(providedKitPhrase([
    { key: 'pa', label: 'PA System', available: true },
    { key: 'microphones', label: 'Microphones', available: true, quantity: 2 },
    { key: 'drumKit', label: 'Drum Kit', available: false },
  ]), 'PA and 2 vocal mics');
  assert.equal(providedKitPhrase([{ key: 'drumKit', available: false }]), '');
  assert.equal(openSetsSummary({ openCount: 2, total: 2 }), '2 of 2 sets open');
  assert.equal(openSetsSummary({ openCount: 0, total: 2, allTaken: true }), 'All sets filled');
});

test('the guest page says bar only for a bar, and drops the missing-kit line', () => {
  assert.equal(venueIsBar({ establishment: 'Pub/Bar' }), true);
  assert.equal(venueIsBar({ establishment: 'Music Venue', name: 'JBar' }), false);
  assert.equal(atThePlace({ establishment: 'Pub/Bar' }), 'the bar');
  assert.equal(atThePlace({ name: 'JBar', establishment: 'Music Venue' }), 'the venue');
  const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'GuestGigPage.jsx'), 'utf8');
  assert.equal(page.includes('ga-mono'), false);
  assert.equal(page.includes('<em'), false);
  assert.equal(/<i(\s|>)/.test(page), false);
  assert.equal(page.includes('doesn\'t have'), false);
  assert.equal(page.includes('What the bar'), false);
  assert.equal(page.includes('The night'), true);
  assert.equal(page.includes('s provided'), true);
  assert.equal(page.includes('Ask the venue about sound and kit'), true);
  assert.equal(page.includes('Your set'), true);
});

test('guest apply music links are the four platforms inside a 560px column', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const assets = readFileSync(join(dir, 'GuestAssetsStep.jsx'), 'utf8');
  const tech = readFileSync(join(dir, 'GuestTechStep.jsx'), 'utf8');
  const css = readFileSync(join(dir, '../../../assets/styles/artists/gig-page.styles.css'), 'utf8');
  for (const name of ['Spotify', 'YouTube', 'SoundCloud', 'Bandcamp']) assert.match(assets, new RegExp(name));
  assert.equal(assets.includes('Instagram'), false);
  assert.equal(assets.includes('Website'), false);
  assert.match(tech, /Instagram/);
  assert.match(tech, /Website/);
  assert.match(tech, /Who&apos;s playing/);
  assert.match(tech, /\+ Add someone/);
  assert.match(tech, /provides:/);
  assert.equal(tech.includes('Bar has'), false);
  assert.match(css, /min-width: 641px/);
  assert.match(css, /max-width: 560px/);
  assert.match(readFileSync(join(dir, 'GuestApplyWizard.jsx'), 'utf8'), /ga-skip/);
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
