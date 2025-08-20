const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest, onCall} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const cors = require("cors")({origin: true});
const {GoogleAuth} = require("google-auth-library");
const {CloudTasksClient} = require("@google-cloud/tasks");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore();

const stripeLiveKey = defineSecret("STRIPE_PRODUCTION_KEY");
const stripeTestKey = defineSecret("STRIPE_TEST_KEY");
const whLive = defineSecret("STRIPE_PROD_WEBHOOK");
const whTest = defineSecret("STRIPE_WEBHOOK_SECRET");

const PROJECT_ID =
process.env.GCLOUD_PROJECT ||
JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId;
const IS_PROD = PROJECT_ID === "giginltd-16772";

/**
 * Retrieves the appropriate Stripe API key for the current environment.
 *
 * In production (`IS_PROD` true),
 * returns the live Stripe secret key from Secret Manager.
 * In development, returns the test Stripe secret key from Secret Manager.
 *
 * @return {string} Stripe API secret key for the current environment.
 * @throws {Error} If the secret value is not defined in Secret Manager.
 */
function getStripeKey() {
  return IS_PROD ? stripeLiveKey.value() : stripeTestKey.value();
}

/**
 * Retrieves the appropriate Stripe
 * webhook signing secret for the current environment.
 *
 * In production (`IS_PROD` true), returns
 * the live webhook secret from Secret Manager.
 * In development, returns the test webhook secret from Secret Manager.
 *
 * @return {string} Stripe webhook signing secret for the current environment.
 * @throws {Error} If the secret value is not defined in Secret Manager.
 */
function getWebhookSecret() {
  return IS_PROD ? whLive.value() : whTest.value();
}

/**
 * Ensures that the correct type of Stripe API
 * key is being used in the current environment.
 *
 * - Throws an error if the development
 * environment is using a live (`sk_live_`) key.
 * - Throws an error if the production
 * environment is using a test (`sk_test_`) key.
 *
 * This prevents accidental use of real Stripe
 * credentials in development, or test credentials in production.
 *
 * @param {string} key - The Stripe API secret key to validate.
 * @throws {Error} If the key type does not match the current environment.
 */
function sanityCheckKey(key) {
  const s = String(key || "");
  if (!IS_PROD && s.startsWith("sk_live_")) {
    throw new Error("Dev using LIVE Stripe key. Check secrets in project.");
  }
  if (IS_PROD && s.startsWith("sk_test_")) {
    throw new Error("Prod using TEST Stripe key. Check secrets in project.");
  }
}

exports.createStripeCustomer = onDocumentCreated(
    {
      region: "europe-west3",
      document: "users/{uid}",
      secrets: [stripeLiveKey, stripeTestKey],
      maxInstances: 3,
    },
    async (event) => {
      const uid = event.params.uid;
      const snap = event.data;
      if (!snap) return;
      const userData = snap.data() || {};
      if (userData.stripeCustomerId) {
        console.log(`User ${uid} already has stripeCustomerId, skipping.`);
        return;
      }
      const key = getStripeKey();
      sanityCheckKey(key);
      const stripe = new Stripe(key);
      let email = userData.email;
      if (!email) {
        const authUser = await admin.auth().getUser(uid).catch(() => null);
        email = authUser.email || null;
      }
      if (!email) {
        console.warn(`No email for uid ${uid}; cannot create Stripe customer.`);
        return;
      }
      const customer = await stripe.customers.create({email, metadata: {uid}});
      await admin.firestore().collection("users").doc(uid).set(
          {stripeCustomerId: customer.id},
          {merge: true},
      );
      console.log(`Stripe customer created for ${uid}: ${customer.id}`);
    },
);

exports.savePaymentMethod = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {paymentMethodId} = request.data;
      if (!request.auth) {
        throw new Error("Unauthenticated request. User must be signed in.");
      }
      const userId = request.auth.uid;
      try {
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
        const userDoc =
    await db.collection("users").doc(userId).get();
        const customerId = userDoc.data().stripeCustomerId;
        if (!customerId) {
          throw new Error("Stripe customer ID not found for this user.");
        }
        const paymentMethodUpdate =
        await stripe.paymentMethods
            .attach(paymentMethodId, {customer: customerId});
        const customerUpdate =
        await stripe.customers.update(customerId, {
          invoice_settings:
      {default_payment_method: paymentMethodId},
        });
        return {success: true, paymentMethodUpdate, customerUpdate};
      } catch (error) {
        console.error("Error saving payment method:", error);
        throw new Error("Failed to save payment method.");
      }
    });

exports.setDefaultPaymentMethod = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 60,
    },
    async (request) => {
      const {paymentMethodId} = request.data;
      if (!request.auth) {
        throw new Error("Unauthenticated request. User must be signed in.");
      }
      const userId = request.auth.uid;
      try {
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          throw new Error("User document not found.");
        }
        const {stripeCustomerId} = userSnap.data();
        if (!stripeCustomerId) {
          throw new Error("Stripe customer ID not found for this user.");
        }
        const updatedCustomer =
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
        return {success: true, updatedCustomer};
      } catch (error) {
        console.error("Error setting default payment method:", error);
        throw new Error("Failed to set default payment method.");
      }
    },
);

exports.getSavedCards = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {auth} = request;
      if (!auth) {
        throw new Error("User must be authenticated.");
      }
      const userId = auth.uid;
      const userDoc =
  await admin.firestore().collection("users").doc(userId).get();
      const customerId = userDoc.data().stripeCustomerId;
      if (!customerId) {
        throw new Error("Stripe customer ID not found.");
      }
      try {
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
        const paymentMethods =
    await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });
        return {paymentMethods: paymentMethods.data};
      } catch (error) {
        console.error("Error fetching payment methods:", error);
        throw new Error("Unable to fetch payment methods.");
      }
    });

