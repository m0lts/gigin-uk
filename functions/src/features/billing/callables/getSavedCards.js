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
    const db = admin.firestore();

    // Load user doc
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) throw new Error("User doc not found.");
    const userData = userSnap.data() || {};

    // Collect target customer IDs: user's + any venues listed on the user doc
    const customerIds = new Set();
    const userCustomerId = userData.stripeCustomerId || null;
    if (userCustomerId) customerIds.add(userCustomerId);

    // user.venueProfiles can be array of ids or objects with venueId
    const venueIds = Array.isArray(userData.venueProfiles)
      ? userData.venueProfiles
          .map((v) => (typeof v === "string" ? v : v?.venueId))
          .filter(Boolean)
      : [];

    let venueDocs = [];
    if (venueIds.length) {
      const refs = venueIds.map((id) => db.collection("venueProfiles").doc(id));
      venueDocs = await db.getAll(...refs);
    }

    const ownerMap = {};
    if (userCustomerId) {
      ownerMap[userCustomerId] = { ownerType: 'user', userName: userData.name };
    }
    venueDocs.forEach((doc) => {
      if (doc?.exists) {
        const v = doc.data() || {};
        if (v.stripeCustomerId) {
          ownerMap[v.stripeCustomerId] = {
            ownerType: 'venue',
            venueId: doc.id,
            venueName: v.name || v.displayName || doc.id,
          };
          customerIds.add(v.stripeCustomerId);
        }
      }
    });


    if (customerIds.size === 0) {
      return { paymentMethods: [] };
    }


    const stripe = makeStripe();

    const fetchBundle = async (cid) => {
      const [customer, pmList] = await Promise.all([
        stripe.customers.retrieve(cid, {
          expand: ["invoice_settings.default_payment_method"],
        }),
        stripe.paymentMethods.list({ customer: cid, type: "card" }),
      ]);
    
      const defaultId = customer?.invoice_settings?.default_payment_method?.id || null;
      const owner = ownerMap[cid] || { ownerType: 'unknown' };
    
      return pmList.data.map((pm) => ({
        ...pm,
        default: pm.id === defaultId,
        customer: cid,                 // owning Stripe customer
        ownerType: owner.ownerType,    // 'user' | 'venue' | 'unknown'
        venueId: owner.venueId || null,
        venueName: owner.venueName || null,
      }));
    };

    const arrays = await Promise.all(Array.from(customerIds).map(fetchBundle));
    const paymentMethods = arrays.flat();

    return { paymentMethods };
  }
);