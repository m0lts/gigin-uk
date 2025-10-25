/* eslint-disable */
import { onCall } from "firebase-functions/v2/https";
import { DEFAULT_REGION } from "../config/regions.js";
import { DEFAULT_CONCURRENCY } from "../config/constants.js";

/**
 * callable({ authRequired, secrets, region, ...fnOpts }, handler)
 */
export function callable(opts, handler) {
  const {
    authRequired = false,
    region = DEFAULT_REGION,
    enforceAppCheck = true,
    secrets = [],
    concurrency = DEFAULT_CONCURRENCY,
    ...rest
  } = opts || {};
  return onCall({ region, enforceAppCheck, secrets, concurrency, ...rest }, async (req) => {
    if (authRequired && !req.auth?.uid) {
      throw new Error("UNAUTHENTICATED");
    }
    return handler(req);
  });
}