/**
 * Clients cannot queue mail, and /api/mail only sends from stored records.
 * Refuses to run unless the emulators are set.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
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

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function postMail(server, token, kind, body) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/mail/${kind}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

test("a signed-in client cannot create a mail document", async () => {
  const user = await signUp(`test+mail-deny-${crypto.randomUUID()}@example.com`);
  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/mail`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        to: { stringValue: "victim@example.com" },
        message: {
          mapValue: {
            fields: {
              subject: { stringValue: "Open relay" },
              text: { stringValue: "sent from the client" },
            },
          },
        },
      },
    }),
  });
  const text = await response.text();
  assert.equal(response.status, 403, text);
  assert.equal(text.includes("Open relay"), false);
});

test("mail routes send only from stored invites and ignore client recipients", async () => {
  const express = (await import("express")).default;
  const { default: mailRoutes } = await import("../routes/mail.js");
  const app = express();
  app.use(express.json());
  app.use("/api/mail", mailRoutes);
  const server = await listen(app);

  const owner = await signUp(`test+mail-owner-${crypto.randomUUID()}@example.com`);
  const outsider = await signUp(`test+mail-outsider-${crypto.randomUUID()}@example.com`);
  const venueId = crypto.randomUUID();
  const inviteId = crypto.randomUUID();
  const gigId = crypto.randomUUID();
  const gigInviteId = crypto.randomUUID();
  const storedTo = `staff-${crypto.randomUUID()}@example.com`;
  const gigTo = `artist-${crypto.randomUUID()}@example.com`;
  const poisoned = `victim-${crypto.randomUUID()}@evil.example`;

  await db.doc(`venueProfiles/${venueId}`).set({
    name: "The <script>Portland</script>",
    accountName: "Ada",
    createdBy: owner.uid,
    email: "venue-inbox@example.com",
  });
  await db.doc(`venueInvites/${inviteId}`).set({
    inviteId,
    venueId,
    email: storedTo,
    status: "pending",
    invitedBy: owner.uid,
  });
  await db.doc(`gigs/${gigId}`).set({
    gigId,
    venueId,
    private: true,
    gigName: "Friday set",
    date: admin.firestore.Timestamp.fromDate(new Date("2026-10-02T20:00:00Z")),
    venue: { venueName: "The Portland" },
  });
  await db.doc(`gigInvites/${gigInviteId}`).set({
    inviteId: gigInviteId,
    gigId,
    venueId,
    email: gigTo,
    active: true,
    createdBy: owner.uid,
  });

  try {
    const denied = await postMail(server, outsider.token, "venue-invite", {
      inviteId,
      to: poisoned,
      gigLink: "https://evil.example/phish",
      origin: "http://127.0.0.1:5173",
    });
    assert.equal(denied.status, 403, JSON.stringify(denied.json));
    const leaked = await db.collection("mail").where("to", "==", poisoned).get();
    assert.equal(leaked.empty, true);

    const removed = await postMail(server, owner.token, "dispute-notice", { dateLabel: "Friday" });
    assert.equal(removed.status, 404);

    const sent = await postMail(server, owner.token, "venue-invite", {
      inviteId,
      to: poisoned,
      venueName: "Attacker venue",
      gigLink: "https://evil.example/phish",
      origin: "https://evil.example",
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.json));
    assert.equal(sent.json.sent, true);

    const queued = await db.collection("mail").where("to", "==", storedTo).limit(5).get();
    assert.equal(queued.empty, false);
    const message = queued.docs[0].data().message || {};
    assert.match(message.subject, /The <script>Portland<\/script>/);
    assert.match(message.html, /&lt;script&gt;/);
    assert.equal(message.html.includes("<script>"), false);
    assert.match(message.html, /https:\/\/giginmusic\.com\/join-venue\?invite=/);
    assert.equal(message.html.includes("evil.example"), false);
    assert.equal(message.text.includes(poisoned), false);
    assert.equal(message.text.includes("Attacker venue"), false);

    const gigSent = await postMail(server, owner.token, "gig-invite", {
      inviteId: gigInviteId,
      to: poisoned,
      gigLink: "https://evil.example/gig",
      userName: "Phisher",
      origin: "http://127.0.0.1:5173",
    });
    assert.equal(gigSent.status, 200, JSON.stringify(gigSent.json));
    const gigMail = await db.collection("mail").where("to", "==", gigTo).limit(1).get();
    assert.equal(gigMail.empty, false);
    const gigMessage = gigMail.docs[0].data().message || {};
    assert.match(gigMessage.subject, /Ada has invited you to play at The <script>Portland<\/script>/);
    assert.match(gigMessage.text, /Check it out on Gigin/);
    assert.match(gigMessage.html, new RegExp(`http://127\\.0\\.0\\.1:5173/gig/${gigId}\\?inviteId=${gigInviteId}`));
    assert.equal(gigMessage.html.includes("evil.example"), false);
    assert.equal(gigMessage.html.includes("Phisher"), false);
    assert.equal(gigMessage.html.includes("<script>"), false);
  } finally {
    server.close();
  }
});

test("a user cannot send more than 30 emails an hour", async () => {
  const express = (await import("express")).default;
  const { default: mailRoutes } = await import("../routes/mail.js");
  const app = express();
  app.use(express.json());
  app.use("/api/mail", mailRoutes);
  const server = await listen(app);
  const owner = await signUp(`test+mail-limit-${crypto.randomUUID()}@example.com`);
  try {
    let last = { status: 0 };
    for (let i = 0; i < 31; i += 1) {
      last = await postMail(server, owner.token, "dispute-notice", {});
    }
    assert.equal(last.status, 429);
  } finally {
    server.close();
  }
});