exports.confirmPayment = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {auth} = request;
      const {
        paymentMethodId,
        amountToCharge,
        gigData,
        gigDate,
        paymentMessageId,
        musicianProfileId,
      } = request.data;
      if (!auth) {
        throw new Error("User must be authenticated.");
      }
      if (!paymentMethodId) {
        throw new Error("Payment method ID is required.");
      }
      if (!gigData.gigId) throw new Error("Missing gig data.");
      const userId = auth.uid;
      const userDoc =
  await admin.firestore().collection("users").doc(userId).get();
      const customerId = userDoc.data().stripeCustomerId;
      if (!customerId) {
        throw new Error("Stripe customer ID not found.");
      }
      let applicantId;
      let recipientMusicianId;
      try {
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
        const acceptedMusician =
    gigData.applicants.find(
        (applicant) => applicant.status === "accepted" &&
        applicant.id === musicianProfileId,
    );
        if (acceptedMusician.id !== musicianProfileId) {
          throw new Error("Accepted applicant doesn't match musician ID.");
        }
        applicantId = acceptedMusician.id;
        const applicantType = acceptedMusician.type || "musician";
        recipientMusicianId = applicantId;
        if (applicantType === "band") {
          const bandSnap =
          await admin
              .firestore()
              .collection("musicianProfiles")
              .doc(applicantId)
              .get();
          if (!bandSnap.exists) {
            throw new Error(`Band profile ${applicantId} not found.`);
          }
          const band = bandSnap.data() || {};
          recipientMusicianId = band.bandInfo.admin.musicianId;
          if (!recipientMusicianId) {
            throw new Error(
                `Band ${applicantId} missing admin/owner musician id.`,
            );
          }
        }
        const paymentIntent = await stripe.paymentIntents.create(
            {
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
                applicantId,
                applicantType,
                recipientMusicianId,
                paymentMessageId,
              },
            },
        );
        const db = admin.firestore();
        const gigRef = db.collection("gigs").doc(gigData.gigId);

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(gigRef);
          if (!snap.exists) {
            throw new Error(
                `Gig ${gigData.gigId} not found while marking payment.`,
            );
          }
          const data = snap.data() || {};
          const applicants =
          Array.isArray(data.applicants) ? data.applicants : [];
          const updatedApplicants = applicants.map((a) =>
            a.id === applicantId ?
            {...a, status: "payment processing"} :
            {...a},
          );
          tx.update(gigRef, {
            applicants: updatedApplicants,
            paymentStatus: paymentIntent.status || "processing",
            paymentIntentId: paymentIntent.id,
            paid: false,
          });
        });
        await db.collection("payments").doc(paymentIntent.id).set({
          gigId: gigData.gigId,
          applicantId,
          recipientMusicianId,
          venueId: gigData.venueId,
          status: "processing",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        return {success: true, paymentIntent};
      } catch (error) {
        const pi = error.raw.payment_intent;
        const needsSCA =
          error.code === "authentication_required" ||
          (pi &&
            (pi.status === "requires_action" ||
            pi.status === "requires_source_action" ||
            pi.status === "requires_payment_method"));
        if (needsSCA && pi.client_secret) {
          await admin.firestore().collection("payments").doc(pi.id).set({
            gigId: gigData.gigId,
            applicantId,
            recipientMusicianId,
            venueId: gigData.venueId,
            status: "requires_action",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
          return {
            success: false,
            requiresAction: true,
            clientSecret: pi.client_secret,
            paymentIntentId: pi.id,
            paymentMethodId: paymentMethodId,
            error: "Authentication required",
          };
        }
        console.error("Error confirming payment:", error);
        if (error.type === "StripeCardError") {
          return {success: false, error: error.message};
        } else if (error.type === "StripeInvalidRequestError") {
          return {success: false, error: "Invalid payment request."};
        } else if (error.type === "StripeAPIError") {
          return {success: false, error: "Payment currently unavailable."};
        } else if (error.type === "StripeConnectionError") {
          return {success: false, error: "Network error."};
        } else if (error.type === "StripeAuthenticationError") {
          return {success: false, error: "Authentication error."};
        } else {
          return {success: false, error: "An unexpected error occurred."};
        }
      }
    });

exports.createGigPaymentIntent = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {auth} = request;
      if (!auth) throw new Error("User must be authenticated.");
      const {
        amountToCharge,
        gigData,
        musicianProfileId,
        paymentMessageId,
        gigDate,
      } = request.data || {};
      if (!amountToCharge || !gigData.gigId) throw new Error("Missing inputs.");
      const db = admin.firestore();
      const userId = auth.uid;
      const userSnap = await db.collection("users").doc(userId).get();
      const customerId = userSnap.data().stripeCustomerId;
      if (!customerId) throw new Error("Stripe customer ID not found.");
      const applicantId = musicianProfileId || null;
      let applicantType = "musician";
      let recipientMusicianId = musicianProfileId || null;
      if (musicianProfileId) {
        const accepted = (gigData.applicants || []).find(
            (a) => a.id === musicianProfileId && a.status === "accepted",
        );
        if (!accepted) {
          throw new Error("Accepted applicant doesn't match musician ID.");
        }
        applicantType = accepted.type || "musician";
        if (applicantType === "band") {
          const bandSnap =
          await db.collection("musicianProfiles").doc(musicianProfileId).get();
          if (!bandSnap.exists) {
            throw new Error(`Band ${musicianProfileId} n/a.`);
          }
          const band = bandSnap.data() || {};
          recipientMusicianId = band.bandInfo.admin.musicianId;
          if (!recipientMusicianId) {
            throw new Error(`Band ${musicianProfileId} no admin id.`);
          }
        }
      }
      const key = getStripeKey();
      sanityCheckKey(key);
      const stripe = new Stripe(key);
      const pi = await stripe.paymentIntents.create({
        amount: amountToCharge,
        currency: "gbp",
        customer: customerId,
        automatic_payment_methods: {enabled: true},
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
        },
      });
      await db.collection("payments").doc(pi.id).set({
        gigId: gigData.gigId,
        applicantId: applicantId || null,
        recipientMusicianId: recipientMusicianId || null,
        venueId: gigData.venueId || null,
        status: "requires_confirmation",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      return {clientSecret: pi.client_secret, paymentIntentId: pi.id};
    },
);

exports.getCustomerData = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {auth} = request;
      if (!auth) {
        throw new Error("User must be authenticated.");
      }
      const userId = auth.uid;
      const userDoc =
  await admin.firestore().collection("users").doc(userId).get();
      const customerId = userDoc.data().stripeCustomerId;
      if (!customerId) {
        throw new Error("Stripe customer ID not found.");
      }
      try {
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
        const customer = await stripe.customers.retrieve(customerId, {
          expand: ["invoice_settings.default_payment_method", "default_source"],
        });
        const pmList = await stripe.paymentMethods.list({
          customer: customerId,
          type: "card",
        });
        const charges =
        await stripe.charges.list({customer: customerId, limit: 100});
        const receipts = charges.data.filter(
            (c) => c.status === "succeeded" && c.receipt_url,
        );
        const defaultPm = customer.invoice_settings.default_payment_method;
        let defaultPmId;
        let defaultSourceId;
        if (defaultPm) {
          defaultPmId = defaultPm.id;
          defaultSourceId = customer.default_source || null;
        }
        return {
          customer,
          receipts,
          paymentMethods: pmList.data,
          defaultPaymentMethodId: defaultPmId,
          defaultSourceId,
        };
      } catch (error) {
        console.error("Error fetching customer data:", error);
        throw new Error("Unable to fetch customer data.");
      }
    });

exports.deleteCard = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {auth} = request;
      const {cardId} = request.data;
      if (!auth) {
        throw new Error(
            "unauthenticated", "User must be authenticated.",
        );
      }
      if (!cardId) {
        throw new Error(
            "invalid-argument", "Card ID is required.",
        );
      }
      const userId = auth.uid;
      const userDoc =
  await admin.firestore().collection("users").doc(userId).get();
      const customerId = userDoc.data().stripeCustomerId;
      if (!customerId) {
        throw new Error(
            "not-found", "Stripe customer ID not found.",
        );
      }
      try {
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
        await stripe.paymentMethods.detach(cardId);
        return {success: true};
      } catch (error) {
        console.error("Error deleting card:", error);
        throw new Error(
            "internal", "Unable to delete the card.",
        );
      }
    });

exports.processRefund = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {auth} = request;
      const {paymentIntentId} = request.data;
      if (!auth) {
        throw new Error("unauthenticated", "User must be authenticated.");
      }
      if (!paymentIntentId) {
        console.error("Transaction ID is required for a refund.");
        throw new Error("Missing paymentIntentId parameter.");
      }
      try {
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
        });
        console.log(`Refund created for transaction: ${paymentIntentId}`);
        return {success: true};
      } catch (error) {
        console.error("Error processing refund:", error.message);
        throw new Error(`Failed to process refund: ${error.message}`);
      }
    });

exports.cancelCloudTask = onCall(
    {
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {auth} = request;
      const {taskName} = request.data;
      if (!auth) {
        throw new Error(
            "unauthenticated", "User must be authenticated.",
        );
      }
      if (!taskName) {
        console.error("Task name is required to cancel a task.");
        throw new Error("Missing taskName parameter.");
      }
      try {
        const client = new CloudTasksClient();
        await client.deleteTask({name: taskName});
        console.log(`Task canceled successfully: ${taskName}`);
        return {
          success: true, message: `Task ${taskName} canceled successfully.`,
        };
      } catch (error) {
        console.error(`Error canceling task: ${taskName}`, error);
        throw new Error(`Failed to cancel task: ${error.message}`);
      }
    });

