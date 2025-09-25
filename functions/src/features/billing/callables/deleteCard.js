/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { admin } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * Callable: deletes (detaches) a saved card payment method from the
 * authenticated user's Stripe Customer.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function deleteCard
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{success: boolean}>}
 */
export const deleteCard = callable(
  {
    region: REGION_PRIMARY,
    secrets: [stripeLiveKey, stripeTestKey],
    timeoutSeconds: 3600,
    authRequired: true,
  },
  async (request) => {
      const {auth} = request;
      const {cardId} = request.data;
      if (!auth) {
        throw new Error(
            "unauthenticated", "User must be authenticated.",
        );
      }
      if (!cardId) {
        throw new Error(
            "invalid-argument", "Card ID is required.",
        );
      }
      const userId = auth.uid;
      const userDoc =
  await admin.firestore().collection("users").doc(userId).get();
      const customerId = userDoc.data().stripeCustomerId;
      if (!customerId) {
        throw new Error(
            "not-found", "Stripe customer ID not found.",
        );
      }
      try {
        const stripe = makeStripe();
        await stripe.paymentMethods.detach(cardId);
        return {success: true};
      } catch (error) {
        console.error("Error deleting card:", error);
        throw new Error(
            "internal", "Unable to delete the card.",
        );
      }
    }
);