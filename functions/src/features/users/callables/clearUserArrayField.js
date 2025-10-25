/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

const ALLOWED_ARRAY_FIELDS = ["venueProfiles", "savedMusicians", "musicianProfile", "bands"];

export const clearUserArrayField = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const uid = req.auth.uid;
    const { field } = req.data || {};
    if (!field || !ALLOWED_ARRAY_FIELDS.includes(field)) {
      const err = new Error("INVALID_ARGUMENT: field not allowed");
      err.code = "invalid-argument";
      throw err;
    }
    const userRef = db.doc(`users/${uid}`);
    await userRef.update({ [field]: FieldValue.delete() });
    return { success: true, field, cleared: true };
  }
);