exports.stripeWebhook = onRequest(
    {
      maxInstances: 3,
      secrets: [whLive, whTest, stripeLiveKey, stripeTestKey],
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      const key = getStripeKey();
      sanityCheckKey(key);
      const stripe = new Stripe(key);
      let event;
      const endpointSecret = getWebhookSecret();
      try {
        event =
    stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
      } catch (err) {
        console.error(
            "Webhook signature verification failed:", err.message,
        );
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }
      try {
        switch (event.type) {
          case "payment_intent.succeeded":
            await handlePaymentSuccess(event.data.object);
            await db.collection("payments").doc(event.data.object.id).set({
              status: "succeeded",
              lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, {merge: true});
            break;
          case "payment_intent.payment_failed":
            await handlePaymentFailure(event.data.object);
            await db.collection("payments").doc(event.data.object.id).set({
              status: "failed",
              lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, {merge: true});
            break;
          case "account.updated":
            if (
              event.data.object.capabilities.transfers === "active"
            ) {
              const musicianId = event.data.object.metadata.musicianId;
              const musicianRef =
              admin.firestore().collection("musicianProfiles").doc(musicianId);
              const musicianDoc = await musicianRef.get();
              if (musicianDoc.exists) {
                const musicianData = musicianDoc.data();
                const withdrawableEarnings =
                musicianData.withdrawableEarnings || 0;
                if (withdrawableEarnings > 0) {
                  console.log(
                      `Transferring £${withdrawableEarnings}
                     to account ${event.data.object.id}`,
                  );
                  await stripe.transfers.create({
                    amount: Math.round(withdrawableEarnings * 100),
                    currency: "gbp",
                    destination: event.data.object.id,
                    metadata: {
                      musicianId,
                      description:
                        "Transfer of existing earnings to Stripe account",
                    },
                  });
                  console.log(
                      `Successfully transferred £${withdrawableEarnings}.`,
                  );
                }
              } else {
                console.warn(`Musician profile not found for: ${musicianId}`);
              }
            }
            break;
          default:
            console.info(`Unhandled event type ${event.type}`);
        }
        res.status(200).send({received: true});
      } catch (err) {
        console.error("Error handling webhook event:", err.message);
        res.status(500).send(`Webhook handler error: ${err.message}`);
      }
    });

exports.clearPendingFee = onRequest(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      timeoutSeconds: 3600,
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
        const db = getFirestore();
        const musicianRef = db.collection("musicianProfiles").doc(musicianId);
        const pendingDocRef =
        musicianRef.collection("pendingFees").doc(paymentIntentId);
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
          console.error(
              `Pending fee doc ${paymentIntentId} not found for gig ${gigId}.`,
          );
          return res.status(400).send(
              `Fee for gig ${gigId} already cleared or not found.`,
          );
        }
        const musician = musicianSnap.data() || {};
        const gig = gigSnap.data() || {};
        const pendingFee = pendingDocSnap.data() || {};
        if (gig.disputeLogged || pendingFee.disputeLogged) {
          console.error(`Dispute logged for gig ${gigId}`);
          return res.status(400).send(`Dispute logged for gig ${gigId}`);
        }
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
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
        const clearedDocRef =
        musicianRef.collection("clearedFees").doc(paymentIntentId);
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
            application.id === applicantId ?
              {...application, status: "paid"} :
              {...application},
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
            {merge: true},
        );
        await batch.commit();
        if (applicantId === musicianId) {
          let clearedCount = 0;
          try {
            const agg =
            await musicianRef.collection("clearedFees").count().get();
            clearedCount = agg.data().count || 0;
          } catch (err) {
            const snap = await musicianRef.collection("clearedFees").get();
            clearedCount = snap.size;
          }
          await musicianRef.set({gigsPerformed: clearedCount}, {merge: true});
        } else {
          const performerRef =
          db.collection("musicianProfiles").doc(applicantId);
          let clearedCount = 0;
          try {
            const agg =
            await performerRef.collection("clearedFees").count().get();
            clearedCount = agg.data().count || 0;
          } catch (err) {
            const snap = await performerRef.collection("clearedFees").get();
            clearedCount = snap.size;
          }
          await performerRef.set({gigsPerformed: clearedCount}, {merge: true});
        }
        const mailRef = db.collection("mail");
        await mailRef.add({
          to: musicianEmail,
          message: {
            subject: "Your gig fee is available!",
            text:
                "We have just cleared your gig fee. " +
                "You can now withdraw it to your bank account.",
            html: `
                <p>Hi ${musicianName},</p>
                <p>
                We hope your gig at <strong>${venueName}</strong> went well!
                </p>
                <p>
                ${applicantId !== musicianId ?
                  "You are the band admin - it is your responsibility " +
                  "to split these funds between your band members" :
                  ""}
                </p>
                <p>
                Your fee has been cleared and is available in your Gigin wallet.
                </p>
                <p><a href="https://gigin.ltd/finances">Log in to Gigin</a> to withdraw it to your bank account.</p>
                <p>Thanks,<br />The Gigin Team</p>
              `,
          },
        });
        console.log(
            `Fee cleared for recipient ${musicianId}, gig ${gigId}.`,
        );
        res.status(200).send({success: true});
      } catch (error) {
        console.error("Error clearing fee:", error);
        res.status(500).send("Internal Server Error.");
      }
    },
);


exports.intermediateTaskQueue = onRequest(
    {
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      const {
        musicianId,
        applicantId,
        gigId,
        venueId,
        disputeClearingTime,
        paymentIntentId,
        ...rest
      } = req.body;
      const targetDate = new Date(disputeClearingTime);
      const maxAllowedDate = new Date(Date.now() + 720 * 60 * 60 * 1000);
      const targetUriForFee = await getFunctionUrl("clearPendingFee");
      const intermediateQueueUri =
      await getFunctionUrl("intermediateTaskQueue");
      try {
        const firestore = getFirestore();
        const gigRef = firestore.collection("gigs").doc(gigId);
        const gigDoc = await gigRef.get();
        if (!gigDoc.exists) {
          console.error(`Gig with ID ${gigId} not found`);
          res.status(404).send(`Gig with ID ${gigId} not found`);
          return;
        }
        let taskName;
        if (targetDate > maxAllowedDate) {
          taskName = await createCloudTask(
              {
                musicianId,
                applicantId,
                gigId,
                venueId,
                disputeClearingTime,
                paymentIntentId,
                ...rest,
              },
              maxAllowedDate,
              intermediateQueueUri,
              "intermediateTaskQueue",
          );
          console.log(`Re-enqueued task for ${maxAllowedDate.toISOString()}`);
        } else {
          taskName = await createCloudTask(
              {
                musicianId,
                applicantId,
                gigId,
                venueId,
                disputeClearingTime,
                paymentIntentId,
                ...rest,
              },
              targetDate,
              targetUriForFee,
              "clearPendingFee",
          );
          console.log(`
          Enqueued clearPendingFee for ${targetDate.toISOString()}
        `);
        }
        await gigRef.update({clearPendingFeeTaskName: taskName});
        res.status(200).send("Task processed successfully");
      } catch (error) {
        console.error("Error processing task:", error);
        res.status(500).send("Internal Server Error");
      }
    });

