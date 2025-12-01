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

      // Try to fetch from artistProfiles first, then fall back to musicianProfiles
      let musicianRef = db.collection("artistProfiles").doc(musicianId);
      let musicianSnap = await musicianRef.get();
      let isArtistProfile = musicianSnap.exists;
      
      if (!isArtistProfile) {
        musicianRef = db.collection("musicianProfiles").doc(musicianId);
        musicianSnap = await musicianRef.get();
      }
      
      if (!musicianSnap.exists) {
        console.error(`Profile doc ${musicianId} not found in artistProfiles or musicianProfiles.`);
        return res.status(400).send(`Profile doc ${musicianId} not found.`);
      }
      
      const pendingDocRef = musicianRef.collection("pendingFees").doc(paymentIntentId);

      const [gigSnap, pendingDocSnap] = await Promise.all([
        db.collection("gigs").doc(gigId).get(),
        pendingDocRef.get(),
      ]);
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

      const payoutConfig = gig.payoutConfig || null;
      const stripe = makeStripe();
      const batch = db.batch();
      const emailsToSend = [];

      if (payoutConfig && payoutConfig.shares && payoutConfig.shares.length > 0) {
        // New model: split payouts across users based on payoutConfig
        const totalFee = Number(amount) || payoutConfig.totalFee || 0;
        const transferResults = [];

        // Process transfers for each user share
        for (const share of payoutConfig.shares) {
          const shareUserId = share.userId;
          const sharePercent = share.percent || 0;
          const shareAmount = Math.round((totalFee * sharePercent / 100) * 100) / 100;

          if (shareAmount <= 0 || !shareUserId) continue;

          // Get user document
          const userRef = db.collection("users").doc(shareUserId);
          const userSnap = await userRef.get();
          if (!userSnap.exists) {
            console.warn(`User ${shareUserId} not found for payout share`);
            continue;
          }

          const userData = userSnap.data() || {};
          const stripeConnectId = userData.stripeConnectId;
          let stripeTransferId = null;

          // Transfer to user's Stripe Connect account
          if (stripeConnectId) {
            try {
              const acct = await stripe.accounts.retrieve(stripeConnectId);
              const canTransfer =
                acct?.capabilities?.transfers === 'active' || acct?.payouts_enabled === true;

              if (canTransfer) {
                const transfer = await stripe.transfers.create({
                  amount: Math.round(shareAmount * 100),
                  currency: "gbp",
                  destination: stripeConnectId,
                  transfer_group: gigId,
                  metadata: {
                    userId: shareUserId,
                    gigId,
                    paymentIntentId,
                    artistProfileId: payoutConfig.artistProfileId || null,
                    sharePercent: sharePercent.toString(),
                    description: "Gig fee share transferred after dispute period cleared",
                  },
                });
                console.log(`Stripe transfer successful for user ${shareUserId}: ${transfer.id}`);
                stripeTransferId = transfer.id;
              } else {
                console.log(
                  `Stripe account ${stripeConnectId} exists but transfers not active. Skipping transfer; marking funds withdrawable.`
                );
              }
            } catch (error) {
              console.error(
                `Stripe transfer skipped for user ${shareUserId}:`,
                error?.message || error
              );
            }
          }

          // Update user document with earnings
          // Only increment withdrawableEarnings if user doesn't have active Stripe account
          // If they have Stripe, funds are already transferred above
          const updateData = {
            totalEarnings: FieldValue.increment(shareAmount),
            pendingFunds: FieldValue.increment(-shareAmount),
          };
          
          // Only track withdrawableEarnings if Stripe transfer didn't happen
          if (!stripeTransferId) {
            updateData.withdrawableEarnings = FieldValue.increment(shareAmount);
          }
          
          batch.set(userRef, updateData, { merge: true });

          transferResults.push({ userId: shareUserId, amount: shareAmount, transferId: stripeTransferId });
          
          // Queue email
          if (userData.email) {
            emailsToSend.push({ email: userData.email, name: userData.name || "User" });
          }
        }

        // Move pending fee to cleared on artistProfile (stays artist-focused)
        const clearedDocRef = musicianRef.collection("clearedFees").doc(paymentIntentId);
        batch.set(clearedDocRef, {
          ...pendingFee,
          status: "cleared",
          feeCleared: true,
          clearedAt: Timestamp.now(),
          recipientMusicianId: musicianId,
          applicantId,
          payoutConfig: payoutConfig,
          transferResults: transferResults,
        });
        batch.delete(pendingDocRef);

      } else {
        // Legacy model: single recipient
      let stripeTransferId = null;
        const userId = musician.userId;
        
        // Get Stripe account from user document (preferred) or profile (legacy)
        let stripeAccountId = null;
        if (userId) {
          const userRef = db.collection("users").doc(userId);
          const userSnap = await userRef.get();
          if (userSnap.exists) {
            stripeAccountId = userSnap.data()?.stripeConnectId;
          }
        }
        // Fallback to legacy stripeAccountId on profile
        if (!stripeAccountId) {
          stripeAccountId = musician.stripeAccountId;
        }

      if (stripeAccountId) {
        try {
          const acct = await stripe.accounts.retrieve(stripeAccountId);
          const canTransfer =
            acct?.capabilities?.transfers === 'active' || acct?.payouts_enabled === true;
      
          if (canTransfer) {
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
            console.log(
                `Stripe account ${stripeAccountId} exists but transfers not active. Skipping transfer; marking funds withdrawable.`
            );
          }
        } catch (error) {
          console.error(
            `Stripe transfer skipped for ${stripeAccountId}:`,
            error?.message || error
          );
        }
      }

        // Move pending fee to cleared on artistProfile
      const clearedDocRef = musicianRef.collection("clearedFees").doc(paymentIntentId);
        batch.set(clearedDocRef, {
        ...pendingFee,
        status: "cleared",
        feeCleared: true,
        stripeTransferId: stripeTransferId || null,
        clearedAt: Timestamp.now(),
        recipientMusicianId: musicianId,
        applicantId,
        });
        batch.delete(pendingDocRef);

        // Update user document with earnings (if userId exists)
        const amt = Number(amount) || 0;
        if (userId) {
          const userRef = db.collection("users").doc(userId);
          const updateData = {
            totalEarnings: FieldValue.increment(amt),
            pendingFunds: FieldValue.increment(-amt),
          };
          
          // Only track withdrawableEarnings if Stripe transfer didn't happen
          if (!stripeTransferId) {
            updateData.withdrawableEarnings = FieldValue.increment(amt);
          }
          
          batch.set(userRef, updateData, { merge: true });
        } else {
          // Legacy: update profile document
          const updateData = {
            totalEarnings: FieldValue.increment(amt),
            pendingFunds: FieldValue.increment(-amt),
          };
          
          // Only track withdrawableEarnings if Stripe transfer didn't happen
          if (!stripeTransferId) {
            updateData.withdrawableEarnings = FieldValue.increment(amt);
          }
          
          batch.set(musicianRef, updateData, { merge: true });
        }

        if (musicianEmail) {
          emailsToSend.push({ email: musicianEmail, name: musicianName || "Musician" });
        }
      }

      // Update gig status
      const updatedApplicants = (gig.applicants || []).map((application) =>
        application.id === applicantId ? { ...application, status: "paid" } : { ...application },
      );
      batch.update(gigSnap.ref, {
        musicianFeeStatus: "cleared",
        applicants: updatedApplicants,
      });

      await batch.commit();

      // Send emails
      const mailRef = db.collection("mail");
      for (const { email, name } of emailsToSend) {
        const mailMessage = gigFeeReleasedEmail(name, venueName);
        await mailRef.add({ to: email, message: mailMessage });
      }

      // Update gigsPerformed count (only for legacy model, not needed for payoutConfig)
      if (!payoutConfig) {
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
        // Try to fetch performer from artistProfiles first, then fall back to musicianProfiles
        let performerRef = db.collection("artistProfiles").doc(applicantId);
        let performerSnap = await performerRef.get();
        
        if (!performerSnap.exists) {
          performerRef = db.collection("musicianProfiles").doc(applicantId);
          performerSnap = await performerRef.get();
        }
        
        if (performerSnap.exists) {
          let clearedCount = 0;
          try {
            const agg = await performerRef.collection("clearedFees").count().get();
            clearedCount = agg.data().count || 0;
          } catch (err) {
            const snap = await performerRef.collection("clearedFees").get();
            clearedCount = snap.size;
          }
          await performerRef.set({ gigsPerformed: clearedCount }, { merge: true });
        } else {
          console.warn(`Performer profile ${applicantId} not found in artistProfiles or musicianProfiles.`);
        }
        }
      }

      console.log(`Fee cleared for gig ${gigId}.`);
      res.status(200).send({ success: true });
    } catch (error) {
      console.error("Error clearing fee:", error);
      res.status(500).send("Internal Server Error.");
    }
  }
);