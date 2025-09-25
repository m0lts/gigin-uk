/* eslint-disable */
import { db } from "./admin.js";

/**
 * Reads membership doc once. Throws if not active.
 */
export async function requireActiveMember(venueId, uid) {
  const snap = await db.doc(`venues/${venueId}/members/${uid}`).get();
  if (!snap.exists || snap.get("status") !== "active") {
    const err = new Error("FORBIDDEN: Not an active member");
    err.code = "permission-denied";
    throw err;
  }
  return snap.data() || {};
}

/**
 * Asserts member has a boolean permission at `perms[key] === true`.
 */
export async function requirePerm(venueId, uid, key) {
  const data = await requireActiveMember(venueId, uid);
  const perms = data.perms || {};
  if (perms[key] !== true) {
    const err = new Error(`FORBIDDEN: Missing permission ${key}`);
    err.code = "permission-denied";
    throw err;
  }
  return true;
}