exports.intermediateMessageQueue = onRequest(
    {
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      const {
        musicianId,
        applicantId,
        gigId,
        venueId,
        gigDate,
        gigTime,
        amount,
        paymentIntentId,
        disputeClearingTime,
        ...rest
      } = req.body;
      const gigStartDate = new Date(gigDate);
      const [hours, minutes] = gigTime.split(":").map(Number);
      gigStartDate.setHours(hours);
      gigStartDate.setMinutes(minutes);
      gigStartDate.setSeconds(0);
      const maxAllowedDate = new Date(Date.now() + 720 * 60 * 60 * 1000);
      const targetUriForMessage =
      await getFunctionUrl("automaticReviewMessage");
      const intermediateQueueUri =
      await getFunctionUrl("intermediateMessageQueue");
      try {
        const firestore = getFirestore();
        const gigRef = firestore.collection("gigs").doc(gigId);
        const gigDoc = await gigRef.get();
        if (!gigDoc.exists) {
          console.error(`Gig with ID ${gigId} not found`);
          res.status(404).send(`Gig with ID ${gigId} not found`);
          return;
        }
        let taskName;
        if (gigStartDate > maxAllowedDate) {
          taskName = await createCloudTask(
              {
                musicianId,
                applicantId,
                gigId,
                venueId,
                gigDate,
                gigTime,
                amount,
                paymentIntentId,
                disputeClearingTime,
                ...rest,
              },
              maxAllowedDate,
              intermediateQueueUri,
              "intermediateMessageQueue",
          );
          console.log(`Re-enqueued task for ${maxAllowedDate.toISOString()}`);
        } else {
          taskName = await createCloudTask(
              {
                musicianId,
                applicantId,
                gigId,
                venueId,
                gigDate,
                gigTime,
                amount,
                paymentIntentId,
                disputeClearingTime,
                ...rest,
              },
              gigStartDate,
              targetUriForMessage,
              "automaticReviewMessage",
          );
          console.log(
              `Enqueued Automatic Message for ${gigStartDate.toISOString()}`,
          );
        }
        await gigRef.update({automaticMessageTaskName: taskName});
        res.status(200).send("Task processed successfully");
      } catch (error) {
        console.error("Error processing task:", error);
        res.status(500).send("Internal Server Error");
      }
    },
);

exports.automaticReviewMessage = onRequest(
    {
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      const {
        musicianId,
        applicantId,
        gigId,
        disputeClearingTime,
        venueId,
        musicianName,
        musicianEmail,
        venueEmail,
        venueName,
      } = req.body;
      if (
        !musicianId ||
    !gigId ||
    !disputeClearingTime ||
    !venueId ||
    !musicianName ||
    !applicantId
      ) {
        console.error("Invalid payload received in task.");
        res.status(400).send("Invalid payload.");
        return;
      }
      try {
        const firestore = getFirestore();
        const conversationsRef = firestore.collection("conversations");
        const conversationQuery = conversationsRef
            .where("gigId", "==", gigId)
            .where("participants", "array-contains", applicantId);
        const conversationsSnapshot = await conversationQuery.get();
        const conversationDoc = conversationsSnapshot.docs[0];
        const conversationId = conversationDoc.id;
        const messagesRef = firestore
            .collection("conversations")
            .doc(conversationId)
            .collection("messages");
        await messagesRef.add({
          senderId: "system",
          text: `How was the gig? Please ` +
            "let us know if you had any issues within 48 hours.",
          type: "review",
          status: "open",
          disputeClearingTime,
          timestamp: Timestamp.now(),
        });
        await firestore
            .collection("conversations")
            .doc(conversationId).update({
              lastMessage: `How was the gig?`,
              lastMessageTimestamp: Timestamp.now(),
              lastMessageSenderId: "system",
            });
        const mailRef = firestore.collection("mail");
        await mailRef.add({
          to: musicianEmail,
          message: {
            subject: "How did the gig go?",
            text: `We hope your gig at ${venueName}
             went well! Let them know how it went.`,
            html: `
                    <p>Hi ${musicianName},</p>
                    <p>We hope your gig at
                     <strong>${venueName}</strong> went well!</p>
                    <p><a href="https://gigin.ltd">Log on to Gigin</a> to leave a review.</p>
                    <p>Thanks,<br />The Gigin Team</p>
                `,
          },
        });
        await mailRef.add({
          to: venueEmail,
          message: {
            subject: "How was the performance?",
            text: `How was ${musicianName}'s performance at your gig?
             Let them know by leaving a review.`,
            html: `
                    <p>Hi ${venueName},</p>
                    <p>How was <strong>${musicianName}</strong>'s
                     performance at your gig?</p>
                    <p>We’d love to hear your feedback!
                     <a href="https://gigin.ltd">Log on to Gigin</a> and
                     leave ${musicianName} a review.</p>
                    <p>Thanks,<br />The Gigin Team</p>
                `,
          },
        });
        console.log("Review message sent successfully.");
        res.status(200).send({success: true});
      } catch (error) {
        console.error("Error clearing fee:", error);
        res.status(500).send("Internal Server Error.");
      }
    },
);


exports.stripeAccountSession = onRequest(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      cors(req, res, async () => {
        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }
        try {
          const key = getStripeKey();
          sanityCheckKey(key);
          const stripe = new Stripe(key);
          const {account} = req.body;
          if (!account) {
            return res.status(400).json({error: "Missing data"});
          }
          const accountSession = await stripe.accountSessions.create({
            account: account,
            components: {
              account_onboarding: {enabled: true},
              account_management: {enabled: true},
            },
          });
          res.json({
            client_secret: accountSession.client_secret,
          });
        } catch (error) {
          console.error(
              "Error occurred calling the Stripe API to create account session",
              error,
          );
          res.status(500).send({error: error.message});
        }
      });
    });

exports.stripeAccount = onRequest(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      cors(req, res, async () => {
        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }
        try {
          const {musicianId} = req.body;
          if (!musicianId) {
            res.status(400).send({error: "Musician ID is required."});
            return;
          }
          const key = getStripeKey();
          sanityCheckKey(key);
          const stripe = new Stripe(key);
          const account = await stripe.accounts.create({
            capabilities: {
              transfers: {requested: true},
            },
            country: "GB",
            metadata: {musicianId},
            controller: {
              stripe_dashboard: {
                type: "none",
              },
              fees: {
                payer: "application",
              },
              losses: {
                payments: "application",
              },
              requirement_collection: "application",
            },
            settings: {
              payouts: {
                schedule: {
                  interval: "manual",
                },
              },
            },
          });
          res.json({
            account: account.id,
          });
        } catch (error) {
          console.error(
              "Error occurred when calling the Stripe API to create an account",
              error,
          );
          res.status(500).send({error: error.message});
        }
      });
    });

exports.transferFunds = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {connectedAccountId, amount} = request.data;
      const {auth} = request;
      if (!auth) {
        throw new Error("User must be authenticated.");
      }
      if (!connectedAccountId || !amount) {
        throw new Error("Missing required parameters.");
      }
      try {
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
        const transfer = await stripe.transfers.create({
          amount,
          currency: "gbp",
          destination: connectedAccountId,
        });
        return {success: true, transfer: transfer};
      } catch (error) {
        console.error("Error transfering funds:", error);
        throw new Error("Failed to transfer funds.");
      }
    },
);

exports.deleteStripeConnectedAccount = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {auth, data} = request;
      if (!auth) throw new Error("User must be authenticated.");
      const {musicianId} = data || {};
      if (!musicianId) throw new Error("Missing musicianId.");
      const musicRef = db.collection("musicianProfiles").doc(musicianId);
      const musicSnap = await musicRef.get();
      if (!musicSnap.exists) throw new Error("Musician profile not found.");
      const {userId} = musicSnap.data();
      if (userId !== auth.uid) throw new Error("Not authorized.");
      const {stripeAccountId} = musicSnap.data();
      if (!stripeAccountId) {
        return {success: true, message: "No Stripe account attached."};
      }
      const key = getStripeKey();
      sanityCheckKey(key);
      const stripe = new Stripe(key);
      const balance =
      await stripe.balance.retrieve({stripeAccount: stripeAccountId});
      const availableTotal =
    (balance.available || []).reduce((sum, b) => sum + (b.amount || 0), 0);
      if (availableTotal > 0) {
        return {
          success: false,
          message: "Please withdraw your available " +
          "balance before deleting your account.",
        };
      }
      await stripe.accounts.del(stripeAccountId);
      await musicRef.update({
        stripeAccountId: admin.firestore.FieldValue.delete(),
        bankDetailsAdded: false,
        withdrawableEarnings: 0,
      });
      return {success: true};
    },
);

