/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { admin } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";

/**
 * Callable: fetch a user document by email.
 *
 * Input:
 * - `email` (string) — email to look up.
 *
 * Behavior:
 * - Queries `users` for a matching `email` (exact match), limited to 1 result.
 * - Returns `{ found: false, user: null }` if not found.
 * - Returns `{ found: true, user }` if found, where `user` includes `id` and document data.
 *
 * Security note:
 * - Consider restricting fields or requiring auth depending on your privacy policy.
 *
 * Region: europe-west3.
 *
 * @function getUserEmail
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{found: boolean, user: object|null}>}
 */
export const getUserEmail = callable(
  {
    // No authRequired to mirror your original; set authRequired: true if desired.
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
  },
  async (request) => {
    try {
      const { email } = request.data || {};
      if (!email) throw new Error("email is required");
      const snap = await admin
        .firestore()
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (snap.empty) {
        return { found: false, user: null };
      }
      const doc = snap.docs[0];
      const data = doc.data() || {};
      const user = { id: doc.id, ...data };
      return { found: true, user };
    } catch (error) {
      console.error("Error fetching user by email:", error);
      throw new Error("Unable to fetch user by email.");
    }
  }
);