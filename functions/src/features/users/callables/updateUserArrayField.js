/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

const ALLOWED_ARRAY_FIELDS = ["venueProfiles", "savedMusicians", "bands", "musicianProfile"];

export const updateUserArrayField = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const uid = req.auth.uid;
    const { field, op, value } = req.data || {};
    if (!field || !ALLOWED_ARRAY_FIELDS.includes(field)) {
      const err = new Error("INVALID_ARGUMENT: field not allowed");
      err.code = "invalid-argument";
      throw err;
    }
    if (!value || typeof value !== "string") {
      const err = new Error("INVALID_ARGUMENT: value required");
      err.code = "invalid-argument";
      throw err;
    }
    const userRef = db.doc(`users/${uid}`);
    if (op === "add") {
      await userRef.update({ [field]: FieldValue.arrayUnion(value) });
    } else if (op === "remove") {
      await userRef.update({ [field]: FieldValue.arrayRemove(value) });
    } else {
      const err = new Error("INVALID_ARGUMENT: op must be 'add' or 'remove'");
      err.code = "invalid-argument";
      throw err;
    }
    return { success: true, field, op, value };
  }
);