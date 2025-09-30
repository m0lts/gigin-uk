/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * getBandByPassword (CF)
 * - Queries bands by joinPassword
 * - Returns first matching band doc
 *
 * Input:
 *   { password: string }
 * Output:
 *   { band: { id: string, ...fields } }
 */
export const getBandByPassword = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { password } = req.data || {};
    if (!password || typeof password !== "string") {
      const e = new Error("INVALID_ARGUMENT: password required");
      e.code = "invalid-argument";
      throw e;
    }

    const q = await db
      .collection("bands")
      .where("joinPassword", "==", password)
      .limit(1)
      .get();

    if (q.empty) {
      const e = new Error("NOT_FOUND: no band with that password");
      e.code = "not-found";
      throw e;
    }

    const snap = q.docs[0];
    return { band: { id: snap.id, ...snap.data() } };
  }
);