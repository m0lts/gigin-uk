/**
 * Storage rules against the local emulators.
 * Refuses to run unless the emulator hosts are set.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import admin from 'firebase-admin';

const PROJECT = 'giginltd-dev';
const BUCKET = `${PROJECT}.firebasestorage.app`;
const STORAGE = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199').replace(/^https?:\/\//, '');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Refusing to run without the Firebase emulators.');
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === 'giginltd-16772' || process.env.GOOGLE_CLOUD_PROJECT === 'giginltd-16772') {
  console.error('Refusing to run against production.');
  process.exit(1);
}

process.env.FIREBASE_STORAGE_EMULATOR_HOST = STORAGE;
process.env.STORAGE_EMULATOR_HOST = `http://${STORAGE}`;

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
}
const db = admin.firestore();

async function signUp(email) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test-password-123', returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  return { uid: body.localId, token: body.idToken, email };
}

async function storageCall(method, objectPath, { token, body, contentType = 'image/jpeg' } = {}) {
  const encoded = encodeURIComponent(objectPath);
  const url = method === 'GET' || method === 'DELETE'
    ? `http://${STORAGE}/v0/b/${BUCKET}/o/${encoded}`
    : `http://${STORAGE}/v0/b/${BUCKET}/o?name=${encoded}`;
  const headers = {};
  if (token) headers.Authorization = `Firebase ${token}`;
  if (body != null) headers['Content-Type'] = contentType;
  const response = await fetch(url, { method, headers, body });
  const text = await response.text();
  return { status: response.status, text };
}

test('an artist cannot read or write another user, or any gig media', async () => {
  const owner = await signUp(`test+storage-owner-${crypto.randomUUID()}@example.com`);
  const artist = await signUp(`test+storage-artist-${crypto.randomUUID()}@example.com`);
  const musicianId = `mus-${crypto.randomUUID()}`;
  const profileId = `art-${crypto.randomUUID()}`;
  const venueId = `ven-${crypto.randomUUID()}`;

  await db.doc(`musicianProfiles/${musicianId}`).set({ userId: owner.uid });
  await db.doc(`artistProfiles/${profileId}`).set({ userId: owner.uid, status: 'live' });
  await db.doc(`venueProfiles/${venueId}`).set({ createdBy: owner.uid, userId: owner.uid });

  const ownPhoto = await storageCall('POST', `users/${owner.uid}/profile/photo.jpg`, {
    token: owner.token,
    body: Buffer.from('owner-photo'),
  });
  assert.equal(ownPhoto.status, 200, ownPhoto.text);

  const ownRead = await storageCall('GET', `users/${owner.uid}/profile/photo.jpg`, { token: owner.token });
  assert.equal(ownRead.status, 200, ownRead.text);

  const otherRead = await storageCall('GET', `users/${owner.uid}/profile/photo.jpg`, { token: artist.token });
  assert.equal(otherRead.status, 403, otherRead.text);

  const otherWrite = await storageCall('POST', `users/${owner.uid}/profile/stolen.jpg`, {
    token: artist.token,
    body: Buffer.from('nope'),
  });
  assert.equal(otherWrite.status, 403, otherWrite.text);

  const signedOut = await storageCall('GET', `users/${owner.uid}/profile/photo.jpg`);
  assert.ok(signedOut.status === 401 || signedOut.status === 403, signedOut.text);

  const gigWrite = await storageCall('POST', `gig-media/${crypto.randomUUID()}/set.mp3`, {
    token: artist.token,
    body: Buffer.from('media'),
    contentType: 'audio/mpeg',
  });
  assert.equal(gigWrite.status, 403, gigWrite.text);

  const gigRead = await storageCall('GET', `gig-media/some-gig/file.mp3`, { token: artist.token });
  assert.equal(gigRead.status, 403, gigRead.text);

  const guestRead = await storageCall('GET', `guest-applications/${crypto.randomUUID()}/photo.jpg`, { token: artist.token });
  assert.equal(guestRead.status, 403, guestRead.text);

  const pressRead = await storageCall('GET', `artist-press-kits/${profileId}/kit.pdf`, { token: artist.token });
  assert.equal(pressRead.status, 403, pressRead.text);

  const musicianWrite = await storageCall('POST', `musicians/${musicianId}/photos/shot.jpg`, {
    token: artist.token,
    body: Buffer.from('not-yours'),
  });
  assert.equal(musicianWrite.status, 403, musicianWrite.text);

  const venueWrite = await storageCall('POST', `venues/${venueId}/stolen.jpg`, {
    token: artist.token,
    body: Buffer.from('not-yours'),
  });
  assert.equal(venueWrite.status, 403, venueWrite.text);
});

test('the owner can still upload a venue image and an artist profile image', async () => {
  const owner = await signUp(`test+storage-upload-${crypto.randomUUID()}@example.com`);
  const venueId = `ven-${crypto.randomUUID()}`;
  const profileId = `art-${crypto.randomUUID()}`;
  await db.doc(`venueProfiles/${venueId}`).set({ createdBy: owner.uid, userId: owner.uid });
  await db.doc(`artistProfiles/${profileId}`).set({ userId: owner.uid, status: 'live' });

  const venue = await storageCall('POST', `venues/${venueId}/front.jpg`, {
    token: owner.token,
    body: Buffer.from('venue-image'),
  });
  assert.equal(venue.status, 200, venue.text);

  const hero = await storageCall('POST', `artistProfiles/${profileId}/hero/hero.jpg`, {
    token: owner.token,
    body: Buffer.from('hero'),
  });
  assert.equal(hero.status, 200, hero.text);

  const publicRead = await storageCall('GET', `venues/${venueId}/front.jpg`);
  assert.equal(publicRead.status, 200, publicRead.text);

  const docs = await storageCall('GET', `venues/${venueId}/documents/terms.pdf`);
  assert.ok(docs.status === 401 || docs.status === 403, docs.text);
});

test('a guest photo written by the API is not readable by a client', async () => {
  const artist = await signUp(`test+storage-guest-${crypto.randomUUID()}@example.com`);
  const applicationId = crypto.randomUUID();
  const objectPath = `guest-applications/${applicationId}/photo.jpg`;
  await admin.storage().bucket().file(objectPath).save(Buffer.from('guest-photo'), {
    contentType: 'image/jpeg',
  });

  const clientRead = await storageCall('GET', objectPath, { token: artist.token });
  assert.equal(clientRead.status, 403, clientRead.text);

  const clientWrite = await storageCall('POST', `guest-applications/${applicationId}/extra.jpg`, {
    token: artist.token,
    body: Buffer.from('nope'),
  });
  assert.equal(clientWrite.status, 403, clientWrite.text);
});
