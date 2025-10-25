/* eslint-disable */
import { onRequest } from "firebase-functions/v2/https";
import { DEFAULT_REGION } from "../config/regions.js";
import cors from "cors";
import { DEFAULT_RUNTIME_OPTIONS } from "../config/constants.js";

const corsMw = cors({ origin: true, methods: ["GET","POST","OPTIONS"] });

export function http(opts, handler) {
  const { region = DEFAULT_REGION, ...rest } = opts || {};
  return onRequest({ region, ...DEFAULT_RUNTIME_OPTIONS, ...rest }, (req, res) => {
    if (req.method === "OPTIONS") return corsMw(req, res, () => res.status(204).end());
    corsMw(req, res, async () => {
      try {
        await handler(req, res);
      } catch (e) {
        console.error(e);
        if (!res.headersSent) res.status(500).json({ error: "Internal error" });
      }
    });
  });
}

/** For webhooks (e.g., Stripe). No CORS, preserves rawBody. */
export function httpRaw(opts, handler) {
  const { region = DEFAULT_REGION, ...rest } = opts || {};
  return onRequest({ region, ...DEFAULT_RUNTIME_OPTIONS, ...rest }, async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.status(500).send("Internal error");
    }
  });
}