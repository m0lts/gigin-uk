/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * Callable: transfers funds from your platform balance to a musician's
 * connected Stripe account.
 *
 * Input:
 * - `connectedAccountId` (string) — destination account id (e.g. acct_...)
 * - `amount` (number) — amount in minor units (pence)
 *
 * Security:
 * - Requires authenticated caller.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function transferFunds
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{success: boolean, transfer: object}>}
 */
export const transferFunds = callable(
  {
    secrets: [stripeLiveKey, stripeTestKey],
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
    authRequired: true,
  },
  async (request) => {
      const {connectedAccountId, amount} = request.data;
      const {auth} = request;
      if (!auth) {
        throw new Error("User must be authenticated.");
      }
      if (!connectedAccountId || !amount) {
        throw new Error("Missing required parameters.");
      }
      try {
        // ✅ structural change: use shared Stripe factory
        const stripe = makeStripe();
        const transfer = await stripe.transfers.create({
          amount,
          currency: "gbp",
          destination: connectedAccountId,
        });
        return {success: true, transfer: transfer};
      } catch (error) {
        console.error("Error transfering funds:", error);
        throw new Error("Failed to transfer funds.");
      }
    }
);