/**
 * API tests against the local Firebase emulators and gigin-api.
 * Addresses are test+name@example.com only. Nothing here sends real email;
 * confirmation mail is read back from the Firestore `mail` collection.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import admin from 'firebase-admin';

const API = process.env.OVERNIGHT_API || 'http://127.0.0.1:8080/api';
const PROJECT = 'giginltd-dev';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Refusing to run without the Firebase emulators. This file must not touch giginltd-dev or production.');
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === 'giginltd-16772' || process.env.GOOGLE_CLOUD_PROJECT === 'giginltd-16772') {
  console.error('Refusing to run against production.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT, storageBucket: `${PROJECT}.firebasestorage.app` });
}
const db = admin.firestore();

async function signUp(email) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test-password-123', returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  return { uid: body.localId, token: body.idToken, email };
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: response.status, json, text };
}

function futureIso() {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

async function seedVenue(uid) {
  const venueId = `venue-${crypto.randomUUID()}`;
  await db.doc(`venueProfiles/${venueId}`).set({
    name: 'Test Bar',
    venueName: 'Test Bar',
    createdBy: uid,
    userId: uid,
  });
  return venueId;
}

async function createGig(token, venueId, { name = 'Overnight gig', slots = 1, privateGig = false } = {}) {
  const ids = Array.from({ length: slots }, () => crypto.randomUUID());
  const when = futureIso();
  const documents = ids.map((gigId, index) => ({
    gigId,
    gigSlots: ids,
    venueId,
    date: when,
    startDateTime: when,
    startTime: index === 0 ? '20:00' : '21:00',
    duration: 45,
    status: 'open',
    applicationsOpen: true,
    private: privateGig,
    gigName: slots > 1 ? `${name} (Set ${index + 1})` : name,
    kind: 'Live Music',
    budget: '£0',
    applicants: [],
    venue: { venueName: 'Test Bar' },
  }));
  const created = await api('/gigs/postMultipleGigs', {
    method: 'POST',
    token,
    body: { venueId, gigDocuments: documents },
  });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  return ids;
}

test('guest apply, close applications, linking, and media share', async () => {
  const venue = await signUp(`test+venue-${Date.now()}@example.com`);
  const artist = await signUp(`test+artist-${Date.now()}@example.com`);
  const existing = await signUp(`test+existing-${Date.now()}@example.com`);
  const venueId = await seedVenue(venue.uid);
  const [slotA, slotB] = await createGig(venue.token, venueId, { slots: 2 });

  const invite = await api('/gigs/invites', {
    method: 'POST',
    token: venue.token,
    body: { gigId: slotA, artistName: 'Guest Act' },
  });
  assert.equal(invite.status, 200, JSON.stringify(invite.json));
  assert.ok(invite.json?.data?.inviteId || invite.json?.inviteId);

  const manageToken = crypto.randomBytes(32).toString('hex');
  const applicationId = crypto.randomUUID();
  const guestEmail = `test+guest-${Date.now()}@example.com`;
  const applied = await api('/guest-applications', {
    method: 'POST',
    body: {
      applicationId,
      manageToken,
      gigId: slotA,
      slotGigIds: [slotA],
      actName: 'The Test Act',
      contactName: 'Guest Tester',
      contacts: { email: guestEmail, phone: '07000000000', instagram: '' },
      needs: ['pa'],
      bringOwn: ['guitar'],
      note: 'We need one vocal mic.',
      members: [{ name: 'Guest Tester', instruments: ['Vocals'] }],
    },
  });
  assert.equal(applied.status, 200, JSON.stringify(applied.json));

  const publicGig = (await db.doc(`gigs/${slotA}`).get()).data();
  const publicText = JSON.stringify(publicGig);
  assert.equal(publicText.includes(guestEmail), false);
  assert.equal(publicText.includes('The Test Act'), false);
  assert.equal(publicText.includes(applicationId), false);
  assert.equal(publicText.includes('07000000000'), false);
  assert.equal(publicText.includes(manageToken), false);
  assert.equal(publicGig.soundEngineerContact, undefined);
  assert.equal(publicGig.mediaShareTokenHash, undefined);
  const privateGuest = (await db.doc(`gigs/${slotA}/guestApplicants/${applicationId}`).get()).data();
  assert.equal(privateGuest.email, guestEmail);
  assert.equal(privateGuest.manageTokenHash.length, 64);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const photoId = crypto.randomUUID();
  const signed = await api('/guest-applications/upload-url', {
    method: 'POST',
    body: { applicationId: photoId, kind: 'photo', contentType: 'image/png', name: 'pixel.png', size: png.length },
  });
  assert.equal(signed.status, 200, JSON.stringify(signed.json));
  assert.equal(signed.json.method, 'POST');
  assert.match(signed.json.uploadUrl, /\/guest-applications\/direct-upload\?/);
  const uploaded = await fetch(signed.json.uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: png,
  });
  assert.equal(uploaded.status, 200, await uploaded.text());
  const [photoExists] = await admin.storage().bucket().file(signed.json.path).exists();
  assert.equal(photoExists, true);
  const rejectedType = await api('/guest-applications/upload-url', {
    method: 'POST',
    body: { applicationId: photoId, kind: 'photo', contentType: 'text/plain', name: 'notes.txt', size: 4 },
  });
  assert.equal(rejectedType.status, 400);

  const outsider = await signUp(`test+outsider-${Date.now()}@example.com`);
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const deniedGuest = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${slotA}/guestApplicants/${applicationId}`, {
    headers: { Authorization: `Bearer ${outsider.token}` },
  });
  const deniedPrivate = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${slotA}/private/details`, {
    headers: { Authorization: `Bearer ${outsider.token}` },
  });
  assert.equal(deniedGuest.status, 403);
  assert.equal(deniedPrivate.status, 403);

  const mail = await db.collection('mail').where('to', '==', guestEmail).get();
  assert.ok(mail.size >= 1, 'confirmation email should be queued in mail');

  const edited = await api(`/guest-applications/${manageToken}`, {
    method: 'PATCH',
    body: { gigId: slotA, note: 'Updated note' },
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.json));

  const secondGig = (await createGig(venue.token, venueId, { name: 'Second night' }))[0];
  const again = await api('/guest-applications', {
    method: 'POST',
    body: {
      applicationId: crypto.randomUUID(),
      manageToken: crypto.randomBytes(32).toString('hex'),
      gigId: secondGig,
      slotGigIds: [secondGig],
      actName: 'The Test Act',
      contactName: 'Guest Tester',
      contacts: { email: guestEmail },
      note: 'Same act again',
    },
  });
  assert.equal(again.status, 200, JSON.stringify(again.json));
  const contacts = await db.collection('users').doc(venue.uid).collection('artistCRM').get();
  const sameEmail = contacts.docs.filter((doc) => String(doc.data().email || '').toLowerCase() === guestEmail);
  assert.equal(sameEmail.length, 1, 'same email must reuse one contact');

  const blocked = await api('/guest-applications', {
    method: 'POST',
    body: {
      applicationId: crypto.randomUUID(),
      manageToken: crypto.randomBytes(32).toString('hex'),
      gigId: slotB,
      slotGigIds: [slotB],
      actName: 'Existing Act',
      contactName: 'Existing',
      contacts: { email: existing.email },
    },
  });
  assert.equal(blocked.status, 409);
  assert.match(blocked.json?.error || '', /log in/i);

  const profileId = `artist-${crypto.randomUUID()}`;
  await db.doc(`artistProfiles/${profileId}`).set({ userId: artist.uid, name: 'The Test Act', email: artist.email });
  await db.doc(`users/${artist.uid}`).set({ artistProfiles: [profileId], email: artist.email });
  await db.doc(`artistProfiles/${profileId}/members/${artist.uid}`).set({
    status: 'active',
    role: 'owner',
    permissions: { 'gigs.book': true },
    userId: artist.uid,
  });

  const openApply = await api('/gigs/applyToGig', {
    method: 'POST',
    token: artist.token,
    body: {
      gigId: slotB,
      musicianProfile: { musicianId: profileId, name: 'The Test Act' },
    },
  });
  assert.equal(openApply.status, 200, JSON.stringify(openApply.json));

  const closed = await api('/gigs/updateGigDocument', {
    method: 'POST',
    token: venue.token,
    body: { gigId: slotA, action: 'gigs.applications.manage', updates: { applicationsOpen: false } },
  });
  assert.equal(closed.status, 200, JSON.stringify(closed.json));
  const rejectedGuest = await api('/guest-applications', {
    method: 'POST',
    body: {
      applicationId: crypto.randomUUID(),
      manageToken: crypto.randomBytes(32).toString('hex'),
      gigId: slotA,
      slotGigIds: [slotA],
      actName: 'Too Late',
      contactName: 'Late',
      contacts: { email: `test+late-${Date.now()}@example.com` },
    },
  });
  assert.equal(rejectedGuest.status, 409);
  await api('/gigs/updateGigDocument', {
    method: 'POST',
    token: venue.token,
    body: { gigId: slotB, action: 'gigs.applications.manage', updates: { applicationsOpen: false } },
  });
  const rejectedArtist = await api('/gigs/applyToGig', {
    method: 'POST',
    token: artist.token,
    body: { gigId: slotB, musicianProfile: { musicianId: profileId, name: 'The Test Act' } },
  });
  assert.equal(rejectedArtist.status, 409);
  assert.equal(rejectedArtist.json?.error, 'APPLICATIONS_CLOSED');

  await api('/gigs/updateGigDocument', {
    method: 'POST',
    token: venue.token,
    body: {
      gigId: slotA,
      action: 'gigs.update',
      updates: { soundEngineerName: 'Sam', soundEngineerContact: '07000000001', internalNotes: 'Bring a spare lead' },
    },
  });
  const saved = (await db.doc(`gigs/${slotA}`).get()).data();
  assert.equal(saved.soundEngineerName, undefined);
  assert.equal(saved.soundEngineerContact, undefined);
  assert.equal(saved.internalNotes, 'Bring a spare lead');
  const privateDetails = (await db.doc(`gigs/${slotA}/private/details`).get()).data();
  assert.equal(privateDetails.soundEngineerName, 'Sam');
  assert.equal(privateDetails.soundEngineerContact, '07000000001');

  const guestUser = await signUp(guestEmail);
  const guestProfile = `artist-${crypto.randomUUID()}`;
  await db.doc(`artistProfiles/${guestProfile}`).set({ userId: guestUser.uid, name: 'The Test Act' });
  const linked = await api(`/guest-applications/${manageToken}/link`, {
    method: 'POST',
    token: guestUser.token,
    body: { gigId: slotA },
  });
  assert.equal(linked.status, 200, JSON.stringify(linked.json));
  assert.equal(linked.json?.artistLinked, true);
  const linkedContact = (await db.doc(`users/${venue.uid}/artistCRM/${sameEmail[0].id}`).get()).data();
  assert.equal(linkedContact.artistId, guestProfile);
  const linkedRoot = (await db.doc(`gigs/${slotA}`).get()).data()?.applicationsRootGigId || slotA;
  const linkedPrivate = (await db.doc(`gigs/${linkedRoot}/private/applications`).get()).data();
  const guestEntry = (linkedPrivate?.applicants || []).find((entry) => entry.id === applicationId);
  const linkedPublic = JSON.stringify((await db.doc(`gigs/${slotA}`).get()).data());
  assert.equal(linkedPublic.includes('The Test Act'), false);
  assert.equal(guestEntry.userId, guestUser.uid);
  assert.equal(guestEntry.id, applicationId);

  const weakName = 'Weak Match Act';
  const weakProfile = `artist-${crypto.randomUUID()}`;
  await db.doc(`artistProfiles/${weakProfile}`).set({ userId: existing.uid, name: weakName });
  const weakRef = db.collection('users').doc(venue.uid).collection('artistCRM').doc();
  await weakRef.set({ name: weakName, artistId: null, email: `test+weak-${Date.now()}@example.com` });
  const suggestions = await api('/contact-links/suggestions', { token: venue.token });
  assert.equal(suggestions.status, 200, JSON.stringify(suggestions.json));
  const hit = (suggestions.json?.suggestions || []).find((row) => row.crmEntryId === weakRef.id);
  assert.ok(hit, 'name match should be suggested, not merged');
  assert.equal((await weakRef.get()).data().artistId, null);
  const merged = await api('/contact-links/merge', {
    method: 'POST',
    token: venue.token,
    body: { crmEntryId: weakRef.id, artistId: weakProfile },
  });
  assert.equal(merged.status, 200, JSON.stringify(merged.json));
  const afterMerge = await db.collection('users').doc(venue.uid).collection('artistCRM').where('artistId', '==', weakProfile).get();
  assert.equal(afterMerge.size, 1);

  const wrongType = await api('/gig-media/upload-url', {
    method: 'POST',
    token: venue.token,
    body: { gigId: slotA, contentType: 'text/plain', name: 'notes.txt', size: 100 },
  });
  assert.equal(wrongType.status, 400);
  const tooBig = await api('/gig-media/upload-url', {
    method: 'POST',
    token: venue.token,
    body: { gigId: slotA, contentType: 'image/jpeg', name: 'big.jpg', size: 60 * 1024 * 1024 },
  });
  assert.equal(tooBig.status, 400);
  const share = await api(`/gig-media/${slotA}/share`, { method: 'POST', token: venue.token });
  assert.equal(share.status, 200, JSON.stringify(share.json));
  const tokenValue = share.json?.token;
  const listed = await api(`/gig-media/share/${tokenValue}`);
  assert.equal(listed.status, 200);
  await api(`/gig-media/${slotA}/share`, { method: 'DELETE', token: venue.token });
  const revoked = await api(`/gig-media/share/${tokenValue}`);
  assert.equal(revoked.status, 404);

  const preview = await api(`/link-preview/gig/${slotA}`);
  assert.equal(preview.status, 200);
  assert.match(preview.text, /og:title/);

  const withdrawn = await api(`/guest-applications/${manageToken}/withdraw`, {
    method: 'POST',
    body: { gigId: slotA },
  });
  assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.json));

  const regressionGig = (await createGig(venue.token, venueId, { name: 'Regression' }))[0];
  const regressionApply = await api('/gigs/applyToGig', {
    method: 'POST',
    token: artist.token,
    body: { gigId: regressionGig, musicianProfile: { musicianId: profileId, name: 'The Test Act' } },
  });
  assert.equal(regressionApply.status, 200, JSON.stringify(regressionApply.json));
  const gigData = { gigId: regressionGig, venueId, applicants: [{ id: profileId, status: 'pending' }], budget: '£0', kind: 'Live Music', gigName: 'Regression' };
  const accepted = await api('/gigs/acceptGigOffer', {
    method: 'POST',
    token: venue.token,
    body: { gigData, musicianProfileId: profileId, nonPayableGig: true, role: 'venue' },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.json));
  const declineGig = (await createGig(venue.token, venueId, { name: 'Decline me' }))[0];
  await api('/gigs/applyToGig', {
    method: 'POST',
    token: artist.token,
    body: { gigId: declineGig, musicianProfile: { musicianId: profileId, name: 'The Test Act' } },
  });
  const declined = await api('/gigs/declineGigApplication', {
    method: 'POST',
    token: venue.token,
    body: { gigData: { gigId: declineGig, venueId }, musicianProfileId: profileId, role: 'venue' },
  });
  assert.equal(declined.status, 200, JSON.stringify(declined.json));
  const withdrawGig = (await createGig(venue.token, venueId, { name: 'Withdraw me' }))[0];
  await api('/gigs/applyToGig', {
    method: 'POST',
    token: artist.token,
    body: { gigId: withdrawGig, musicianProfile: { musicianId: profileId, name: 'The Test Act' } },
  });
  const artistWithdraw = await api('/gigs/updateGigDocument', {
    method: 'POST',
    token: artist.token,
    body: {
      gigId: withdrawGig,
      action: 'artist.withdraw.application',
      updates: { applicants: [] },
    },
  });
  assert.equal(artistWithdraw.status, 200, JSON.stringify(artistWithdraw.json));
  const removed = await api('/gigs/deleteGigAndInformation', {
    method: 'POST',
    token: venue.token,
    body: { gigId: declineGig },
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.json));
  assert.equal((await db.doc(`gigs/${declineGig}`).get()).exists, false);
});
