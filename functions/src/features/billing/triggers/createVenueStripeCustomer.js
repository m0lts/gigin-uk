/* eslint-disable */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { STRIPE_LIVE_KEY, STRIPE_TEST_KEY } from "../../../config/secrets.js";
import { admin, db } from "../../../lib/admin.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * Firestore trigger: creates a Stripe Customer when a new venue profile is created.
 *
 * - Listens on `venueProfiles/{venueId}`.
 * - Skips if `stripeCustomerId` already exists.
 * - Tries venue emails (contact/billing/email) or falls back to owner’s auth email if `createdByUid` present.
 * - Creates a Stripe Customer with venue name + metadata.
 * - Stores `stripeCustomerId` back on the venue doc.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3 (same as users trigger).
 */
export const createVenueStripeCustomer = onDocumentCreated(
    {
      region: REGION_PRIMARY,
      document: "venueProfiles/{venueId}",
      secrets: [STRIPE_LIVE_KEY, STRIPE_TEST_KEY],
      maxInstances: 3,
    },
    async (event) => {
      const venueId = event.params.venueId;
      const snap = event.data;
      if (!snap) return;
  
      const venue = snap.data() || {};
      if (venue.stripeCustomerId) {
        console.log(`Venue ${venueId} already has stripeCustomerId, skipping.`);
        return;
      }
  
      const stripe = makeStripe();
  
      let email =
        venue.contactEmail ||
        venue.billingEmail ||
        venue.email ||
        null;
  
      const customerPayload = {
        name: venue.name || venue.displayName || `Venue ${venueId}`,
        email: email || undefined,
        metadata: {
          venueId,
        },
      };
  
      const customer = await stripe.customers.create(customerPayload);
  
      await db.collection("venueProfiles").doc(venueId).set(
        { stripeCustomerId: customer.id },
        { merge: true }
      );
  
      console.log(`Stripe customer created for venue ${venueId}: ${customer.id}`);
    }
  );