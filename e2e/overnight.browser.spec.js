/**
 * Browser flows 1-10 against the Firebase emulators and the local API.
 * Refuses to start unless the emulator hosts are set, and refuses the prod project.
 * Addresses are test+…@example.com only.
 */
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

async function assertSignedOutGigHidesSecrets(gigId, email) {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const response = await fetch(`http://${host}/v1/projects/giginltd-dev/databases/(default)/documents/gigs/${gigId}`);
  expect(response.status).toBe(200);
  const body = await response.json();
  const text = JSON.stringify(body);
  if (email) expect(text).not.toContain(email);
  expect(text).not.toContain('manageTokenHash');
  expect(text).not.toContain('mediaShareTokenHash');
  expect(text).not.toContain('soundEngineerContact');
  expect(text).not.toContain('gig-media/');
  expect(text).not.toMatch(/07\d{8,}/);
}

async function markEmailVerified(email) {
  const sign = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  }).then((response) => response.json());
  if (!sign.localId) throw new Error(`Could not look up ${email} in the auth emulator: ${JSON.stringify(sign)}`);
  const update = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: sign.localId, emailVerified: true }),
  }).then((response) => response.json());
  if (update.emailVerified !== true) {
    throw new Error(`Could not mark ${email} verified: ${JSON.stringify(update)}`);
  }
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
  let revokedShare404 = 0;
  page.on('response', (response) => {
    try {
      const pathname = new URL(response.url()).pathname;
      if (response.status() === 404 && /\/api\/gig-media\/share\/[a-f0-9]+$/.test(pathname)) revokedShare404 += 1;
    } catch {
      /* not a URL */
    }
  });
  const note = (text) => {
    const ignore = /favicon|Download the React DevTools|Download the Firebase|mapbox|ERR_CONNECTION_REFUSED.*5001|functions emulator|net::ERR_FAILED/i;
    if (ignore.test(text)) return;
    if (/status of 404/.test(text) && revokedShare404 > 0) {
      revokedShare404 -= 1;
      return;
    }
    if (text.includes('giginltd-16772')) throw new Error('The browser client is pointed at production.');
    consoleProblems.push(`${label}: ${text}`);
  };
  page.on('pageerror', (error) => note(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/status of 404/.test(text)) {
      setTimeout(() => note(text), 300);
      return;
    }
    note(text);
  });
}

async function logout(page) {
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
  const row = page.getByRole('row', { name: new RegExp(name) }).first();
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
  try {
    await keep.waitFor({ state: 'visible', timeout: 8000 });
    await keep.click();
  } catch {
    // The close-applications prompt only appears when accepting fills the slots.
  }
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
    createdAt: admin.firestore.Timestamp.now(),
  });
  await db.doc(`users/${venue.uid}/artistCRM/merge-contact`).set({
    name: 'Browser Merge Act',
    createdAt: admin.firestore.Timestamp.now(),
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
  await page.getByRole('button', { name: 'Generate Invite' }).click();
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
  await assertSignedOutGigHidesSecrets(gigId, email);
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
  await page.locator('.venue-gig-running__applicant', { hasText: 'Browser Act Declined' }).getByRole('button', { name: 'Decline' }).click();
  await page.locator('.venue-gig-running__applicant', { hasText: 'Browser Act Accepted' }).getByRole('button', { name: 'Accept' }).click();
  await keepOpenIfAsked(page);
  await expect(page.getByRole('heading', { name: 'Who is playing' })).toBeVisible();
  await page.goto('/venues/dashboard/artists');
  await expect(page.getByText('Browser Act Accepted')).toBeVisible({ timeout: 20000 });
});

test('5. closing applications rejects a new guest', async ({ page }) => {
  watch(page, 'test 5');
  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Night');
  await page.getByRole('button', { name: /Accepting applications/ }).click();
  await expect(page.getByText('Applications closed.')).toBeVisible();
  await logout(page);
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
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Add a note' }).click();
  await page.locator('textarea.venue-gig-rail__notes-input').fill('Bring the spare DI box.');
  await page.getByRole('complementary', { name: 'Gig details' }).getByRole('heading', { name: 'Additional notes' }).click();
  await page.reload();
  await expect(page.getByText('Sam Engineer').first()).toBeVisible();
  await expect(page.getByText('Bring the spare DI box.').first()).toBeVisible();
  await assertSignedOutGigHidesSecrets(world.nightId, 'test+engineer-browser@example.com');
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
    const priv = await world.db.collection(`gigs/${world.secondId}/guestApplicants`).where('email', '==', email).limit(1).get();
    if (priv.empty) return '';
    const gig = await world.db.doc(`gigs/${world.secondId}`).get();
    const applicant = (gig.data()?.applicants || []).find((entry) => entry.id === priv.docs[0].id);
    return applicant?.userId || '';
  }, { timeout: 20000 }).not.toBe('');
  await markEmailVerified(email);
  await login(page, world.venue.email);
  await page.goto('/venues/dashboard/artists');
  await expect(page.getByText(/This looks like/)).toBeVisible({ timeout: 20000 });
  const before = await world.db.doc('users/' + world.venue.uid + '/artistCRM/merge-contact').get();
  expect(before.data()?.artistId || null).toBeFalsy();
  await page.getByRole('button', { name: 'Merge', exact: true }).click();
  await expect.poll(async () => {
    const after = await world.db.doc(`users/${world.venue.uid}/artistCRM/merge-contact`).get();
    return after.exists ? after.data()?.artistId || '' : 'deleted';
  }).not.toBe('');
});

