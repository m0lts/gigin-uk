/* eslint-disable */
import { onCall } from "firebase-functions/v2/https";
import { DEFAULT_REGION } from "../config/regions.js";
import { DEFAULT_RUNTIME_OPTIONS } from "../config/constants.js";

/**
 * callable({ authRequired, secrets, region, ...fnOpts }, handler)
 */
export function callable(opts, handler) {
  const {
    authRequired = false,
    region = DEFAULT_REGION,
    enforceAppCheck = true,
    secrets = [],
    ...rest
  } = opts || {};
  return onCall({ region, enforceAppCheck, secrets, ...DEFAULT_RUNTIME_OPTIONS, ...rest }, async (req) => {
    if (authRequired && !req.auth?.uid) {
      throw new Error("UNAUTHENTICATED");
    }
    return handler(req);
  });
}