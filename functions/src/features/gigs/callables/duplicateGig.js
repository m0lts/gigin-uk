/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

/**
 * duplicateGig (CF)
 * Moves the client-side duplication to server.
 * - Reads original gig
 * - Creates a new gig with a fresh ID
 * - Resets applicants[], timestamps, status
 * - Adds new gigId to venueProfiles/{venueId}.gigs via arrayUnion
 *
 * Input:  { gigId: string }
 * Output: { gigId: string }
 */
export const duplicateGig = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { gigId } = req.data || {};
    if (!gigId || typeof gigId !== "string") {
      const e = new Error("INVALID_ARGUMENT: gigId is required");
      e.code = "invalid-argument";
      throw e;
    }

    // Load original gig
    const originalRef = db.doc(`gigs/${gigId}`);
    const originalSnap = await originalRef.get();
    if (!originalSnap.exists) {
      const e = new Error(`NOT_FOUND: gig ${gigId}`);
      e.code = "not-found";
      throw e;
    }
    const originalData = originalSnap.data() || {};

    // Create new gig doc ref (auto-id)
    const newGigRef = db.collection("gigs").doc();
    const newGigId = newGigRef.id;

    // Prepare new gig data (mirror client behavior)
    const now = new Date();
    const newGig = {
      ...originalData,
      gigId: newGigId,
      applicants: [],
      createdAt: now,
      updatedAt: now,
      status: "open",
    };
    // Remove any stray 'id' field if present
    delete newGig.id;

    // Write new gig
    await newGigRef.set(newGig, { merge: false });

    // Append to venue profile gigs array if venueId present
    if (originalData.venueId) {
      const venueRef = db.doc(`venueProfiles/${originalData.venueId}`);
      await venueRef.update({
        gigs: FieldValue.arrayUnion(newGigId),
      }).catch(() => {
        // If venue doc missing 'gigs' field, ensure it's created
        return venueRef.set({ gigs: [newGigId] }, { merge: true });
      });
    }

    return { gigId: newGigId };
  }
);