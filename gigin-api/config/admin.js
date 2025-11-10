/* eslint-disable */
import admin from "firebase-admin";
import { getFirestore, FieldValue, Timestamp, GeoPoint } from "firebase-admin/firestore";
import { PROJECT_ID, IS_PROD, IS_DEV, IS_EMULATOR, PROD_PROJECT_ID, DEV_PROJECT_ID } from "./env.js";

let initialized = false;

/**
 * Initialize Firebase Admin SDK with the correct project.
 * 
 * Project Detection:
 * - In Cloud Run: GCLOUD_PROJECT is automatically set to the deployed project
 * - Locally: Uses GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT env var, or Firebase default project
 * 
 * This uses Application Default Credentials which work automatically in Cloud Run.
 * In local development, ensure you're using the correct project:
 * - `gcloud auth application-default login`
 * - Or set GCLOUD_PROJECT environment variable to match your Firebase project
 */
export function initializeAdmin() {
  if (initialized) {
    return;
  }

  if (!admin.apps.length) {
    try {
      // Check if we should use emulators (must be set BEFORE initializing Admin SDK)
      const useEmulators = 
        process.env.USE_EMULATORS === "true" ||
        process.env.FIRESTORE_EMULATOR_HOST ||
        process.env.FIREBASE_AUTH_EMULATOR_HOST ||
        IS_EMULATOR;

      if (useEmulators) {
        // Set emulator environment variables BEFORE initializing Admin SDK
        // Firebase Admin SDK reads these during initialization
        process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8081";
        process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
        console.log("🔥 Using Firebase Emulators");
        console.log(`   Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
        console.log(`   Auth: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
      }

      // Validate project ID is detected
      if (!PROJECT_ID) {
        console.warn(
          "WARNING: No project ID detected. Using Application Default Credentials.\n" +
          "Set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT environment variable."
        );
      } else {
        // Verify project ID matches expected values
        const isValidProject = PROJECT_ID === PROD_PROJECT_ID || PROJECT_ID === DEV_PROJECT_ID;
        if (!isValidProject) {
          console.warn(
            `WARNING: Project ID '${PROJECT_ID}' doesn't match expected projects.\n` +
            `Expected: ${DEV_PROJECT_ID} (dev) or ${PROD_PROJECT_ID} (prod)`
          );
        }
      }

      // Initialize Firebase Admin
      // In Cloud Run, this automatically uses the service account of the deployed project
      // Locally, it uses Application Default Credentials (from gcloud auth application-default login)
      // When emulator env vars are set, Admin SDK automatically connects to emulators
      const appOptions = PROJECT_ID
        ? {
            projectId: PROJECT_ID,
            credential: admin.credential.applicationDefault(),
          }
        : {
            credential: admin.credential.applicationDefault(),
          };

      admin.initializeApp(appOptions);

      // Log initialization success with project info
      const firebaseProject = admin.app().options.projectId || PROJECT_ID || "auto-detected";
      console.log("Firebase Admin initialized successfully", {
        projectId: firebaseProject,
        isProduction: IS_PROD,
        isDevelopment: IS_DEV,
        isEmulator: IS_EMULATOR,
      });
    } catch (error) {
      console.error("Failed to initialize Firebase Admin:", error);
      console.error(
        "Ensure you have:\n" +
        "1. Set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT environment variable\n" +
        "2. Run 'gcloud auth application-default login' (for local development)\n" +
        "3. Or ensure Cloud Run has proper service account permissions"
      );
      throw error;
    }
  }

  initialized = true;
}

// Lazy-load Firestore instance - only created after initialization
let _db = null;
function getDb() {
  if (!admin.apps.length) {
    throw new Error(
      "Firebase Admin not initialized. Call initializeAdmin() before using db."
    );
  }
  if (!_db) {
    _db = getFirestore();
  }
  return _db;
}

// Export Firestore instance and utilities
// db is a getter that lazily initializes Firestore after Admin SDK is initialized
export const db = new Proxy({}, {
  get(target, prop) {
    return getDb()[prop];
  },
});

export { admin, FieldValue, Timestamp, GeoPoint };
