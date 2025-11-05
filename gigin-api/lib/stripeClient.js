/* eslint-disable */
import Stripe from "stripe";

let stripeSingleton = null;

export function getStripe() {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_TEST_KEY || process.env.STRIPE_PRODUCTION_KEY;
  if (!key) throw new Error("Stripe API key not configured (STRIPE_TEST_KEY/STRIPE_PRODUCTION_KEY)");
  stripeSingleton = new Stripe(key, { apiVersion: "2023-10-16" });
  return stripeSingleton;
}