exports.changeBankDetails = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      cors(req, res, async () => {
        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }
        const {accountId} = req.body;
        if (!accountId) {
          res.status(400).send({error: "Musician ID is required."});
          return;
        }
        try {
          const key = getStripeKey();
          sanityCheckKey(key);
          const stripe = new Stripe(key);
          const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: "https://gigin.ltd/dashboard/finances",
            return_url: "https://gigin.ltd/dashboard/finances",
            type: "account_onboarding",
          });
          return {url: accountLink.url};
        } catch (error) {
          console.error(
              "Error occurred when calling the Stripe API to edit details",
              error,
          );
          res.status(500).send({error: error.message});
        }
      });
    });

exports.getConnectAccountStatus = onCall(
    {
      region: "europe-west3",
      secrets: [stripeLiveKey, stripeTestKey],
      timeoutSeconds: 60,
    },
    async (req) => {
      try {
        if (!req.auth) throw new Error("Unauthenticated");
        const uid = req.auth.uid;
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) throw new Error("User not found");
        const userData = userSnap.data() || {};
        let musicianId = null;
        if (
          Array.isArray(userData.musicianProfile) &&
          userData.musicianProfile.length
        ) {
          musicianId = userData.musicianProfile[0];
        }
        if (!musicianId) {
          return {
            exists: false,
            status: "no_account",
            reason: "no_musician_profile",
          };
        }
        const musicianSnap =
        await db.collection("musicianProfiles").doc(musicianId).get();
        if (!musicianSnap.exists) {
          return {
            exists: false,
            status: "no_account",
            reason: "profile_not_found",
          };
        }
        const musicianProfile = musicianSnap.data() || {};
        if (!musicianProfile.stripeAccountId) {
          return {exists: false, status: "no_account"};
        }
        const accountId = musicianProfile.stripeAccountId;
        const key = getStripeKey();
        sanityCheckKey(key);
        const stripe = new Stripe(key);
        const account = await stripe.accounts.retrieve(accountId);
        const reqs = account.requirements;
        const currentlyDueArr = reqs.currently_due;
        const pastDueArr = reqs.past_due;
        const pendingVerificationArr = reqs.pending_verification;
        const eventuallyDueArr = reqs.eventually_due;
        const disabledReason = reqs.disabled_reason;
        const verification = account.individual.verification;
        const verificationStatus = verification.status;
        const verificationDetails = verification.details;
        const verificationCode = verification.details_code;
        let status = "all_good";
        if (
          pastDueArr.length > 0 ||
          disabledReason ||
          currentlyDueArr.length > 0
        ) {
          status = "urgent";
        } else if (
          verificationStatus === "unverified" ||
          eventuallyDueArr.length > 0
        ) {
          status = "warning";
        }
        const actions = Array.from(new Set([
          ...currentlyDueArr,
          ...pastDueArr,
          ...pendingVerificationArr,
          ...eventuallyDueArr,
        ]));
        const needsOnboarding =
        (currentlyDueArr.length > 0) ||
        (pastDueArr.length > 0) ||
        !account.details_submitted;
        let resolveUrl = null;
        if (status !== "all_good" || needsOnboarding) {
          const link = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: "https://gigin.ltd/dashboard/finances?retry=true",
            return_url: "https://gigin.ltd/dashboard/finances?done=true",
            type: needsOnboarding ? "account_onboarding" : "account_update",
          });
          resolveUrl = link.url;
        }
        return {
          exists: true,
          status,
          counts: {
            currentlyDue: currentlyDueArr.length,
            pastDue: pastDueArr.length,
            eventuallyDue: eventuallyDueArr.length,
          },
          payoutsEnabled: !!account.payouts_enabled,
          disabledReason,
          actions,
          verification: {
            status: verificationStatus,
            details: verificationDetails,
            code: verificationCode,
          },
          resolveUrl,
          raw: {
            detailsSubmitted: account.details_submitted,
            capabilities: account.capabilities,
          },
        };
      } catch (error) {
        console.error("getConnectAccountStatus error:", error);
        throw new Error(
          typeof error.message === "string" ?
          error.message : "Unknown error",
        );
      }
    },
);

exports.payoutToBankAccount = onCall(
    {
      secrets: [stripeLiveKey, stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const key = getStripeKey();
      sanityCheckKey(key);
      const stripe = new Stripe(key);
      const {musicianId, amount} = request.data;
      const {auth} = request;
      if (!auth) {
        throw new Error("User must be authenticated.");
      }

      if (!musicianId ||
    typeof musicianId !== "string" ||
    musicianId.trim() === ""
      ) {
        throw new Error("Invalid musicianId provided.");
      }

      if (!amount || amount <= 0) {
        throw new Error("Invalid amount provided.");
      }

      try {
        const musicianDoc =
        await admin
            .firestore()
            .collection("musicianProfiles")
            .doc(musicianId)
            .get();
        if (!musicianDoc.exists) {
          throw new Error("Musician profile not found.");
        }

        const musicianData = musicianDoc.data();
        const stripeAccountId = musicianData.stripeAccountId;

        if (!stripeAccountId) {
          throw new Error("Stripe account ID not found for this musician.");
        }

        const withdrawableEarnings = musicianData.withdrawableEarnings || 0;
        if (withdrawableEarnings < amount) {
          throw new Error("Insufficient withdrawable earnings.");
        }

        const payout = await stripe.payouts.create(
            {
              amount: Math.round(amount * 100),
              currency: "gbp",
              metadata: {
                musicianId,
                description: "Payout of withdrawable funds",
              },
            },
            {stripeAccount: stripeAccountId},
        );

        await admin.firestore()
            .collection("musicianProfiles")
            .doc(musicianId).update({
              withdrawableEarnings: FieldValue.increment(-amount),
              withdrawals: FieldValue.arrayUnion({
                amount: amount,
                status: "complete",
                timestamp: Timestamp.now(),
                stripePayoutId: payout.id,
              }),
            });

        return {success: true, payoutId: payout.id};
      } catch (error) {
        console.error("Error creating payout:", error);
        throw new Error("Failed to create payout.");
      }
    });

exports.uploadMediaFiles = onCall(
    {
      timeoutSeconds: 3600,
      region: "europe-west3",
    },
    async (request) => {
      const {musicianId, mediaFiles} = request.data;
      if (!musicianId || !mediaFiles || !Array.isArray(mediaFiles)) {
        throw new Error(
            "Invalid payload: musicianId and mediaFiles are required.",
        );
      }
      try {
        const firestore = getFirestore();
        const bucket =
    admin.storage().bucket("giginltd-16772.firebasestorage.app");
        const videoUpdates = [];
        const trackUpdates = [];
        console.log("Received media, uploading starting.");
        for (const media of mediaFiles) {
          const {
            title,
            file,
            thumbnail,
            contentType,
            type,
            date,
          } = media;
          if (!file) {
            throw new Error(`Invalid file for media "${title}"`);
          }
          const fileBuffer = Buffer.from(file, "base64");
          const mediaRef =
          bucket.file(`musicians/${musicianId}/${type}/${title}`);
          await mediaRef.save(fileBuffer, {contentType});
          const mediaUrl = `https://storage.googleapis.com/${bucket.name}/${mediaRef.name}`;
          let thumbnailUrl = null;
          if (type === "video" && thumbnail) {
            const thumbnailBuffer = Buffer.from(thumbnail, "base64");
            const thumbnailRef =
        bucket
            .file(
                `musicians/${musicianId}/${type}/thumbnails/${title}_thumbnail`,
            );
            await thumbnailRef.save(
                thumbnailBuffer, {contentType: "image/png"},
            );
            thumbnailUrl =
        `https://storage.googleapis.com/${bucket.name}/${thumbnailRef.name}`;
          }
          if (type === "video") {
            videoUpdates.push({
              title,
              file: mediaUrl,
              thumbnail: thumbnailUrl,
              date,
            });
            console.log(`Video file ${title} uploaded.`);
          } else if (type === "track") {
            trackUpdates.push({
              title,
              file: mediaUrl,
              date,
            });
            console.log(`Track file ${title} uploaded.`);
          }
        }
        const musicianRef =
    firestore.collection("musicianProfiles").doc(musicianId);
        const musicianDoc = await musicianRef.get();
        if (!musicianDoc.exists) {
          throw new Error("Musician profile does not exist.");
        }
        const currentData = musicianDoc.data();
        const updatedVideos = (currentData.videos || []).map((video) => {
          const match =
      videoUpdates.find(
          (v) => v.title === video.title && video.file === "uploading...",
      );
          return match ? {...match} : video;
        });
        const updatedTracks = (currentData.tracks || []).map((track) => {
          const match =
      trackUpdates.find(
          (t) => t.title === track.title && track.file === "uploading...",
      );
          return match ? {...match} : track;
        });
        await musicianRef.update({
          videos: updatedVideos,
          tracks: updatedTracks,
        });
        console.log("Updated musician profile.");
        return {success: true};
      } catch (error) {
        console.error("Error uploading media files:", error);
        throw new Error("Failed to upload media files.");
      }
    });

exports.sweepPayments = onSchedule(
    {
      schedule: "every 10 minutes",
      timeZone: "Etc/UTC",
      timeoutSeconds: 300,
      memory: "256MiB",
    },
    async () => {
      const db = getFirestore();
      const stripe = new Stripe(getStripeKey());
      const cutoff = new Date(Date.now() - 10 * 60 * 1000);
      const pageSize = 100;
      const lockRef = db.collection("_internal").doc("paymentsSweeperLock");
      const now = Date.now();
      const lockTtlMs = 4 * 60 * 1000;
      const lockSnap = await lockRef.get();
      if (lockSnap.exists && lockSnap.data().expiresAt > now) {
        console.log("Sweeper already running, skipping.");
        return;
      }
      await lockRef.set({expiresAt: now + lockTtlMs}, {merge: true});
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
                    {merge: true},
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
                    {merge: true},
                );
              } else {
                await doc.ref.set(
                    {lastCheckedAt: FieldValue.serverTimestamp()},
                    {merge: true},
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
        await lockRef.set({expiresAt: 0}, {merge: true});
      }
    },
);

