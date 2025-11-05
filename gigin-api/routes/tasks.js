/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db } from "../config/admin.js";
import { CloudTasksClient } from "@google-cloud/tasks";
import { assertVenuePerm } from "../utils/permissions.js";

const router = express.Router();

// POST /api/tasks/cancelCloudTask
router.post("/cancelCloudTask", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { taskName, gigId, venueId: venueIdRaw } = req.body || {};

  if (!taskName || typeof taskName !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "taskName is required" });
  }

  let venueId = venueIdRaw;
  if (!venueId && gigId) {
    const gigSnap = await db.doc(`gigs/${gigId}`).get();
    if (!gigSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "gig" });
    venueId = gigSnap.data()?.venueId;
  }
  if (!venueId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId or gigId required" });

  // Permission: venue owner or active member with reviews.create (same as callable)
  await assertVenuePerm(db, caller, venueId, 'reviews.create');

  try {
    const client = new CloudTasksClient();
    await client.deleteTask({ name: taskName });
    return res.json({ data: { success: true, message: `Task ${taskName} canceled successfully.` } });
  } catch (error) {
    console.error(`Error canceling task: ${taskName}`, error);
    return res.status(500).json({ error: "INTERNAL", message: `Failed to cancel task: ${error.message}` });
  }
}));

export default router;


