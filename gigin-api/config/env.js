/* eslint-disable */

const FIREBASE_CONFIG_JSON = process.env.FIREBASE_CONFIG || "{}";
const FIREBASE_CONFIG = (() => {
  try {
    return JSON.parse(FIREBASE_CONFIG_JSON);
  } catch {
    return {};
  }
})();

// Project IDs from .firebaserc
export const PROD_PROJECT_ID = "giginltd-16772";
export const DEV_PROJECT_ID = "giginltd-dev";

// Detect current project ID from environment
// Priority: GCLOUD_PROJECT > GOOGLE_CLOUD_PROJECT > FIREBASE_CONFIG.projectId
export const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  FIREBASE_CONFIG.projectId ||
  "";

// Determine if we're in production or development
export const IS_PROD = PROJECT_ID === PROD_PROJECT_ID;
export const IS_DEV = PROJECT_ID === DEV_PROJECT_ID || (!IS_PROD && PROJECT_ID !== "");

// Emulator detection
export const IS_EMULATOR =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.PUBSUB_EMULATOR_HOST;

// Node environment
export const NODE_ENV = process.env.NODE_ENV || (IS_PROD ? "production" : "development");

// Log detected environment for debugging (only in non-production)
if (IS_DEV || NODE_ENV === "development") {
  console.log("Environment Configuration:", {
    PROJECT_ID,
    IS_PROD,
    IS_DEV,
    IS_EMULATOR,
    NODE_ENV,
  });
}
