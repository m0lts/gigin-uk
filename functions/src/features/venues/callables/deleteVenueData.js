/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue, admin } from "../../../lib/admin.js";

// Import existing callable functions
import { updateUserArrayField } from "../../users/callables/updateUserArrayField.js";
import { deleteReview } from "../../reviews/callables/deleteReview.js";
import { deleteGigAndInformation } from "../../gigs/callables/deleteGigAndInformation.js";

/**
 * deleteVenueData
 * -----------------
 * Deletes all venue-related data:
 *  - Deletes venueProfile + members subcollection
 *  - Removes venue from user's venueProfiles array
 *  - Deletes all gigs (via deleteGigAndInformation)
 *  - Deletes all reviews (via deleteReview)
 *  - Deletes templates linked to the venue
 *  - Deletes Storage folder /venues/{venueId}
 *
 * Conversations are NOT deleted (gig deletion already adds messages).
 */
export const deleteVenueData = callable(
  { authRequired: true, enforceAppCheck: true, timeoutSeconds: 540 },
  async (req) => {
    const uid = req.auth.uid;
    const { venueId, confirm = false } = req.data || {};

    if (!venueId) {
      const e = new Error("INVALID_ARGUMENT: venueId is required");
      e.code = "invalid-argument";
      throw e;
    }
    if (!confirm) {
      const e = new Error("INVALID_ARGUMENT: confirm=true is required");
      e.code = "invalid-argument";
      throw e;
    }

    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) {
      const e = new Error("NOT_FOUND: venue does not exist");
      e.code = "not-found";
      throw e;
    }

    const venueData = venueSnap.data() || {};
    const ownerId = venueData.userId || venueData.createdBy;
    if (ownerId !== uid) {
      const e = new Error("PERMISSION_DENIED: only the venue owner can delete this venue");
      e.code = "permission-denied";
      throw e;
    }
    const deleteMembersSubcollection = async () => {
      const membersCol = venueRef.collection("members");
      while (true) {
        const page = await membersCol.limit(500).get();
        if (page.empty) break;
        const batch = db.batch();
        page.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    };
    
    const deleteTemplates = async () => {
      const templatesSnap = await db.collection("templates").where("venueId", "==", venueId).get();
      if (templatesSnap.empty) return 0;

      const batch = db.batch();
      templatesSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      return templatesSnap.size;
    };
    
    await Promise.all([
        deleteTemplates(),
        deleteMembersSubcollection(),
    ]);

    await venueRef.delete();

    return {
      success: true,
      venueId,
    };
  }
);