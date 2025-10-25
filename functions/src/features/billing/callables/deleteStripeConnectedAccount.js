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
 * Callable: delete a musician’s connected Stripe account.
 *
 * Input:
 * - `musicianId` (string) — musician profile ID.
 *
 * Behavior:
 * - Verifies caller is authenticated and owns the musician profile.
 * - Checks for available balance on connected account.
 * - If balance > 0, refuses deletion with message.
 * - If balance == 0, deletes account from Stripe and clears Firestore fields.
 *
 * Security:
 * - Requires auth; caller must be the owner of the musician profile.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function deleteStripeConnectedAccount
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const deleteStripeConnectedAccount = callable(
  {
    secrets: [stripeLiveKey, stripeTestKey],
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
    authRequired: true,
  },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new Error("User must be authenticated.");
    const { musicianId } = data || {};
    if (!musicianId) throw new Error("Missing musicianId.");

    const db = admin.firestore();
    const musicRef = db.collection("musicianProfiles").doc(musicianId);
    const musicSnap = await musicRef.get();
    if (!musicSnap.exists) throw new Error("Musician profile not found.");

    const { userId, stripeAccountId } = musicSnap.data();
    if (userId !== auth.uid) throw new Error("Not authorized.");
    if (!stripeAccountId) {
      return { success: true, message: "No Stripe account attached." };
    }

    const stripe = makeStripe();
    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });
    const availableTotal = (balance.available || []).reduce(
      (sum, b) => sum + (b.amount || 0),
      0
    );

    if (availableTotal > 0) {
      return {
        success: false,
        message:
          "Please withdraw your available balance before deleting your account.",
      };
    }

    await stripe.accounts.del(stripeAccountId);
    await musicRef.update({
      stripeAccountId: admin.firestore.FieldValue.delete(),
      bankDetailsAdded: false,
      withdrawableEarnings: 0,
    });

    return { success: true };
  }
);