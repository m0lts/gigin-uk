import { FieldValue } from "firebase-admin/firestore";
import { emailIndexKey } from "./keepProfileLogic.js";

export async function rememberProfileEmail(db, profileId, email) {
  const key = emailIndexKey(email);
  if (!profileId || !key) return;
  await db.doc(`profileEmailIndex/${key}`).set({
    profileId,
    updatedAt: new Date().toISOString(),
  });
}

export async function forgetProfileEmail(db, email) {
  const key = emailIndexKey(email);
  if (!key) return;
  await db.doc(`profileEmailIndex/${key}`).delete().catch(() => {});
}

export async function profileIdForEmail(db, email) {
  const key = emailIndexKey(email);
  if (!key) return "";
  const snap = await db.doc(`profileEmailIndex/${key}`).get();
  return snap.exists ? String(snap.data()?.profileId || "") : "";
}

/** One-off: index private contact emails and delete the public unsalted hash. */
export async function migrateProfileEmailIndex(db) {
  const snap = await db.collection("artistProfiles").get();
  let indexed = 0;
  let stripped = 0;
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const contact = await db.doc(`artistProfiles/${doc.id}/private/contact`).get();
    const email = contact.exists ? contact.data()?.email : "";
    if (email) {
      await rememberProfileEmail(db, doc.id, email);
      indexed += 1;
    }
    if (Object.prototype.hasOwnProperty.call(data, "contactEmailHash")) {
      await doc.ref.update({ contactEmailHash: FieldValue.delete() });
      stripped += 1;
    }
  }
  return { scanned: snap.size, indexed, stripped };
}