test('8b. private link downloads one file and a zip of that file', async ({ page }) => {
  watch(page, 'test 8b');
  let remoteUpload = '';
  page.on('request', (request) => {
    if (request.method() !== 'PUT') return;
    const host = new URL(request.url()).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') remoteUpload = host;
  });
  await page.route('**/*', (route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      const host = new URL(request.url()).hostname;
      if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') return route.abort();
    }
    return route.continue();
  });
  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Night');
  const media = page.locator('section.gig-details-tile').filter({ has: page.getByRole('heading', { name: 'Photos and videos' }) });
  await media.locator('input[type="file"]').setInputFiles(PNG);
  if (remoteUpload) throw new Error(`Refusing to upload to ${remoteUpload}`);
  await expect(page.getByText('Uploaded.')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Create private link' }).click();
  const href = await page.locator('p', { hasText: '/share/gig-media/' }).innerText();
  await page.goto(href);
  const fileHref = await page.getByRole('link', { name: 'Download', exact: true }).first().getAttribute('href');
  const file = await page.request.get(fileHref);
  expect(file.ok()).toBeTruthy();
  expect(file.headers()['content-disposition'] || '').toContain('overnight-browser-pixel.png');
  expect((await file.body()).length).toBeGreaterThan(8);
  const zipHref = await page.getByRole('link', { name: 'Download all as zip' }).getAttribute('href');
  const zip = await page.request.get(zipHref);
  expect(zip.ok()).toBeTruthy();
  const dir = mkdtempSync(path.join(tmpdir(), 'gig-media-'));
  const zipPath = path.join(dir, 'media.zip');
  writeFileSync(zipPath, await zip.body());
  const listing = execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(len(z.namelist())); print("\\n".join(z.namelist()))', zipPath], { encoding: 'utf8' });
  const [count, ...names] = listing.trim().split('\n');
  expect(count).toBe('1');
  expect(names).toEqual(['1-overnight-browser-pixel.png']);
});

test('8. media share link, wrong type, revoke', async ({ page }) => {
  watch(page, 'test 8');
  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Night');
  const media = page.locator('section.gig-details-tile').filter({ has: page.getByRole('heading', { name: 'Photos and videos' }) });
  await expect(media).toBeVisible();
  await media.locator('input[type="file"]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a photo'),
  });
  await expect(page.getByText('Use a photo or video')).toBeVisible();
  const revoke = page.getByRole('button', { name: 'Revoke link' });
  if (await revoke.count()) {
    await revoke.click();
    await expect(page.getByRole('button', { name: 'Create private link' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Create private link' }).click();
  const link = page.locator('p', { hasText: '/share/gig-media/' });
  await expect(link).toBeVisible();
  const href = await link.innerText();
  await page.goto(href);
  await expect(page.getByRole('link', { name: 'Download', exact: true }).first()).toBeVisible();
  await page.goto('/venues/dashboard/gigs');
  await openGigRow(page, 'Overnight Browser Night');
  await page.getByRole('button', { name: 'Revoke link' }).click();
  await page.goto(href);
  await expect(page.getByText('This link is no longer available.')).toBeVisible();
});

async function applyAsArtist(page, gigId, message) {
  await page.goto(`/gig/${gigId}`);
  await expect(page.getByRole('button', { name: 'Apply To Gig' })).toBeEnabled({ timeout: 20000 });
  await page.getByRole('button', { name: 'Apply To Gig' }).click();
  await page.getByLabel('Message to the venue').fill(message);
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByRole('button', { name: 'Withdraw Application' })).toBeVisible({ timeout: 20000 });
  const wizard = page.locator('.apply-wizard-modal');
  if (await wizard.isVisible().catch(() => false)) {
    await wizard.click({ position: { x: 8, y: 8 } });
    await expect(wizard).toBeHidden({ timeout: 5000 });
  }
}

async function deleteGigFromTable(page, name) {
  await page.goto('/venues/dashboard/gigs');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 20000 });
  await page.getByRole('button', { name: 'Table' }).click();
  const row = page.getByRole('row', { name: new RegExp(name) }).first();
  await row.getByRole('button', { name: 'Gig options' }).click();
  await page.getByRole('button', { name: /^Delete/ }).click();
  await page.locator('.modal').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(name)).toHaveCount(0);
}

