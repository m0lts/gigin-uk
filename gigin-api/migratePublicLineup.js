/**
 * Move non-confirmed applicants off world-readable gig documents.
 *
 * Run against the emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 \
 *   GCLOUD_PROJECT=giginltd-dev \
 *   node migratePublicLineup.js
 *
 * The full applicant list is stored at gigs/{rootId}/private/applications.
 * Each public gig keeps only the confirmed lineup: act name and assigned set.
 * A legacy per-set night (no bookedApplicantId, no applicationsRootGigId)
 * stays in that shape: those fields are not added.
 */
import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { applicationsRootGigId, publicLineup, readNight } from "./lib/nightApplications.js";
import { isGuestApplicant, operationalApplicant, PRIVATE_KEYS } from "./lib/gigPrivacy.js";

const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "giginltd-dev";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Set FIRESTORE_EMULATOR_HOST. This script runs against the emulator.");
  process.exit(1);
}
if (project === "giginltd-16772") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

function groupIds(start, byId) {
  const seen = new Set();
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    if (!id || seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    const slots = byId.get(id).data()?.gigSlots;
    if (!Array.isArray(slots)) continue;
    for (const sid of slots) if (sid && !seen.has(sid)) queue.push(sid);
  }
  return [...seen];
}

function legacyNight(views) {
  return views.every((slot) => (
    !Object.prototype.hasOwnProperty.call(slot, "bookedApplicantId") && !slot.applicationsRootGigId
  ));
}

admin.initializeApp({ projectId: project });
const db = admin.firestore();
const snap = await db.collection("gigs").get();
const byId = new Map(snap.docs.map((doc) => [doc.id, doc]));
const seen = new Set();
let nights = 0;
let stripped = 0;

for (const doc of snap.docs) {
  if (seen.has(doc.id)) continue;
  const ids = groupIds(doc.id, byId);
  ids.forEach((id) => seen.add(id));
  const slots = ids.map((id) => byId.get(id)).filter(Boolean);
  const views = slots.map((slot) => ({ gigId: slot.id, ...(slot.data() || {}) }));
  const hasApplicants = views.some((slot) => Array.isArray(slot.applicants) && slot.applicants.length);
  const rootId = applicationsRootGigId(views) || doc.id;
  const storedSnap = await db.doc(`gigs/${rootId}/private/applications`).get();
  const stored = storedSnap.exists ? (storedSnap.data() || {}) : {};
  if (!hasApplicants && !(stored.applicants || []).length) continue;

  const fromDocs = readNight(views).applications;
  const map = new Map((stored.applicants || []).map((entry) => [String(entry.id), entry]));
  for (const entry of fromDocs) {
    if (entry?.id == null) continue;
    const prev = map.get(String(entry.id));
    map.set(String(entry.id), prev ? { ...entry, ...prev, id: prev.id } : entry);
  }
  const full = [...map.values()];
  const rootView = views.find((slot) => slot.gigId === rootId) || views[0] || {};
  const closeUndo = stored.closeUndo || rootView.closeUndo || null;

  for (const app of full) {
    if (!isGuestApplicant(app) || app.id == null) continue;
    const secrets = { applicantId: app.id, gigId: rootId };
    let any = false;
    for (const key of PRIVATE_KEYS) {
      if (app[key] !== undefined) {
        secrets[key] = app[key];
        any = true;
      }
    }
    if (any) await db.doc(`gigs/${rootId}/guestApplicants/${app.id}`).set(secrets, { merge: true });
  }

  await db.doc(`gigs/${rootId}/private/applications`).set({
    gigId: rootId,
    applicants: full.map(operationalApplicant).filter(Boolean),
    ...(closeUndo ? { closeUndo } : {}),
  }, { merge: true });

  const legacy = legacyNight(views);
  for (const slot of slots) {
    const data = slot.data() || {};
    const lineup = publicLineup(full, slot.id, { onlySlot: slots.length < 2 });
    const patch = { applicants: lineup };
    if (!legacy && (Object.prototype.hasOwnProperty.call(data, "bookedApplicantId") || data.applicationsRootGigId)) {
      patch.bookedApplicantId = lineup[0]?.id || null;
    }
    if (data.closeUndo) patch.closeUndo = FieldValue.delete();
    await slot.ref.update(patch);
    stripped += 1;
  }
  nights += 1;
}

console.log(JSON.stringify({ nights, stripped }));
