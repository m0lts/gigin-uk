/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { requirePerm } from "../../../lib/authz.js";

/**
 * Callable: Mark one or more applicants as viewed on a gig.
 *
 * Input:
 *  - venueId: string (required)
 *  - gigId: string (required)
 *  - applicantIds?: string[] (optional; if omitted, marks ALL current applicants as viewed)
 *
 * Security:
 *  - Requires authenticated user
 *  - Requires venue membership with permission "gigs.read"
 *
 * Behavior:
 *  - Loads the gig, verifies gig.venueId === venueId
 *  - In a transaction, sets `viewed: true` for matching applicants in the `applicants` array
 *  - Preserves all other applicant fields and other gig fields
 */
export const markApplicantsViewed = callable(
  { region: REGION_PRIMARY, timeoutSeconds: 30, authRequired: true },
  async (req) => {
    const uid = req.auth.uid;
    const { venueId, gigId, applicantIds } = req.data || {};

    if (!venueId || !gigId) {
      throw new Error("INVALID_ARGUMENT");
    }

    // Permission check (active member with gigs.read)
    await requirePerm(venueId, uid, "gigs.read");

    const gigRef = db.collection("gigs").doc(gigId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(gigRef);
      if (!snap.exists) throw new Error("NOT_FOUND: gig");

      const data = snap.data() || {};
      if (data.venueId !== venueId) throw new Error("VENUE_MISMATCH");

      const applicants = Array.isArray(data.applicants) ? data.applicants : [];

      // If no specific list provided, mark all current applicants
      const targetSet =
        Array.isArray(applicantIds) && applicantIds.length
          ? new Set(applicantIds)
          : new Set(applicants.map((a) => a?.id).filter(Boolean));

      // Map over existing array and set viewed=true where id matches
      const nextApplicants = applicants.map((a) => {
        if (a && targetSet.has(a.id)) {
          // shallow copy + force viewed true (preserve everything else)
          return { ...a, viewed: true };
        }
        return a;
      });

      tx.update(gigRef, {
        applicants: nextApplicants,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    return { ok: true };
  }
);