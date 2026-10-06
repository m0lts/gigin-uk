/**
 * Clients cannot write approval fields, create a venue, or publish a pending venue's nights.
 * A venue with no approvalStatus stays publicly readable.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import admin from "firebase-admin";

const PROJECT = "giginltd-dev";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run without the Firebase emulators.");
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === "giginltd-16772" || process.env.GOOGLE_CLOUD_PROJECT === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT });
}
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

async function patch(path, token, fields, mask) {
  const params = mask.map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`).join("&");
  const response = await fetch(`${docUrl(path)}?${params}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  const text = await response.text();
  return { status: response.status, text };
}

test("approval fields are server-only, and a pending venue is not public", async () => {
  const owner = await signUp(`test+rules-owner-${crypto.randomUUID()}@example.com`);
  const stranger = await signUp(`test+rules-stranger-${crypto.randomUUID()}@example.com`);
  const venueId = crypto.randomUUID();
  const gigId = crypto.randomUUID();
  await db.doc(`venueProfiles/${venueId}`).set({
    name: "Rules Room",
    createdBy: owner.uid,
    userId: owner.uid,
    approvalStatus: "pending",
    city: "Cambridge",
  });
  await db.doc(`venueProfiles/${venueId}/members/${owner.uid}`).set({ status: "active", role: "owner" });
  await db.doc(`gigs/${gigId}`).set({
    venueId,
    status: "open",
    gigName: "Hidden night",
    applicants: [],
  });

  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const publicVenue = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/venueProfiles/${venueId}`);
  assert.equal(publicVenue.status, 403);
  const publicGig = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${gigId}`);
  assert.equal(publicGig.status, 403);
  const ownerVenue = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/venueProfiles/${venueId}`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  assert.equal(ownerVenue.status, 200);
  const strangerVenue = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/venueProfiles/${venueId}`, {
    headers: { Authorization: `Bearer ${stranger.token}` },
  });
  assert.equal(strangerVenue.status, 403);

  const renamed = await patch(`venueProfiles/${venueId}`, owner.token, {
    name: { stringValue: "Rules Room Edited" },
  }, ["name"]);
  assert.equal(renamed.status, 200, renamed.text);
  const forged = await patch(`venueProfiles/${venueId}`, owner.token, {
    approvalStatus: { stringValue: "approved" },
    approvedBy: { stringValue: owner.uid },
  }, ["approvalStatus", "approvedBy"]);
  assert.equal(forged.status, 403, forged.text);
  const stored = (await db.doc(`venueProfiles/${venueId}`).get()).data();
  assert.equal(stored.name, "Rules Room Edited");
  assert.equal(stored.approvalStatus, "pending");

  const createdGig = await fetch(`${docUrl("gigs")}?documentId=${crypto.randomUUID()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${owner.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        venueId: { stringValue: venueId },
        status: { stringValue: "open" },
        gigName: { stringValue: "Sneaky night" },
      },
    }),
  });
  assert.equal(createdGig.status, 403, await createdGig.text());

  const published = await patch(`gigs/${gigId}`, owner.token, {
    status: { stringValue: "open" },
    gigName: { stringValue: "Still hidden" },
  }, ["status", "gigName"]);
  assert.equal(published.status, 403, published.text);

  const legacyId = crypto.randomUUID();
  const legacyGig = crypto.randomUUID();
  await db.doc(`venueProfiles/${legacyId}`).set({
    name: "Legacy Room",
    createdBy: owner.uid,
    userId: owner.uid,
  });
  await db.doc(`gigs/${legacyGig}`).set({
    venueId: legacyId,
    status: "open",
    gigName: "Legacy night",
    applicants: [],
  });
  const legacyVenue = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/venueProfiles/${legacyId}`);
  const legacyGigRead = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${legacyGig}`);
  assert.equal(legacyVenue.status, 200);
  assert.equal(legacyGigRead.status, 200);
  const legacyBody = await legacyGigRead.text();
  assert.equal(legacyBody.includes("manageTokenHash"), false);
  assert.equal(legacyBody.includes("soundEngineerContact"), false);

  const listed = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${owner.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "gigs" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "venueId" },
            op: "IN",
            value: { arrayValue: { values: [{ stringValue: legacyId }] } },
          },
        },
      },
    }),
  });
  const listedText = await listed.text();
  assert.equal(listed.status, 200, listedText);
  assert.equal(listedText.includes("PERMISSION_DENIED"), false);
  assert.equal(listedText.includes("Legacy night"), true);

  const edited = await patch(`gigs/${legacyGig}`, owner.token, {
    gigName: { stringValue: "Legacy night edited" },
  }, ["gigName"]);
  assert.equal(edited.status, 200, edited.text);
  assert.equal((await db.doc(`gigs/${legacyGig}`).get()).data().gigName, "Legacy night edited");

  const clientCreate = await fetch(`${docUrl("venueProfiles")}?documentId=${crypto.randomUUID()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stranger.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        createdBy: { stringValue: stranger.uid },
        name: { stringValue: "Client venue" },
        approvalStatus: { stringValue: "approved" },
      },
    }),
  });
  assert.equal(clientCreate.status, 403, await clientCreate.text());
});
