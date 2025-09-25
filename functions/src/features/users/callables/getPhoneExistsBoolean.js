/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { admin } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";

/**
 * Callable: checks whether a phone number already exists on any user doc.
 *
 * Input:
 * - `phoneNumber` (string) — E.164 formatted preferred.
 *
 * Behavior:
 * - Queries `users` for a matching `phoneNumber` and returns a boolean.
 *
 * Region: europe-west3.
 *
 * @function getPhoneExistsBoolean
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<boolean>} true if a user with that phone exists; otherwise false
 */
export const getPhoneExistsBoolean = callable(
  {
    // no authRequired — can be used pre-signup to validate availability
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
  },
  async (request) => {
    try {
      const { phoneNumber } = request.data || {};
      if (!phoneNumber) throw new Error("phoneNumber is required");
      const snap = await admin
        .firestore()
        .collection("users")
        .where("phoneNumber", "==", phoneNumber)
        .limit(1)
        .get();
      return !snap.empty;
    } catch (error) {
      console.error("Error checking phone existence:", error);
      throw new Error("Unable to check phone number.");
    }
  }
);