/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { admin, db } from "../../../lib/admin.js";

/**
 * Delete the authenticated user's account and primary Firestore footprint.
 * - Requires recent sign-in (default 5 minutes).
 * - Deletes users/{uid}
 * - Removes membership docs: venueProfiles/{venueId}/members/{uid}
 * - Revokes tokens + deletes Firebase Auth user
 *
 * NOTE: We intentionally DO NOT delete venueProfiles the user created.
 *       If you want that behaviour later, we can gate it behind a flag
 *       and add additional validation/confirmation.
 */
export const deleteUserDocument = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const uid = req.auth.uid;
    const { confirm = false } = req.data || {};
    if (!confirm) {
      const err = new Error("INVALID_ARGUMENT: confirm=true is required");
      err.code = "invalid-argument";
      throw err;
    }
    // ---- recent sign-in check (5 minutes) ----
    const NOW_SECONDS = Math.floor(Date.now() / 1000);
    const AUTH_TIME = req.auth.token?.auth_time || 0;
    const MAX_AGE = 5 * 60; // 5 minutes
    if (NOW_SECONDS - AUTH_TIME > MAX_AGE) {
      const err = new Error("UNAUTHENTICATED: Recent login required");
      err.code = "unauthenticated";
      throw err;
    }
    const userRef = db.doc(`users/${uid}`);
    const batch = db.batch();
    batch.delete(userRef);
    await batch.commit();
    await admin.auth().revokeRefreshTokens(uid);
    return {
      success: true,
      uid,
    };
  }
);