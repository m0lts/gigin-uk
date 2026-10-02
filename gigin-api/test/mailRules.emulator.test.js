/**
 * Clients cannot queue mail. The API templates still write a mail document.
 * Refuses to run unless the emulators are set.
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

test("a gig invite and a dispute notice still queue mail", async () => {
  const { sendGigInviteEmail, sendDisputeNoticeEmail } = await import("../lib/legacyMail.js");
  const to = `test+invite-${crypto.randomUUID()}@example.com`;
  await sendGigInviteEmail({
    to,
    userName: "Ada",
    venueName: "The Portland",
    date: "Friday 2 October",
    gigLink: "https://giginmusic.com/gig/abc",
  });
  const invite = await db.collection("mail").where("to", "==", to).limit(1).get();
  assert.equal(invite.empty, false);
  const message = invite.docs[0].data().message || {};
  assert.equal(message.subject, "Ada has invited you to play at The Portland");
  assert.match(message.text, /Friday 2 October/);
  assert.match(message.html, /Check it out on Gigin/);

  await sendDisputeNoticeEmail({ dateLabel: "Friday 2 October" });
  const notice = await db.collection("mail").where("to", "==", "toby@giginmusic.com").get();
  const hit = notice.docs.map((doc) => doc.data()).find((row) => row.message?.text?.includes("Friday 2 October"));
  assert.ok(hit);
  assert.equal(hit.message.subject, "Dispute Logged");
});
