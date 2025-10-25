/* eslint-disable */
// src/features/messaging/http/intermediateTaskQueue.js
import { httpRaw } from "../../../lib/https.js";
import { REGION_US_CENTRAL } from "../../../config/regions.js";
import { getFunctionUrl, createCloudTask } from "../../../lib/tasks.js";
import { getFirestore } from "firebase-admin/firestore";

/**
 * HTTP endpoint (Cloud Tasks trampoline): re-enqueue fee-clearing
 * until it’s within the Cloud Tasks max ETA window, then dispatches
 * to `clearPendingFee`.
 *
 * Region: europe-west3 (switch to REGION_US_CENTRAL if preferred)
 *
 * @function intermediateTaskQueue
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const intermediateTaskQueue = httpRaw(
  {
    timeoutSeconds: 3600,
    region: REGION_US_CENTRAL,
    memory: "512MiB",
  },
  async (req, res) => {
    const {
      musicianId,
      applicantId,
      gigId,
      venueId,
      disputeClearingTime,
      paymentIntentId,
      ...rest
    } = req.body;

    const targetDate = new Date(disputeClearingTime);
    const maxAllowedDate = new Date(Date.now() + 720 * 60 * 60 * 1000);
    const targetUriForFee = await getFunctionUrl("clearPendingFee");
    const intermediateQueueUri = await getFunctionUrl("intermediateTaskQueue");

    try {
      const firestore = getFirestore();
      const gigRef = firestore.collection("gigs").doc(gigId);
      const gigDoc = await gigRef.get();
      if (!gigDoc.exists) {
        console.error(`Gig with ID ${gigId} not found`);
        res.status(404).send(`Gig with ID ${gigId} not found`);
        return;
      }

      let taskName;
      if (targetDate > maxAllowedDate) {
        taskName = await createCloudTask(
          {
            musicianId,
            applicantId,
            gigId,
            venueId,
            disputeClearingTime,
            paymentIntentId,
            ...rest,
          },
          maxAllowedDate,
          intermediateQueueUri,
          "intermediateTaskQueue",
        );
        console.log(`Re-enqueued task for ${maxAllowedDate.toISOString()}`);
      } else {
        taskName = await createCloudTask(
          {
            musicianId,
            applicantId,
            gigId,
            venueId,
            disputeClearingTime,
            paymentIntentId,
            ...rest,
          },
          targetDate,
          targetUriForFee,
          "clearPendingFee",
        );
        console.log(`Enqueued clearPendingFee for ${targetDate.toISOString()}`);
      }

      await gigRef.update({ clearPendingFeeTaskName: taskName });
      res.status(200).send("Task processed successfully");
    } catch (error) {
      console.error("Error processing task:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);