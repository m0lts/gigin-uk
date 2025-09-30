/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { requirePerm } from "../../../lib/authz.js";


export const updateGigDocument = callable(
    { region: REGION_PRIMARY, timeoutSeconds: 30, authRequired: true },
    async (req) => {
      const { gigId, updates } = req.data || {};
      if (!gigId || typeof gigId !== "string") {
        const e = new Error("INVALID_ARGUMENT: gigId is required");
        e.code = "invalid-argument";
        throw e;
      }
      if (!updates || typeof updates !== "object") {
        const e = new Error("INVALID_ARGUMENT: updates object required");
        e.code = "invalid-argument";
        throw e;
      }
  
      const gigRef = db.doc(`gigs/${gigId}`);
      await gigRef.update(updates);
  
      return { success: true };
    }
  );