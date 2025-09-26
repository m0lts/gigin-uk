/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { requirePerm } from "../../../lib/authz.js";


export const updateGigDocument = callable(
    { region: REGION_PRIMARY, timeoutSeconds: 30, authRequired: true },
    async (req) => {
      const { gigId, updates } = req.data || {};
      const uid = req.auth.uid;
  
      if (!gigId || typeof updates !== "object") {
        throw new HttpsError("invalid-argument", "gigId and updates required");
      }
  
      // Load gig and verify membership
      const gigSnap = await db.collection("gigs").doc(gigId).get();
      if (!gigSnap.exists) throw new HttpsError("not-found", "Gig not found");
  
      const gig = gigSnap.data();
      await requirePerm(gig.venueId, uid, "gigs.update");
  
      // Whitelist allowed fields
      const allowedKeys = ["status", "viewed", "somethingSmall"];
      const sanitized = {};
      for (const key of Object.keys(updates)) {
        if (!allowedKeys.includes(key)) {
          throw new HttpsError("permission-denied", `Field ${key} cannot be updated`);
        }
        sanitized[key] = updates[key];
      }
  
      await gigSnap.ref.update(sanitized);
  
      return { ok: true };
    }
  );