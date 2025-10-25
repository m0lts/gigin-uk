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
    authRequired: true,
    secrets: [stripeLiveKey, stripeTestKey],
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
  },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new Error("User must be authenticated.");
    const userId = auth.uid;

    const requestedCustomerId = data?.customerId || null;
    const include = Array.isArray(data?.include) ? data.include : null; 
    // include can contain: 'customer', 'paymentMethods', 'receipts', 'defaultPaymentMethod'

    // load caller user + personal customer
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) throw new Error("User doc not found.");
    const userCustomerId = userDoc.data()?.stripeCustomerId || null;

    // Defaults: personal scope
    let scope = { type: "personal", canPay: true, canRead: true, canUpdate: true };
    let customerId = userCustomerId;

    if (requestedCustomerId && requestedCustomerId !== userCustomerId) {
      // Venue scope
      const venueQuery = await admin.firestore()
        .collection("venueProfiles")
        .where("stripeCustomerId", "==", requestedCustomerId)
        .limit(1).get();

      if (venueQuery.empty) {
        const e = new Error("UNAUTHORIZED: customerId not found or not linked to a venue.");
        // @ts-ignore
        e.code = "permission-denied";
        throw e;
      }

      const venueSnap = venueQuery.docs[0];
      const venue = venueSnap.data() || {};
      const venueRef = venueSnap.ref;

      const isOwner = venue?.createdBy === userId || venue?.userId === userId;

      let canPay = isOwner;
      let canRead = isOwner;
      let canUpdate = isOwner;

      if (!isOwner) {
        const mSnap = await venueRef.collection("members").doc(userId).get();
        const m = mSnap.exists ? mSnap.data() : null;
        const active = !!m && m.status === "active";
        const perms = sanitizePermissions(m?.permissions || {});
        if (active) {
          canPay    = !!perms["gigs.pay"];
          canRead   = !!perms["finances.read"];
          canUpdate = !!perms["finances.update"];
        } else {
          canPay = canRead = canUpdate = false;
        }
      }

      scope = { type: "venue", canPay, canRead, canUpdate };
      customerId = requestedCustomerId;
    }

    if (!customerId) throw new Error("Stripe customer ID not found.");

    // Decide what to fetch based on scope + include
    const needCustomer = include ? include.includes("customer") || include.includes("defaultPaymentMethod") || include.includes("paymentMethods")
                                 : true;
    const needPMs      = scope.type === "personal" ? true
                        : scope.canUpdate && (include ? include.includes("paymentMethods") : true);
    const needDefault  = scope.type === "personal" ? true
                        : scope.canPay && (include ? include.includes("defaultPaymentMethod") : true);
    const needReceipts = scope.type === "personal" ? true
                        : scope.canRead && (include ? include.includes("receipts") : true);

    const stripe = makeStripe();

    // Fetch only what’s needed
    let customer = null;
    let paymentMethods = [];
    let defaultPaymentMethodId = null;
    let defaultSourceId = null;
    let receipts = [];

    if (needCustomer || needDefault) {
      customer = await stripe.customers.retrieve(customerId, {
        expand: ["invoice_settings.default_payment_method", "default_source"],
      });
      const defaultPm = customer?.invoice_settings?.default_payment_method || null;
      defaultPaymentMethodId = defaultPm ? defaultPm.id : null;
      defaultSourceId = customer?.default_source || null;
    }

    if (needPMs) {
      const pmList = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
      paymentMethods = pmList.data;
    }

    if (needReceipts) {
      // TODO: paginate if needed
      const charges = await stripe.charges.list({ customer: customerId, limit: 100 });
      receipts = charges.data
        .filter(c => c.status === "succeeded" && c.receipt_url)
        .sort((a, b) => (b.created || 0) - (a.created || 0));
    }

    // For venue scope: trim fields the caller isn't allowed to see
    if (scope.type === "venue") {
      if (!scope.canUpdate) paymentMethods = [];            // no card list
      if (!scope.canRead) receipts = [];                    // no receipts
      if (!scope.canPay) {                                  // can't even see default
        defaultPaymentMethodId = null;
        defaultSourceId = null;
      }
    }

    return {
      // Always safe to return minimal customer object id
      customer: needCustomer ? customer : { id: customerId },
      receipts,
      paymentMethods,
      defaultPaymentMethodId,
      defaultSourceId,
      scope, // optional: useful on client for UI gating
    };
  }
);