let auth;

// [START v2GetFunctionUri]
/**
 * Get the URL of a given v2 cloud function.
 *
 * @param {string} name the function's name
 * @param {string} location the function's location
 * @return {Promise<string>} The URL of the function
 */

const createCloudTask = async (payload, scheduleTime, targetUri, queueName) => {
  const client = new CloudTasksClient();
  const project = process.env.GCLOUD_PROJECT;
  if (!project) {
    throw new Error("GCLOUD_PROJECT is not set in environment variables.");
  }
  const location = "us-central1";
  const queue = queueName;
  const serviceAccountEmail = `${project}@appspot.gserviceaccount.com`;
  const parent = client.queuePath(project, location, queue);
  const task = {
    httpRequest: {
      httpMethod: "POST",
      url: targetUri,
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
      headers: {
        "Content-Type": "application/json",
      },
      oidcToken: {
        serviceAccountEmail: serviceAccountEmail,
      },
    },
    scheduleTime: {
      seconds: Math.floor(scheduleTime.getTime() / 1000),
    },
  };
  const request = {
    parent: parent,
    task: task,
  };
  const [response] = await client.createTask(request);
  return response.name;
};

const getFunctionUrl = async (name, location="us-central1") => {
  if (!auth) {
    auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
  }
  const projectId = await auth.getProjectId();
  const url = "https://cloudfunctions.googleapis.com/v2beta/" +
    `projects/${projectId}/locations/${location}/functions/${name}`;
  const client = await auth.getClient();
  const res = await client.request({url});
  const uri = res.data.serviceConfig.uri;
  if (!uri) {
    throw new Error(`Unable to retreive uri for function at ${url}`);
  }
  return uri;
};

