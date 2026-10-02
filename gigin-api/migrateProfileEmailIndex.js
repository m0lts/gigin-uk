/**
 * Move artist contact emails off the public profile document.
 *
 * Run against the emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 \
 *   PROFILE_EMAIL_INDEX_SECRET=... \
 *   GCLOUD_PROJECT=giginltd-dev \
 *   node migrateProfileEmailIndex.js
 *
 * Reads artistProfiles/{id}/private/contact.email, writes profileEmailIndex/{hmac}
 * with the profile id only, and deletes contactEmailHash. The hash cannot be reversed.
 */
import admin from "firebase-admin";
import { migrateProfileEmailIndex } from "./lib/profileEmailIndex.js";

const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "giginltd-dev";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Set FIRESTORE_EMULATOR_HOST. This script runs against the emulator.");
  process.exit(1);
}
if (!process.env.PROFILE_EMAIL_INDEX_SECRET) {
  console.error("Set PROFILE_EMAIL_INDEX_SECRET.");
  process.exit(1);
}
if (project === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

admin.initializeApp({ projectId: project });
const result = await migrateProfileEmailIndex(admin.firestore());
console.log(JSON.stringify(result));
