/**
 * listedVenues is server-only. The finder reads it through the API.
 * Refuses to run unless the Firestore emulator is set.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import admin from "firebase-admin";
import { listedVenueContact } from "../lib/keepProfileLogic.js";

const PROJECT = "giginltd-dev";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Refusing to run without the Firestore emulator.");
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

test("a signed-out client cannot read a listed venue email", async () => {
  const id = `listed-${crypto.randomUUID()}`;
  const email = `book+${crypto.randomUUID()}@example.com`;
  await db.doc(`listedVenues/${id}`).set({
    name: "The Portland",
    city: "Cambridge",
    websiteEmail: email,
  });

  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/listedVenues/${id}`;
  const response = await fetch(url);
  const text = await response.text();
  assert.equal(response.status, 403, text);
  assert.equal(text.includes(email), false);

  const signedOut = listedVenueContact({ name: "The Portland", websiteEmail: email, signedIn: false });
  assert.equal(Object.prototype.hasOwnProperty.call(signedOut, "email"), false);
  const signedIn = listedVenueContact({ name: "The Portland", websiteEmail: email, signedIn: true });
  assert.equal(signedIn.email, email);
});
