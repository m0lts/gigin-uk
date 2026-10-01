/**
 * Browser flows 1-10 against the Firebase emulators and the local API.
 * Refuses to start unless the emulator hosts are set, and refuses the prod project.
 * Addresses are test+…@example.com only.
 */
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../gigin-api/package.json'));
const admin = require('firebase-admin');

const API = process.env.OVERNIGHT_API || 'http://127.0.0.1:8099/api';
const AUTH = 'http://127.0.0.1:9099';
const PASSWORD = 'Overnight1!';
const PNG = '/tmp/overnight-browser-pixel.png';

const consoleProblems = [];

function assertSafe() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Refusing to run browser tests without the Firebase emulators.');
  }
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
  if (project === 'giginltd-16772') throw new Error('Refusing to run against production.');
}

function initAdmin() {
  assertSafe();
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'giginltd-dev' });
  }
  return admin.firestore();
}

async function signUp(email) {
  const sign = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  }).then((response) => response.json());
  if (!sign.localId) throw new Error(`Auth emulator signup failed for ${email}: ${JSON.stringify(sign)}`);
  const update = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: sign.localId, emailVerified: true }),
  }).then((response) => response.json());
  if (!update.emailVerified && update.emailVerified !== true) {
    throw new Error(`Could not mark ${email} verified in the auth emulator: ${JSON.stringify(update)}`);
  }
  const again = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  }).then((response) => response.json());
  return { uid: sign.localId, token: again.idToken, email };
}

function watch(page, label) {
  const note = (text) => {
    const ignore = /favicon|Download the React DevTools|Download the Firebase|mapbox|ERR_CONNECTION_REFUSED.*5001|functions emulator|net::ERR_FAILED/i;
    if (ignore.test(text)) return;
    if (text.includes('giginltd-16772')) throw new Error('The browser client is pointed at production.');
    consoleProblems.push(`${label}: ${text}`);
  };
  page.on('pageerror', (error) => note(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') note(message.text());
  });
}

