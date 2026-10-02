/**
 * The public artist profile must not carry an email hash.
 * Refuses to run unless the Firestore emulator is set.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import admin from "firebase-admin";
import { emailIndexKey } from "../lib/keepProfileLogic.js";
import { migrateProfileEmailIndex, profileIdForEmail } from "../lib/profileEmailIndex.js";

const PROJECT = "giginltd-dev";
const SECRET = "emulator-profile-email-secret";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Refusing to run without the Firestore emulator.");
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === "giginltd-16772" || process.env.GOOGLE_CLOUD_PROJECT === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

process.env.PROFILE_EMAIL_INDEX_SECRET = SECRET;

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT });
}
const db = admin.firestore();

async function signedOutDoc(path) {
  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
  const response = await fetch(url);
  const text = await response.text();
  return { status: response.status, text };
}

test("a signed-out read of a live profile has no email-derived field", async () => {
  const profileId = `art-${crypto.randomUUID()}`;
  const email = `test+index-${crypto.randomUUID()}@example.com`;
  const unsalted = crypto.createHash("sha256").update(email).digest("hex");
  await db.doc(`artistProfiles/${profileId}`).set({
    name: "Index Trio",
    slug: `index-${profileId}`,
    status: "live",
    bio: "Public bio",
    contactEmailHash: unsalted,
  });
  await db.doc(`artistProfiles/${profileId}/private/contact`).set({ email });

  const before = await signedOutDoc(`artistProfiles/${profileId}`);
  assert.equal(before.status, 200, before.text);
  assert.equal(before.text.includes("contactEmailHash"), true);

  const result = await migrateProfileEmailIndex(db);
  assert.ok(result.stripped >= 1);
  assert.ok(result.indexed >= 1);

  const after = await signedOutDoc(`artistProfiles/${profileId}`);
  assert.equal(after.status, 200, after.text);
  assert.equal(after.text.includes("contactEmailHash"), false);
  assert.equal(after.text.includes(email), false);
  assert.equal(after.text.includes(unsalted), false);
  assert.equal(after.text.includes("Public bio"), true);

  const key = emailIndexKey(email);
  const index = await signedOutDoc(`profileEmailIndex/${key}`);
  assert.equal(index.status, 403, index.text);

  assert.equal(await profileIdForEmail(db, email), profileId);
  const stored = await db.doc(`profileEmailIndex/${key}`).get();
  assert.equal(stored.data().profileId, profileId);
  assert.equal(JSON.stringify(stored.data()).includes(email), false);
});
