/* eslint-disable */
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { STRIPE_LIVE_KEY, STRIPE_TEST_KEY } from "../../../config/secrets.js";
import { admin, db } from "../../../lib/admin.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * Firestore trigger: creates a Stripe Customer when a venue profile is updated.
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

export const updateVenueStripeCustomer = onDocumentUpdated(
    {
      region: REGION_PRIMARY,
      document: "venueProfiles/{venueId}",
      secrets: [STRIPE_LIVE_KEY, STRIPE_TEST_KEY],
      maxInstances: 3,
    },
    async (event) => {
      const venueId = event.params.venueId;
  
      const beforeSnap = event.data?.before;
      const afterSnap  = event.data?.after;
      if (!afterSnap?.exists) return;
  
      const before = beforeSnap?.data() || {};
      const venue  = afterSnap.data() || {};
  
      // Run only when we previously had no customer AND still have none
      if (before.stripeCustomerId || venue.stripeCustomerId) {
        console.log(`Venue ${venueId} already has stripeCustomerId (before or after), skipping.`);
        return;
      }
  
      const stripe = makeStripe();
  
      // Try to resolve an email (optional for Stripe Customers)
      let email =
        venue.contactEmail ||
        venue.billingEmail ||
        venue.email ||
        null;
  
      const customerPayload = {
        name: venue.name || venue.displayName || `Venue ${venueId}`,
        email: email || undefined,
        metadata: { venueId },
      };
  
      const customer = await stripe.customers.create(customerPayload);
  
      await db.collection("venueProfiles").doc(venueId).set(
        { stripeCustomerId: customer.id },
        { merge: true }
      );
  
      console.log(`Stripe customer created for venue ${venueId}: ${customer.id}`);
    }
  );