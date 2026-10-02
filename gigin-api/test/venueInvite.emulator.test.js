/**
 * A signed-in stranger is not given a venue by the app gate.
 * An invited person can still join through the venue invite route.
 * Refuses to run unless the emulators are set.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import express from "express";
import admin from "firebase-admin";
import { canCreateVenue } from "../../src/config/venueAccess.js";

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

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("a new signup cannot create a venue, and an invited member can still join", async () => {
  assert.equal(canCreateVenue({}, { exists: false }), false);

  const stranger = await signUp(`test+venue-stranger-${crypto.randomUUID()}@example.com`);
  const venueId = crypto.randomUUID();
  const create = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/venueProfiles?documentId=${venueId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stranger.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          createdBy: { stringValue: stranger.uid },
          name: { stringValue: "Unapproved Room" },
        },
      }),
    },
  );
  const createText = await create.text();
  assert.equal(create.status, 403, createText);

  const owner = await signUp(`test+venue-owner-${crypto.randomUUID()}@example.com`);
  const guest = await signUp(`test+venue-guest-${crypto.randomUUID()}@example.com`);
  const inviteId = crypto.randomUUID();
  const invitedVenue = crypto.randomUUID();
  await db.doc(`venueProfiles/${invitedVenue}`).set({
    name: "The Invited Room",
    createdBy: owner.uid,
    userId: owner.uid,
  });
  await db.doc(`venueInvites/${inviteId}`).set({
    inviteId,
    venueId: invitedVenue,
    email: guest.email,
    status: "pending",
    invitedBy: owner.uid,
    invitedByName: "Ada",
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const { default: venuesRouter } = await import("../routes/venues.js");
  const app = express();
  app.use(express.json());
  app.use("/api/venues", venuesRouter);
  const server = await listen(app);
  try {
    const { port } = server.address();
    const joined = await fetch(`http://127.0.0.1:${port}/api/venues/acceptVenueInvite`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${guest.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inviteId }),
    });
    const joinedBody = await joined.json();
    assert.equal(joined.status, 200, JSON.stringify(joinedBody));
    assert.equal(joinedBody.data.ok, true);
    assert.equal(joinedBody.data.venueId, invitedVenue);

    const member = await db.doc(`venueProfiles/${invitedVenue}/members/${guest.uid}`).get();
    assert.equal(member.exists, true);
    assert.equal(member.data().status, "active");
    const user = await db.doc(`users/${guest.uid}`).get();
    assert.ok((user.data()?.venueProfiles || []).includes(invitedVenue));
  } finally {
    server.close();
  }
});
