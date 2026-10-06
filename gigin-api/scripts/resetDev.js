/**
 * Wipe dev Firestore data and Auth users.
 *
 *   npm run reset:dev
 *
 * Refuses every project except giginltd-dev, then waits until that id is typed.
 * Deletes only the collections the app uses (including their subcollections)
 * and Auth users. Other collections and other Firebase products are left alone.
 * The Firestore and Auth emulator hosts are honoured when they are set.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const ONLY_PROJECT = "giginltd-dev";

/** Top-level collections the app writes. Subcollections go with them. */
export const APP_COLLECTIONS = [
  "_internal",
  "accessRequests",
  "artistInvites",
  "artistProfiles",
  "artistSignupRate",
  "auditLogs",
  "bandInvites",
  "bands",
  "cancellations",
  "clientErrors",
  "conversations",
  "disputes",
  "feedback",
  "finderAreaRequests",
  "gigInvites",
  "gigs",
  "listedVenues",
  "mail",
  "musicianProfiles",
  "payments",
  "pressKitRequests",
  "profileEmailIndex",
  "profileReminders",
  "profileRequests",
  "profileSessions",
  "profileTokens",
  "reviews",
  "system",
  "templates",
  "testimonials",
  "users",
  "venueApprovalTokens",
  "venueClaims",
  "venueHireOpportunities",
  "venueInvites",
  "venueProfiles",
  "venueRequests",
  "venueSignupRate",
];

/** Same order as gigin-api/config/env.js. An empty result is not dev. */
export function resolvedProject(env = process.env) {
  let firebaseConfig = {};
  try {
    firebaseConfig = JSON.parse(env.FIREBASE_CONFIG || "{}");
  } catch {
    firebaseConfig = {};
  }
  return String(env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId || "").trim();
}

function refuse(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function typedConfirmation() {
  const prompt = `Type ${ONLY_PROJECT} to wipe Firestore and Auth users on ${ONLY_PROJECT}: `;
  if (!process.stdin.isTTY) {
    process.stderr.write(prompt);
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await rl.question(prompt);
  rl.close();
  return answer;
}

async function deleteAuthUsers(auth) {
  let pageToken;
  let deleted = 0;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const uids = page.users.map((user) => user.uid);
    if (uids.length) {
      const result = await auth.deleteUsers(uids);
      if (result.failureCount) {
        const reason = result.errors?.[0]?.error?.message || "Auth delete failed.";
        refuse(`Refusing to continue. ${reason}`);
      }
      deleted += result.successCount;
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return deleted;
}

async function wipe() {
  const { initializeAdmin, admin } = await import("../config/admin.js");
  initializeAdmin();
  const appProject = String(admin.app().options.projectId || "").trim();
  if (appProject !== ONLY_PROJECT) {
    refuse(`Refusing to reset. Admin resolved ${appProject || "(no project)"}, not ${ONLY_PROJECT}.`);
  }
  const firestore = admin.firestore();
  for (const name of APP_COLLECTIONS) {
    await firestore.recursiveDelete(firestore.collection(name));
  }
  const deletedUsers = await deleteAuthUsers(admin.auth());
  process.stdout.write(`Wiped ${ONLY_PROJECT}. Cleared ${APP_COLLECTIONS.length} Firestore collections and deleted ${deletedUsers} Auth users.\n`);
}

async function main() {
  const project = resolvedProject();
  if (project !== ONLY_PROJECT) {
    refuse(`Refusing to reset ${project || "(no project)"}. This command only runs on ${ONLY_PROJECT}.`);
  }
  const typed = await typedConfirmation();
  if (String(typed || "").trim() !== ONLY_PROJECT) {
    refuse(`Refusing to reset ${ONLY_PROJECT} without typing that project id.`);
  }
  if (resolvedProject() !== ONLY_PROJECT) {
    refuse(`Refusing to reset ${resolvedProject() || "(no project)"}. This command only runs on ${ONLY_PROJECT}.`);
  }
  await wipe();
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`${error?.message || "Reset failed."}\n`);
    process.exit(1);
  });
}
