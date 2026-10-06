/* eslint-env node */
/**
 * Create an artist profile from the landing page, confirm the email,
 * set a password, and land on an empty home.
 * Needs the Firebase emulators, the API, and the web app started with
 * VITE_FEATURE_KEEP_PROFILE=true and VITE_FEATURE_MARKETING_PAGES=true.
 */
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../gigin-api/package.json'));
const admin = require('firebase-admin');

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

test('an artist creates a profile, confirms, and sees an empty home', async ({ page }) => {
  assertSafe();
  const email = `test+artist-signup-${randomUUID()}@example.com`;
  const name = `Signup Act ${randomUUID().slice(0, 8)}`;

  await page.goto('/');
  const card = page.locator('article').filter({ has: page.getByRole('button', { name: 'Create your artist profile' }) });
  await card.getByLabel('Your name').fill(name);
  await card.getByLabel('Email').fill(email);
  await card.getByRole('button', { name: 'Create your artist profile' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  const firestore = db();
  let token = '';
  for (let attempt = 0; attempt < 20 && !token; attempt += 1) {
    const mail = await firestore.collection('mail').where('to', '==', email).get();
    token = mail.docs.map((doc) => String(doc.data()?.message?.text || '')).join('\n').match(/\/profile\/confirm\/([a-f0-9]{64})/)?.[1] || '';
    if (!token) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  expect(token).toBeTruthy();

  await page.goto(`/profile/confirm/${token}`);
  await expect(page.getByRole('heading', { name: 'Create a password' })).toBeVisible();
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 20000 });
  await expect(page.getByText("There's nothing to apply to yet.")).toBeVisible();
  await expect(page.getByText("Nights come from a venue's link.")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fill it in' })).toBeVisible();

  const profiles = await firestore.collection('artistProfiles').where('name', '==', name).get();
  expect(profiles.size).toBe(1);
  const profile = profiles.docs[0].data();
  expect(profile.status).toBe('hidden');
  expect(profile.userId).toBeTruthy();
  expect(JSON.stringify(profile).includes(email)).toBe(false);

  const authUser = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: [profile.userId] }),
  }).then((response) => response.json());
  expect(authUser.users?.[0]?.email).toBe(email);
  expect(authUser.users?.[0]?.emailVerified).toBe(true);
});
