/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { tasksClient } from "../../../lib/tasks.js";
import { db } from "../../../lib/admin.js";
import { assertVenuePerm } from "../../../lib/utils/permissions.js";

/**
 * Callable: cancels a Cloud Tasks task by full task name.
 *
 * Input:
 * - `taskName` (string) — Full task resource name:
 *   `projects/{project}/locations/{location}/queues/{queue}/tasks/{task}`
 *
 * Behavior:
 * - Requires authentication.
 * - Deletes the task via Cloud Tasks API.
 *
 * Region: europe-west3.
 *
 * @function cancelCloudTask
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const cancelCloudTask = callable(
  {
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
    authRequired: true,
  },
  async (request) => {
      const {auth} = request;
      const {taskName, gigId, venueId: venueIdRaw} = request.data;
      if (!auth) {
        throw new Error(
            "unauthenticated", "User must be authenticated.",
        );
      }
      if (!taskName) {
        console.error("Task name is required to cancel a task.");
        throw new Error("Missing taskName parameter.");
      }
      let venueId = venueIdRaw;
      if (!venueId && gigId) {
        const gigSnap = await db.doc(`gigs/${gigId}`).get();
        if (!gigSnap.exists) {
          const e = new Error("NOT_FOUND: gig");
          e.code = "not-found";
          throw e;
        }
        venueId = gigSnap.data()?.venueId;
      }
      if (!venueId) {
        const e = new Error("INVALID_ARGUMENT: venueId or gigId required");
        e.code = "invalid-argument";
        throw e;
      }
      await assertVenuePerm(caller, venueId, 'reviews.create');
      try {
        const client = tasksClient();
        await client.deleteTask({name: taskName});
        console.log(`Task canceled successfully: ${taskName}`);
        return {
          success: true, message: `Task ${taskName} canceled successfully.`,
        };
      } catch (error) {
        console.error(`Error canceling task: ${taskName}`, error);
        throw new Error(`Failed to cancel task: ${error.message}`);
      }
    }
);