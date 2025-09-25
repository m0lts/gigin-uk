/* eslint-disable */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { STRIPE_LIVE_KEY, STRIPE_TEST_KEY } from "../../../config/secrets.js";
import { admin, db } from "../../../lib/admin.js";
import { makeStripe } from "../../../lib/stripeClient.js";


/**
 * Firestore trigger: creates a Stripe Customer when a new user document is created.
 *
 * Flow:
 * - Runs when a document is created under `users/{uid}`.
 * - Skips if the user already has a `stripeCustomerId`.
 * - Retrieves the Stripe API key via Secret Manager and instantiates a Stripe client.
 * - Resolves the user's email from Firestore data or falls back to Firebase Auth.
 * - Creates a new Stripe Customer with the user's email and UID metadata.
 * - Stores the `stripeCustomerId` back in the user document in Firestore.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3 (default project region).
 *
 * @function createStripeCustomer
 * @param {import("firebase-functions/v2/firestore").FirestoreEvent} event
 *   The Firestore onDocumentCreated event payload.
 * @returns {Promise<void>} Resolves once the Stripe customer is created and the Firestore doc updated.
 */
export const createStripeCustomer = onDocumentCreated(
  {
    region: REGION_PRIMARY,
    document: "users/{uid}",
    secrets: [STRIPE_LIVE_KEY, STRIPE_TEST_KEY],
    maxInstances: 3,
  },
  async (event) => {
    const uid = event.params.uid;
    const snap = event.data;
    if (!snap) return;
    const userData = snap.data() || {};
    if (userData.stripeCustomerId) {
      console.log(`User ${uid} already has stripeCustomerId, skipping.`);
      return;
    }
    const stripe = makeStripe();
    let email = userData.email;
    if (!email) {
      const authUser = await admin.auth().getUser(uid).catch(() => null);
      email = (authUser && authUser.email) || null;
    }
    if (!email) {
      console.warn(`No email for uid ${uid}; cannot create Stripe customer.`);
      return;
    }
    const customer = await stripe.customers.create({ email, metadata: { uid } });
    await db.collection("users").doc(uid).set(
      { stripeCustomerId: customer.id },
      { merge: true }
    );
    console.log(`Stripe customer created for ${uid}: ${customer.id}`);
  }
);