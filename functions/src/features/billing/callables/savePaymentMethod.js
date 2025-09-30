/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { makeStripe } from "../../../lib/stripeClient.js";
import { STRIPE_LIVE_KEY, STRIPE_TEST_KEY } from "../../../config/secrets.js";
import { REGION_PRIMARY } from "../../../config/regions.js";

/**
 * Callable function: attaches a new payment method to the user's Stripe Customer
 * and sets it as the default payment method.
 *
 * Flow:
 * - Requires the caller to be authenticated.
 * - Reads `paymentMethodId` from the request body.
 * - Looks up the user’s Firestore document for `stripeCustomerId`.
 * - Attaches the payment method to the Stripe Customer.
 * - Updates the Stripe Customer’s default invoice payment method.
 * - Returns the updated payment method and customer objects.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3 (default project region).
 *
 * @function savePaymentMethod
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 *   The callable request object (must include `auth` and `data.paymentMethodId`).
 * @returns {Promise<{success: boolean, paymentMethodUpdate: object, customerUpdate: object}>}
 *   Success flag and Stripe API responses.
 */
export const savePaymentMethod = callable(
  {
    authRequired: true,
    region: REGION_PRIMARY,
    secrets: [STRIPE_LIVE_KEY, STRIPE_TEST_KEY],
    timeoutSeconds: 180,
    minInstances: 0,
    maxInstances: 2,
  },
  async (request) => {
    const { paymentMethodId, customerId: requestedCustomerId } = request.data || {};
    const userId = request.auth.uid;
    if (!paymentMethodId) {
      throw new Error("INVALID_ARGUMENT: paymentMethodId is required");
    }
    try {
      const stripe = makeStripe();
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) throw new Error("User doc not found.");
      const userData = userDoc.data() || {};
      const userCustomerId = userData.stripeCustomerId || null;
      let targetCustomerId = userCustomerId;
      if (requestedCustomerId) {
        if (requestedCustomerId === userCustomerId) {
          targetCustomerId = requestedCustomerId;
        } else {
          const venueQuery = await db
            .collection("venueProfiles")
            .where("stripeCustomerId", "==", requestedCustomerId)
            .limit(1)
            .get();
          if (venueQuery.empty) {
            throw new Error("UNAUTHORIZED: customerId not found or not linked to a venue.");
          }
          targetCustomerId = requestedCustomerId;
        }
      }
      if (!targetCustomerId) {
        throw new Error("Stripe customer ID not found for this user.");
      }
      const paymentMethodUpdate = await stripe.paymentMethods.attach(
        paymentMethodId,
        { customer: targetCustomerId }
      );
      const customerUpdate = await stripe.customers.update(targetCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      return { success: true, paymentMethodUpdate, customerUpdate };
    } catch (error) {
      console.error("Error saving payment method:", error);
      throw new Error("Failed to save payment method.");
    }
  }
);