/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";
import { makeStripe } from "../../../lib/stripeClient.js";
import { STRIPE_LIVE_KEY, STRIPE_TEST_KEY } from "../../../config/secrets.js";
import { REGION_PRIMARY } from "../../../config/regions.js";

/**
 * Callable: creates a Stripe PaymentIntent for a gig (not confirmed yet).
 *
 * Flow:
 * - Requires authentication.
 * - Validates inputs: `amountToCharge` (minor units), `gigData.gigId`.
 * - Resolves accepted applicant; if it's a band, fetches the admin's musicianId.
 * - Creates a PaymentIntent with `automatic_payment_methods.enabled = true`.
 * - Writes a `payments/{paymentIntentId}` doc with `requires_confirmation` status.
 * - Returns `{ clientSecret, paymentIntentId }` for client-side confirmation/SCA.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function createGigPaymentIntent
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{clientSecret: string, paymentIntentId: string}>}
 */
export const createGigPaymentIntent = callable(
  {
    authRequired: true,
    region: REGION_PRIMARY,
    secrets: [STRIPE_LIVE_KEY, STRIPE_TEST_KEY],
    timeoutSeconds: 3600,
  },
  async (request) => {
    const { auth } = request;
    const {
      amountToCharge,
      gigData,
      musicianProfileId,
      paymentMessageId,
      gigDate,
      customerId: requestedCustomerId,
    } = request.data || {};
    if (!Number.isInteger(amountToCharge) || amountToCharge <= 0) {
      throw new Error("Missing or invalid amountToCharge (positive integer, minor units).");
    }
    if (!gigData?.gigId) throw new Error("Missing inputs: gigData.gigId is required.");
    const userId = auth.uid;
    const userSnap = await db.collection("users").doc(userId).get();
    const userCustomerId = userSnap.data()?.stripeCustomerId || null;
    const customerId = requestedCustomerId || userCustomerId;
    if (!customerId) throw new Error("Stripe customer ID not found.");
    const applicantId = musicianProfileId || null;
    let applicantType = "musician";
    let recipientMusicianId = musicianProfileId || null;
    if (musicianProfileId) {
      const accepted = Array.isArray(gigData.applicants)
        ? gigData.applicants.find(
            (a) => a?.id === musicianProfileId && a?.status === "accepted"
          )
        : null;
      if (!accepted) {
        throw new Error("Accepted applicant doesn't match musician ID.");
      }
      applicantType = accepted.type || "musician";
      if (applicantType === "band") {
        const bandSnap = await db
          .collection("musicianProfiles")
          .doc(musicianProfileId)
          .get();
        if (!bandSnap.exists) throw new Error(`Band ${musicianProfileId} n/a.`);
        const band = bandSnap.data() || {};
        recipientMusicianId = band?.bandInfo?.admin?.musicianId;
        if (!recipientMusicianId) {
          throw new Error(`Band ${musicianProfileId} missing admin id.`);
        }
      }
    }
    const stripe = makeStripe();
    const pi = await stripe.paymentIntents.create({
      amount: amountToCharge,
      currency: "gbp",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        gigId: gigData.gigId,
        time: gigData.startTime,
        date: gigDate,
        venueName: gigData.venue.venueName,
        venueId: gigData.venueId,
        applicantId: applicantId,
        applicantType,
        recipientMusicianId: recipientMusicianId,
        paymentMessageId: paymentMessageId,
        paymentMadeById: userId,
        paymentMadeByName: userSnap.data()?.name,
      },
    });
    await db.collection("payments").doc(pi.id).set(
      {
        gigId: gigData.gigId,
        applicantId: applicantId || null,
        recipientMusicianId: recipientMusicianId || null,
        venueId: gigData.venueId || null,
        payerCustomerId: customerId, 
        status: "requires_confirmation",
        payerUid: userId,
        createdAt: FieldValue.serverTimestamp(),
        lastCheckedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { clientSecret: pi.client_secret, paymentIntentId: pi.id };
  }
);