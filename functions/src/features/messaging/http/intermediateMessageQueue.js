/* eslint-disable */
// src/features/messaging/http/intermediateMessageQueue.js
import { httpRaw } from "../../../lib/https.js";
import { REGION_US_CENTRAL } from "../../../config/regions.js";
import { getFunctionUrl, createCloudTask } from "../../../lib/tasks.js";
import { getFirestore } from "firebase-admin/firestore";

/**
 * HTTP endpoint (Cloud Tasks trampoline): re-enqueue the automatic
 * review message until it’s within the max ETA window, then dispatches
 * to `automaticReviewMessage`.
 *
 * Region: europe-west3 (switch to REGION_US_CENTRAL if preferred)
 *
 * @function intermediateMessageQueue
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const intermediateMessageQueue = httpRaw(
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
      gigDate,
      gigTime,
      amount,
      paymentIntentId,
      disputeClearingTime,
      ...rest
    } = req.body;

    const gigStartDate = new Date(gigDate);
    const [hours, minutes] = gigTime.split(":").map(Number);
    gigStartDate.setHours(hours);
    gigStartDate.setMinutes(minutes);
    gigStartDate.setSeconds(0);

    const maxAllowedDate = new Date(Date.now() + 720 * 60 * 60 * 1000);
    const targetUriForMessage = await getFunctionUrl("automaticReviewMessage");
    const intermediateQueueUri = await getFunctionUrl("intermediateMessageQueue");

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
      if (gigStartDate > maxAllowedDate) {
        taskName = await createCloudTask(
          {
            musicianId,
            applicantId,
            gigId,
            venueId,
            gigDate,
            gigTime,
            amount,
            paymentIntentId,
            disputeClearingTime,
            ...rest,
          },
          maxAllowedDate,
          intermediateQueueUri,
          "intermediateMessageQueue",
        );
        console.log(`Re-enqueued task for ${maxAllowedDate.toISOString()}`);
      } else {
        taskName = await createCloudTask(
          {
            musicianId,
            applicantId,
            gigId,
            venueId,
            gigDate,
            gigTime,
            amount,
            paymentIntentId,
            disputeClearingTime,
            ...rest,
          },
          gigStartDate,
          targetUriForMessage,
          "automaticReviewMessage",
        );
        console.log(
          `Enqueued Automatic Message for ${gigStartDate.toISOString()}`,
        );
      }

      await gigRef.update({ automaticMessageTaskName: taskName });
      res.status(200).send("Task processed successfully");
    } catch (error) {
      console.error("Error processing task:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);