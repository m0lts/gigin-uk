/* eslint-disable */

const FIREBASE_CONFIG_JSON = process.env.FIREBASE_CONFIG || "{}";
const FIREBASE_CONFIG = (() => {
  try { return JSON.parse(FIREBASE_CONFIG_JSON); } catch { return {}; }
})();
export const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  FIREBASE_CONFIG.projectId ||
  "";
export const PROD_PROJECT_ID = "giginltd-16772";
export const IS_PROD = PROJECT_ID === PROD_PROJECT_ID;
export const IS_EMULATOR =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.PUBSUB_EMULATOR_HOST;
export const NODE_ENV = process.env.NODE_ENV || (IS_PROD ? "production" : "development");