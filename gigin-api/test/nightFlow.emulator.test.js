/**
 * One-application-per-night checks against the local emulators.
 * Addresses are test+name@example.com only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import admin from 'firebase-admin';

const API = process.env.OVERNIGHT_API || 'http://127.0.0.1:8100/api';
const PROJECT = 'giginltd-dev';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Refusing to run without the Firebase emulators.');
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
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo', {
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
  return { status: response.status, json };
}

function futureIso() {
  return new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString();
}

async function seedVenue(uid, email) {
  const venueId = `venue-${crypto.randomUUID()}`;
  await db.doc(`venueProfiles/${venueId}`).set({
    name: 'Night Flow Bar',
    venueName: 'Night Flow Bar',
    email,
    createdBy: uid,
    userId: uid,
  });
  await db.doc(`venueProfiles/${venueId}/members/${uid}`).set({
    role: 'owner',
    status: 'active',
    permissions: { 'gigs.update': true, 'gigs.applications.manage': true, 'gigs.create': true },
  });
  return venueId;
}

async function createGig(token, venueId, { name, slots }) {
  const ids = Array.from({ length: slots }, () => crypto.randomUUID());
  const when = futureIso();
  const documents = ids.map((gigId, index) => ({
    gigId,
    gigSlots: ids,
    venueId,
    date: when,
    startDateTime: when,
    startTime: `${20 + index}:00`.replace(/^(\d):/, '0$1:'),
    duration: 45,
    status: 'open',
    applicationsOpen: true,
    private: false,
    guestApplications: true,
    gigName: slots > 1 ? `${name} (Set ${index + 1})` : name,
    kind: 'Live Music',
    budget: '£0',
    applicants: [],
    venue: { venueName: 'Night Flow Bar' },
  }));
  const created = await api('/gigs/postMultipleGigs', {
    method: 'POST',
    token,
    body: { venueId, gigDocuments: documents },
  });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  return ids;
}

function guestBody(gigId, { email, act, preference, phone = '07000999111' }) {
  return {
    applicationId: crypto.randomUUID(),
    manageToken: crypto.randomBytes(32).toString('hex'),
    gigId,
    preferredSlotGigIds: preference,
    slotGigIds: preference,
    actName: act,
    contactName: 'Guest Tester',
    contacts: { email, phone },
    note: 'Night flow note',
    members: [{ name: 'Guest Tester', instruments: ['Vocals'] }],
  };
}

function mailStart(doc) {
  const start = doc.delivery?.startTime;
  if (!start) return null;
  return typeof start.toDate === 'function' ? start.toDate() : new Date(start);
}

test('one application per night: preference, assign, mail, close, old data, privacy', async () => {
  const stamp = Date.now();
  const venueEmail = `test+night-venue-${stamp}@example.com`;
  const venue = await signUp(venueEmail);
  const artist = await signUp(`test+night-artist-${stamp}@example.com`);
  const outsider = await signUp(`test+night-outsider-${stamp}@example.com`);
  const venueId = await seedVenue(venue.uid, venueEmail);
  const [a, b, c] = await createGig(venue.token, venueId, { name: 'Three set night', slots: 3 });
  const guestEmail = `test+night-guest-${stamp}@example.com`;

  const firstToken = crypto.randomBytes(32).toString('hex');
  const firstId = crypto.randomUUID();
  const first = await api('/guest-applications', {
    method: 'POST',
    body: { ...guestBody(a, { email: guestEmail, act: 'Preference Act', preference: [b] }), applicationId: firstId, manageToken: firstToken },
  });
  assert.equal(first.status, 200, JSON.stringify(first.json));

  const second = await api('/guest-applications', {
    method: 'POST',
    body: guestBody(a, { email: guestEmail, act: 'Preference Act', preference: [] }),
  });
  assert.equal(second.status, 200, JSON.stringify(second.json));
  assert.equal(second.json.applicationId, firstId);

  const root = (await db.doc(`gigs/${a}`).get()).data();
  const preferenceApps = (root.applicants || []).filter((entry) => entry.name === 'Preference Act' || entry.artistName === 'Preference Act');
  assert.equal(preferenceApps.length, 1);
  assert.deepEqual(preferenceApps[0].preferredSlotGigIds, []);
  const contacts = await db.collection(`users/${venue.uid}/artistCRM`).where('email', '==', guestEmail).get();
  assert.equal(contacts.size, 1);

  const laterEmail = `test+night-other-${stamp}@example.com`;
  const other = await api('/guest-applications', {
    method: 'POST',
    body: guestBody(a, { email: laterEmail, act: 'Later Act', preference: [], phone: '07000999222' }),
  });
  assert.equal(other.status, 200, JSON.stringify(other.json));
  const laterId = other.json.applicationId;

  const profileId = `artist-${crypto.randomUUID()}`;
  await db.doc(`users/${artist.uid}`).set({ artistProfiles: [profileId], email: artist.email });
  await db.doc(`artistProfiles/${profileId}`).set({ userId: artist.uid, name: 'Logged In Act', email: artist.email });
  await db.doc(`artistProfiles/${profileId}/members/${artist.uid}`).set({
    status: 'active', role: 'owner', permissions: { 'gigs.book': true }, userId: artist.uid,
  });
  const loggedIn = await api('/gigs/applyToGig', {
    method: 'POST',
    token: artist.token,
    body: {
      gigId: c,
      preferredSlotGigIds: [c],
      musicianProfile: { musicianId: profileId, name: 'Logged In Act' },
    },
  });
  assert.equal(loggedIn.status, 200, JSON.stringify(loggedIn.json));

  const venueNotices = (await db.collection('mail').where('to', '==', venueEmail).get()).docs
    .map((doc) => doc.data())
    .filter((mail) => /application/i.test(String(mail.message?.subject || '')));
  assert.equal(venueNotices.length, 1, 'applications in the same hour share one venue email');
  assert.match(venueNotices[0].message.text, /Preference Act/);
  assert.match(venueNotices[0].message.text, /Later Act/);
  assert.match(venueNotices[0].message.text, /Logged In Act/);
  assert.equal((venueNotices[0].message.text.match(/Preference Act/g) || []).length, 1);
  const noticeStart = mailStart(venueNotices[0]);
  assert.ok(noticeStart, 'the venue notice is delayed');
  const noticeWait = noticeStart.getTime() - Date.now();
  assert.ok(noticeWait > 50 * 60 * 1000 && noticeWait < 70 * 60 * 1000);

  const afterArtist = (await db.doc(`gigs/${a}`).get()).data();
  assert.equal((afterArtist.applicants || []).filter((entry) => entry.id === profileId).length, 1);
  assert.equal((await db.doc(`gigs/${c}`).get()).data().applicants.some((entry) => entry.id === profileId && entry.status !== 'confirmed'), false);

  const accepted = await api(`/gigs/${a}/applications/${firstId}/accept`, {
    method: 'POST',
    token: venue.token,
    body: { slotGigId: b },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.json));
  const later = await api(`/gigs/${a}/applications/${laterId}/accept`, {
    method: 'POST',
    token: venue.token,
    body: { slotGigId: null },
  });
  assert.equal(later.status, 200, JSON.stringify(later.json));

  let night = (await db.doc(`gigs/${a}`).get()).data();
  const acceptedGuest = night.applicants.find((entry) => entry.id === firstId);
  assert.equal(acceptedGuest.status, 'accepted');
  assert.equal(acceptedGuest.assignedSlotGigId, b);
  const slotB = (await db.doc(`gigs/${b}`).get()).data();
  assert.equal(slotB.bookedApplicantId, firstId);
  assert.equal(slotB.applicants.some((entry) => entry.id === firstId && entry.status === 'confirmed'), true);

  const assigned = await api(`/gigs/${a}/applications/${laterId}/assign`, {
    method: 'POST',
    token: venue.token,
    body: { slotGigId: a },
  });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.json));
  const moved = await api(`/gigs/${a}/applications/${laterId}/assign`, {
    method: 'POST',
    token: venue.token,
    body: { slotGigId: c },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.json));
  const swapped = await api(`/gigs/${a}/applications/${laterId}/assign`, {
    method: 'POST',
    token: venue.token,
    body: { slotGigId: b },
  });
  assert.equal(swapped.status, 200, JSON.stringify(swapped.json));
  const afterSwapA = (await db.doc(`gigs/${a}`).get()).data();
  const guestNow = afterSwapA.applicants.find((entry) => entry.id === firstId);
  const laterNow = afterSwapA.applicants.find((entry) => entry.id === laterId);
  assert.equal(laterNow.assignedSlotGigId, b);
  assert.equal(guestNow.assignedSlotGigId, c);
  assert.equal((await db.doc(`gigs/${b}`).get()).data().bookedApplicantId, laterId);

  const privateGuest = (await db.doc(`gigs/${a}/guestApplicants/${firstId}`).get()).data();
  const guestDoc = await db.doc(`gigs/${a}/guestApplicants/${firstId}`).get();
  assert.equal(guestDoc.exists, true);
  const freshToken = crypto.randomBytes(32).toString('hex');
  await guestDoc.ref.set({ manageTokenHash: crypto.createHash('sha256').update(freshToken).digest('hex') }, { merge: true });
  const shown = await api(`/guest-applications/${freshToken}?gigId=${a}`);
  assert.equal(shown.status, 200, JSON.stringify(shown.json));
  const slotText = JSON.stringify(shown.json.slots);
  assert.equal(slotText.includes('Preference Act'), false);
  assert.equal(slotText.includes('Later Act'), false);
  assert.equal(slotText.includes(guestEmail), false);
  assert.equal(shown.json.slots.some((slot) => slot.gigId === b && slot.taken === true), true);

  const publicGigText = JSON.stringify((await db.doc(`gigs/${a}`).get()).data());
  assert.equal(publicGigText.includes(guestEmail), false);
  assert.equal(publicGigText.includes('07000999111'), false);
  assert.equal(publicGigText.includes(freshToken), false);
  assert.equal(publicGigText.includes(privateGuest.manageTokenHash), false);

  const declineId = laterId;
  const declined = await api(`/gigs/${a}/applications/${declineId}/decline`, {
    method: 'POST',
    token: venue.token,
  });
  assert.equal(declined.status, 200, JSON.stringify(declined.json));
  const declineMailId = (await db.doc(`gigs/${a}`).get()).data().applicants.find((entry) => entry.id === declineId)?.undo?.mailIds?.[0];
  const declineMail = declineMailId ? await db.doc(`mail/${declineMailId}`).get() : null;
  assert.equal(declineMail?.exists, true);
  const declineDelay = mailStart(declineMail.data()).getTime() - Date.now();
  assert.ok(declineDelay > 4 * 60 * 1000 && declineDelay < 6 * 60 * 1000, `decline delay ${declineDelay}`);
  const undone = await api(`/gigs/${a}/applications/${declineId}/undo`, { method: 'POST', token: venue.token });
  assert.equal(undone.status, 200, JSON.stringify(undone.json));
  assert.equal((await db.doc(`mail/${declineMailId}`).get()).exists, false);

  const acceptMail = await db.collection('mail').where('to', '==', guestEmail).get();
  const delayed = acceptMail.docs.map((doc) => ({ id: doc.id, delay: mailStart(doc.data()) ? mailStart(doc.data()).getTime() - Date.now() : null, data: doc.data() }));
  const tenSecond = delayed.find((row) => row.delay != null && row.delay > 0 && row.delay < 30 * 1000);
  assert.ok(tenSecond, `expected a ~10s accept email, saw ${JSON.stringify(delayed.map((row) => row.delay))}`);

  const allMail = await db.collection('mail').get();
  const missingTo = allMail.docs.filter((doc) => !doc.data().to);
  assert.equal(missingTo.length, 0);

  const reaccepted = await api(`/gigs/${a}/applications/${firstId}/accept`, {
    method: 'POST',
    token: venue.token,
    body: { slotGigId: a },
  });
  assert.equal(reaccepted.status, 200, JSON.stringify(reaccepted.json));
  const withdrawn = await api(`/guest-applications/${freshToken}/withdraw`, { method: 'POST', body: { gigId: a } });
  assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.json));
  assert.equal((await db.doc(`gigs/${a}`).get()).data().bookedApplicantId || null, null);
  const venueMail = await db.collection('mail').where('to', '==', venueEmail).get();
  assert.ok(venueMail.size >= 1, 'venue should be told the accepted act withdrew');

  const filled = await api(`/gigs/${a}/applications/${laterId}/accept`, {
    method: 'POST',
    token: venue.token,
    body: { slotGigId: a },
  });
  assert.equal(filled.status, 200, JSON.stringify(filled.json));
  const closedRest = await api(`/gigs/${a}/close`, {
    method: 'POST',
    token: venue.token,
    body: { declineWaiting: false },
  });
  assert.equal(closedRest.status, 200, JSON.stringify(closedRest.json));
  assert.equal((await db.doc(`gigs/${b}`).get()).data().applicationsOpen, false);
  const reopened = await api(`/gigs/${a}/reopen`, { method: 'POST', token: venue.token });
  assert.equal(reopened.status, 200, JSON.stringify(reopened.json));
  assert.equal((await db.doc(`gigs/${a}`).get()).data().applicationsOpen, true);

  const [only] = await createGig(venue.token, venueId, { name: 'One set night', slots: 1 });
  const oneBody = guestBody(only, { email: `test+night-one-${stamp}@example.com`, act: 'Solo Act', preference: [] });
  const one = await api('/guest-applications', { method: 'POST', body: oneBody });
  assert.equal(one.status, 200, JSON.stringify(one.json));
  const booked = await api(`/gigs/${only}/applications/${one.json.applicationId}/accept`, {
    method: 'POST',
    token: venue.token,
    body: {},
  });
  assert.equal(booked.status, 200, JSON.stringify(booked.json));
  assert.equal((await db.doc(`gigs/${only}`).get()).data().bookedApplicantId, one.json.applicationId);
  const oneMailId = (await db.doc(`gigs/${only}`).get()).data().applicants.find((entry) => entry.id === one.json.applicationId)?.undo?.mailIds?.[0];
  const oneMail = await db.doc(`mail/${oneMailId}`).get();
  assert.equal(oneMail.exists, true);
  const acceptDelay = mailStart(oneMail.data()).getTime() - Date.now();
  assert.ok(acceptDelay > 0 && acceptDelay < 30000, `accept delay ${acceptDelay}`);
  const acceptUndo = await api(`/gigs/${only}/applications/${one.json.applicationId}/undo`, { method: 'POST', token: venue.token });
  assert.equal(acceptUndo.status, 200, JSON.stringify(acceptUndo.json));
  assert.equal((await db.doc(`mail/${oneMailId}`).get()).exists, false);
  assert.equal((await db.doc(`gigs/${only}`).get()).data().bookedApplicantId || null, null);

  const oldIds = await createGig(venue.token, venueId, { name: 'Legacy night', slots: 3 });
  const legacyId = 'legacy-act';
  const waitingId = 'legacy-waiting';
  const legacy = {
    id: legacyId,
    name: 'Legacy Act',
    artistName: 'Legacy Act',
    status: 'confirmed',
    guest: true,
    type: 'guest',
    slotGigIds: [oldIds[0], oldIds[1]],
  };
  const waiting = {
    id: waitingId,
    name: 'Legacy Waiting',
    artistName: 'Legacy Waiting',
    status: 'pending',
    guest: true,
    type: 'guest',
    slotGigIds: [oldIds[1], oldIds[2]],
  };
  await db.doc(`gigs/${oldIds[0]}`).update({ applicants: [{ ...legacy, status: 'confirmed' }], bookedApplicantId: admin.firestore.FieldValue.delete() });
  await db.doc(`gigs/${oldIds[1]}`).update({ applicants: [{ ...legacy, status: 'pending' }, { ...waiting, status: 'pending' }] });
  await db.doc(`gigs/${oldIds[2]}`).update({ applicants: [{ ...waiting, status: 'pending' }] });
  await db.doc(`gigs/${oldIds[0]}/guestApplicants/${waitingId}`).set({
    applicantId: waitingId,
    email: `test+legacy-waiting-${stamp}@example.com`,
    manageTokenHash: crypto.createHash('sha256').update('c'.repeat(40)).digest('hex'),
  });
  const legacyDeclined = await api(`/gigs/${oldIds[0]}/applications/${waitingId}/decline`, {
    method: 'POST',
    token: venue.token,
  });
  assert.equal(legacyDeclined.status, 200, JSON.stringify(legacyDeclined.json));
  const legacyAccepted = await api(`/gigs/${oldIds[0]}/applications/${legacyId}/accept`, {
    method: 'POST',
    token: venue.token,
    body: { slotGigId: oldIds[0] },
  });
  assert.equal(legacyAccepted.status, 200, JSON.stringify(legacyAccepted.json));
  const cancelled = await api('/gigs/revertGigAfterCancellationVenue', {
    method: 'POST',
    token: venue.token,
    body: { gigData: { gigId: oldIds[0], venueId }, cancellationReason: 'availability' },
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.json));

  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const deniedGuest = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${a}/guestApplicants/${firstId}`, {
    headers: { Authorization: `Bearer ${outsider.token}` },
  });
  const deniedPrivate = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${a}/private/details`, {
    headers: { Authorization: `Bearer ${outsider.token}` },
  });
  assert.equal(deniedGuest.status, 403);
  assert.equal(deniedPrivate.status, 403);
  const signedOut = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${a}`);
  if (signedOut.status === 200) {
    const text = await signedOut.text();
    assert.equal(text.includes(guestEmail), false);
    assert.equal(text.includes('07000999111'), false);
    assert.equal(text.includes(freshToken), false);
  }
});
