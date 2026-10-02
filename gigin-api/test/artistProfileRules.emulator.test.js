/**
 * An artist cannot rewrite server-managed profile fields from the client.
 * The keep-profile editor still saves bio, links, tech rider and media.
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
  return { uid: body.localId, token: body.idToken };
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

test("an artist cannot change status, slug or playedAt, and can still save the editor fields", async () => {
  const owner = await signUp(`test+profile-rules-${crypto.randomUUID()}@example.com`);
  const profileId = `art-${crypto.randomUUID()}`;
  await db.doc(`artistProfiles/${profileId}`).set({
    userId: owner.uid,
    name: "Index Trio",
    slug: "index-trio",
    status: "live",
    source: "guest_keep",
    bio: "Old bio",
    playedAt: [],
    spotifyUrl: "",
    websiteUrl: "",
    techRider: null,
    heroMedia: null,
  });

  const denied = await patch(`artistProfiles/${profileId}`, owner.token, {
    status: { stringValue: "hidden" },
    slug: { stringValue: "stolen" },
    playedAt: { arrayValue: { values: [{ mapValue: { fields: { venueName: { stringValue: "nope" } } } }] } },
  }, ["status", "slug", "playedAt"]);
  assert.equal(denied.status, 403, denied.text);

  const saved = await patch(`artistProfiles/${profileId}`, owner.token, {
    bio: { stringValue: "New bio" },
    spotifyUrl: { stringValue: "https://open.spotify.com/artist/1" },
    youtubeUrl: { stringValue: "https://youtube.com/watch?v=1" },
    instagramUrl: { stringValue: "https://instagram.com/trio" },
    websiteUrl: { stringValue: "https://trio.example" },
    techRider: { mapValue: { fields: { pa: { booleanValue: true } } } },
    heroMedia: { mapValue: { fields: { path: { stringValue: `artistProfiles/${profileId}/hero/a.jpg` } } } },
  }, ["bio", "spotifyUrl", "youtubeUrl", "instagramUrl", "websiteUrl", "techRider", "heroMedia"]);
  assert.equal(saved.status, 200, saved.text);

  const stored = (await db.doc(`artistProfiles/${profileId}`).get()).data();
  assert.equal(stored.bio, "New bio");
  assert.equal(stored.websiteUrl, "https://trio.example");
  assert.equal(stored.techRider.pa, true);
  assert.equal(stored.heroMedia.path, `artistProfiles/${profileId}/hero/a.jpg`);
  assert.equal(stored.status, "live");
  assert.equal(stored.slug, "index-trio");

  const { updateOwnProfile } = await import("../lib/keepProfile.js");
  const updated = await updateOwnProfile(
    { id: profileId, ref: db.doc(`artistProfiles/${profileId}`) },
    {
      bio: "Editor bio",
      spotifyUrl: "https://open.spotify.com/artist/2",
      websiteUrl: "https://editor.example",
      techRider: { monitors: 2 },
      heroMedia: { path: `artistProfiles/${profileId}/hero/b.jpg`, name: "b.jpg", contentType: "image/jpeg" },
      status: "deleted",
      slug: "hacked",
      playedAt: [{ venueName: "nope" }],
    },
  );
  assert.equal(updated.bio, "Editor bio");
  assert.equal(updated.status, "live");
  assert.equal(updated.slug, "index-trio");
  assert.deepEqual(updated.playedAt, []);
  assert.equal(updated.techRider.monitors, 2);
  assert.equal(updated.heroMedia.path, `artistProfiles/${profileId}/hero/b.jpg`);

  const created = await fetch(`${docUrl("artistProfiles")}?documentId=client-${crypto.randomUUID()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${owner.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        userId: { stringValue: owner.uid },
        name: { stringValue: "Sneaky" },
        status: { stringValue: "live" },
        slug: { stringValue: "sneaky" },
      },
    }),
  });
  const createdText = await created.text();
  assert.equal(created.status, 403, createdText);
});