test('9. a logged-in artist applies, is accepted, declined, withdraws, and a gig is cancelled and deleted', async ({ page }) => {
  watch(page, 'test 9');
  await applyAsGuest(page, world.regressionId, {
    act: 'Browser Guest Beside Artist',
    name: 'Guest With Artist',
    email: `test+guest-mixed-${world.stamp}@example.com`,
    note: 'Guest on the same gig as a logged-in artist.',
  });
  await login(page, world.artist.email);
  await applyAsArtist(page, world.regressionId, 'Logged-in artist on the same gig as a guest.');
  await applyAsArtist(page, world.declineGigId, 'Please decline this regression application.');
  await applyAsArtist(page, world.deleteGigId, 'I will withdraw this one.');
  await page.getByRole('button', { name: 'Withdraw Application' }).click();
  await expect(page.getByRole('button', { name: 'Apply To Gig' })).toBeVisible({ timeout: 20000 });

  await login(page, world.venue.email);
  await openGigRow(page, 'Overnight Browser Regression');
  await expect(page.getByText('Browser Guest Beside Artist')).toBeVisible();
  await expect(page.getByText('Guest').first()).toBeVisible();
  await expect(page.getByText('Regression Act')).toBeVisible();
  const artistRow = page.locator('div').filter({ hasText: 'Regression Act' }).filter({ has: page.getByRole('button', { name: 'Accept' }) }).last();
  await artistRow.getByRole('button', { name: 'Accept' }).click();
  await keepOpenIfAsked(page);
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByRole('button', { name: 'Cancel gig' }).click();
  await expect(page).toHaveURL(/\/venues\/dashboard\/gigs\/?$/);
  await page.getByRole('button', { name: /Overnight Browser Regression/ }).first().click();
  await page.getByRole('button', { name: 'More actions' }).click();
  const cancel = page.getByRole('button', { name: 'Cancel gig' });
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await page.locator('#cancellation-reason').selectOption('availability');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Gig cancellation successful.')).toBeVisible({ timeout: 20000 });
  await deleteGigFromTable(page, 'Overnight Browser Regression');
  const cancelled = await world.db.doc(`gigs/${world.regressionId}`).get();
  expect(cancelled.exists).toBe(false);

  await openGigRow(page, 'Overnight Browser Decline');
  await page.locator('.venue-gig-running__applicant').getByRole('button', { name: 'Decline' }).click();
  await expect.poll(async () => {
    const doc = await world.db.doc(`gigs/${world.declineGigId}`).get();
    return (doc.data()?.applicants || []).some((entry) => entry.status === 'declined');
  }).toBe(true);

  await deleteGigFromTable(page, 'Overnight Browser Delete');
});

test('privacy. a signed-out read hides guest secrets and a non-owner cannot read private docs', async ({ page }) => {
  watch(page, 'privacy');
  const email = `test+guest-a-${world.stamp}@example.com`;
  const stored = await world.db.collection(`gigs/${world.nightId}/guestApplicants`).where('email', '==', email).limit(1).get();
  expect(stored.empty).toBe(false);
  const applicationId = stored.docs[0].id;
  await assertSignedOutGigHidesSecrets(world.nightId, email);

  await login(page, world.artist.email);
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const headers = { Authorization: `Bearer ${world.artist.token}` };
  const guestRead = await page.request.get(
    `http://${host}/v1/projects/giginltd-dev/databases/(default)/documents/gigs/${world.nightId}/guestApplicants/${applicationId}`,
    { headers },
  );
  const privateRead = await page.request.get(
    `http://${host}/v1/projects/giginltd-dev/databases/(default)/documents/gigs/${world.nightId}/private/details`,
    { headers },
  );
  expect(guestRead.status()).toBe(403);
  expect(privateRead.status()).toBe(403);
});

test('10. no unexpected browser errors', async () => {
  const unique = [...new Set(consoleProblems)];
  expect(unique, unique.join('\n')).toEqual([]);
});
