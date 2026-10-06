/**
 * Email links follow BASE_URL. Dev Cloud Run sets that, not PUBLIC_APP_URL.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import express from "express";
import admin from "firebase-admin";

const PROJECT = "giginltd-dev";
const DEV_ORIGIN = "https://giginltd-dev.web.app";
const NOTIFY = "founder-email-links@example.com";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run without the Firebase emulators.");
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === "giginltd-16772" || process.env.GOOGLE_CLOUD_PROJECT === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

process.env.BASE_URL = DEV_ORIGIN;
process.env.PUBLIC_APP_URL = "https://should-not-be-used.example";
process.env.APP_ORIGIN = "https://also-not-used.example";
process.env.VENUE_ACCESS_NOTIFY_EMAIL = NOTIFY;
process.env.PROFILE_EMAIL_INDEX_SECRET = "emulator-profile-email-secret";
process.env.GCLOUD_PROJECT = PROJECT;
process.env.GOOGLE_CLOUD_PROJECT = PROJECT;

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function signUp(email) {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-123", returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  const update = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ localId: body.localId, emailVerified: true }),
  });
  assert.equal(update.ok, true, await update.text());
  const again = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-123", returnSecureToken: true }),
  });
  const signed = await again.json();
  assert.equal(again.ok, true, JSON.stringify(signed));
  return { uid: body.localId, token: signed.idToken, email };
}

async function post(port, path, { token, body } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const json = await response.json();
  return { status: response.status, json };
}

function urlsIn(messages) {
  return messages.flatMap((entry) => String(entry?.message?.text || "").match(/https?:\/\/\S+/g) || []);
}

test("venue approval, artist confirm, and sign-in links use BASE_URL", async () => {
  const { default: venuesRouter } = await import("../routes/venues.js");
  const { default: profileRoutes } = await import("../routes/profiles.js");
  const app = express();
  app.use(express.json());
  app.use("/api/venues", venuesRouter);
  app.use("/api/profiles", profileRoutes);
  const server = await listen(app);
  const { port } = server.address();
  try {
    const owner = await signUp(`test+email-link-venue-${crypto.randomUUID()}@example.com`);
    const created = await post(port, "/api/venues", {
      token: owner.token,
      body: {
        venueId: crypto.randomUUID(),
        name: "Link Room",
        address: "1 King Street, Cambridge, CB1 1AA, United Kingdom",
        city: "Cambridge",
        completed: true,
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const founderMail = await db.collection("mail").where("to", "==", NOTIFY).get();
    const approvalLinks = urlsIn(founderMail.docs.map((doc) => doc.data()))
      .filter((url) => url.includes("/admin/venue-approval/"));
    assert.equal(approvalLinks.length > 0, true);
    assert.equal(approvalLinks.every((url) => url.startsWith(`${DEV_ORIGIN}/`)), true, approvalLinks.join("\n"));

    const artistEmail = `test+email-link-artist-${crypto.randomUUID()}@example.com`;
    const signup = await post(port, "/api/profiles/signup", {
      body: { name: "Link Act", email: artistEmail, company: "" },
    });
    assert.equal(signup.status, 200, JSON.stringify(signup.json));
    const confirmMail = await db.collection("mail").where("to", "==", artistEmail).get();
    const confirmLinks = urlsIn(confirmMail.docs.map((doc) => doc.data()))
      .filter((url) => url.includes("/profile/confirm/"));
    assert.equal(confirmLinks.length > 0, true);
    assert.equal(confirmLinks.every((url) => url.startsWith(`${DEV_ORIGIN}/`)), true, confirmLinks.join("\n"));

    const existingEmail = `test+email-link-existing-${crypto.randomUUID()}@example.com`;
    const existing = await signUp(existingEmail);
    assert.ok(existing.uid);
    const signIn = await post(port, "/api/profiles/signup", {
      body: { name: "Existing Act", email: existingEmail, company: "" },
    });
    assert.equal(signIn.status, 200, JSON.stringify(signIn.json));
    const signInMail = await db.collection("mail").where("to", "==", existingEmail).get();
    const signInLinks = urlsIn(signInMail.docs.map((doc) => doc.data()))
      .filter((url) => url.includes("/auth/reset"));
    assert.equal(signInLinks.length > 0, true);
    assert.equal(signInLinks.every((url) => url.startsWith(`${DEV_ORIGIN}/`)), true, signInLinks.join("\n"));
  } finally {
    server.close();
  }
});
