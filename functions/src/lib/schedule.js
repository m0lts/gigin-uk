/* eslint-disable */
// src/lib/schedule.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { DEFAULT_REGION } from "../config/regions.js";
import { DEFAULT_CONCURRENCY } from "../config/constants.js";

/**
 * schedule({ schedule, timeZone, region, ...fnOpts }, handler)
 * Thin wrapper around functions v2 scheduler so we keep region & options consistent.
 *
 * @param {object} opts
 * @param {string} opts.schedule - e.g. "every 10 minutes", "0 3 * * *"
 * @param {string} [opts.timeZone="Etc/UTC"]
 * @param {string} [opts.region=DEFAULT_REGION]
 * @param {number} [opts.timeoutSeconds]
 * @param {string} [opts.memory]
 * @param {Array<any>} [opts.secrets]
 * @param {number} [opts.maxInstances]
 * @param {(event: import("firebase-functions/v2/scheduler").ScheduledEvent)=>Promise<void>} handler
 */
export function schedule(opts, handler) {
  const {
    schedule: cron,
    timeZone = "Etc/UTC",
    region = DEFAULT_REGION,
    concurrency = DEFAULT_CONCURRENCY,
    ...rest
  } = opts || {};

  if (!cron) throw new Error("schedule() requires a cron `schedule` string");

  return onSchedule({ schedule: cron, timeZone, region, concurrency, ...rest }, async (event) => {
    try {
      await handler(event);
    } catch (e) {
      console.error("Scheduled function error:", e);
    }
  });
}