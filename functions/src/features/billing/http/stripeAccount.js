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
 * HTTP: Create a new Stripe account for a musician.
 * - CORS enabled via http() wrapper
 * - Expects POST with `{ musicianId }` in JSON body
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
      const { musicianId } = req.body;
      if (!musicianId) {
        return res.status(400).send({ error: "Musician ID is required." });
      }

      // ✅ use shared Stripe factory
      const stripe = makeStripe();

      const account = await stripe.accounts.create({
        capabilities: {
          transfers: { requested: true },
        },
        country: "GB",
        metadata: { musicianId },
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