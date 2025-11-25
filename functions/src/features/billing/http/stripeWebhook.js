/* eslint-disable */
// src/features/billing/http/stripeWebhook.js
import { httpRaw } from "../../../lib/https.js";
import { admin, db } from "../../../lib/admin.js";
import { REGION_US_CENTRAL } from "../../../config/regions.js";
import {
  STRIPE_WH_LIVE as whLive,
  STRIPE_WH_TEST as whTest,
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe, getWebhookSecret } from "../../../lib/stripeClient.js";
import { handlePaymentSuccess } from "../services/handlePaymentSuccess.js";
import { handlePaymentFailure } from "../services/handlePaymentFailure.js";

/**
 * HTTP webhook: receives Stripe events.
 *
 * Structural notes:
 * - Uses httpRaw (no CORS, preserves req.rawBody).
 * - Uses makeStripe() and getWebhookSecret() from lib.
 * - Secrets declared via config/secrets.
 *
 * Region: europe-west3 (change to REGION_US_CENTRAL if you keep webhooks there).
 *
 * @function stripeWebhook
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const stripeWebhook = httpRaw(
  {
    maxInstances: 3,
    secrets: [whLive, whTest, stripeLiveKey, stripeTestKey],
    timeoutSeconds: 3600,
    region: REGION_US_CENTRAL,
    memory: "1GiB",
    cpu: 0.5,
  },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const stripe = makeStripe();
    let event;
    const endpointSecret = getWebhookSecret();
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          await handlePaymentSuccess(event.data.object);
          await db.collection("payments").doc(event.data.object.id).set({
            status: "succeeded",
            lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
          break;
        case "payment_intent.payment_failed":
          await handlePaymentFailure(event.data.object);
          await db.collection("payments").doc(event.data.object.id).set({
            status: "failed",
            lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
          break;
        case "account.updated":
          if (event.data.object.capabilities.transfers === "active") {
            const musicianId = event.data.object.metadata.musicianId;
            // Try artistProfiles first, then fall back to musicianProfiles
            let profileRef = admin.firestore().collection("artistProfiles").doc(musicianId);
            let profileDoc = await profileRef.get();
            let isArtistProfile = profileDoc.exists;
            
            if (!isArtistProfile) {
              profileRef = admin.firestore().collection("musicianProfiles").doc(musicianId);
              profileDoc = await profileRef.get();
            }
            
            if (profileDoc.exists) {
              const profileData = profileDoc.data();
              const withdrawableEarnings = profileData.withdrawableEarnings || 0;
              if (withdrawableEarnings > 0) {
                console.log(
                  `Transferring £${withdrawableEarnings} to account ${event.data.object.id}`,
                );
                await stripe.transfers.create({
                  amount: Math.round(withdrawableEarnings * 100),
                  currency: "gbp",
                  destination: event.data.object.id,
                  metadata: {
                    musicianId,
                    description: "Transfer of existing earnings to Stripe account",
                  },
                });
                console.log(`Successfully transferred £${withdrawableEarnings}.`);
              }
            } else {
              console.warn(`Profile not found for: ${musicianId} (checked artistProfiles and musicianProfiles)`);
            }
          }
          break;
        default:
          console.info(`Unhandled event type ${event.type}`);
      }
      res.status(200).send({ received: true });
    } catch (err) {
      console.error("Error handling webhook event:", err.message);
      res.status(500).send(`Webhook handler error: ${err.message}`);
    }
  }
);