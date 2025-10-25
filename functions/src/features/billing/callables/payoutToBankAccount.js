/* eslint-disable */
// src/features/billing/callables/payoutToBankAccount.js
import { callable } from "../../../lib/callable.js";
import { admin, FieldValue, Timestamp } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * Callable: initiate a payout from a musician's connected Stripe account
 * to their bank account and deduct local ledger balances.
 *
 * Input:
 * - `musicianId` (string)
 * - `amount` (number, major units e.g. GBP)
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
 * @function payoutToBankAccount
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{success: boolean, payoutId: string}>}
 */
export const payoutToBankAccount = callable(
  {
    secrets: [stripeLiveKey, stripeTestKey],
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
    authRequired: true,
  },
  async (request) => {
      // ✅ structural change: use shared Stripe factory
      const stripe = makeStripe();

      const {musicianId, amount} = request.data;
      const {auth} = request;
      if (!auth) {
        throw new Error("User must be authenticated.");
      }

      if (!musicianId ||
    typeof musicianId !== "string" ||
    musicianId.trim() === ""
      ) {
        throw new Error("Invalid musicianId provided.");
      }

      if (!amount || amount <= 0) {
        throw new Error("Invalid amount provided.");
      }

      try {
        const musicianDoc =
        await admin
            .firestore()
            .collection("musicianProfiles")
            .doc(musicianId)
            .get();
        if (!musicianDoc.exists) {
          throw new Error("Musician profile not found.");
        }

        const musicianData = musicianDoc.data();
        const stripeAccountId = musicianData.stripeAccountId;

        if (!stripeAccountId) {
          throw new Error("Stripe account ID not found for this musician.");
        }

        const withdrawableEarnings = musicianData.withdrawableEarnings || 0;
        if (withdrawableEarnings < amount) {
          throw new Error("Insufficient withdrawable earnings.");
        }

        const payout = await stripe.payouts.create(
            {
              amount: Math.round(amount * 100),
              currency: "gbp",
              metadata: {
                musicianId,
                description: "Payout of withdrawable funds",
              },
            },
            {stripeAccount: stripeAccountId},
        );

        await admin.firestore()
            .collection("musicianProfiles")
            .doc(musicianId).update({
              withdrawableEarnings: FieldValue.increment(-amount),
              withdrawals: FieldValue.arrayUnion({
                amount: amount,
                status: "complete",
                timestamp: Timestamp.now(),
                stripePayoutId: payout.id,
              }),
            });

        return {success: true, payoutId: payout.id};
      } catch (error) {
        console.error("Error creating payout:", error);
        throw new Error("Failed to create payout.");
      }
    }
);