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
          // Check if transfers are now active (account completed onboarding)
          const account = event.data.object;
          const canTransfer = account.capabilities?.transfers === "active" || account.payouts_enabled === true;
          
          if (canTransfer) {
            // Get userId from metadata (new model) or fall back to musicianId (legacy)
            const userId = account.metadata?.userId;
            const musicianId = account.metadata?.musicianId;
            const accountId = account.id;
            
            if (userId) {
              // New model: use user document with transaction to prevent duplicate transfers
              const userRef = admin.firestore().collection("users").doc(userId);
              
              // First, check if we've already transferred (idempotency check)
              const userDoc = await userRef.get();
              if (!userDoc.exists) {
                console.warn(`User ${userId} not found.`);
              } else {
                const userData = userDoc.data();
                const withdrawableEarnings = userData.withdrawableEarnings || 0;
                const lastTransferAccountId = userData.lastEarningsTransferAccountId;
                
                // Skip if already transferred to this account
                if (lastTransferAccountId === accountId) {
                  console.log(`Funds already transferred for user ${userId} to account ${accountId}. Skipping.`);
                } else if (withdrawableEarnings > 0) {
                  try {
                    console.log(
                      `Transferring £${withdrawableEarnings} to user ${userId} account ${accountId}`,
                    );
                    
                    // Create transfer first
                    const transfer = await stripe.transfers.create({
                      amount: Math.round(withdrawableEarnings * 100),
                      currency: "gbp",
                      destination: accountId,
                      metadata: {
                        userId,
                        description: "Transfer of existing earnings to Stripe Connect account",
                      },
                    });
                    
                    // Then update user document atomically using transaction
                    await admin.firestore().runTransaction(async (tx) => {
                      const userDocSnap = await tx.get(userRef);
                      if (!userDocSnap.exists) {
                        throw new Error("User document no longer exists");
                      }
                      
                      const currentData = userDocSnap.data();
                      // Double-check we haven't transferred in the meantime
                      if (currentData.lastEarningsTransferAccountId === accountId) {
                        throw new Error("Transfer already completed by another process");
                      }
                      
                      // Update atomically
                      tx.update(userRef, {
                        withdrawableEarnings: admin.firestore.FieldValue.increment(-withdrawableEarnings),
                        lastEarningsTransferAccountId: accountId,
                        lastEarningsTransferAmount: withdrawableEarnings,
                        lastEarningsTransferAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastEarningsTransferId: transfer.id,
                      });
                    });
                    
                    console.log(`Successfully transferred £${withdrawableEarnings} (transfer ID: ${transfer.id}).`);
                  } catch (error) {
                    console.error(`Error transferring funds to user ${userId}:`, error?.message || error);
                    // Don't throw - webhook should still return 200
                  }
                }
              }
            } else if (musicianId) {
              // Legacy: try profile documents
              let profileRef = admin.firestore().collection("artistProfiles").doc(musicianId);
              let profileDoc = await profileRef.get();
              
              if (!profileDoc.exists) {
                profileRef = admin.firestore().collection("musicianProfiles").doc(musicianId);
                profileDoc = await profileRef.get();
              }
              
              if (profileDoc.exists) {
                const profileData = profileDoc.data();
                const withdrawableEarnings = profileData.withdrawableEarnings || 0;
                const lastTransferAccountId = profileData.lastEarningsTransferAccountId;
                
                // Skip if already transferred to this account
                if (lastTransferAccountId === accountId) {
                  console.log(`Funds already transferred for profile ${musicianId} to account ${accountId}. Skipping.`);
                } else if (withdrawableEarnings > 0) {
                  try {
                    console.log(
                      `Transferring £${withdrawableEarnings} to legacy profile ${musicianId} account ${accountId}`,
                    );
                    
                    // Create transfer first
                    const transfer = await stripe.transfers.create({
                      amount: Math.round(withdrawableEarnings * 100),
                      currency: "gbp",
                      destination: accountId,
                      metadata: {
                        musicianId,
                        description: "Transfer of existing earnings to Stripe account",
                      },
                    });
                    
                    // Then update profile document atomically using transaction
                    await admin.firestore().runTransaction(async (tx) => {
                      const profileDocSnap = await tx.get(profileRef);
                      if (!profileDocSnap.exists) {
                        throw new Error("Profile document no longer exists");
                      }
                      
                      const currentData = profileDocSnap.data();
                      // Double-check we haven't transferred in the meantime
                      if (currentData.lastEarningsTransferAccountId === accountId) {
                        throw new Error("Transfer already completed by another process");
                      }
                      
                      // Update atomically
                      tx.update(profileRef, {
                        withdrawableEarnings: admin.firestore.FieldValue.increment(-withdrawableEarnings),
                        lastEarningsTransferAccountId: accountId,
                        lastEarningsTransferAmount: withdrawableEarnings,
                        lastEarningsTransferAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastEarningsTransferId: transfer.id,
                      });
                    });
                    
                    console.log(`Successfully transferred £${withdrawableEarnings} (transfer ID: ${transfer.id}).`);
                  } catch (error) {
                    console.error(`Error transferring funds to profile ${musicianId}:`, error?.message || error);
                    // Don't throw - webhook should still return 200
                  }
                }
              } else {
                console.warn(`Profile not found for: ${musicianId}`);
              }
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