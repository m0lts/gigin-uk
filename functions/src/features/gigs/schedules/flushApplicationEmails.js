/* eslint-disable */
import { schedule } from "../../../lib/schedule.js";
import { flushDueApplicationEmails } from "../services/applicationEmails.js";

/** Sends batched application emails once each recipient's 60-minute window ends. */
export const flushApplicationEmails = schedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Etc/UTC",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    await flushDueApplicationEmails();
  },
);
