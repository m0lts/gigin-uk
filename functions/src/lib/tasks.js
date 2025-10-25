/* eslint-disable */
import { CloudTasksClient } from "@google-cloud/tasks";
import { GoogleAuth } from "google-auth-library";
import { PROJECT_ID } from "../config/env.js";

// Centralise your queue location here (matches where your queues are created)
export const TASKS_LOCATION = "us-central1";

let _client;
export function tasksClient() {
  if (!_client) _client = new CloudTasksClient();
  return _client;
}

/**
 * Enqueue a task (raw wrapper).
 * @param {string} queueName - Queue id (not full path).
 * @param {object} httpRequest - Cloud Tasks HTTP request object: { httpMethod, url, headers, body, oidcToken? }
 * @returns {Promise<object>} created task
 */
export async function enqueue(queueName, httpRequest) {
  const parent = tasksClient().queuePath(PROJECT_ID, TASKS_LOCATION, queueName);
  const [resp] = await tasksClient().createTask({
    parent,
    task: { httpRequest },
  });
  return resp;
}

let _auth;
/**
 * Get the deployed HTTPS URL of a Cloud Function (v2) by name and location.
 * @param {string} name - Function name (e.g., "clearPendingFee")
 * @param {string} [location=TASKS_LOCATION] - Region the function is deployed in
 * @returns {Promise<string>} HTTPS URL of the function
 */
export async function getFunctionUrl(name, location = TASKS_LOCATION) {
  if (!_auth) {
    _auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
  }
  const projectId = await _auth.getProjectId();
  const url = `https://cloudfunctions.googleapis.com/v2beta/projects/${projectId}/locations/${location}/functions/${name}`;
  const client = await _auth.getClient();
  const res = await client.request({ url });
  const uri = res.data?.serviceConfig?.uri;
  if (!uri) throw new Error(`Unable to retrieve uri for function at ${url}`);
  return uri;
}

/**
 * Create a scheduled Cloud Task targeting a given HTTPS function URL.
 * Uses the App Engine default service account for OIDC authentication.
 *
 * @param {object} payload - JSON-serializable body
 * @param {Date} scheduleTime - When the task should run
 * @param {string} targetUri - Fully-qualified HTTPS endpoint to call
 * @param {string} queueName - Queue id (must exist in TASKS_LOCATION)
 * @returns {Promise<string>} Task name returned by Cloud Tasks
 */
export async function createCloudTask(payload, scheduleTime, targetUri, queueName) {
  const client = new CloudTasksClient();
  const project = process.env.GCLOUD_PROJECT;
  if (!project) {
    throw new Error("GCLOUD_PROJECT is not set in environment variables.");
  }
  const location = "us-central1"; // adjust if you use queues in another region
  const serviceAccountEmail = `${project}@appspot.gserviceaccount.com`;
  const parent = client.queuePath(project, location, queueName);

  const task = {
    httpRequest: {
      httpMethod: "POST",
      url: targetUri,
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
      headers: {
        "Content-Type": "application/json",
      },
      oidcToken: {
        serviceAccountEmail,
      },
    },
    scheduleTime: {
      seconds: Math.floor(scheduleTime.getTime() / 1000),
    },
  };

  const request = { parent, task };
  const [response] = await client.createTask(request);
  return response.name;
}