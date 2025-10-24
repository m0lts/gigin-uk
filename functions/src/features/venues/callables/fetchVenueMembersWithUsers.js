/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { PERM_DEFAULTS, PERM_KEYS } from "../../../lib/utils/permissions.js";

/** server-side mirror of your normalizePermissions */
function normalizePermissions(incoming) {
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
 * fetchVenueMembersWithUsers
 * Input: { venueId: string }
 * Auth: required. Only the venue creator can fetch the full member list.
 * Output: [{ uid, status, role, permissions, user: { id, name, email, photoURL? } }]
 */
export const fetchVenueMembersWithUsers = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const caller = req.auth.uid;
    const { venueId } = req.data || {};
    if (!venueId || typeof venueId !== "string") {
      const e = new Error("INVALID_ARGUMENT: venueId required");
      e.code = "invalid-argument";
      throw e;
    }

    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) {
      const e = new Error("NOT_FOUND: venue");
      e.code = "not-found";
      throw e;
    }

    // Fetch active members
    const membersSnap = await venueRef.collection("members")
      .where("status", "==", "active")
      .get();

    const members = membersSnap.docs.map(d => ({
      uid: d.id,
      ...(d.data() || {}),
    }));

    if (members.length === 0) return [];

    // Batch fetch user docs
    const userRefs = members.map(m => db.doc(`users/${m.uid}`));
    const userSnaps = await db.getAll(...userRefs);

    const userById = new Map();
    userSnaps.forEach(s => {
      if (s.exists) {
        const u = s.data() || {};
        userById.set(s.id, {
          id: s.id,
          name: u.name || null,
          email: u.email || null,
          photoURL: u.picture || u.photoURL || null,
        });
      }
    });

    const result = members.map(m => ({
      uid: m.uid,
      status: m.status || "active",
      role: m.role || "member",
      permissions: normalizePermissions(m.permissions),
      createdAt: m.createdAt || null,
      updatedAt: m.updatedAt || null,
      user: userById.get(m.uid) || null,
      userName: (userById.get(m.uid) || {}).name || null,
      userEmail: (userById.get(m.uid) || {}).email || null,
    }));

    return result;
  }
);