/**
 * A venue with no photos used to throw in the settings list and trip the error boundary.
 * Refuses to start unless the Firebase emulators are set, and refuses the prod project.
 */
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../gigin-api/package.json'));
const admin = require('firebase-admin');

const AUTH = 'http://127.0.0.1:9099';
const PASSWORD = 'Overnight1!';

function assertSafe() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Refusing to run browser tests without the Firebase emulators.');
  }
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
  if (project === 'giginltd-16772') throw new Error('Refusing to run against production.');
}

test('venue settings opens at 375px without an error boundary', async ({ page }) => {
  assertSafe();
  if (!admin.apps.length) admin.initializeApp({ projectId: 'giginltd-dev' });
  const db = admin.firestore();
  const email = `test+settings-375-${Date.now()}@example.com`;
  const sign = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  }).then((response) => response.json());
  if (!sign.localId) throw new Error('Auth emulator signup failed.');
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: sign.localId, emailVerified: true }),
  });
  const venueId = randomUUID();
  await db.doc(`users/${sign.localId}`).set({
    email,
    name: 'Settings Phone',
    venueProfiles: [venueId],
  });
  await db.doc(`venueProfiles/${venueId}`).set({
    venueId,
    name: 'No Photo Venue',
    completed: true,
    createdBy: sign.localId,
    userId: sign.localId,
  });

  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByPlaceholder('e.g. johnsmith@gigin.com').fill(email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  await page.goto('/venues/dashboard/my-venues');
  await expect(page.getByRole('heading', { name: 'My Venues' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('No Photo Venue')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Oops!' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
