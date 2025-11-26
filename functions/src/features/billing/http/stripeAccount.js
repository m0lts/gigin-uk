/* eslint-disable */
// src/features/billing/http/stripeAccount.js
import { http } from "../../../lib/https.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * HTTP: Create a new Stripe Connect account for a user or musician.
 * - CORS enabled via http() wrapper
 * - Expects POST with `{ userId }` (new model) or `{ musicianId }` (legacy) in JSON body
 * - Supports both user-level (new) and musicianProfile-level (legacy) Stripe accounts
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function stripeAccount
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const stripeAccount = http(
  {
    secrets: [stripeLiveKey, stripeTestKey],
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    try {
      const { userId, musicianId } = req.body;
      // Support both new (userId) and legacy (musicianId) models
      const ownerId = userId || musicianId;
      if (!ownerId) {
        return res.status(400).send({ error: "User ID or Musician ID is required." });
      }

      // ✅ use shared Stripe factory
      const stripe = makeStripe();

      const account = await stripe.accounts.create({
        capabilities: {
          transfers: { requested: true },
        },
        country: "GB",
        metadata: { 
          userId: userId || null,
          musicianId: musicianId || null,
          ownerId, // For backward compatibility
        },
        controller: {
          stripe_dashboard: { type: "none" },
          fees: { payer: "application" },
          losses: { payments: "application" },
          requirement_collection: "application",
        },
        settings: {
          payouts: { schedule: { interval: "manual" } },
        },
      });

      res.json({ account: account.id });
    } catch (error) {
      console.error(
        "Error occurred when calling the Stripe API to create an account",
        error
      );
      res.status(500).send({ error: error.message });
    }
  }
);