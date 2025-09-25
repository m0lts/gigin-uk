/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * Callable: processes a refund for a given Stripe PaymentIntent.
 *
 * Input:
 * - `paymentIntentId` (string) — ID of the payment intent to refund.
 *
 * Behavior:
 * - Requires authenticated user.
 * - Creates a refund via Stripe for the provided paymentIntentId.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function processRefund
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{success: boolean}>}
 */
export const processRefund = callable(
  {
    region: REGION_PRIMARY,
    secrets: [stripeLiveKey, stripeTestKey],
    timeoutSeconds: 3600,
    authRequired: true,
  },
  async (request) => {
    const { auth } = request;
    const { paymentIntentId } = request.data;
    if (!auth) {
      throw new Error("unauthenticated", "User must be authenticated.");
    }
    if (!paymentIntentId) {
      console.error("Transaction ID is required for a refund.");
      throw new Error("Missing paymentIntentId parameter.");
    }
    try {
      const stripe = makeStripe();
      await stripe.refunds.create({
        payment_intent: paymentIntentId,
      });
      console.log(`Refund created for transaction: ${paymentIntentId}`);
      return { success: true };
    } catch (error) {
      console.error("Error processing refund:", error.message);
      throw new Error(`Failed to process refund: ${error.message}`);
    }
  }
);