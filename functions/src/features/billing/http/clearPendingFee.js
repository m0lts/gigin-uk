/* eslint-disable */
// src/features/billing/http/clearPendingFee.js
import { httpRaw } from "../../../lib/https.js";
import { REGION_US_CENTRAL } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";
import { gigFeeReleasedEmail } from "../../../lib/utils/emails.js";
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";

/**
 * HTTP endpoint (Cloud Tasks target): clears a pending musician fee after the dispute window.
 * - Validates payload from Cloud Tasks
 * - Transfers funds to connected Stripe account (if present)
 * - Moves pending fee to cleared, updates gig + musician aggregates
 * - Sends confirmation email
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3 (can be moved to us-central1 if your queues/endpoints live there)
 *
 * @function clearPendingFee
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const clearPendingFee = httpRaw(
  {
    secrets: [stripeLiveKey, stripeTestKey],
    timeoutSeconds: 3600,
    region: REGION_US_CENTRAL,
    maxInstances: 3,
  },
  async (req, res) => {
    try {
      const {
        musicianId,
        applicantId,
        paymentIntentId,
        gigId,
        amount,
        disputeClearingTime,
        venueId,
        gigDate,
        gigTime,
        musicianEmail,
        musicianName,
        venueName,
      } = req.body || {};
      if (
        !musicianId || !paymentIntentId || !gigId ||
        !venueId || !gigDate || !gigTime ||
        !amount || !disputeClearingTime ||
        !applicantId
      ) {
        console.error("Invalid payload received in task.", req.body);
        return res.status(400).send("Invalid payload.");
      }

      const musicianRef = db.collection("musicianProfiles").doc(musicianId);
      const pendingDocRef = musicianRef.collection("pendingFees").doc(paymentIntentId);

      const [musicianSnap, gigSnap, pendingDocSnap] = await Promise.all([
        musicianRef.get(),
        db.collection("gigs").doc(gigId).get(),
        pendingDocRef.get(),
      ]);

      if (!musicianSnap.exists) {
        console.error(`Musician doc ${musicianId} not found.`);
        return res.status(400).send(`Musician doc ${musicianId} not found.`);
      }
      if (!gigSnap.exists) {
        console.error(`Gig ${gigId} not found.`);
        return res.status(400).send(`Gig ${gigId} not found.`);
      }
      if (!pendingDocSnap.exists) {
        console.error(`Pending fee doc ${paymentIntentId} not found for gig ${gigId}.`);
        return res.status(400).send(`Fee for gig ${gigId} already cleared or not found.`);
      }

      const musician = musicianSnap.data() || {};
      const gig = gigSnap.data() || {};
      const pendingFee = pendingDocSnap.data() || {};

      if (gig.disputeLogged || pendingFee.disputeLogged) {
        console.error(`Dispute logged for gig ${gigId}`);
        return res.status(400).send(`Dispute logged for gig ${gigId}`);
      }

      // ✅ Structural change: use shared Stripe factory
      const stripe = makeStripe();

      let stripeTransferId = null;
      const stripeAccountId = musician.stripeAccountId;
      if (stripeAccountId) {
        const transfer = await stripe.transfers.create({
          amount: Math.round(Number(amount) * 100),
          currency: "gbp",
          destination: stripeAccountId,
          metadata: {
            musicianId,
            applicantId,
            gigId,
            paymentIntentId,
            description: "Gig fee transferred after dispute period cleared",
          },
        });
        console.log(`Stripe transfer successful: ${transfer.id}`);
        stripeTransferId = transfer.id;
      } else {
        console.log(`Musician ${musicianId} has no Stripe account`);
      }

      const clearedDocRef = musicianRef.collection("clearedFees").doc(paymentIntentId);
      const clearedPayload = {
        ...pendingFee,
        status: "cleared",
        feeCleared: true,
        stripeTransferId: stripeTransferId || null,
        clearedAt: Timestamp.now(),
        recipientMusicianId: musicianId,
        applicantId,
      };

      const batch = db.batch();
      batch.set(clearedDocRef, clearedPayload);
      batch.delete(pendingDocRef);

      const updatedApplicants = (gig.applicants || []).map((application) =>
        application.id === applicantId ? { ...application, status: "paid" } : { ...application },
      );

      batch.update(gigSnap.ref, {
        musicianFeeStatus: "cleared",
        applicants: updatedApplicants,
      });

      const amt = Number(amount) || 0;
      batch.set(
        musicianRef,
        {
          totalEarnings: FieldValue.increment(amt),
          withdrawableEarnings: FieldValue.increment(amt),
          pendingFunds: FieldValue.increment(-amt),
        },
        { merge: true },
      );

      await batch.commit();

      if (applicantId === musicianId) {
        let clearedCount = 0;
        try {
          const agg = await musicianRef.collection("clearedFees").count().get();
          clearedCount = agg.data().count || 0;
        } catch (err) {
          const snap = await musicianRef.collection("clearedFees").get();
          clearedCount = snap.size;
        }
        await musicianRef.set({ gigsPerformed: clearedCount }, { merge: true });
      } else {
        const performerRef = db.collection("musicianProfiles").doc(applicantId);
        let clearedCount = 0;
        try {
          const agg = await performerRef.collection("clearedFees").count().get();
          clearedCount = agg.data().count || 0;
        } catch (err) {
          const snap = await performerRef.collection("clearedFees").get();
          clearedCount = snap.size;
        }
        await performerRef.set({ gigsPerformed: clearedCount }, { merge: true });
      }

      const mailRef = db.collection("mail");
      const isAdmin = applicantId === musicianId;
      const mailMessage = gigFeeReleasedEmail(musicianName, venueName, isAdmin);
      await mailRef.add({
        to: musicianEmail,
        message: mailMessage,
      });

      console.log(`Fee cleared for recipient ${musicianId}, gig ${gigId}.`);
      res.status(200).send({ success: true });
    } catch (error) {
      console.error("Error clearing fee:", error);
      res.status(500).send("Internal Server Error.");
    }
  }
);