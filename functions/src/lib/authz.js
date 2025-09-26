/* eslint-disable */
import { db } from "./admin.js";
import { PERM_KEYS, PERM_DEFAULTS } from "./utils/permissions.js";

/**
 * Normalize an incoming permissions object to the full PERM_DEFAULTS shape.
 * Always enforces "gigs.read" = true.
 * Server-side twin of the client helper.
 */
export function normalizePermissions(incoming) {
  const base = { ...PERM_DEFAULTS };
  if (incoming && typeof incoming === "object") {
    for (const k of PERM_KEYS) {
      if (Object.prototype.hasOwnProperty.call(incoming, k)) {
        base[k] = !!incoming[k];
      }
    }
  }
  base["gigs.read"] = true;
  return base;
}

/**
 * Read a membership once (active or not). Returns a plain object or null.
 * Path: venueProfiles/{venueId}/members/{uid}
 */
export async function getMembership(venueId, uid) {
  const ref = db.doc(`venueProfiles/${venueId}/members/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { uid, ...snap.data() };
}

/**
 * Ensure the user is an *active* member for the given venue.
 * Throws permission-denied if missing/inactive.
 * Returns the membership document (including role/permissions).
 */
export async function requireActiveMember(venueId, uid) {
  const m = await getMembership(venueId, uid);
  if (!m || m.status !== "active") {
    const err = new Error("FORBIDDEN: Not an active member");
    err.code = "permission-denied";
    throw err;
  }
  return m;
}

/**
 * Ensure the user has a specific permission (owner bypass).
 * - Throws permission-denied if not allowed.
 * - Returns true if OK.
 */
export async function requirePerm(venueId, uid, key) {
  const m = await requireActiveMember(venueId, uid);

  // Owner bypass
  if (m.role === "owner") return true;

  // Normalize and check
  const perms = normalizePermissions(m.permissions || {});
  if (perms[key] === true) return true;

  const err = new Error(`FORBIDDEN: Missing permission ${key}`);
  err.code = "permission-denied";
  throw err;
}

/**
 * Ensure user has ANY of the provided permissions (owner bypass).
 * Throws permission-denied if none match.
 */
export async function requireAnyPerm(venueId, uid, keys = []) {
  const m = await requireActiveMember(venueId, uid);
  if (m.role === "owner") return true;

  const perms = normalizePermissions(m.permissions || {});
  if (keys.some((k) => perms[k] === true)) return true;

  const err = new Error(`FORBIDDEN: Missing any of [${keys.join(", ")}]`);
  err.code = "permission-denied";
  throw err;
}

/**
 * Pure helper for member mgmt UIs:
 * Can caller edit target member? (server can use this too before mutating)
 * - Caller must be active
 * - Target must exist
 * - Caller cannot edit self
 * - Target with role "owner" is protected (unless you explicitly allow owners to edit owners)
 * - Caller must have members.update OR be owner
 */
export function canEditMember(callerMembership, targetMembership) {
  if (!callerMembership || callerMembership.status !== "active") return false;
  if (!targetMembership) return false;

  if (callerMembership.uid === targetMembership.uid) return false; // no self-edit
  if (targetMembership.role === "owner") return false;             // owner protected

  if (callerMembership.role === "owner") return true;              // owner can edit others

  const perms = normalizePermissions(callerMembership.permissions || {});
  return perms["members.update"] === true;
}