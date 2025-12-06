/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db } from "../config/admin.js";
import { CloudTasksClient } from "@google-cloud/tasks";
import { assertVenuePerm, assertArtistPerm } from "../utils/permissions.js";

const router = express.Router();

// POST /api/tasks/cancelCloudTask
router.post("/cancelCloudTask", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { taskName, gigId, venueId: venueIdRaw } = req.body || {};

  if (!taskName || typeof taskName !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "taskName is required" });
  }

  let venueId = venueIdRaw;
  let gigData = null;
  
  // Always fetch gig data if gigId is provided (needed to check applicants)
  if (gigId) {
    const gigSnap = await db.doc(`gigs/${gigId}`).get();
    if (!gigSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "gig" });
    gigData = gigSnap.data() || {};
    // Use gig's venueId if not provided in request
    if (!venueId) {
      venueId = gigData.venueId;
    }
  }
  if (!venueId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId or gigId required" });

  // Check if caller is an accepted applicant for this gig (artist/musician cancelling their own gig)
  let isAcceptedApplicant = false;
  if (gigId && gigData) {
    const applicants = Array.isArray(gigData.applicants) ? gigData.applicants : [];
    const acceptedApplicant = applicants.find(
      (a) => (a?.status === "accepted" || a?.status === "confirmed") && a?.id
    );
    
    if (acceptedApplicant) {
      const applicantId = acceptedApplicant.id;
      
      // Check if this is an artist profile and if caller has permission
      const artistRef = db.doc(`artistProfiles/${applicantId}`);
      const artistSnap = await artistRef.get();
      
      if (artistSnap.exists) {
        // Check if caller is owner or active member with gigs.book permission
        try {
          await assertArtistPerm(db, caller, applicantId, "gigs.book");
          isAcceptedApplicant = true;
        } catch (permError) {
          // Not an authorized member, continue to venue permission check
        }
      } else {
        // Legacy musician/band profile - check if caller is the owner
        const musicianRef = db.doc(`musicianProfiles/${applicantId}`);
        const musicianSnap = await musicianRef.get();
        if (musicianSnap.exists) {
          const musician = musicianSnap.data() || {};
          if (musician.userId === caller) {
            isAcceptedApplicant = true;
          }
        }
      }
    }
  }

  // If not an accepted applicant, check venue permissions
  if (!isAcceptedApplicant) {
    await assertVenuePerm(db, caller, venueId, 'reviews.create');
  }

  try {
    const client = new CloudTasksClient();
    await client.deleteTask({ name: taskName });
    return res.json({ data: { success: true, message: `Task ${taskName} canceled successfully.` } });
  } catch (error) {
    // Handle case where task doesn't exist (404) - this is acceptable
    if (error.code === 5 || error.message?.includes('NOT_FOUND') || error.message?.includes('not found')) {
      console.log(`Task ${taskName} not found (may have already been deleted). Continuing...`);
      return res.json({ data: { success: true, message: `Task ${taskName} not found (may have already been deleted).` } });
    }
    console.error(`Error canceling task: ${taskName}`, error);
    return res.status(500).json({ error: "INTERNAL", message: `Failed to cancel task: ${error.message}` });
  }
}));

export default router;


