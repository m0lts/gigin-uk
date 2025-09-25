/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { admin, db, FieldValue } from "../../../lib/admin.js";
import { makeStripe } from "../../../lib/stripeClient.js";
import { STRIPE_LIVE_KEY, STRIPE_TEST_KEY } from "../../../config/secrets.js";
import { REGION_PRIMARY } from "../../../config/regions.js";

/**
 * Callable: creates & confirms a Stripe PaymentIntent for a booked gig.
 *
 * Flow:
 * - Requires authentication.
 * - Validates input: paymentMethodId, gigData.gigId, amountToCharge.
 * - Ensures the accepted applicant matches the provided musicianProfileId.
 * - If the accepted applicant is a band, resolves the band admin's musician id
 *   as the ultimate recipient.
 * - Creates a PaymentIntent (off_session + confirm) with rich metadata.
 * - Marks the gig's applicant status as "payment processing" in a transaction,
 *   stores payment record in `payments/{paymentIntentId}`.
 * - Returns { success: true, paymentIntent }.
 *
 * Error handling:
 * - Maps Stripe errors; if SCA required, returns `{ requiresAction: true, clientSecret }`
 *   and writes a `payments` doc with `requires_action` status.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function confirmPayment
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<object>} Payment result payload
 */
export const confirmPayment = callable(
  {
    authRequired: true,
    region: REGION_PRIMARY,
    secrets: [STRIPE_LIVE_KEY, STRIPE_TEST_KEY],
    timeoutSeconds: 3600,
  },
  async (request) => {
    const { auth } = request;
    const {
      paymentMethodId,
      amountToCharge,
      gigData,
      gigDate,
      paymentMessageId,
      musicianProfileId,
    } = request.data || {};
    if (!paymentMethodId) throw new Error("Payment method ID is required.");
    if (!gigData?.gigId) throw new Error("Missing gig data.");
    if (!(Number.isInteger(amountToCharge) && amountToCharge > 0)) {
      throw new Error("Invalid amountToCharge (must be positive integer in minor units).");
    }
    const userId = auth.uid;
    const userSnap = await admin.firestore().collection("users").doc(userId).get();
    const customerId = userSnap.data()?.stripeCustomerId;
    if (!customerId) throw new Error("Stripe customer ID not found.");
    let applicantId;
    let recipientMusicianId;
    try {
      const stripe = makeStripe();
      const acceptedMusician = Array.isArray(gigData.applicants)
        ? gigData.applicants.find(
            (a) => a?.status === "accepted" && a?.id === musicianProfileId
          )
        : null;
      if (!acceptedMusician || acceptedMusician.id !== musicianProfileId) {
        throw new Error("Accepted applicant doesn't match musician ID.");
      }
      applicantId = acceptedMusician.id;
      const applicantType = acceptedMusician.type || "musician";
      recipientMusicianId = applicantId;
      if (applicantType === "band") {
        const bandSnap = await admin.firestore().collection("bands").doc(applicantId).get();
        if (!bandSnap.exists) throw new Error(`Band profile ${applicantId} not found.`);
        const band = bandSnap.data() || {};
        recipientMusicianId = band?.admin?.musicianId;
        if (!recipientMusicianId) {
          throw new Error(`Band ${applicantId} missing admin/owner musician id.`);
        }
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountToCharge,
        currency: "gbp",
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          gigId: gigData.gigId,
          time: gigData.startTime,
          date: gigDate,
          venueName: gigData.venue.venueName,
          venueId: gigData.venueId,
          applicantId: musicianProfileId,
          applicantType,
          recipientMusicianId,
          paymentMessageId,
        },
      });
      const gigRef = db.collection("gigs").doc(gigData.gigId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(gigRef);
        if (!snap.exists) {
          throw new Error(`Gig ${gigData.gigId} not found while marking payment.`);
        }
        const data = snap.data() || {};
        const applicants = Array.isArray(data.applicants) ? data.applicants : [];
        const updatedApplicants = applicants.map((a) =>
          a?.id === applicantId ? { ...a, status: "payment processing" } : { ...a }
        );
        tx.update(gigRef, {
          applicants: updatedApplicants,
          paymentStatus: paymentIntent.status || "processing",
          paymentIntentId: paymentIntent.id,
          paid: false,
        });
      });
      await db.collection("payments").doc(paymentIntent.id).set(
        {
          gigId: gigData.gigId,
          applicantId,
          recipientMusicianId,
          venueId: gigData.venueId,
          status: "processing",
          createdAt: FieldValue.serverTimestamp(),
          lastCheckedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { success: true, paymentIntent };
    } catch (error) {
      console.error("Error confirming payment:", error);
      const pi = error?.raw?.payment_intent;
      const needsSCA =
        error?.code === "authentication_required" ||
        (pi &&
          (pi.status === "requires_action" ||
            pi.status === "requires_source_action" ||
            pi.status === "requires_payment_method"));
      if (needsSCA && pi?.client_secret) {
        await admin.firestore().collection("payments").doc(pi.id).set(
          {
            gigId: gigData.gigId,
            applicantId,
            recipientMusicianId,
            venueId: gigData.venueId,
            status: "requires_action",
            createdAt: FieldValue.serverTimestamp(),
            lastCheckedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return {
          success: false,
          requiresAction: true,
          clientSecret: pi.client_secret,
          paymentIntentId: pi.id,
          paymentMethodId,
          error: "Authentication required",
        };
      }
      if (error?.type === "StripeCardError") {
        return { success: false, error: error.message };
      } else if (error?.type === "StripeInvalidRequestError") {
        return { success: false, error: "Invalid payment request." };
      } else if (error?.type === "StripeAPIError") {
        return { success: false, error: "Payment currently unavailable." };
      } else if (error?.type === "StripeConnectionError") {
        return { success: false, error: "Network error." };
      } else if (error?.type === "StripeAuthenticationError") {
        return { success: false, error: "Authentication error." };
      } else {
        return { success: false, error: "An unexpected error occurred." };
      }
    }
  }
);