const handlePaymentSuccess = async (paymentIntent) => {
  const gigId = paymentIntent.metadata.gigId;
  const applicantId = paymentIntent.metadata.applicantId;
  const recipientMusicianId = paymentIntent.metadata.recipientMusicianId;
  const venueId = paymentIntent.metadata.venueId;
  const gigTime = paymentIntent.metadata.time;
  const gigDate = paymentIntent.metadata.date;
  const paymentIntentId = paymentIntent.id;
  const formattedGigDate = new Date(gigDate);
  const [hours, minutes] = gigTime.split(":").map(Number);
  formattedGigDate.setHours(hours);
  formattedGigDate.setMinutes(minutes);
  formattedGigDate.setSeconds(0);
  const disputePeriodDate =
  new Date(formattedGigDate.getTime() + 48 * 60 * 60 * 1000);
  const maxAllowedDate = new Date(Date.now() + 720 * 60 * 60 * 1000);
  const gigStartDate =
  new Date(formattedGigDate.getTime());
  if (!gigId || !applicantId || !recipientMusicianId || !venueId) {
    console.error("Missing required metadata in paymentIntent");
    return;
  }
  try {
    const timestamp = Timestamp.now();
    const gigRef = admin.firestore().collection("gigs").doc(gigId);
    const gigDoc = await gigRef.get();
    if (!gigDoc.exists) {
      throw new Error(`Gig with ID ${gigId} not found`);
    }
    const gigData = gigDoc.data();
    const feeAmount = (() => {
      const raw = typeof gigData.agreedFee === "string" ?
        gigData.agreedFee.replace("£", "").trim() :
        gigData.agreedFee;
      const n = Number(raw);
      return Math.round(n * 0.95 * 100) / 100;
    })();
    const updatedApplicants = (gigData.applicants || []).map((a) =>
      a.id === applicantId ? {...a, status: "confirmed"} : {...a},
    );
    const venueName = gigData.venue.venueName;
    const musicianProfileRef = admin.firestore()
        .collection("musicianProfiles").doc(recipientMusicianId);
    const musicianProfileSnap = await musicianProfileRef.get();
    const musicianProfile = musicianProfileSnap.data();
    const musicianName = musicianProfile.name;
    const musicianEmail = musicianProfile.email;
    const venueProfileRef = admin.firestore()
        .collection("venueProfiles").doc(venueId);
    const venueProfileSnap = await venueProfileRef.get();
    const venueProfile = venueProfileSnap.data();
    const venueEmail = venueProfile.email;
    const gigFeePayload = {
      musicianId: recipientMusicianId,
      applicantId,
      gigId,
      venueId,
      gigDate,
      gigTime,
      amount: feeAmount,
      disputeClearingTime:
        Timestamp.fromDate(disputePeriodDate).toMillis(),
      musicianEmail,
      musicianName,
      venueName,
      paymentIntentId: paymentIntentId,
    };
    const automaticMessagePayload = {
      musicianId: recipientMusicianId,
      applicantId,
      gigId,
      venueId,
      gigDate,
      gigTime,
      amount: feeAmount,
      disputeClearingTime:
        Timestamp.fromDate(disputePeriodDate).toMillis(),
      paymentIntentId,
      musicianName,
      musicianEmail,
      venueEmail,
      venueName,
    };
    const targetUriForFee =
    await getFunctionUrl("clearPendingFee");
    const intermediateQueueUri =
    await getFunctionUrl("intermediateTaskQueue");
    const intermediateMessageUri =
    await getFunctionUrl("intermediateMessageQueue");
    const targetUriForMessage =
    await getFunctionUrl("automaticReviewMessage");
    let feeTaskName;
    let messageTaskName;
    if (disputePeriodDate > maxAllowedDate) {
      feeTaskName = await createCloudTask(
          gigFeePayload,
          maxAllowedDate,
          intermediateQueueUri,
          "intermediateTaskQueue",
      );
      console.log(
          `Enqueued intermediate fee task for ${maxAllowedDate.toISOString()}`,
      );
      messageTaskName =
      await createCloudTask(
          automaticMessagePayload,
          maxAllowedDate,
          intermediateMessageUri,
          "intermediateMessageQueue",
      );
      console.log(
          `Enqueued intermediate msg task for ${maxAllowedDate.toISOString()}`,
      );
    } else {
      feeTaskName = await createCloudTask(
          gigFeePayload,
          disputePeriodDate,
          targetUriForFee,
          "clearPendingFee",
      );
      console.log(`Enqueued fee task for ${disputePeriodDate.toISOString()}`);
      messageTaskName =
      await createCloudTask(
          automaticMessagePayload,
          gigStartDate,
          targetUriForMessage,
          "automaticReviewMessage",
      );
      console.log(
          `Enqueued message task for ${disputePeriodDate.toISOString()}`,
      );
    }
    await gigRef.update({
      applicants: updatedApplicants,
      paymentIntentId: paymentIntentId,
      status: "closed",
      paid: true,
      paymentStatus: "succeeded",
      musicianFeeStatus: "pending",
      disputeClearingTime: disputePeriodDate,
      disputeLogged: false,
      clearPendingFeeTaskName: feeTaskName,
      automaticMessageTaskName: messageTaskName,
    });
    const pendingFeeDocRef = admin
        .firestore()
        .collection("musicianProfiles")
        .doc(recipientMusicianId)
        .collection("pendingFees")
        .doc(paymentIntentId);
    const existing = await pendingFeeDocRef.get();
    if (!existing.exists) {
      await pendingFeeDocRef.set({
        paymentIntentId,
        gigId,
        venueId,
        amount: feeAmount,
        currency: paymentIntent.currency || "gbp",
        timestamp,
        gigDate,
        gigTime,
        disputeClearingTime: Timestamp.fromDate(disputePeriodDate),
        disputeLogged: false,
        disputeDetails: null,
        status: "pending",
        feeCleared: false,
        musicianName,
        musicianEmail,
        venueName,
      });
      await musicianProfileRef.set(
          {
            confirmedGigs: FieldValue.arrayUnion(gigId),
            pendingFunds: FieldValue.increment(feeAmount),
          },
          {merge: true},
      );
    } else {
      await musicianProfileRef.set(
          {confirmedGigs: FieldValue.arrayUnion(gigId)},
          {merge: true},
      );
    }
    const conversationsRef =
    admin.firestore().collection("conversations");
    const conversationsSnapshot =
    await conversationsRef.where("gigId", "==", gigId).get();
    conversationsSnapshot.forEach(async (conversationDoc) => {
      const conversationId = conversationDoc.id;
      const conversationData = conversationDoc.data();
      const isVenueAndMusicianConversation =
        conversationData.participants.includes(venueId) &&
        conversationData.participants.includes(applicantId);
      const messagesRef = admin.firestore().collection("conversations")
          .doc(conversationId).collection("messages");
      if (isVenueAndMusicianConversation) {
        const awaitingPaymentQuery =
        messagesRef.where("status", "==", "awaiting payment");
        const awaitingPaymentSnapshot = await awaitingPaymentQuery.get();
        if (!awaitingPaymentSnapshot.empty) {
          const awaitingMessageId = awaitingPaymentSnapshot.docs[0].id;
          const awaitingMessageRef = messagesRef.doc(awaitingMessageId);
          await awaitingMessageRef.update({
            senderId: "system",
            text:
            `The fee of ${gigData.agreedFee} 
            has been paid by the venue. 
            The gig is now confirmed.`,
            timestamp: timestamp,
            type: "announcement",
            status: "gig confirmed",
          });
        }
        await admin.firestore().collection("conversations")
            .doc(conversationId).update({
              lastMessage:
              `The fee of ${gigData.agreedFee}
               has been paid by the venue.
               The gig is now confirmed.`,
              lastMessageTimestamp: timestamp,
              lastMessageSenderId: "system",
              status: "closed",
            });
      } else {
        const pendingMessagesQuery =
        messagesRef.where("status", "==", "pending");
        const pendingMessagesSnapshot = await pendingMessagesQuery.get();
        if (!pendingMessagesSnapshot.empty) {
          pendingMessagesSnapshot.forEach(async (pendingMessageDoc) => {
            const pendingMessageRef = messagesRef.doc(pendingMessageDoc.id);
            await pendingMessageRef.update({
              status: "declined",
            });
          });
        }
        await messagesRef.add({
          senderId: "system",
          text: "This gig has been booked or deleted.",
          timestamp: timestamp,
          type: "announcement",
          status: "gig booked",
        });
        await admin.firestore().collection("conversations")
            .doc(conversationId).update({
              lastMessage: "This gig has been booked or deleted.",
              lastMessageTimestamp: timestamp,
              lastMessageSenderId: "system",
              status: "closed",
            });
      }
      const calendarLink = generateCalendarLink({
        title: `Gig at ${gigData.venue.venueName}`,
        startTime: formattedGigDate.toISOString(),
        endTime:
        new Date(formattedGigDate.getTime() +
        gigData.duration * 60 * 1000).toISOString(),
        description: `Gig confirmed with fee: ${gigData.agreedFee}`,
        location: gigData.venue.address,
      });

      const mailRef = admin.firestore().collection("mail");
      await mailRef.add({
        to: musicianEmail,
        message: {
          subject: "Gig Confirmed!",
          text: `Your gig at ${gigData.venue.venueName} on ` +
          `${new Date(gigDate).toLocaleDateString()} is now confirmed. ` +
          `Fee: ${gigData.agreedFee}.`,
          html: `
                <p>Hi ${musicianName},</p>
                <p>Great news! Your gig is now confirmed:</p>
                <ul>
                    <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                    <li>
                      <strong>Date:</strong>
                       ${new Date(gigDate).toLocaleDateString()}
                    </li>
                    <li><strong>Time:</strong> ${gigTime}</li>
                    <li><strong>Fee:</strong> ${gigData.agreedFee}</li>
                </ul>
                <p><a href="${calendarLink}">Add to your calendar</a></p>
                <p>Thanks,<br />The Gigin Team</p>
            `,
        },
      });
    });
    console.log(
        `Gig ${gigId} updated successfully after payment confirmation.`,
    );
  } catch (error) {
    console.error("Error handling payment success:", error);
    throw new Error("Error updating gig and related data.");
  }
};

