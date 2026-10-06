/**
 * documentId and nearby gig reads go through the API, which keeps pending venues private.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import express from "express";
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
  return { uid: body.localId, token: body.idToken, email };
}

async function api(port, path, { token, body } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: response.status, json };
}

test("by-id and nearby reads include an approved venue and hide a pending one", async () => {
  const { default: gigsRouter } = await import("../routes/gigs.js");
  const app = express();
  app.use(express.json());
  app.use("/api/gigs", gigsRouter);
  const server = await listen(app);
  const { port } = server.address();
  try {
    const owner = await signUp(`test+gig-api-owner-${crypto.randomUUID()}@example.com`);
    const stranger = await signUp(`test+gig-api-stranger-${crypto.randomUUID()}@example.com`);
    const approvedId = crypto.randomUUID();
    const pendingId = crypto.randomUUID();
    const approvedGig = crypto.randomUUID();
    const pendingGig = crypto.randomUUID();
    const when = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 86400000));
    const geopoint = new admin.firestore.GeoPoint(52.2053, 0.1218);
    await db.doc(`venueProfiles/${approvedId}`).set({
      name: "Approved Room",
      createdBy: owner.uid,
      approvalStatus: "approved",
    });
    await db.doc(`venueProfiles/${pendingId}`).set({
      name: "Pending Room",
      createdBy: owner.uid,
      userId: owner.uid,
      approvalStatus: "pending",
    });
    await db.doc(`venueProfiles/${pendingId}/members/${owner.uid}`).set({ status: "active", role: "owner" });
    await db.doc(`gigs/${approvedGig}`).set({
      venueId: approvedId,
      gigName: "Approved night",
      status: "open",
      startDateTime: when,
      geopoint,
    });
    await db.doc(`gigs/${pendingGig}`).set({
      venueId: pendingId,
      gigName: "Pending night",
      status: "open",
      startDateTime: when,
      geopoint,
    });

    const signedOut = await api(port, "/api/gigs/by-ids", { body: { gigIds: [approvedGig, pendingGig] } });
    assert.equal(signedOut.status, 200, JSON.stringify(signedOut.json));
    const signedOutNames = signedOut.json.data.map((gig) => gig.gigName);
    assert.deepEqual(signedOutNames, ["Approved night"]);

    const signedIn = await api(port, "/api/gigs/by-ids", {
      token: stranger.token,
      body: { gigIds: [approvedGig, pendingGig] },
    });
    assert.deepEqual(signedIn.json.data.map((gig) => gig.gigName), ["Approved night"]);

    const asOwner = await api(port, "/api/gigs/by-ids", {
      token: owner.token,
      body: { gigIds: [approvedGig, pendingGig] },
    });
    assert.deepEqual(asOwner.json.data.map((gig) => gig.gigName), ["Approved night", "Pending night"]);

    const nearby = await api(port, "/api/gigs/nearby", {
      body: { location: { latitude: 52.2053, longitude: 0.1218 }, radiusInKm: 20 },
    });
    assert.equal(nearby.status, 200, JSON.stringify(nearby.json));
    const nearbyNames = nearby.json.data.gigs.map((gig) => gig.gigName);
    assert.equal(nearbyNames.includes("Approved night"), true, JSON.stringify(nearbyNames));
    assert.equal(nearbyNames.includes("Pending night"), false, JSON.stringify(nearbyNames));

    const missingLocation = await api(port, "/api/gigs/nearby", { body: {} });
    assert.equal(missingLocation.status, 400);
  } finally {
    server.close();
  }
});
