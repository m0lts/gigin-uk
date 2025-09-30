/* eslint-disable */
// src/features/billing/http/setDefaultPaymentMethod.js
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { makeStripe } from "../../../lib/stripeClient.js";
import { STRIPE_LIVE_KEY, STRIPE_TEST_KEY } from "../../../config/secrets.js";
import { REGION_PRIMARY } from "../../../config/regions.js";

/**
 * Callable function: updates the user's Stripe Customer to set the default
 * payment method for invoices and subscriptions.
 *
 * Flow:
 * - Requires the caller to be authenticated.
 * - Reads `paymentMethodId` from the request body.
 * - Looks up the user’s Firestore document for `stripeCustomerId`.
 * - Calls Stripe API to update the default payment method.
 * - Returns the updated Stripe Customer object.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3 (default project region).
 *
 * @function setDefaultPaymentMethod
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 *   The callable request object (must include `auth` and `data.paymentMethodId`).
 * @returns {Promise<{success: boolean, updatedCustomer: object}>}
 *   Success flag and updated Stripe Customer object.
 */
export const setDefaultPaymentMethod = callable(
  {
    authRequired: true,
    region: REGION_PRIMARY,
    secrets: [STRIPE_LIVE_KEY, STRIPE_TEST_KEY],
    timeoutSeconds: 60,
  },
  async (request) => {
    const { paymentMethodId, customerId: requestedCustomerId } = request.data || {};
    const userId = request.auth.uid;
    if (!paymentMethodId) {
      throw new Error("INVALID_ARGUMENT: paymentMethodId is required");
    }
    try {
      const stripe = makeStripe();
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        throw new Error("User document not found.");
      }
      const { stripeCustomerId } = userSnap.data() || {};
      const targetCustomerId = requestedCustomerId || stripeCustomerId;
      if (!targetCustomerId) throw new Error("Stripe customer ID not found for this user.");
      const updatedCustomer = await stripe.customers.update(targetCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      return { success: true, updatedCustomer };
    } catch (error) {
      console.error("Error setting default payment method:", error);
      throw new Error("Failed to set default payment method.");
    }
  }
);