const generateCalendarLink = ({
  title,
  startTime,
  endTime,
  description,
  location,
}) => {
  const baseUrl = "https://www.google.com/calendar/render";
  const formattedStartTime = startTime.replace(/-|:|\.\d+/g, "");
  const formattedEndTime = endTime.replace(/-|:|\.\d+/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formattedStartTime}/${formattedEndTime}`,
    details: description,
    location: location,
  });
  return `${baseUrl}?${params.toString()}`;
};

const handlePaymentFailure = async (failedIntent) => {
  const gigId = failedIntent.metadata.gigId;
  const venueId = failedIntent.metadata.venueId;
  const applicantId = failedIntent.metadata.applicantId;
  const paymentIntentId = failedIntent.id;
  if (!gigId || !venueId || !applicantId) {
    console.error("Missing required metadata in failedIntent");
    return;
  }
  try {
    const timestamp = Timestamp.now();
    const gigRef = admin.firestore().collection("gigs").doc(gigId);
    await gigRef.update({
      paymentStatus: "failed",
      paid: false,
      paymentIntentId,
      status: "open",
    });
    const conversationsRef = admin.firestore().collection("conversations");
    const convoSnap = conversationsRef
        .where("gigId", "==", gigId)
        .where("participants", "array-contains", venueId);
    const convoDoc = convoSnap.docs.find((d) => {
      const data = d.data() || {};
      const participants = data.participants || [];
      return Array.isArray(participants) && participants.includes(applicantId);
    });
    if (convoDoc) {
      const conversationId = convoDoc.id;
      const messagesRef = admin
          .firestore()
          .collection("conversations")
          .doc(conversationId)
          .collection("messages");
      await messagesRef.add({
        senderId: "system",
        text:
        `The payment for this gig failed. Please try again or contact support.`,
        timestamp: timestamp,
        type: "announcement",
        status: "payment failed",
      });
      await admin.firestore()
          .collection("conversations")
          .doc(conversationId).update({
            lastMessage: "The payment for this gig failed.",
            lastMessageTimestamp: timestamp,
            lastMessageSenderId: "system",
          });
      console.log(
          `Updated conversation ${conversationId} for payment failure.`,
      );
    } else {
      console.error(
          "No relevant conversation found between venue and musician.",
      );
    }
    console.log(`Handled payment failure for gig ${gigId}`);
  } catch (error) {
    console.error("Error handling payment failure:", error.message);
    throw new Error("Error updating gig and other data after payment failure.");
  }
};


/* eslint-disable */
// ======= START OF IGNORED FUNCTION =======

/*
exports.clearPendingFee = onRequest(
  {
    secrets: [stripeProductionKey],
    timeoutSeconds: 3600,
  },
  async (req, res) => {
    const {
      musicianId,
      gigId,
      amount,
      disputeClearingTime,
      venueId,
      gigDate,
      gigTime,
      musicianEmail,
      musicianName,
      venueName,
    } = req.body;
    if (!musicianId ||
      !gigId ||
      !disputeClearingTime ||
      !venueId ||
      !gigDate ||
      !gigTime ||
      !amount) {
      console.error("Invalid payload received in task.");
      return res.status(400).send("Invalid payload.");
    }
    const stripe = new Stripe(stripeProductionKey.value());
    const firestore = getFirestore();
    try {
      const musicianProfileRef =
      firestore.collection("musicianProfiles").doc(musicianId);
      const musicianDoc = await musicianProfileRef.get();
      if (!musicianDoc.exists) {
        console.error(`Musician doc ${musicianId} not found.`);
        return res.status(400).send(`Musician doc ${musicianId} not found.`);
      }
      const musicianData = musicianDoc.data();
      const isBand = musicianData.bandProfile === true;
      const gigRef = firestore.collection("gigs").doc(gigId);
      const gigDoc = await gigRef.get();
      if (!gigDoc.exists) {
        console.error(`Gig ${gigId} not found.`);
        return res.status(400).send(`Gig ${gigId} not found.`);
      }
      const gigData = gigDoc.data();
      const clearedFee =
      (musicianData.pendingFees || []).find((fee) => fee.gigId === gigId);
      if (!clearedFee) {
        console.error(`Fee for gig ${gigId} already cleared or not found.`);
        return res.status(400).send(`Fee for gig ${gigId} already cleared.`);
      }
      if (clearedFee.disputeLogged || gigData.disputeLogged) {
        console.error(`Dispute logged for gig ${gigId}`);
        return res.status(400).send(`Dispute logged for gig ${gigId}`);
      }
      const updatedApplications = gigData.applicants.map((application) =>
      application.id === musicianId ? {...application, status: "paid"} : application,
      );
      await gigRef.update({
        musicianFeeStatus: "cleared",
        applicants: updatedApplications,
      });
      const mailRef = firestore.collection("mail");
      if (isBand) {
        const membersSnap =
        await firestore.collection("bands")
            .doc(musicianId).collection("members").get();
        const bandMembers = membersSnap.docs.map((doc) => doc.data());
        for (const member of bandMembers) {
          const {musicianProfileId, split} = member;
          const memberAmount = parseFloat((amount * (split / 100)).toFixed(2));
          const memberRef =
          firestore.collection("musicianProfiles").doc(musicianProfileId);
          const memberDoc = await memberRef.get();
          if (!memberDoc.exists) continue;
          const memberData = memberDoc.data();
          let stripeTransferId = null;
          if (memberData.stripeAccountId) {
            const transfer = await stripe.transfers.create({
              amount: Math.round(memberAmount * 100),
              currency: "gbp",
              destination: memberData.stripeAccountId,
              metadata: {
                musicianId: musicianProfileId,
                gigId,
                description: "Gig fee split transfer after dispute period cleared",
              },
            });
            console.log(`Transferred £${memberAmount} to ${musicianProfileId}`);
            stripeTransferId = transfer.id;
          }
          const updatedPendingFees =
          (memberData.pendingFees || [])
              .filter((fee) => fee.gigId !== gigId);
          const updatedClearedFees = [
            ...(memberData.clearedFees || []),
            {
              ...clearedFee,
              feeCleared: true,
              status: "cleared",
              stripeTransferId,
              amount: memberAmount,
              splitPercentage,
            },
          ];
          await memberRef.update({
            pendingFees: updatedPendingFees,
            clearedFees: updatedClearedFees,
            totalEarnings: (memberData.totalEarnings || 0) + memberAmount,
            withdrawableEarnings: (memberData.withdrawableEarnings || 0) + memberAmount,
          });
          await mailRef.add({
            to: memberData.email,
            message: {
              subject: "Your gig fee is available!",
              text: `Your split from the band gig has cleared. You can now withdraw it from your account.`,
              html: `
              <p>Hi ${memberData.name},</p>
              <p>Your share of the gig with <strong>${venueName}</strong> has been cleared.</p>
              <p><a href="https://gigin.ltd">Log on to Gigin</a> to withdraw your £${memberAmount}.</p>
              <p>Thanks,<br />The Gigin Team</p>
            `,
            },
          });
        }
        await musicianProfileRef.update({
          pendingFees: [],
          clearedFees: [],
        });
      } else {
        let stripeTransferId = null;
        if (musicianData.stripeAccountId) {
          const transfer = await stripe.transfers.create({
            amount: Math.round(amount * 100),
            currency: "gbp",
            destination: musicianData.stripeAccountId,
            metadata: {
              musicianId,
              gigId,
              description: "Gig fee transferred after dispute period cleared",
            },
          });
          console.log(`Stripe transfer successful: ${transfer.id}`);
          stripeTransferId = transfer.id;
        }
        const updatedPendingFees =
        (musicianData.pendingFees || [])
            .filter((fee) => fee.gigId !== gigId);
        const updatedClearedFees = [
          ...(musicianData.clearedFees || []),
          {
            ...clearedFee,
            feeCleared: true,
            status: "cleared",
            stripeTransferId,
          },
        ];
        await musicianProfileRef.update({
          pendingFees: updatedPendingFees,
          clearedFees: updatedClearedFees,
          totalEarnings: (musicianData.totalEarnings || 0) + amount,
          withdrawableEarnings:
          (musicianData.withdrawableEarnings || 0) + amount,
        });
        await mailRef.add({
          to: musicianEmail,
          message: {
            subject: "Your gig fee is available!",
            text: `We have just cleared your gig fee. You can now withdraw it to your bank account.`,
            html: `
            <p>Hi ${musicianName},</p>
            <p>We hope your gig at <strong>${venueName}</strong> went well!</p>
            <p><a href="https://gigin.ltd">Log on to Gigin</a> to withdraw it to your bank account.</p>
            <p>Thanks,<br />The Gigin Team</p>
          `,
          },
        });
      }
      console.log(`Fee cleared for ${musicianId}, gig ${gigId}`);
      return res.status(200).send({success: true});
    } catch (error) {
      console.error("Error clearing fee:", error);
      return res.status(500).send("Internal Server Error.");
    }
  },
);

exports.createStripeCustomer =
functions.auth.user().onCreate(async (user) => {
  try {
    const {uid, email} = user;
    const mode = functions.config().stripe.mode;
    const key = functions.config().stripe.key;
    if (!key) throw new Error(`Stripe key missing (mode: ${mode})`);
    const stripe = new Stripe(key);
    const customer = await stripe.customers.create({email});
    await db.collection("users").doc(uid).set(
        {
          stripeCustomerId: customer.id,
        },
        {merge: true},
    );
    console.log(`Stripe customer created for: ${uid}`);
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw new functions.https.HttpsError(
        "internal", "Failed to create Stripe customer",
    );
  }
});

// ======= END OF IGNORED FUNCTION =======
/* eslint-enable */