/* eslint-disable */
import Stripe from "stripe";
import { IS_PROD } from "../config/env.js";
import { STRIPE_LIVE_KEY, STRIPE_TEST_KEY, STRIPE_WH_LIVE, STRIPE_WH_TEST } from "../config/secrets.js";
export function getStripeKey() {
  return IS_PROD ? STRIPE_LIVE_KEY.value() : STRIPE_TEST_KEY.value();
}
export function getWebhookSecret() {
  return IS_PROD ? STRIPE_WH_LIVE.value() : STRIPE_WH_TEST.value();
}
export function sanityCheckKey(key) {
  const s = String(key || "");
  if (!IS_PROD && s.startsWith("sk_live_")) throw new Error("Dev using LIVE Stripe key. Check secrets.");
  if (IS_PROD && s.startsWith("sk_test_")) throw new Error("Prod using TEST Stripe key. Check secrets.");
}
export function makeStripe() {
  const key = getStripeKey();
  sanityCheckKey(key);
  return new Stripe(key);
}