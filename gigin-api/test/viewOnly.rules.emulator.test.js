/**
 * A view-only member can read a night and cannot write gigs, applications,
 * promo, venue settings, or contacts. A member with those permissions still can.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import admin from "firebase-admin";
import { viewOnlyPermissions } from "../utils/permissions.js";

const PROJECT = "giginltd-dev";
const BUCKET = `${PROJECT}.firebasestorage.app`;
const STORAGE = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199").replace(/^https?:\/\//, "");

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run without the Firebase emulators.");
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === "giginltd-16772" || process.env.GOOGLE_CLOUD_PROJECT === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

process.env.FIREBASE_STORAGE_EMULATOR_HOST = STORAGE;
process.env.STORAGE_EMULATOR_HOST = `http://${STORAGE}`;

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
const db = admin.firestore();

async function signUp(email) {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-123", returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  return { uid: body.localId, token: body.idToken, email };
}

function docUrl(path) {
  return `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
}

async function firestoreCall(method, path, token, fields, mask) {
  const params = mask ? mask.map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`).join("&") : "";
  const joiner = path.includes("?") ? "&" : "?";
  const url = params ? `${docUrl(path)}${joiner}${params}` : docUrl(path);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: fields ? JSON.stringify({ fields }) : undefined,
  });
  const text = await response.text();
  return { status: response.status, text };
}

async function storageWrite(objectPath, token, bytes) {
  const url = `http://${STORAGE}/v0/b/${BUCKET}/o?name=${encodeURIComponent(objectPath)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Firebase ${token}`,
      "Content-Type": "image/jpeg",
    },
    body: Buffer.from(bytes),
  });
  const text = await response.text();
  return { status: response.status, text };
}

function contactFields(name) {
  return { name: { stringValue: name } };
}

test("a view-only member is refused writes to gigs, applications, promo, venue settings and contacts", async () => {
  const owner = await signUp(`test+view-owner-${crypto.randomUUID()}@example.com`);
  const staff = await signUp(`test+view-staff-${crypto.randomUUID()}@example.com`);
  const venueId = `ven-${crypto.randomUUID()}`;
  const gigId = `gig-${crypto.randomUUID()}`;
  await db.doc(`users/${staff.uid}`).set({ venueProfiles: [venueId] });
  await db.doc(`venueProfiles/${venueId}`).set({
    name: "View Room",
    createdBy: owner.uid,
    userId: owner.uid,
    approvalStatus: "approved",
  });
  await db.doc(`venueProfiles/${venueId}/members/${staff.uid}`).set({
    status: "active",
    role: "member",
    permissions: viewOnlyPermissions(),
  });
  await db.doc(`gigs/${gigId}`).set({
    venueId,
    gigName: "Friday",
    status: "open",
    applicants: [],
  });
  await db.doc(`gigs/${gigId}/private/applications`).set({ applications: [] });
  await db.doc(`users/${staff.uid}/artistCRM/kept`).set({ name: "Kept Act" });
  await db.doc(`venueProfiles/${venueId}/artistCRM/kept`).set({ name: "Venue Act" });

  const readGig = await firestoreCall("GET", `gigs/${gigId}`, staff.token);
  assert.equal(readGig.status, 200, readGig.text);

  const createdGig = await firestoreCall("POST", `gigs?documentId=${crypto.randomUUID()}`, staff.token, {
    venueId: { stringValue: venueId },
    gigName: { stringValue: "Sneaky night" },
    status: { stringValue: "open" },
  });
  assert.equal(createdGig.status, 403, createdGig.text);

  const editedGig = await firestoreCall("PATCH", `gigs/${gigId}`, staff.token, {
    gigName: { stringValue: "Renamed" },
  }, ["gigName"]);
  assert.equal(editedGig.status, 403, editedGig.text);

  const applicants = await firestoreCall("PATCH", `gigs/${gigId}`, staff.token, {
    applicants: { arrayValue: { values: [] } },
  }, ["applicants"]);
  assert.equal(applicants.status, 403, applicants.text);

  const privateApps = await firestoreCall("PATCH", `gigs/${gigId}/private/applications`, staff.token, {
    note: { stringValue: "booked" },
  }, ["note"]);
  assert.equal(privateApps.status, 403, privateApps.text);

  const promo = await storageWrite(`gig-media/${gigId}/set.mp3`, staff.token, "promo");
  assert.equal(promo.status, 403, promo.text);

  const venueName = await firestoreCall("PATCH", `venueProfiles/${venueId}`, staff.token, {
    name: { stringValue: "Stolen Room" },
  }, ["name"]);
  assert.equal(venueName.status, 403, venueName.text);

  const venuePhoto = await storageWrite(`venues/${venueId}/front.jpg`, staff.token, "photo");
  assert.equal(venuePhoto.status, 403, venuePhoto.text);

  const ownContact = await firestoreCall(
    "POST",
    `users/${staff.uid}/artistCRM?documentId=new-contact`,
    staff.token,
    contactFields("New Act"),
  );
  assert.equal(ownContact.status, 403, ownContact.text);

  const editedContact = await firestoreCall("PATCH", `users/${staff.uid}/artistCRM/kept`, staff.token, {
    name: { stringValue: "Changed Act" },
  }, ["name"]);
  assert.equal(editedContact.status, 403, editedContact.text);

  const venueContact = await firestoreCall(
    "POST",
    `venueProfiles/${venueId}/artistCRM?documentId=new-venue-contact`,
    staff.token,
    contactFields("Venue New"),
  );
  assert.equal(venueContact.status, 403, venueContact.text);

  assert.equal((await db.doc(`gigs/${gigId}`).get()).data().gigName, "Friday");
  assert.equal((await db.doc(`venueProfiles/${venueId}`).get()).data().name, "View Room");
  assert.equal((await db.doc(`users/${staff.uid}/artistCRM/kept`).get()).data().name, "Kept Act");
  assert.equal((await db.doc(`users/${staff.uid}/artistCRM/new-contact`).get()).exists, false);
});

test("a member allowed to edit can still write the gig, the venue and a contact", async () => {
  const owner = await signUp(`test+edit-owner-${crypto.randomUUID()}@example.com`);
  const staff = await signUp(`test+edit-staff-${crypto.randomUUID()}@example.com`);
  const venueId = `ven-${crypto.randomUUID()}`;
  const gigId = `gig-${crypto.randomUUID()}`;
  const permissions = {
    ...viewOnlyPermissions(),
    "gigs.update": true,
    "venue.update": true,
  };
  await db.doc(`users/${staff.uid}`).set({ venueProfiles: [venueId] });
  await db.doc(`venueProfiles/${venueId}`).set({
    name: "Edit Room",
    createdBy: owner.uid,
    userId: owner.uid,
    approvalStatus: "approved",
  });
  await db.doc(`venueProfiles/${venueId}/members/${staff.uid}`).set({
    status: "active",
    role: "member",
    permissions,
  });
  await db.doc(`gigs/${gigId}`).set({
    venueId,
    gigName: "Friday",
    status: "open",
  });

  const editedGig = await firestoreCall("PATCH", `gigs/${gigId}`, staff.token, {
    gigName: { stringValue: "Saturday" },
  }, ["gigName"]);
  assert.equal(editedGig.status, 200, editedGig.text);

  const venueName = await firestoreCall("PATCH", `venueProfiles/${venueId}`, staff.token, {
    name: { stringValue: "Edited Room" },
  }, ["name"]);
  assert.equal(venueName.status, 200, venueName.text);

  const ownContact = await firestoreCall(
    "POST",
    `users/${staff.uid}/artistCRM?documentId=new-contact`,
    staff.token,
    contactFields("Editable Act"),
  );
  assert.equal(ownContact.status, 200, ownContact.text);

  const venuePhoto = await storageWrite(`venues/${venueId}/front.jpg`, staff.token, "photo");
  assert.equal(venuePhoto.status, 200, venuePhoto.text);

  assert.equal((await db.doc(`gigs/${gigId}`).get()).data().gigName, "Saturday");
  assert.equal((await db.doc(`venueProfiles/${venueId}`).get()).data().name, "Edited Room");
  assert.equal((await db.doc(`users/${staff.uid}/artistCRM/new-contact`).get()).data().name, "Editable Act");
});
