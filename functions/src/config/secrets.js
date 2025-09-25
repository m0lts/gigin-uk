/* eslint-disable */
import { defineSecret } from "firebase-functions/params";

export const STRIPE_LIVE_KEY = defineSecret("STRIPE_PRODUCTION_KEY");
export const STRIPE_TEST_KEY = defineSecret("STRIPE_TEST_KEY");
export const STRIPE_WH_LIVE = defineSecret("STRIPE_PROD_WEBHOOK");
export const STRIPE_WH_TEST = defineSecret("STRIPE_WEBHOOK_SECRET");