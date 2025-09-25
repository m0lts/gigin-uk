/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { tasksClient } from "../../../lib/tasks.js";

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
      const {taskName} = request.data;
      if (!auth) {
        throw new Error(
            "unauthenticated", "User must be authenticated.",
        );
      }
      if (!taskName) {
        console.error("Task name is required to cancel a task.");
        throw new Error("Missing taskName parameter.");
      }
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