/* eslint-disable */
import Stripe from "stripe";
import { IS_PROD } from "../config/env.js";

let stripeSingleton = null;

export function getStripe() {
  if (stripeSingleton) return stripeSingleton;
  
  // In production, use production key; otherwise use test key
  const key = IS_PROD 
    ? process.env.STRIPE_PRODUCTION_KEY || process.env.STRIPE_TEST_KEY
    : process.env.STRIPE_TEST_KEY || process.env.STRIPE_PRODUCTION_KEY;
  
  if (!key) {
    throw new Error(
      IS_PROD 
        ? "Stripe production API key not configured (STRIPE_PRODUCTION_KEY)"
        : "Stripe API key not configured (STRIPE_TEST_KEY/STRIPE_PRODUCTION_KEY)"
    );
  }
  
  stripeSingleton = new Stripe(key, { apiVersion: "2023-10-16" });
  return stripeSingleton;
}


