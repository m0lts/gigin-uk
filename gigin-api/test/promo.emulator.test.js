/**
 * Promo submit against the local emulators. Addresses are test+name@example.com.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import admin from "firebase-admin";

const API = process.env.OVERNIGHT_API || "http://127.0.0.1:8080/api";
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
  admin.initializeApp({ projectId: PROJECT, storageBucket: `${PROJECT}.firebasestorage.app` });
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

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
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

test("an accepted guest can send promo on the manage link, and a second send updates consent", async () => {
  const venue = await signUp(`test+promo-venue-${Date.now()}@example.com`);
  const venueId = `venue-${crypto.randomUUID()}`;
  await db.doc(`venueProfiles/${venueId}`).set({
    name: "The Mill",
    venueName: "The Mill",
    createdBy: venue.uid,
    userId: venue.uid,
  });
  const gigId = crypto.randomUUID();
  const when = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const created = await api("/gigs/postMultipleGigs", {
    method: "POST",
    token: venue.token,
    body: {
      venueId,
      gigDocuments: [{
        gigId,
        venueId,
        date: when,
        startDateTime: when,
        startTime: "20:00",
        duration: 45,
        status: "open",
        applicationsOpen: true,
        gigName: "Thursday Folk",
        kind: "Live Music",
        budget: "£0",
        applicants: [],
        venue: { venueName: "The Mill" },
      }],
    },
  });
  assert.equal(created.status, 200, JSON.stringify(created.json));

  const manageToken = crypto.randomBytes(32).toString("hex");
  const applicationId = crypto.randomUUID();
  const guestEmail = `test+promo-guest-${Date.now()}@example.com`;
  const applied = await api("/guest-applications", {
    method: "POST",
    body: {
      applicationId,
      manageToken,
      gigId,
      slotGigIds: [gigId],
      actName: "The Test Act",
      contactName: "Guest Tester",
      contacts: { email: guestEmail },
      note: "Songs from the fens",
    },
  });
  assert.equal(applied.status, 200, JSON.stringify(applied.json));

  const accepted = await api(`/gigs/${gigId}/applications/${applicationId}/accept`, {
    method: "POST",
    token: venue.token,
    body: { slotGigId: gigId },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.json));

  const view = await api(`/guest-applications/${manageToken}?gigId=${gigId}`);
  assert.equal(view.status, 200, JSON.stringify(view.json));
  assert.equal(view.json.promo, null);
  assert.equal(view.json.promoOpen, true);
  assert.match(view.json.promoDue, /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/);

  const refused = await api(`/guest-applications/${manageToken}/promo`, {
    method: "POST",
    body: { gigId, permission: false, bio: "Songs", photos: [{ path: "x" }], track: { url: "https://example.com/song" } },
  });
  assert.equal(refused.status, 400);
  assert.match(refused.json.error, /permission/i);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const signed = await api("/guest-applications/upload-url", {
    method: "POST",
    body: { applicationId, kind: "asset", contentType: "image/png", name: "pixel.png", size: png.length, gigId, manageToken },
  });
  assert.equal(signed.status, 200, JSON.stringify(signed.json));
  const uploaded = await fetch(signed.json.uploadUrl, {
    method: signed.json.method || "POST",
    headers: { "Content-Type": "image/png" },
    body: png,
  });
  assert.equal(uploaded.status, 200, await uploaded.text());

  const sent = await api(`/guest-applications/${manageToken}/promo`, {
    method: "POST",
    body: {
      gigId,
      permission: true,
      bio: "Songs from the fens",
      photos: [{ path: signed.json.path, name: "pixel.png", contentType: "image/png", size: png.length }],
      track: { url: "https://open.spotify.com/track/1" },
      videoUrl: "https://youtu.be/abc",
      played: "Hidden Rooms, The Portland Arms",
    },
  });
  assert.equal(sent.status, 200, JSON.stringify(sent.json));
  assert.equal(sent.json.promo.bio, "Songs from the fens");
  assert.equal(sent.json.promo.photos.length, 1);
  assert.equal(sent.json.promo.played, "Hidden Rooms, The Portland Arms");
  assert.equal(sent.json.promoPermission.name, "Guest Tester");
  assert.equal(sent.json.promoPermission.email, guestEmail);
  assert.ok(sent.json.promoPermission.at);

  const priv = (await db.doc(`gigs/${gigId}/guestApplicants/${applicationId}`).get()).data();
  assert.equal(priv.promoPermission.email, guestEmail);
  assert.equal(priv.promo.track.url, "https://open.spotify.com/track/1");
  const publicGig = JSON.stringify((await db.doc(`gigs/${gigId}`).get()).data());
  assert.equal(publicGig.includes("Songs from the fens"), false);
  assert.equal(publicGig.includes(guestEmail), false);

  await new Promise((resolve) => setTimeout(resolve, 20));
  const again = await api(`/guest-applications/${manageToken}/promo`, {
    method: "POST",
    body: {
      gigId,
      permission: true,
      bio: "Updated bio",
      photos: [{ path: signed.json.path, name: "pixel.png" }],
      track: { url: "https://open.spotify.com/track/1" },
      played: "The Portland Arms",
    },
  });
  assert.equal(again.status, 200, JSON.stringify(again.json));
  assert.equal(again.json.promo.bio, "Updated bio");
  assert.notEqual(again.json.promoPermission.at, sent.json.promoPermission.at);

  const mail = await db.collection("mail").where("to", "==", guestEmail).get();
  const booked = mail.docs.map((doc) => doc.data()?.message?.html || "").find((html) => html.includes("Send your promo"));
  assert.ok(booked, "the accepted email should link to the promo page");
  assert.match(booked, /One thing we need from you/);
});
