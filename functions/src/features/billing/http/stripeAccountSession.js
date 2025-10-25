/* eslint-disable */
// src/features/billing/http/stripeAccountSession.js
import { http } from "../../../lib/https.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * HTTP: Create a Stripe Account Session for onboarding/management.
 * - CORS enabled via http() wrapper
 * - Expects POST with `{ account }` in JSON body
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function stripeAccountSession
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const stripeAccountSession = http(
  {
    secrets: [stripeLiveKey, stripeTestKey],
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
    maxInstances: 3,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    try {
      const stripe = makeStripe();
      const { account } = req.body;
      if (!account) {
        return res.status(400).json({ error: "Missing data" });
      }
      const accountSession = await stripe.accountSessions.create({
        account,
        components: {
          account_onboarding: { enabled: true },
          account_management: { enabled: true },
        },
      });
      res.json({ client_secret: accountSession.client_secret });
    } catch (error) {
      console.error(
        "Error occurred calling the Stripe API to create account session",
        error
      );
      res.status(500).send({ error: error.message });
    }
  }
);