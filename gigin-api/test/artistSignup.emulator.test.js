/**
 * Standalone artist sign-up. The response never says whether the email
 * already has an account. Tokens are hashed, single-use and expiring.
 * Refuses to run unless the local emulators are set.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import express from "express";
import admin from "firebase-admin";

const PROJECT = "giginltd-dev";
const SECRET = "emulator-profile-email-secret";
const IP_MAX = 24;

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run without the Firebase emulators.");
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === "giginltd-16772" || process.env.GOOGLE_CLOUD_PROJECT === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

process.env.PROFILE_EMAIL_INDEX_SECRET = SECRET;
process.env.ARTIST_SIGNUP_EMAIL_MAX = "3";
process.env.ARTIST_SIGNUP_IP_MAX = String(IP_MAX);
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

async function signedOut(path) {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`);
  return { status: response.status, text: await response.text() };
}

test("artist signup hides whether the email exists, and the confirm link works once", async () => {
  const { default: profileRoutes } = await import("../routes/profiles.js");
  const { emailIndexKey } = await import("../lib/keepProfileLogic.js");
  const { profileIdForEmail } = await import("../lib/profileEmailIndex.js");
  const app = express();
  app.use(express.json());
  app.use("/api/profiles", profileRoutes);
  const server = await listen(app);
  const base = `http://127.0.0.1:${server.address().port}`;
  let posts = 0;

  async function signup(body) {
    posts += 1;
    const response = await fetch(`${base}/api/profiles/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return { status: response.status, json };
  }

  async function mailFor(email) {
    const snap = await db.collection("mail").where("to", "==", email).get();
    return snap.docs.map((doc) => doc.data());
  }

  function tokenFrom(messages) {
    const text = messages.map((entry) => entry?.message?.text || "").join("\n");
    return text.match(/\/profile\/confirm\/([a-f0-9]{64})/)?.[1] || "";
  }

  try {
    const freshEmail = `test+artist-new-${crypto.randomUUID()}@example.com`;
    const freshName = `New Act ${crypto.randomUUID().slice(0, 8)}`;
    const takenEmail = `test+artist-taken-${crypto.randomUUID()}@example.com`;
    const signedUp = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: takenEmail, password: "Signup1!aa", returnSecureToken: true }),
    }).then((response) => response.json());
    assert.ok(signedUp.localId);

    const created = await signup({ name: freshName, email: freshEmail, company: "" });
    const taken = await signup({ name: "Someone Else", email: takenEmail, company: "" });
    assert.equal(created.status, 200);
    assert.deepEqual(created.json, { sent: true });
    assert.deepEqual(taken.json, { sent: true });

    const trapEmail = `test+artist-trap-${crypto.randomUUID()}@example.com`;
    const trap = await signup({ name: "Trap Act", email: trapEmail, company: "buy followers" });
    assert.deepEqual(trap.json, { sent: true });
    assert.equal((await mailFor(trapEmail)).length, 0);
    assert.equal((await db.collection("artistProfiles").where("name", "==", "Trap Act").get()).empty, true);

    const freshMail = await mailFor(freshEmail);
    const takenMail = await mailFor(takenEmail);
    const token = tokenFrom(freshMail);
    assert.equal(token.length, 64);
    assert.equal(tokenFrom(takenMail), "");
    assert.match(String(takenMail[0]?.message?.text || ""), /auth\/reset/);
    assert.equal((await db.collection("artistProfiles").where("name", "==", "Someone Else").get()).empty, true);

    const profileId = await profileIdForEmail(db, freshEmail);
    assert.ok(profileId);
    const indexKey = emailIndexKey(freshEmail);
    const index = await db.doc(`profileEmailIndex/${indexKey}`).get();
    assert.equal(JSON.stringify(index.data()).includes(freshEmail), false);
    const indexRead = await signedOut(`profileEmailIndex/${indexKey}`);
    assert.equal(indexRead.status, 403, indexRead.text);

    const pending = (await db.doc(`artistProfiles/${profileId}`).get()).data();
    assert.equal(pending.status, "pending");
    assert.equal(pending.userId, null);
    assert.equal(pending.source, "artist_signup");
    assert.equal(JSON.stringify(pending).includes(freshEmail), false);
    const hiddenRead = await signedOut(`artistProfiles/${profileId}`);
    assert.equal(hiddenRead.status, 403, hiddenRead.text);

    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const tokenDoc = await db.doc(`profileTokens/${hash}`).get();
    assert.equal(tokenDoc.exists, true);
    assert.equal(tokenDoc.data().usedAt, null);
    assert.equal(JSON.stringify(tokenDoc.data()).includes(token), false);

    const opened = await fetch(`${base}/api/profiles/confirm/${token}`);
    const openedBody = await opened.json();
    assert.equal(opened.status, 200, JSON.stringify(openedBody));
    assert.equal(openedBody.directSignup, true);
    assert.equal(openedBody.hasAccount, false);
    assert.equal((await db.doc(`profileTokens/${hash}`).get()).data().usedAt, null);
    assert.equal((await db.doc(`artistProfiles/${profileId}`).get()).data().status, "pending");

    const claimed = await fetch(`${base}/api/profiles/confirm/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Signup1!aa" }),
    });
    const claimedBody = await claimed.json();
    assert.equal(claimed.status, 200, JSON.stringify(claimedBody));
    const live = (await db.doc(`artistProfiles/${profileId}`).get()).data();
    assert.equal(live.status, "hidden");
    assert.ok(live.userId);
    const authUser = await admin.auth().getUser(live.userId);
    assert.equal(authUser.email, freshEmail);
    assert.equal(authUser.emailVerified, true);
    const userDoc = await db.doc(`users/${live.userId}`).get();
    assert.ok((userDoc.data().artistProfiles || []).includes(profileId));
    const stillPrivate = await signedOut(`artistProfiles/${profileId}`);
    assert.equal(stillPrivate.status, 403, stillPrivate.text);
    assert.ok((await db.doc(`profileTokens/${hash}`).get()).data().usedAt);

    const again = await fetch(`${base}/api/profiles/confirm/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Signup1!aa" }),
    });
    assert.equal(again.status, 409);

    const expiringEmail = `test+artist-expire-${crypto.randomUUID()}@example.com`;
    const expiring = await signup({ name: "Expiring Act", email: expiringEmail, company: "" });
    assert.deepEqual(expiring.json, { sent: true });
    const expiringToken = tokenFrom(await mailFor(expiringEmail));
    const expiringHash = crypto.createHash("sha256").update(expiringToken).digest("hex");
    await db.doc(`profileTokens/${expiringHash}`).update({ expiresAt: "2000-01-01T00:00:00.000Z" });
    const expired = await fetch(`${base}/api/profiles/confirm/${expiringToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Signup1!aa" }),
    });
    assert.equal(expired.status, 410);
    const expiredProfileId = await profileIdForEmail(db, expiringEmail);
    const expiredProfile = (await db.doc(`artistProfiles/${expiredProfileId}`).get()).data();
    assert.equal(expiredProfile.status, "pending");
    assert.equal(expiredProfile.userId, null);

    const limitedEmail = `test+artist-limit-${crypto.randomUUID()}@example.com`;
    const first = await signup({ name: "Limit Act", email: limitedEmail, company: "" });
    const second = await signup({ name: "Limit Act", email: limitedEmail, company: "" });
    const third = await signup({ name: "Limit Act", email: limitedEmail, company: "" });
    const fourth = await signup({ name: "Limit Act", email: limitedEmail, company: "" });
    assert.deepEqual(first.json, { sent: true });
    assert.deepEqual(second.json, { sent: true });
    assert.deepEqual(third.json, { sent: true });
    assert.equal(fourth.status, 429);
    assert.equal(JSON.stringify(fourth.json).includes(limitedEmail), false);

    while (posts < IP_MAX) {
      const filler = await signup({
        name: "Filler Act",
        email: `test+artist-ip-${crypto.randomUUID()}@example.com`,
        company: "",
      });
      assert.equal(filler.status, 200, JSON.stringify(filler.json));
    }
    const blocked = await signup({
      name: "Past Act",
      email: `test+artist-ip-${crypto.randomUUID()}@example.com`,
      company: "",
    });
    assert.equal(blocked.status, 429);
    assert.equal(JSON.stringify(blocked.json).includes("@"), false);
  } finally {
    server.close();
  }
});
