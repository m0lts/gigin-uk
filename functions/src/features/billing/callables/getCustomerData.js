/* eslint-disable */
// src/features/billing/callables/getCustomerData.js
import { callable } from "../../../lib/callable.js";
import { admin } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * Callable: retrieves a user's Stripe Customer data, payment methods, and receipts.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function getCustomerData
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<object>} Customer data and receipts
 */
export const getCustomerData = callable(
  {
    secrets: [stripeLiveKey, stripeTestKey],
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
  },
  async (request) => {
      const {auth} = request;
      if (!auth) {
        throw new Error("User must be authenticated.");
      }
      const requestedCustomerId = request.data?.customerId || null;
      const userId = auth.uid;

      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      if (!userDoc.exists) throw new Error("User doc not found.");
      const userData = userDoc.data() || {};
      const userCustomerId = userData.stripeCustomerId || null;

      let customerId = userCustomerId;
      if (requestedCustomerId) {
        if (requestedCustomerId === userCustomerId) {
          customerId = requestedCustomerId;
        } else {
          const venueQuery = await admin
            .firestore()
            .collection("venueProfiles")
            .where("stripeCustomerId", "==", requestedCustomerId)
            .limit(1)
            .get();
          if (venueQuery.empty) {
            throw new Error("UNAUTHORIZED: customerId not found or not linked to a venue.");
          }
          customerId = requestedCustomerId;
        }
      }
      if (!customerId) {
        throw new Error("Stripe customer ID not found.");
      }
      try {
        const stripe = makeStripe();
        const customer = await stripe.customers.retrieve(customerId, {
          expand: ["invoice_settings.default_payment_method", "default_source"],
        });
        const pmList = await stripe.paymentMethods.list({
          customer: customerId,
          type: "card",
        });
        const charges =
        await stripe.charges.list({customer: customerId, limit: 100});
        const receipts = charges.data.filter(
            (c) => c.status === "succeeded" && c.receipt_url,
        );
        const defaultPm = customer.invoice_settings.default_payment_method;
        let defaultPmId;
        let defaultSourceId;
        if (defaultPm) {
          defaultPmId = defaultPm.id;
          defaultSourceId = customer.default_source || null;
        }
        return {
          customer,
          receipts,
          paymentMethods: pmList.data,
          defaultPaymentMethodId: defaultPmId,
          defaultSourceId,
        };
      } catch (error) {
        console.error("Error fetching customer data:", error);
        throw new Error("Unable to fetch customer data.");
      }
    }
);