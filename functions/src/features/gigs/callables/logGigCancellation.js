/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * logGigCancellation (CF)
 * Moves client write to server. No extra reads/validation.
 *
 * Input:
 *  {
 *    gigId: string,
 *    musicianId?: string,
 *    venueId?: string,
 *    reason: string,
 *    cancellingParty?: 'musician' | 'venue'
 *  }
 * Output: { id: string }
 */
export const logGigCancellation = callable(
    { authRequired: true, enforceAppCheck: true },
    async (req) => {
      const {
        gigId,
        musicianId = null,
        venueId = null,
        reason = "",
        cancellingParty = "musician",
      } = req.data || {};
  
      const doc = {
        gigId,
        musicianId,
        venueId,
        reason,
        cancellingParty,
        createdAt: new Date(),   // server timestamp
        createdBy: req.auth.uid, // optional server-stamped caller
      };
  
      const ref = await db.collection("cancellations").add(doc);
      return { id: ref.id };
    }
  );