async function login(page, email) {
  await page.goto('/');
  await page.evaluate(async () => {
    const names = typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((db) => db.name) : ['firebaseLocalStorageDb'];
    await Promise.all(names.filter(Boolean).map((name) => new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    })));
  });
  await page.reload();
  await page.getByPlaceholder('e.g. johnsmith@gigin.com').fill(email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForResponse((response) => response.url().includes('signInWithPassword'), { timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toHaveCount(0);
}

async function openGigRow(page, name) {
  await page.goto('/venues/dashboard/gigs');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 20000 });
  await page.getByRole('button', { name: 'Table' }).click();
  const row = page.locator('tr', { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.click();
  await expect(page).toHaveURL(/gig-applications/, { timeout: 20000 });
}

async function applyAsGuest(page, gigId, { act, name, email, note, photo = false }) {
  await page.goto(`/gig/${gigId}`);
  await expect(page.getByRole('button', { name: 'Apply to play' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Apply to play' }).click();
  await page.getByLabel('Act or band name').fill(act);
  await page.getByLabel('Your name').fill(name);
  const emailField = page.locator('input[type="email"]');
  await emailField.fill(email);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('account-check')).catch(() => null),
    emailField.blur(),
  ]);
  await page.getByRole('button', { name: /Set 1/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Photo and links' })).toBeVisible();
  if (photo) {
    await page.locator('input[type="file"]').first().setInputFiles(PNG);
    await expect(page.getByText(/overnight-browser-pixel/)).toBeVisible({ timeout: 20000 });
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Tech rider' })).toBeVisible();
  await page.getByRole('button', { name: 'Guitar' }).first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Nearly done' })).toBeVisible();
  await page.locator('textarea').fill(note);
  await page.getByRole('button', { name: 'Send application' }).click();
  await expect(page.getByRole('heading', { name: /Application sent/ })).toBeVisible({ timeout: 20000 });
  return page.evaluate(() => sessionStorage.getItem('guestApplicationLink') || '');
}

async function keepOpenIfAsked(page) {
  const keep = page.getByRole('button', { name: 'Keep open' });
  if (await keep.isVisible().catch(() => false)) await keep.click();
}

const world = {};

test.beforeAll(async () => {
  const db = initAdmin();
  writeFileSync(PNG, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ));
  const stamp = Date.now();
  const venue = await signUp(`test+venue-browser-${stamp}@example.com`);
  const artist = await signUp(`test+artist-browser-${stamp}@example.com`);
  const existing = await signUp(`test+existing-browser-${stamp}@example.com`);
  const venueId = randomUUID();
  const artistId = randomUUID();
  const mergeProfileId = randomUUID();
  const night = [randomUUID(), randomUUID()];
  const second = randomUUID();
  const regression = randomUUID();
  const declineGig = randomUUID();
  const deleteGig = randomUUID();
  const when = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

  await db.doc(`users/${venue.uid}`).set({
    email: venue.email,
    name: 'Venue Browser',
    venueProfiles: [venueId],
  });
  await db.doc(`venueProfiles/${venueId}`).set({
    venueId,
    name: 'Overnight Browser Venue',
    accountName: 'Overnight Browser Venue',
    bookerDisplayName: 'Jez',
    guestApplications: true,
    completed: true,
    createdBy: venue.uid,
    userId: venue.uid,
  });
  await db.doc(`venueProfiles/${venueId}/members/${venue.uid}`).set({
    role: 'owner',
    status: 'active',
    permissions: {
      'gigs.read': true,
      'gigs.create': true,
      'gigs.update': true,
      'gigs.applications.manage': true,
      'gigs.invite': true,
    },
  });
  await db.doc(`users/${venue.uid}/artistCRM/saved-contact`).set({
    name: 'Saved Contact Act',
    email: `test+contact-browser-${stamp}@example.com`,
  });
  await db.doc(`users/${venue.uid}/artistCRM/merge-contact`).set({
    name: 'Browser Merge Act',
  });
  await db.doc(`users/${artist.uid}`).set({
    email: artist.email,
    name: 'Artist Browser',
    artistProfiles: [artistId],
  });
  await db.doc(`artistProfiles/${artistId}`).set({
    userId: artist.uid,
    createdBy: artist.uid,
    name: 'Regression Act',
    isComplete: true,
    genres: [],
  });
  await db.doc(`artistProfiles/${artistId}/members/${artist.uid}`).set({
    status: 'active',
    role: 'owner',
    permissions: { 'gigs.book': true, 'profile.viewer': true, 'profile.edit': true },
  });
  await db.doc(`artistProfiles/${mergeProfileId}`).set({
    name: 'Browser Merge Act',
    userId: artist.uid,
    isComplete: true,
  });

  const gig = (gigId, gigName, slots) => ({
    gigId,
    gigName,
    kind: 'Live Music',
    status: 'open',
    applicationsOpen: true,
    private: false,
    guestApplications: true,
    startDateTime: when,
    date: when,
    startTime: '20:00',
    duration: 60,
    gigSlots: slots,
    applicants: [],
    budget: '£0',
    paymentModel: 'no_fee',
  });
  const created = await fetch(`${API}/gigs/postMultipleGigs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${venue.token}` },
    body: JSON.stringify({
      venueId,
      gigDocuments: [
        gig(night[0], 'Overnight Browser Night', night),
        { ...gig(night[1], 'Overnight Browser Night', night), startTime: '21:30' },
        gig(second, 'Overnight Browser Second', [second]),
        gig(regression, 'Overnight Browser Regression', [regression]),
        gig(declineGig, 'Overnight Browser Decline', [declineGig]),
        gig(deleteGig, 'Overnight Browser Delete', [deleteGig]),
      ],
    }),
  }).then((response) => response.json());
  if (!created?.data?.ok) throw new Error(`Could not seed gigs: ${JSON.stringify(created)}`);

  Object.assign(world, {
    db, venue, artist, existing, venueId, artistId, nightId: night[0], secondId: second,
    regressionId: regression, declineGigId: declineGig, deleteGigId: deleteGig, stamp,
  });
});

test('1. invite from a saved contact', async ({ page }) => {
  watch(page, 'test 1');
  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Night');
  await page.getByRole('button', { name: 'Offer gig to a saved Contact' }).click();
  await expect(page.getByRole('heading', { name: 'Send this invite to any of your artists?' })).toBeVisible();
  await page.getByRole('button', { name: /Saved Contact Act/ }).click();
  await expect(page.getByText(/Invitation email sent to Saved Contact Act/)).toBeVisible({ timeout: 20000 });
  const invites = await world.db.collection('gigInvites').get();
  const mine = invites.docs.filter((doc) => doc.data().gigId === world.nightId);
  expect(mine.length).toBeGreaterThan(0);
});

test('2. guest applies, edits, withdraws, and does not duplicate a contact', async ({ page }) => {
  watch(page, 'test 2');
  const email = `test+guest-a-${world.stamp}@example.com`;
  const stored = await applyAsGuest(page, world.nightId, {
    act: 'Browser Act Withdrawn',
    name: 'Guest A',
    email,
    note: 'First note from the browser.',
    photo: true,
  });
  const [gigId, token] = stored.split(':');
  expect(token).toBeTruthy();
  await page.goto(`/gig/${gigId}/application/${token}`);
  await expect(page.getByRole('heading', { name: 'Your application' })).toBeVisible();
  await page.locator('.ga-review__row', { hasText: 'Note to Jez' }).getByRole('button', { name: 'Edit' }).click();
  await page.locator('textarea').fill('Edited from the private link.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Edited from the private link.')).toBeVisible();
  await page.getByRole('button', { name: 'Withdraw my application' }).click();
  await page.getByRole('button', { name: 'Yes, withdraw' }).click();
  await expect(page.getByText('Withdrawn')).toBeVisible();

  await applyAsGuest(page, world.secondId, {
    act: 'Browser Act Withdrawn',
    name: 'Guest A',
    email,
    note: 'Same email, second gig.',
  });
  const contacts = await world.db.collection('users').doc(world.venue.uid).collection('artistCRM').get();
  const same = contacts.docs.filter((doc) => String(doc.data().email || '').toLowerCase() === email);
  expect(same).toHaveLength(1);
  const mail = await world.db.collection('mail').where('to', '==', email).get();
  expect(mail.size).toBeGreaterThan(0);
});

test('3. an existing Gigin email is told to log in', async ({ page }) => {
  watch(page, 'test 3');
  await page.goto(`/gig/${world.secondId}`);
  await page.getByRole('button', { name: 'Apply to play' }).click();
  await page.getByLabel('Act or band name').fill('Should Not Send');
  await page.getByLabel('Your name').fill('Existing');
  const emailField = page.locator('input[type="email"]');
  await emailField.fill(world.existing.email);
  await emailField.blur();
  await expect(page.getByText('This email already has a Gigin account. Log in to apply.')).toBeVisible();
  await page.getByRole('button', { name: /Set 1/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
});

test('4. venue accepts one guest and declines another', async ({ page }) => {
  watch(page, 'test 4');
  await applyAsGuest(page, world.nightId, {
    act: 'Browser Act Accepted',
    name: 'Guest B',
    email: `test+guest-b-${world.stamp}@example.com`,
    note: 'Please accept this one.',
  });
  await applyAsGuest(page, world.nightId, {
    act: 'Browser Act Declined',
    name: 'Guest C',
    email: `test+guest-c-${world.stamp}@example.com`,
    note: 'Please decline this one.',
  });
  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Night');
  await expect(page.getByText('Guest').first()).toBeVisible();
  await expect(page.getByText('Browser Act Accepted')).toBeVisible();
  const declinedRow = page.locator('div').filter({ hasText: 'Browser Act Declined' }).filter({ has: page.getByRole('button', { name: 'Decline' }) }).last();
  await declinedRow.getByRole('button', { name: 'Decline' }).click();
  const acceptedRow = page.locator('div').filter({ hasText: 'Browser Act Accepted' }).filter({ has: page.getByRole('button', { name: 'Accept' }) }).last();
  await acceptedRow.getByRole('button', { name: 'Accept' }).click();
  await keepOpenIfAsked(page);
  await expect(page.getByText(/Who is playing|Browser Act Accepted/)).toBeVisible();
  await page.goto('/venues/dashboard/artists');
  await expect(page.getByText('Browser Act Accepted')).toBeVisible({ timeout: 20000 });
});

test('5. closing applications rejects a new guest', async ({ page }) => {
  watch(page, 'test 5');
  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Night');
  await page.getByRole('button', { name: /Accepting applications/ }).click();
  await expect(page.getByText('Applications closed.')).toBeVisible();
  await page.goto(`/gig/${world.nightId}`);
  await expect(page.getByRole('button', { name: 'Applications closed' })).toBeVisible();
  const rejected = await fetch(`${API}/guest-applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gigId: world.nightId,
      applicationId: randomUUID(),
      manageToken: 'b'.repeat(40),
      actName: 'Too Late',
      contactName: 'Late Guest',
      contacts: { email: `test+late-browser-${world.stamp}@example.com` },
      slotGigIds: [world.nightId],
    }),
  });
  expect(rejected.status).toBe(409);
  const body = await rejected.json();
  expect(String(body.error || '')).toMatch(/closed/i);
});

test('6. sound engineer and additional notes survive a refresh', async ({ page }) => {
  watch(page, 'test 6');
  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Night');
  await page.getByRole('button', { name: 'Add sound engineer' }).click();
  await page.locator('#gig-sound-engineer-name').fill('Sam Engineer');
  await page.locator('#gig-sound-engineer-contact').fill('test+engineer-browser@example.com');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Add a note' }).click();
  await page.locator('textarea.venue-gig-rail__notes-input').fill('Bring the spare DI box.');
  await page.getByRole('heading', { name: 'Additional notes' }).click();
  await page.reload();
  await expect(page.getByText('Sam Engineer')).toBeVisible();
  await expect(page.getByText('Bring the spare DI box.')).toBeVisible();
});

test('7. a guest account links, and a name match merges only when asked', async ({ page }) => {
  watch(page, 'test 7');
  const email = `test+guest-d-${world.stamp}@example.com`;
  await applyAsGuest(page, world.secondId, {
    act: 'Browser Act Account',
    name: 'Guest D',
    email,
    note: 'I will make an account.',
  });
  await page.getByRole('button', { name: 'Create a free account' }).click();
  await page.locator('#name').fill('Guest D');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('input[name="terms"]').check();
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect.poll(async () => {
    const gig = await world.db.doc(`gigs/${world.secondId}`).get();
    const applicant = (gig.data()?.applicants || []).find((entry) => entry?.contacts?.email === email || entry?.email === email);
    return applicant?.userId || '';
  }, { timeout: 20000 }).not.toBe('');

  await login(page, world.venue.email);
  await page.goto('/venues/dashboard/artists');
  await expect(page.getByText(/This looks like/)).toBeVisible({ timeout: 20000 });
  const before = await world.db.doc('users/' + world.venue.uid + '/artistCRM/merge-contact').get();
  expect(before.data()?.artistId || null).toBeFalsy();
  await page.getByRole('button', { name: 'Merge' }).click();
  await expect.poll(async () => {
    const after = await world.db.doc(`users/${world.venue.uid}/artistCRM/merge-contact`).get();
    return after.exists ? after.data()?.artistId || '' : 'deleted';
  }).not.toBe('');
});

test('8. media share link, wrong type, revoke', async ({ page }) => {
  watch(page, 'test 8');
  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Night');
  const media = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Photos and videos' }) });
  await expect(media).toBeVisible();
  await media.locator('input[type="file"]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a photo'),
  });
  await expect(page.getByText('Use a photo or video')).toBeVisible();
  await page.getByRole('button', { name: 'Create private link' }).click();
  const link = page.locator('p', { hasText: '/share/gig-media/' });
  await expect(link).toBeVisible();
  const href = await link.innerText();
  await page.goto(href);
  await expect(page.getByText(/No photos or videos yet|Download/)).toBeVisible();
  await page.goto('/venues/dashboard/gigs');
  await openGigRow(page, 'Overnight Browser Night');
  await page.getByRole('button', { name: 'Revoke link' }).click();
  await page.goto(href);
  await expect(page.getByText('This link is no longer available.')).toBeVisible();
});

test('9. a logged-in artist applies, withdraws, and a gig can be deleted', async ({ page }) => {
  watch(page, 'test 9');
  await login(page, world.artist.email);
  await page.goto(`/gig/${world.regressionId}`);
  await expect(page.getByRole('button', { name: 'Apply To Gig' })).toBeEnabled();
  await page.getByRole('button', { name: 'Apply To Gig' }).click();
  await page.getByLabel('Message to the venue').fill('Regression application from the browser.');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByRole('button', { name: 'Withdraw Application' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Withdraw Application' }).click();
  await expect(page.getByRole('button', { name: 'Apply To Gig' })).toBeVisible({ timeout: 20000 });

  await page.goto(`/gig/${world.declineGigId}`);
  await page.getByRole('button', { name: 'Apply To Gig' }).click();
  await page.getByLabel('Message to the venue').fill('Please decline this regression application.');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByRole('button', { name: 'Withdraw Application' })).toBeVisible({ timeout: 20000 });

  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Decline');
  await page.getByRole('button', { name: 'Decline' }).first().click();
  await page.goto('/venues/dashboard/gigs');
  const row = page.locator('tr', { hasText: 'Overnight Browser Delete' }).first();
  await row.locator('.options-cell button').click();
  await page.getByRole('button', { name: /^Delete/ }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Overnight Browser Delete')).toHaveCount(0);
});

test('10. no unexpected browser errors', async () => {
  const unique = [...new Set(consoleProblems)];
  expect(unique, unique.join('\n')).toEqual([]);
});
