/**
 * Private desk documents belong to the owner. Another signed-in user, a
 * view-only venue member, and a signed-out caller cannot read or write them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import admin from "firebase-admin";
import { viewOnlyPermissions } from "../utils/permissions.js";

const PROJECT = "giginltd-dev";
const USER_DOCS = ["daysOff", "gigDiary", "invoices", "pitches", "artistContacts"];

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run without the Firebase emulators.");
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === "giginltd-16772" || process.env.GOOGLE_CLOUD_PROJECT === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
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
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method,
    headers,
    body: fields ? JSON.stringify({ fields }) : undefined,
  });
  const text = await response.text();
  return { status: response.status, text };
}

function deskFields(label) {
  return {
    value: { mapValue: { fields: { label: { stringValue: label } } } },
    updatedAt: { integerValue: "1" },
  };
}

test("only the owner can read and write a private desk", async () => {
  const owner = await signUp(`test+desk-owner-${crypto.randomUUID()}@example.com`);
  const other = await signUp(`test+desk-other-${crypto.randomUUID()}@example.com`);
  const staff = await signUp(`test+desk-staff-${crypto.randomUUID()}@example.com`);
  const venueId = `ven-${crypto.randomUUID()}`;
  await db.doc(`venueProfiles/${venueId}`).set({
    name: "Desk Room",
    createdBy: owner.uid,
    userId: owner.uid,
    approvalStatus: "approved",
  });
  await db.doc(`venueProfiles/${venueId}/members/${staff.uid}`).set({
    status: "active",
    role: "member",
    permissions: viewOnlyPermissions(),
  });

  for (const docId of USER_DOCS) {
    const created = await firestoreCall(
      "POST",
      `users/${owner.uid}/privateDesk?documentId=${docId}`,
      owner.token,
      deskFields(docId),
    );
    assert.equal(created.status, 200, `${docId} create ${created.text}`);
    const read = await firestoreCall("GET", `users/${owner.uid}/privateDesk/${docId}`, owner.token);
    assert.equal(read.status, 200, `${docId} read ${read.text}`);
    const updated = await firestoreCall(
      "PATCH",
      `users/${owner.uid}/privateDesk/${docId}`,
      owner.token,
      deskFields(`${docId}-next`),
      ["value", "updatedAt"],
    );
    assert.equal(updated.status, 200, `${docId} update ${updated.text}`);
  }

  const legwork = await firestoreCall(
    "POST",
    `venueProfiles/${venueId}/privateDesk?documentId=legwork`,
    owner.token,
    deskFields("guide"),
  );
  assert.equal(legwork.status, 200, legwork.text);
  const legworkRead = await firestoreCall("GET", `venueProfiles/${venueId}/privateDesk/legwork`, owner.token);
  assert.equal(legworkRead.status, 200, legworkRead.text);

  const strangers = [
    ["other user", other.token],
    ["view-only member", staff.token],
    ["signed-out user", ""],
  ];
  for (const [label, token] of strangers) {
    const readUser = await firestoreCall("GET", `users/${owner.uid}/privateDesk/daysOff`, token);
    assert.equal(readUser.status, 403, `${label} read user desk ${readUser.text}`);
    const writeUser = await firestoreCall(
      "PATCH",
      `users/${owner.uid}/privateDesk/daysOff`,
      token,
      deskFields("nope"),
      ["value", "updatedAt"],
    );
    assert.equal(writeUser.status, 403, `${label} write user desk ${writeUser.text}`);
    const readVenue = await firestoreCall("GET", `venueProfiles/${venueId}/privateDesk/legwork`, token);
    assert.equal(readVenue.status, 403, `${label} read legwork ${readVenue.text}`);
    const writeVenue = await firestoreCall(
      "PATCH",
      `venueProfiles/${venueId}/privateDesk/legwork`,
      token,
      deskFields("nope"),
      ["value", "updatedAt"],
    );
    assert.equal(writeVenue.status, 403, `${label} write legwork ${writeVenue.text}`);
  }
});
