/**
 * Client gig query shapes against the gigs read rule.
 * Queries without a venueId constraint cannot be proved, including for an approved venue.
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

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
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

function docName(gigId) {
  return `projects/${PROJECT}/databases/(default)/documents/gigs/${gigId}`;
}

async function runQuery(token, structuredQuery) {
  const response = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ structuredQuery }),
    },
  );
  const text = await response.text();
  return {
    status: response.status,
    text,
    denied: response.status === 403 || text.includes("PERMISSION_DENIED"),
  };
}

function fromGigs(where) {
  return { from: [{ collectionId: "gigs" }], where };
}

test("gig query shapes follow the approval rule for signed-out and signed-in readers", async () => {
  const owner = await signUp(`test+gig-read-owner-${crypto.randomUUID()}@example.com`);
  const stranger = await signUp(`test+gig-read-stranger-${crypto.randomUUID()}@example.com`);
  const approvedId = crypto.randomUUID();
  const pendingId = crypto.randomUUID();
  const approvedGig = crypto.randomUUID();
  const pendingGig = crypto.randomUUID();
  const when = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 86400000));
  await db.doc(`venueProfiles/${approvedId}`).set({
    name: "Approved Room",
    createdBy: owner.uid,
    userId: owner.uid,
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
    date: when,
    startDateTime: when,
    geopoint: new admin.firestore.GeoPoint(52.2053, 0.1218),
  });
  await db.doc(`gigs/${pendingGig}`).set({
    venueId: pendingId,
    gigName: "Pending night",
    status: "open",
    date: when,
    startDateTime: when,
    geopoint: new admin.firestore.GeoPoint(52.2053, 0.1218),
  });

  const readers = [
    ["signed-out", null],
    ["signed-in", stranger.token],
    ["owner", owner.token],
  ];

  for (const [label, token] of readers) {
    const approvedList = await runQuery(token, fromGigs({
      fieldFilter: {
        field: { fieldPath: "venueId" },
        op: "EQUAL",
        value: { stringValue: approvedId },
      },
    }));
    assert.equal(approvedList.denied, false, `${label} approved venueId == ${approvedList.text}`);
    assert.equal(approvedList.text.includes("Approved night"), true, approvedList.text);

    const pendingList = await runQuery(token, fromGigs({
      fieldFilter: {
        field: { fieldPath: "venueId" },
        op: "EQUAL",
        value: { stringValue: pendingId },
      },
    }));
    assert.equal(pendingList.denied, label !== "owner", `${label} pending venueId == ${pendingList.text}`);
    if (label === "owner") assert.equal(pendingList.text.includes("Pending night"), true);

    const approvedIn = await runQuery(token, fromGigs({
      fieldFilter: {
        field: { fieldPath: "venueId" },
        op: "IN",
        value: { arrayValue: { values: [{ stringValue: approvedId }] } },
      },
    }));
    assert.equal(approvedIn.denied, false, `${label} approved venueId in ${approvedIn.text}`);
    assert.equal(approvedIn.text.includes("Approved night"), true);

    const pendingIn = await runQuery(token, fromGigs({
      fieldFilter: {
        field: { fieldPath: "venueId" },
        op: "IN",
        value: { arrayValue: { values: [{ stringValue: pendingId }] } },
      },
    }));
    assert.equal(pendingIn.denied, label !== "owner", `${label} pending venueId in ${pendingIn.text}`);

    const approvedOnly = await runQuery(token, fromGigs({
      fieldFilter: {
        field: { fieldPath: "__name__" },
        op: "IN",
        value: { arrayValue: { values: [{ referenceValue: docName(approvedGig) }] } },
      },
    }));
    const pendingOnly = await runQuery(token, fromGigs({
      fieldFilter: {
        field: { fieldPath: "__name__" },
        op: "IN",
        value: { arrayValue: { values: [{ referenceValue: docName(pendingGig) }] } },
      },
    }));
    const mixed = await runQuery(token, fromGigs({
      fieldFilter: {
        field: { fieldPath: "__name__" },
        op: "IN",
        value: { arrayValue: { values: [{ referenceValue: docName(approvedGig) }, { referenceValue: docName(pendingGig) }] } },
      },
    }));
    assert.equal(approvedOnly.denied, false, `${label} approved documentId in ${approvedOnly.text}`);
    assert.equal(approvedOnly.text.includes("Approved night"), true, approvedOnly.text);
    assert.equal(pendingOnly.denied, label !== "owner", `${label} pending documentId in ${pendingOnly.text}`);
    if (label === "owner") {
      assert.equal(mixed.denied, false, mixed.text);
      assert.equal(mixed.text.includes("Pending night"), true);
    } else {
      assert.equal(mixed.denied, true, `${label} mixed documentId in ${mixed.text}`);
      assert.equal(mixed.text.includes("Approved night"), false);
      assert.equal(mixed.text.includes("Pending night"), false);
    }

    const nearby = await runQuery(token, {
      from: [{ collectionId: "gigs" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "open" } } },
            { fieldFilter: { field: { fieldPath: "geopoint" }, op: "GREATER_THAN_OR_EQUAL", value: { geoPointValue: { latitude: 52, longitude: 0 } } } },
            { fieldFilter: { field: { fieldPath: "geopoint" }, op: "LESS_THAN_OR_EQUAL", value: { geoPointValue: { latitude: 53, longitude: 1 } } } },
            { fieldFilter: { field: { fieldPath: "startDateTime" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: new Date().toISOString() } } },
          ],
        },
      },
      orderBy: [
        { field: { fieldPath: "geopoint" }, direction: "ASCENDING" },
        { field: { fieldPath: "startDateTime" }, direction: "ASCENDING" },
      ],
    });
    assert.equal(nearby.text.includes("Pending night"), false, `${label} nearby ${nearby.text}`);
    assert.equal(nearby.denied || !nearby.text.includes("Approved night"), true, `${label} nearby should not be provable ${nearby.text}`);

    const upcoming = await runQuery(token, {
      from: [{ collectionId: "gigs" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "venueId" }, op: "IN", value: { arrayValue: { values: [{ stringValue: approvedId }] } } } },
            { fieldFilter: { field: { fieldPath: "date" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: "2020-01-01T00:00:00Z" } } },
          ],
        },
      },
    });
    assert.equal(upcoming.denied, false, `${label} upcoming approved ${upcoming.text}`);
    assert.equal(upcoming.text.includes("Approved night"), true, upcoming.text);

    const upcomingPending = await runQuery(token, {
      from: [{ collectionId: "gigs" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "venueId" }, op: "IN", value: { arrayValue: { values: [{ stringValue: pendingId }] } } } },
            { fieldFilter: { field: { fieldPath: "date" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: "2020-01-01T00:00:00Z" } } },
          ],
        },
      },
    });
    assert.equal(upcomingPending.denied, label !== "owner", `${label} upcoming pending ${upcomingPending.text}`);
  }

  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const publicApproved = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${approvedGig}`);
  const publicPending = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${pendingGig}`);
  const ownerPending = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${pendingGig}`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  const strangerPending = await fetch(`http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/gigs/${pendingGig}`, {
    headers: { Authorization: `Bearer ${stranger.token}` },
  });
  assert.equal(publicApproved.status, 200);
  assert.equal(publicPending.status, 403);
  assert.equal(ownerPending.status, 200);
  assert.equal(strangerPending.status, 403);
});
