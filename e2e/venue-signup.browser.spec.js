/* eslint-env node */
/**
 * Sign up, stay pending, approve from the founder link, then create a night.
 * Needs the Firebase emulators, the API, and the web app started with
 * VITE_FEATURE_VENUE_SIGNUP=true and VITE_FEATURE_MARKETING_PAGES=true.
 */
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../gigin-api/package.json'));
const admin = require('firebase-admin');

const API = process.env.OVERNIGHT_API || 'http://127.0.0.1:8080/api';
const AUTH = 'http://127.0.0.1:9099';
const PASSWORD = 'Overnight1!';

function assertSafe() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
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

test('a venue signs up, waits, is approved, then creates a night', async ({ page }) => {
  assertSafe();
  const email = `test+venue-signup-${randomUUID()}@example.com`;
  const venueName = `Signup Room ${randomUUID().slice(0, 8)}`;

  await page.goto('/');
  const createAccount = page.getByRole('button', { name: 'Create a venue account' }).first();
  await expect(createAccount).toBeVisible();
  await createAccount.click();
  await page.getByPlaceholder('Your Name').fill('Venue Owner');
  await page.getByPlaceholder('e.g. johnsmith@gigin.com').fill(email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /terms and conditions/i }).check();
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();

  const sign = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  }).then((response) => response.json());
  expect(sign.localId).toBeTruthy();
  const verified = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: sign.localId, emailVerified: true }),
  }).then((response) => response.json());
  expect(verified.emailVerified).toBe(true);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByRole('heading', { name: /Add Your Venue/i })).toBeVisible({ timeout: 20000 });

  const signedIn = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  }).then((response) => response.json());
  const venueId = randomUUID();
  const created = await fetch(`${API}/venues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${signedIn.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      venueId,
      name: venueName,
      address: '1 King Street, Cambridge, CB1 1AA, United Kingdom',
      city: 'Cambridge',
      type: 'Public Establishment',
      completed: true,
    }),
  });
  const createdBody = await created.json();
  expect(created.status, JSON.stringify(createdBody)).toBe(201);

  await page.goto('/venues/dashboard');
  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'New gig' })).toHaveCount(0);

  const firestore = db();
  const mail = await firestore.collection('mail').where('to', '==', process.env.VENUE_ACCESS_NOTIFY_EMAIL || 'gardner.b.toby@gmail.com').get();
  const message = mail.docs.map((doc) => doc.data()).find((entry) => String(entry?.message?.text || '').includes(venueName));
  const token = String(message?.message?.text || '').match(/\/admin\/venue-approval\/([a-f0-9]{64})/)?.[1];
  expect(token).toBeTruthy();
  expect((await firestore.doc(`venueProfiles/${venueId}`).get()).data().approvalStatus).toBe('pending');

  await page.goto(`/admin/venue-approval/${token}`);
  await expect(page.getByText(venueName)).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Approved/)).toBeVisible();
  expect((await firestore.doc(`venueProfiles/${venueId}`).get()).data().approvalStatus).toBe('approved');
  const hash = createHash('sha256').update(token).digest('hex');
  expect((await firestore.doc(`venueApprovalTokens/${hash}`).get()).data().usedAt).toBeTruthy();

  await page.goto('/venues/dashboard');
  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toHaveCount(0);
  await page.getByRole('button', { name: 'New gig' }).first().click();
  await expect(page.getByRole('dialog', { name: 'New gig' })).toBeVisible();

  const gigId = randomUUID();
  const when = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const night = await fetch(`${API}/gigs/postMultipleGigs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${signedIn.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      venueId,
      gigDocuments: [{
        gigId,
        venueId,
        gigSlots: [gigId],
        status: 'open',
        gigName: 'Signup Thursday',
        kind: 'Live Music',
        date: when,
        startDateTime: when,
        startTime: '20:00',
        duration: 45,
        applicants: [],
        venue: { venueName },
      }],
    }),
  });
  expect(night.status, await night.text()).toBe(200);
  await page.goto('/venues/dashboard/gigs');
  await expect(page.getByText('Signup Thursday')).toBeVisible({ timeout: 20000 });
});
