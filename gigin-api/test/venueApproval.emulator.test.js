/**
 * Pending venues cannot create nights, take applications, or be read in public.
 * The approval link works once. Expired and unknown tokens do not decide anything.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import express from "express";
import admin from "firebase-admin";

const PROJECT = "giginltd-dev";
const NOTIFY = "founder-venue-approval@example.com";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run without the Firebase emulators.");
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === "giginltd-16772" || process.env.GOOGLE_CLOUD_PROJECT === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

process.env.VENUE_ACCESS_NOTIFY_EMAIL = NOTIFY;
process.env.PUBLIC_APP_URL = "http://127.0.0.1:5174";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT });
}
const db = admin.firestore();

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function signUp(email, { verified = true } = {}) {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-123", returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  if (!verified) return { uid: body.localId, token: body.idToken, email };
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

async function api(port, path, { method = "GET", token, body } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: response.status, json };
}

function venueBody(name = "The Pending Room") {
  return {
    venueId: crypto.randomUUID(),
    name,
    address: "1 King Street, Cambridge, CB1 1AA, United Kingdom",
    city: "Cambridge",
    type: "Public Establishment",
    completed: true,
  };
}

async function founderMail() {
  const snap = await db.collection("mail").where("to", "==", NOTIFY).get();
  return snap.docs.map((doc) => doc.data());
}

function tokenFromMail(messages, venueName) {
  const message = messages.find((entry) => String(entry?.message?.text || "").includes(venueName));
  const match = String(message?.message?.text || "").match(/\/admin\/venue-approval\/([a-f0-9]{64})/);
  return match ? match[1] : "";
}

test("a pending venue cannot create a night, take an application, or be read in public", async () => {
  const { default: venuesRouter } = await import("../routes/venues.js");
  const { default: gigsRouter } = await import("../routes/gigs.js");
  const { default: guestRouter } = await import("../routes/guestApplications.js");
  const app = express();
  app.use(express.json());
  app.use("/api/venues", venuesRouter);
  app.use("/api/gigs", gigsRouter);
  app.use("/api/guest-applications", guestRouter);
  const server = await listen(app);
  const { port } = server.address();
  try {
    const unverified = await signUp(`test+venue-unverified-${crypto.randomUUID()}@example.com`, { verified: false });
    const refused = await api(port, "/api/venues", {
      method: "POST",
      token: unverified.token,
      body: venueBody("Unverified Room"),
    });
    assert.equal(refused.status, 403, JSON.stringify(refused.json));
    const stray = await db.collection("venueProfiles").where("createdBy", "==", unverified.uid).get();
    assert.equal(stray.empty, true);

    const owner = await signUp(`test+venue-owner-${crypto.randomUUID()}@example.com`);
    const created = await api(port, "/api/venues", {
      method: "POST",
      token: owner.token,
      body: venueBody("The Pending Room"),
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const venueId = created.json.data.venueId;
    const stored = (await db.doc(`venueProfiles/${venueId}`).get()).data();
    assert.equal(stored.approvalStatus, "pending");
    assert.equal(stored.ownerEmail, undefined);
    assert.equal(stored.email, "");
    assert.equal(JSON.stringify(stored).includes(owner.email), false);
    assert.equal(stored.city, "Cambridge");
    const member = await db.doc(`venueProfiles/${venueId}/members/${owner.uid}`).get();
    assert.equal(member.exists, true);
    assert.equal(member.data().role, "owner");
    assert.equal(member.data().permissions["gigs.create"], true);
    const user = await db.doc(`users/${owner.uid}`).get();
    assert.ok((user.data()?.venueProfiles || []).includes(venueId));

    const second = await api(port, "/api/venues", {
      method: "POST",
      token: owner.token,
      body: venueBody("Second Room"),
    });
    assert.equal(second.status, 409, JSON.stringify(second.json));
    const third = await api(port, "/api/venues", {
      method: "POST",
      token: owner.token,
      body: venueBody("Third Room"),
    });
    assert.equal(third.status, 409, JSON.stringify(third.json));
    const fourth = await api(port, "/api/venues", {
      method: "POST",
      token: owner.token,
      body: venueBody("Fourth Room"),
    });
    assert.equal(fourth.status, 429, JSON.stringify(fourth.json));

    const host = process.env.FIRESTORE_EMULATOR_HOST;
    const publicVenue = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/venueProfiles/${venueId}`);
    assert.equal(publicVenue.status, 403);

    const gigId = crypto.randomUUID();
    const night = await api(port, "/api/gigs/postMultipleGigs", {
      method: "POST",
      token: owner.token,
      body: {
        venueId,
        gigDocuments: [{
          gigId,
          venueId,
          status: "open",
          gigName: "Thursday",
          date: new Date(Date.now() + 7 * 86400000).toISOString(),
          startDateTime: new Date(Date.now() + 7 * 86400000).toISOString(),
        }],
      },
    });
    assert.equal(night.status, 403, JSON.stringify(night.json));
    assert.equal((await db.doc(`gigs/${gigId}`).get()).exists, false);

    await db.doc(`gigs/${gigId}`).set({
      gigId,
      venueId,
      status: "open",
      gigName: "Hidden Thursday",
      venue: { venueName: "The Pending Room" },
    });
    const publicGig = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${gigId}`);
    assert.equal(publicGig.status, 403);
    const ownerGig = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${gigId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    assert.equal(ownerGig.status, 200);

    const application = await api(port, "/api/guest-applications", {
      method: "POST",
      body: {
        gigId,
        applicationId: crypto.randomUUID(),
        manageToken: crypto.randomBytes(32).toString("hex"),
        actName: "Hidden Act",
        contactName: "Ada",
        contacts: { email: `test+act-${crypto.randomUUID()}@example.com` },
      },
    });
    assert.equal(application.status, 403, JSON.stringify(application.json));
    const gigAfter = (await db.doc(`gigs/${gigId}`).get()).data();
    assert.equal(Array.isArray(gigAfter.applicants) ? gigAfter.applicants.length : 0, 0);

    const legacyId = `legacy-${crypto.randomUUID()}`;
    const legacyGig = `legacy-gig-${crypto.randomUUID()}`;
    await db.doc(`venueProfiles/${legacyId}`).set({ name: "Already Live", createdBy: owner.uid, userId: owner.uid });
    await db.doc(`gigs/${legacyGig}`).set({ gigId: legacyGig, venueId: legacyId, status: "open", gigName: "Public Thursday", applicants: [] });
    const legacyVenueRead = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/venueProfiles/${legacyId}`);
    const legacyGigRead = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${legacyGig}`);
    assert.equal(legacyVenueRead.status, 200);
    assert.equal(legacyGigRead.status, 200);
    const legacyText = await legacyGigRead.text();
    assert.equal(legacyText.includes("manageTokenHash"), false);
  } finally {
    server.close();
  }
});

test("the approval link does nothing on open, works once, and rejects expired or unknown tokens", async () => {
  const { default: venuesRouter } = await import("../routes/venues.js");
  const app = express();
  app.use(express.json());
  app.use("/api/venues", venuesRouter);
  const server = await listen(app);
  const { port } = server.address();
  try {
    const owner = await signUp(`test+venue-approve-${crypto.randomUUID()}@example.com`);
    const created = await api(port, "/api/venues", {
      method: "POST",
      token: owner.token,
      body: venueBody("Approval Room"),
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const venueId = created.json.data.venueId;
    const messages = await founderMail();
    const token = tokenFromMail(messages, "Approval Room");
    assert.equal(token.length, 64);
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    assert.notEqual(hash, token);
    const tokenDoc = await db.doc(`venueApprovalTokens/${hash}`).get();
    assert.equal(tokenDoc.exists, true);
    assert.equal(tokenDoc.data().usedAt, null);

    const peeked = await api(port, `/api/venues/approval/${token}`);
    assert.equal(peeked.status, 200, JSON.stringify(peeked.json));
    assert.equal(peeked.json.data.venueName, "Approval Room");
    assert.equal(peeked.json.data.city, "Cambridge");
    assert.equal(peeked.json.data.ownerEmail, owner.email);
    assert.equal(peeked.json.data.state, "ok");
    assert.equal((await db.doc(`venueProfiles/${venueId}`).get()).data().approvalStatus, "pending");
    assert.equal((await db.doc(`venueApprovalTokens/${hash}`).get()).data().usedAt, null);

    const approved = await api(port, `/api/venues/approval/${token}`, {
      method: "POST",
      body: { decision: "approve" },
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.json));
    const after = (await db.doc(`venueProfiles/${venueId}`).get()).data();
    assert.equal(after.approvalStatus, "approved");
    assert.equal(after.approvedBy, "approval-link");
    assert.ok(after.approvedAt);
    assert.equal(JSON.stringify(after).includes(owner.email), false);
    const host = process.env.FIRESTORE_EMULATOR_HOST;
    const publicApproved = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/venueProfiles/${venueId}`);
    assert.equal(publicApproved.status, 200);
    const publicApprovedText = await publicApproved.text();
    assert.equal(publicApprovedText.includes(owner.email), false);
    assert.equal(publicApprovedText.includes("ownerEmail"), false);
    assert.ok((await db.doc(`venueApprovalTokens/${hash}`).get()).data().usedAt);
    const ownerMail = await db.collection("mail").where("to", "==", owner.email).get();
    assert.equal(ownerMail.docs.some((doc) => String(doc.data()?.message?.text || "").includes("is approved")), true);

    const again = await api(port, `/api/venues/approval/${token}`, {
      method: "POST",
      body: { decision: "reject" },
    });
    assert.equal(again.status, 409, JSON.stringify(again.json));
    assert.equal((await db.doc(`venueProfiles/${venueId}`).get()).data().approvalStatus, "approved");

    const other = await signUp(`test+venue-expire-${crypto.randomUUID()}@example.com`);
    const expiredVenue = await api(port, "/api/venues", {
      method: "POST",
      token: other.token,
      body: venueBody("Expired Room"),
    });
    assert.equal(expiredVenue.status, 201, JSON.stringify(expiredVenue.json));
    const expiredId = expiredVenue.json.data.venueId;
    const expiredToken = tokenFromMail(await founderMail(), "Expired Room");
    const expiredHash = crypto.createHash("sha256").update(expiredToken).digest("hex");
    await db.doc(`venueApprovalTokens/${expiredHash}`).update({ expiresAt: "2000-01-01T00:00:00.000Z" });
    const expired = await api(port, `/api/venues/approval/${expiredToken}`, {
      method: "POST",
      body: { decision: "approve" },
    });
    assert.equal(expired.status, 410, JSON.stringify(expired.json));
    assert.equal((await db.doc(`venueProfiles/${expiredId}`).get()).data().approvalStatus, "pending");

    const bad = await api(port, `/api/venues/approval/${crypto.randomBytes(32).toString("hex")}`, {
      method: "POST",
      body: { decision: "approve" },
    });
    assert.equal(bad.status, 404, JSON.stringify(bad.json));

    const rejectedOwner = await signUp(`test+venue-reject-${crypto.randomUUID()}@example.com`);
    const rejectedVenue = await api(port, "/api/venues", {
      method: "POST",
      token: rejectedOwner.token,
      body: venueBody("Rejected Room"),
    });
    assert.equal(rejectedVenue.status, 201, JSON.stringify(rejectedVenue.json));
    const rejectToken = tokenFromMail(await founderMail(), "Rejected Room");
    const rejected = await api(port, `/api/venues/approval/${rejectToken}`, {
      method: "POST",
      body: { decision: "reject" },
    });
    assert.equal(rejected.status, 200, JSON.stringify(rejected.json));
    assert.equal((await db.doc(`venueProfiles/${rejectedVenue.json.data.venueId}`).get()).data().approvalStatus, "rejected");
    const rejectMail = await db.collection("mail").where("to", "==", rejectedOwner.email).get();
    assert.equal(rejectMail.docs.some((doc) => String(doc.data()?.message?.subject || "").includes("wasn't approved")), true);
  } finally {
    server.close();
  }
});
