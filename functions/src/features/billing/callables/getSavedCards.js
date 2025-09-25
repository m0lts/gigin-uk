/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { admin } from "../../../lib/admin.js";
import { makeStripe } from "../../../lib/stripeClient.js";
import { STRIPE_LIVE_KEY, STRIPE_TEST_KEY } from "../../../config/secrets.js";
import { REGION_PRIMARY } from "../../../config/regions.js";

/**
 * Callable: lists the saved card payment methods for the authenticated user.
 *
 * Flow:
 * - Requires authentication.
 * - Loads the user's Firestore doc to get `stripeCustomerId`.
 * - Uses Stripe to list `payment_methods` of type `card`.
 * - Returns an array of card payment methods.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function getSavedCards
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{ paymentMethods: object[] }>}
 */
export const getSavedCards = callable(
  {
    authRequired: true,
    region: REGION_PRIMARY,
    secrets: [STRIPE_LIVE_KEY, STRIPE_TEST_KEY],
    timeoutSeconds: 3600,
  },
  async (request) => {
    const userId = request.auth.uid;

    const userSnap = await admin.firestore().collection("users").doc(userId).get();
    const customerId = userSnap.data()?.stripeCustomerId;
    if (!customerId) throw new Error("Stripe customer ID not found.");

    try {
      const stripe = makeStripe();
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });
      return { paymentMethods: paymentMethods.data };
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      throw new Error("Unable to fetch payment methods.");
    }
  }
);