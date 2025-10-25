/* eslint-disable */
import { schedule } from "../../../lib/schedule.js";
import { REGION_US_CENTRAL } from "../../../config/regions.js";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { makeStripe } from "../../../lib/stripeClient.js";
import { handlePaymentSuccess } from "../services/handlePaymentSuccess.js";
import { handlePaymentFailure } from "../services/handlePaymentFailure.js";

/**
 * Scheduled task: Sweep Stripe payments stuck in "processing" state.
 *
 * Runs every 10 minutes, UTC.
 *
 * - Checks Firestore `payments` collection for items older than 10 minutes.
 * - Attempts to reconcile their status by retrieving the PaymentIntent from Stripe.
 * - If succeeded -> marks as `succeeded` and runs `handlePaymentSuccess`.
 * - If failed/canceled -> marks as `failed` and runs `handlePaymentFailure`.
 * - Uses Firestore doc `_internal/paymentsSweeperLock` as a lock to avoid overlaps.
 *
 * @function sweepPayments
 */
export const sweepPayments = schedule(
  {
    schedule: "every 10 minutes",
    timeZone: "Etc/UTC",
    region: REGION_US_CENTRAL,
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const db = getFirestore();
    const stripe = makeStripe();
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const pageSize = 100;

    // Prevent concurrent sweepers
    const lockRef = db.collection("_internal").doc("paymentsSweeperLock");
    const now = Date.now();
    const lockTtlMs = 4 * 60 * 1000;
    const lockSnap = await lockRef.get();
    if (lockSnap.exists && lockSnap.data().expiresAt > now) {
      console.log("Sweeper already running, skipping.");
      return;
    }
    await lockRef.set({ expiresAt: now + lockTtlMs }, { merge: true });

    try {
      let lastDoc = null;
      let processed = 0;
      let stopLoop = true;

      while (stopLoop) {
        let q = db
          .collection("payments")
          .where("status", "==", "processing")
          .where("createdAt", "<=", cutoff)
          .orderBy("createdAt", "asc")
          .limit(pageSize);

        if (lastDoc) q = q.startAfter(lastDoc);

        const snap = await q.get();
        if (snap.empty) {
          stopLoop = false;
          break;
        }

        for (const doc of snap.docs) {
          const piId = doc.id;
          try {
            const pi = await stripe.paymentIntents.retrieve(piId);

            if (pi.status === "succeeded") {
              await handlePaymentSuccess(pi);
              await doc.ref.set(
                {
                  status: "succeeded",
                  lastCheckedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            } else if (
              pi.status === "requires_payment_method" ||
              pi.status === "canceled"
            ) {
              await handlePaymentFailure(pi);
              await doc.ref.set(
                {
                  status: "failed",
                  lastCheckedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            } else {
              await doc.ref.set(
                { lastCheckedAt: FieldValue.serverTimestamp() },
                { merge: true }
              );
            }

            processed++;
          } catch (err) {
            console.error(`Error reconciling PI ${piId}:`, err);
          }
        }

        lastDoc = snap.docs[snap.docs.length - 1];
        stopLoop = snap.size === pageSize;
      }

      console.log(`Sweeper done. Processed ~${processed} items.`);
    } finally {
      await lockRef.set({ expiresAt: 0 }, { merge: true });
    }
  }
);