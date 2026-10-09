/**
 * Guest audio uploads. Runs only against the local Firebase emulators.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import express from "express";

const PROJECT = "giginltd-dev";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run without the Firebase emulators.");
  process.exit(1);
}
if (process.env.GCLOUD_PROJECT === "giginltd-16772" || process.env.GOOGLE_CLOUD_PROJECT === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

const storageHost = (process.env.STORAGE_EMULATOR_HOST || "127.0.0.1:9199").replace(/^https?:\/\//, "");
process.env.STORAGE_EMULATOR_HOST = `http://${storageHost}`;

const AUDIO_LIMIT = 15 * 1024 * 1024;

let server;
let port;
let db;
let admin;

function listen(app) {
  return new Promise((resolve) => {
    const httpServer = http.createServer(app);
    httpServer.listen(0, "127.0.0.1", () => resolve(httpServer));
  });
}

async function api(path, { method = "GET", token, body, raw, contentType } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(raw ? { "Content-Type": contentType || "application/octet-stream" } : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw || (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: response.status, json, text };
}

async function signUp(email) {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-123", returnSecureToken: true }),
  });
  const signed = await response.json();
  assert.equal(response.ok, true, JSON.stringify(signed));
  return { uid: signed.localId, token: signed.idToken, email };
}

function futureIso() {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

async function uploadUrl(body) {
  return api("/api/guest-applications/upload-url", { method: "POST", body });
}

test.before(async () => {
  const loaded = await import("../config/admin.js");
  loaded.initializeAdmin();
  db = loaded.db;
  admin = loaded.admin;
  const { default: guestRouter } = await import("../routes/guestApplications.js");
  const { default: gigsRouter } = await import("../routes/gigs.js");
  const { errorHandler } = await import("../middleware/errorHandler.js");
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/guest-applications", guestRouter);
  app.use("/api/gigs", gigsRouter);
  app.use(errorHandler);
  server = await listen(app);
  port = server.address().port;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("upload urls allow audio types and reject mismatches, oversize files, and a fourth audio file", async () => {
  const applicationId = crypto.randomUUID();
  const allowed = [
    ["demo.mp3", "audio/mpeg"],
    ["demo.m4a", "audio/mp4"],
    ["demo.m4a", "audio/x-m4a"],
    ["demo.wav", "audio/wav"],
    ["demo.wav", "audio/x-wav"],
  ];
  for (const [name, contentType] of allowed) {
    const fresh = crypto.randomUUID();
    const response = await uploadUrl({ applicationId: fresh, kind: "asset", contentType, name, size: 1200 });
    assert.equal(response.status, 200, `${name} ${contentType} ${JSON.stringify(response.json)}`);
    assert.match(response.json.path, new RegExp(`${name.replace(".", "\\.")}$`, "i"));
  }

  const rejected = [
    ["notes.txt", "text/plain", 20, /isn't supported/],
    ["demo.wav", "audio/mpeg", 20, /isn't supported/],
    ["demo.mp3", "audio/wav", 20, /isn't supported/],
    ["demo.mp3", "audio/mpeg", AUDIO_LIMIT + 1, /15 MB/],
    ["rider.pdf", "application/pdf", 20 * 1024 * 1024 + 1, /20 MB/],
    ["photo.png", "image/png", 10 * 1024 * 1024 + 1, /10 MB/],
  ];
  for (const [name, contentType, size, pattern] of rejected) {
    const kind = name.startsWith("photo") ? "photo" : "asset";
    const response = await uploadUrl({ applicationId, kind, contentType, name, size });
    assert.equal(response.status, 400, `${name} should be rejected`);
    assert.match(response.json?.error || "", pattern, response.json?.error);
  }

  const pdf = await uploadUrl({
    applicationId,
    kind: "asset",
    contentType: "application/pdf",
    name: "rider.pdf",
    size: 20 * 1024 * 1024,
  });
  assert.equal(pdf.status, 200, JSON.stringify(pdf.json));

  const photo = await uploadUrl({
    applicationId: crypto.randomUUID(),
    kind: "photo",
    contentType: "text/plain",
    name: "notes.txt",
    size: 4,
  });
  assert.equal(photo.status, 400);

  const signed = await uploadUrl({ applicationId, kind: "asset", contentType: "audio/mpeg", name: "demo.mp3", size: 8 });
  assert.equal(signed.status, 200, JSON.stringify(signed.json));
  const wrongType = await fetch(signed.json.uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: Buffer.from("not-wav"),
  });
  assert.equal(wrongType.status, 400);
  const [wrongExists] = await admin.storage().bucket().file(signed.json.path).exists();
  assert.equal(wrongExists, false);

  const tooBigUrl = await uploadUrl({ applicationId: crypto.randomUUID(), kind: "asset", contentType: "audio/mpeg", name: "big.mp3", size: 1000 });
  assert.equal(tooBigUrl.status, 200, JSON.stringify(tooBigUrl.json));
  const tooBig = await fetch(tooBigUrl.json.uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "audio/mpeg" },
    body: Buffer.alloc(AUDIO_LIMIT + 1, 1),
  });
  assert.equal(tooBig.status, 400);
  const [bigExists] = await admin.storage().bucket().file(tooBigUrl.json.path).exists();
  assert.equal(bigExists, false);
});

test("a venue can play an applicant's audio and another venue cannot", async () => {
  const owner = await signUp(`test+audio-venue-${crypto.randomUUID()}@example.com`);
  const outsider = await signUp(`test+audio-other-${crypto.randomUUID()}@example.com`);
  const venueId = `venue-${crypto.randomUUID()}`;
  await db.doc(`venueProfiles/${venueId}`).set({
    name: "Audio Bar",
    venueName: "Audio Bar",
    createdBy: owner.uid,
    userId: owner.uid,
  });
  const gigId = crypto.randomUUID();
  const when = futureIso();
  const created = await api("/api/gigs/postMultipleGigs", {
    method: "POST",
    token: owner.token,
    body: {
      venueId,
      gigDocuments: [{
        gigId,
        gigSlots: [gigId],
        venueId,
        date: when,
        startDateTime: when,
        startTime: "20:00",
        duration: 45,
        status: "open",
        applicationsOpen: true,
        gigName: "Audio night",
        kind: "Live Music",
        budget: "£0",
        applicants: [],
        venue: { venueName: "Audio Bar" },
      }],
    },
  });
  assert.equal(created.status, 200, JSON.stringify(created.json));

  const applicationId = crypto.randomUUID();
  const manageToken = crypto.randomBytes(32).toString("hex");
  const mp3 = Buffer.from("mp3-bytes");
  const files = [
    ["demo.mp3", "audio/mpeg", mp3],
    ["demo.m4a", "audio/mp4", Buffer.from("m4a-bytes")],
    ["demo.wav", "audio/wav", Buffer.from("wav-bytes")],
  ];
  const assets = [];
  for (const [name, contentType, bytes] of files) {
    const signed = await uploadUrl({ applicationId, kind: "asset", contentType, name, size: bytes.length });
    assert.equal(signed.status, 200, JSON.stringify(signed.json));
    const uploaded = await fetch(signed.json.uploadUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: bytes,
    });
    assert.equal(uploaded.status, 200, await uploaded.text());
    assets.push({ path: signed.json.path, name, size: bytes.length, contentType });
  }
  const fourth = await uploadUrl({ applicationId, kind: "asset", contentType: "audio/mpeg", name: "extra.mp3", size: 10 });
  assert.equal(fourth.status, 400);
  assert.match(fourth.json?.error || "", /3 audio/);
  const sneakyPath = `guest-applications/${applicationId}/${crypto.randomUUID()}-extra.mp3`;
  const sneaky = await api(`/api/guest-applications/direct-upload?path=${encodeURIComponent(sneakyPath)}`, {
    method: "POST",
    raw: Buffer.from("sneaky-mp3"),
    contentType: "audio/mpeg",
  });
  assert.equal(sneaky.status, 400);
  assert.match(sneaky.json?.error || "", /3 audio/);
  const [sneakyExists] = await admin.storage().bucket().file(sneakyPath).exists();
  assert.equal(sneakyExists, false);

  const pdfSigned = await uploadUrl({ applicationId, kind: "asset", contentType: "application/pdf", name: "rider.pdf", size: 4 });
  assert.equal(pdfSigned.status, 200, JSON.stringify(pdfSigned.json));
  const pdfBody = Buffer.from("%PDF");
  const pdfUploaded = await fetch(pdfSigned.json.uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: pdfBody,
  });
  assert.equal(pdfUploaded.status, 200, await pdfUploaded.text());

  const guestEmail = `test+audio-guest-${crypto.randomUUID()}@example.com`;
  const applied = await api("/api/guest-applications", {
    method: "POST",
    body: {
      applicationId,
      manageToken,
      gigId,
      slotGigIds: [gigId],
      actName: "The Audio Act",
      contactName: "Ada Player",
      contacts: { email: guestEmail, phone: "07000000099" },
      assets: [...assets, { path: pdfSigned.json.path, name: "rider.pdf", size: pdfBody.length, contentType: "application/pdf" }],
    },
  });
  assert.equal(applied.status, 200, JSON.stringify(applied.json));

  const stored = (await db.doc(`gigs/${gigId}/guestApplicants/${applicationId}`).get()).data();
  const storedMp3 = stored.assets.find((asset) => asset.name === "demo.mp3");
  assert.equal(storedMp3.contentType, "audio/mpeg");
  assert.equal(storedMp3.url, undefined);
  assert.equal(storedMp3.playUrl, undefined);
  const storedPdf = stored.assets.find((asset) => asset.name === "rider.pdf");
  assert.match(storedPdf.url || "", /token=/);
  const publicGig = JSON.stringify((await db.doc(`gigs/${gigId}`).get()).data());
  assert.equal(publicGig.includes("demo.mp3"), false);
  assert.equal(publicGig.includes("guest-applications"), false);
  const [mp3Meta] = await admin.storage().bucket().file(storedMp3.path).getMetadata();
  assert.equal(mp3Meta.metadata?.firebaseStorageDownloadTokens, undefined);

  const bundle = await api("/api/gigs/privateBundle", { method: "POST", token: owner.token, body: { gigIds: [gigId] } });
  assert.equal(bundle.status, 200, JSON.stringify(bundle.json));
  const shown = bundle.json.gigs[gigId].guests[applicationId].assets.find((asset) => asset.name === "demo.mp3");
  assert.ok(shown.playUrl, JSON.stringify(shown));
  assert.ok(shown.downloadUrl);
  assert.equal(shown.playUrl.includes("asset-read"), true);
  const played = await fetch(shown.playUrl);
  assert.equal(played.status, 200);
  assert.equal(Buffer.compare(Buffer.from(await played.arrayBuffer()), mp3), 0);

  const hidden = await api("/api/gigs/privateBundle", { method: "POST", token: outsider.token, body: { gigIds: [gigId] } });
  assert.equal(hidden.status, 200, JSON.stringify(hidden.json));
  assert.equal(hidden.json.gigs[gigId], undefined);

  const forged = `${shown.playUrl.slice(0, -1)}${shown.playUrl.endsWith("a") ? "b" : "a"}`;
  const denied = await fetch(forged);
  assert.equal(denied.status, 403);

  const guestView = await api(`/api/guest-applications/${manageToken}?gigId=${gigId}`);
  assert.equal(guestView.status, 200, JSON.stringify(guestView.json));
  const guestMp3 = guestView.json.assets.find((asset) => asset.name === "demo.mp3");
  assert.ok(guestMp3.playUrl);
  const stranger = await api(`/api/guest-applications/${"ab".repeat(32)}?gigId=${gigId}`);
  assert.equal(stranger.status, 404);

  const ignored = await uploadUrl({
    applicationId,
    kind: "asset",
    contentType: "audio/mpeg",
    name: "extra.mp3",
    size: 10,
    gigId,
    manageToken,
    ignorePaths: [storedMp3.path],
  });
  assert.equal(ignored.status, 200, JSON.stringify(ignored.json));
  const noToken = await uploadUrl({
    applicationId,
    kind: "asset",
    contentType: "audio/mpeg",
    name: "extra.mp3",
    size: 10,
    ignorePaths: [storedMp3.path],
  });
  assert.equal(noToken.status, 400);

  const blockedDelete = await api("/api/guest-applications/delete-upload", {
    method: "POST",
    body: { applicationId, path: storedMp3.path },
  });
  assert.equal(blockedDelete.status, 403);

  const removed = await api(`/api/guest-applications/${manageToken}`, {
    method: "PATCH",
    body: { gigId, assets: [] },
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.json));
  for (const asset of assets) {
    const [gone] = await admin.storage().bucket().file(asset.path).exists();
    assert.equal(gone, false, asset.name);
  }
  const again = await uploadUrl({ applicationId, kind: "asset", contentType: "audio/mpeg", name: "fresh.mp3", size: 10 });
  assert.equal(again.status, 200, JSON.stringify(again.json));
});

test("submit rejects more than 3 audio files even if the upload step was skipped", async () => {
  const owner = await signUp(`test+audio-cap-${crypto.randomUUID()}@example.com`);
  const venueId = `venue-${crypto.randomUUID()}`;
  await db.doc(`venueProfiles/${venueId}`).set({ name: "Cap Bar", createdBy: owner.uid, userId: owner.uid });
  const gigId = crypto.randomUUID();
  const when = futureIso();
  const created = await api("/api/gigs/postMultipleGigs", {
    method: "POST",
    token: owner.token,
    body: {
      venueId,
      gigDocuments: [{
        gigId,
        gigSlots: [gigId],
        venueId,
        date: when,
        startDateTime: when,
        startTime: "21:00",
        duration: 45,
        status: "open",
        applicationsOpen: true,
        gigName: "Cap night",
        kind: "Live Music",
        budget: "£0",
        applicants: [],
      }],
    },
  });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  const applicationId = crypto.randomUUID();
  const assets = [1, 2, 3, 4].map((index) => ({
    path: `guest-applications/${applicationId}/fake-${index}.mp3`,
    name: `fake-${index}.mp3`,
    size: 10,
    contentType: "audio/mpeg",
  }));
  const applied = await api("/api/guest-applications", {
    method: "POST",
    body: {
      applicationId,
      manageToken: crypto.randomBytes(32).toString("hex"),
      gigId,
      slotGigIds: [gigId],
      actName: "Too Many Songs",
      contactName: "Ada",
      contacts: { email: `test+audio-cap-guest-${crypto.randomUUID()}@example.com` },
      assets,
    },
  });
  assert.equal(applied.status, 400);
  assert.match(applied.json?.error || "", /3 audio/);
});
