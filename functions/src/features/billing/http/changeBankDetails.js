/* eslint-disable */
import { http } from "../../../lib/https.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * HTTP: Create a Stripe Account Link for updating bank details.
 * - CORS enabled via http() wrapper
 * - Expects POST with `{ accountId }` in JSON body
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function changeBankDetails
 * @param {import("express").Request} req
 * @param {import("express").Response} res}
 */
export const changeBankDetails = http(
  {
    secrets: [stripeLiveKey, stripeTestKey],
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).send({ error: "Musician ID is required." });
    }

    try {
      // ✅ structural change: use shared Stripe factory
      const stripe = makeStripe();

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: "https://giginmusic.com/dashboard/finances",
        return_url: "https://giginmusic.com/dashboard/finances",
        type: "account_onboarding",
      });

      return res.json({ url: accountLink.url });
    } catch (error) {
      console.error(
        "Error occurred when calling the Stripe API to edit details",
        error
      );
      return res.status(500).send({ error: error.message });
    }
  }
);