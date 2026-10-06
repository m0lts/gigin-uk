/**
 * reset:dev refuses every project except giginltd-dev, and only wipes the
 * emulator when that id is typed. It must not be pointed at cloud dev or prod.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { APP_COLLECTIONS, ONLY_PROJECT, resolvedProject } from "../scripts/resetDev.js";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/resetDev.js");
const PROJECT = "giginltd-dev";

test("the reset allowlist is the app collections and nothing else", () => {
  assert.equal(ONLY_PROJECT, "giginltd-dev");
  assert.equal(APP_COLLECTIONS.includes("gigs"), true);
  assert.equal(APP_COLLECTIONS.includes("users"), true);
  assert.equal(APP_COLLECTIONS.includes("artistSignupRate"), true);
  assert.equal(APP_COLLECTIONS.includes("resetDevKeep"), false);
  assert.equal(resolvedProject({ GCLOUD_PROJECT: "giginltd-dev", GOOGLE_CLOUD_PROJECT: "other", FIREBASE_CONFIG: "{\"projectId\":\"giginltd-16772\"}" }), "giginltd-dev");
  assert.equal(resolvedProject({ GOOGLE_CLOUD_PROJECT: "giginltd-dev" }), "giginltd-dev");
  assert.equal(resolvedProject({ FIREBASE_CONFIG: "{\"projectId\":\"giginltd-16772\"}" }), "giginltd-16772");
  assert.equal(resolvedProject({}), "");
});

function assertEmulators() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("Refusing to run without the Firebase emulators.");
  }
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
  if (project === "giginltd-16772") throw new Error("Refusing to run against production.");
}

function runReset(envOverrides, stdin = "") {
  const env = { ...process.env, ...envOverrides };
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    if (stdin) child.stdin.end(stdin);
    else child.stdin.end();
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("a typed confirmation on the emulator wipes app data and Auth, and leaves other collections", async () => {
  assertEmulators();
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const email = "test+reset-dev@example.com";
  await db.doc("gigs/reset-night").set({ gigName: "Reset night" });
  await db.doc("gigs/reset-night/guestApplicants/reset-app").set({ email });
  await db.doc("users/reset-user").set({ name: "Reset User" });
  await db.doc("users/reset-user/artistCRM/reset-row").set({ note: "nested" });
  await db.doc("resetDevKeep/keep").set({ keep: true });
  await admin.auth().createUser({ uid: "reset-auth-user", email, password: "Resetdev1!" });

  const prod = await runReset({
    GCLOUD_PROJECT: "giginltd-16772",
    GOOGLE_CLOUD_PROJECT: "giginltd-16772",
    FIREBASE_CONFIG: "",
  }, "giginltd-dev\n");
  assert.equal(prod.code, 1);
  assert.match(prod.stderr, /Refusing/);
  assert.equal(prod.stdout.includes("Wiped"), false);
  assert.equal((await db.doc("gigs/reset-night").get()).exists, true);

  const missing = await runReset({
    GCLOUD_PROJECT: "",
    GOOGLE_CLOUD_PROJECT: "",
    FIREBASE_CONFIG: JSON.stringify({ projectId: "giginltd-16772" }),
  }, "giginltd-dev\n");
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /Refusing/);
  assert.equal(missing.stdout.includes("Wiped"), false);

  const blank = await runReset({
    GCLOUD_PROJECT: PROJECT,
    GOOGLE_CLOUD_PROJECT: PROJECT,
    FIREBASE_CONFIG: JSON.stringify({ projectId: "giginltd-16772" }),
  }, "");
  assert.equal(blank.code, 1);
  assert.match(blank.stderr, /Refusing/);
  assert.equal(blank.stdout.includes("Wiped"), false);
  assert.equal((await admin.auth().getUser("reset-auth-user")).email, email);

  const wrong = await runReset({
    GCLOUD_PROJECT: PROJECT,
    GOOGLE_CLOUD_PROJECT: PROJECT,
  }, "giginltd-16772\n");
  assert.equal(wrong.code, 1);
  assert.match(wrong.stderr, /Refusing/);
  assert.equal((await db.doc("users/reset-user/artistCRM/reset-row").get()).exists, true);

  const wiped = await runReset({
    GCLOUD_PROJECT: PROJECT,
    GOOGLE_CLOUD_PROJECT: PROJECT,
    FIREBASE_CONFIG: JSON.stringify({ projectId: "giginltd-16772" }),
  }, "giginltd-dev\n");
  assert.equal(wiped.code, 0, wiped.stderr);
  assert.match(wiped.stdout, /Wiped giginltd-dev/);
  assert.equal((await db.doc("gigs/reset-night").get()).exists, false);
  assert.equal((await db.doc("gigs/reset-night/guestApplicants/reset-app").get()).exists, false);
  assert.equal((await db.doc("users/reset-user").get()).exists, false);
  assert.equal((await db.doc("users/reset-user/artistCRM/reset-row").get()).exists, false);
  assert.equal((await db.doc("resetDevKeep/keep").get()).data().keep, true);
  await assert.rejects(() => admin.auth().getUser("reset-auth-user"));
});
