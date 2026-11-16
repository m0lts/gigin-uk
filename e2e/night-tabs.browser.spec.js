/**
 * The venue new-request email opens a night on ?tab=applications.
 * That page used to crash with React error #310 once the gig finished loading.
 * Needs the Firebase emulators, the API, and the web app on the emulators.
 */
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../gigin-api/package.json'));
const admin = require('firebase-admin');

const API = process.env.OVERNIGHT_API || 'http://127.0.0.1:8080/api';
const AUTH = 'http://127.0.0.1:9099';
const PASSWORD = 'Overnight1!';

function assertSafe() {
  const firestore = process.env.FIRESTORE_EMULATOR_HOST;
  const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!firestore || !auth) {
    throw new Error('Refusing to run without the local Firebase emulators.');
  }
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
  if (project === 'giginltd-16772') throw new Error('Refusing to run against production.');
}

function db() {
  assertSafe();
  if (!admin.apps.length) admin.initializeApp({ projectId: 'giginltd-dev' });
  return admin.firestore();
}

async function signUp(email) {
  const sign = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  }).then((response) => response.json());
  if (!sign.localId) throw new Error(`Auth emulator signup failed: ${JSON.stringify(sign)}`);
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: sign.localId, emailVerified: true }),
  });
  const again = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  }).then((response) => response.json());
  return { uid: sign.localId, token: again.idToken, email };
}

function nightUrl(gigId, tab) {
  const search = new URLSearchParams({ gig: gigId });
  if (tab) search.set('tab', tab);
  return `/venues/dashboard/gigs/gig-applications?${search.toString()}`;
}

test('opening a night with ?tab=applications does not crash', async ({ page }) => {
  assertSafe();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `test+night-tabs-${randomUUID()}@example.com`;
  const venue = await signUp(email);
  const venueId = randomUUID();
  const gigId = randomUUID();
  const when = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
  const store = db();
  await store.doc(`users/${venue.uid}`).set({
    email: venue.email,
    name: 'Night Tabs Venue',
    venueProfiles: [venueId],
  });
  await store.doc(`venueProfiles/${venueId}`).set({
    venueId,
    name: 'Night Tabs Bar',
    guestApplications: true,
    completed: true,
    createdBy: venue.uid,
    userId: venue.uid,
  });
  await store.doc(`venueProfiles/${venueId}/members/${venue.uid}`).set({
    role: 'owner',
    status: 'active',
    permissions: { 'gigs.read': true, 'gigs.update': true, 'gigs.applications.manage': true },
  });
  const created = await fetch(`${API}/gigs/postMultipleGigs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${venue.token}` },
    body: JSON.stringify({
      venueId,
      gigDocuments: [{
        gigId,
        gigName: 'Night Tabs Gig',
        kind: 'Live Music',
        status: 'open',
        applicationsOpen: true,
        private: false,
        guestApplications: true,
        startDateTime: when,
        date: when,
        startTime: '20:00',
        duration: 60,
        gigSlots: [gigId],
        applicants: [],
        budget: '£0',
        paymentModel: 'no_fee',
      }],
    }),
  }).then((response) => response.json());
  expect(created?.data?.ok, JSON.stringify(created)).toBeTruthy();

  const assertNoCrash = async () => {
    await expect(page.getByText(/hit a snag/i)).toHaveCount(0);
    const hookError = errors.find((message) => /more hooks|Minified React error #310/i.test(message));
    expect(hookError || '').toBe('');
  };

  for (const tab of ['applications', 'overview', 'promo', 'photos']) {
    await page.goto(nightUrl(gigId, tab));
    await page.waitForTimeout(1500);
    await assertNoCrash();
  }

  await page.goto('/');
  await page.locator('.launch-header').getByRole('button', { name: 'Sign in' }).click();
  const card = page.locator('.auth-card');
  await card.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await card.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await card.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(card).toHaveCount(0, { timeout: 20000 });

  const openTab = async (tab) => {
    await page.goto(nightUrl(gigId, tab));
    const selected = page.getByRole('tab', { name: new RegExp(`^${tab[0].toUpperCase()}${tab.slice(1)}`) });
    await expect(selected).toHaveAttribute('aria-selected', 'true', { timeout: 20000 });
    await assertNoCrash();
  };

  await openTab('applications');
  await expect(page.getByText(/No applications in this view/)).toBeVisible();
  await openTab('overview');
  await expect(page.getByRole('button', { name: 'Download promo' })).toBeVisible();
  await openTab('promo');
  await expect(page.getByRole('heading', { name: 'Not booked yet' })).toBeVisible();
  await openTab('photos');

  await page.getByRole('tab', { name: 'Applications' }).click();
  await expect(page).toHaveURL(/tab=applications/);
  await expect(page.getByText(/No applications in this view/)).toBeVisible();
  await page.getByRole('tab', { name: 'Promo' }).click();
  await expect(page).toHaveURL(/tab=promo/);
  await expect(page.getByRole('heading', { name: 'Ready to post' })).toBeVisible();
  await page.getByRole('tab', { name: /Photos/ }).click();
  await expect(page).toHaveURL(/tab=photos/);
  await page.getByRole('tab', { name: 'Overview' }).click();
  await expect(page).not.toHaveURL(/tab=/);
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  await assertNoCrash();
});
