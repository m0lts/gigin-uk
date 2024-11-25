const {onRequest, onCall} = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const {onTaskDispatched} = require("firebase-functions/v2/tasks");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const {getFunctions} = require("firebase-admin/functions");
const stripeTestKey = defineSecret("STRIPE_TEST_KEY");
// const endpointSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
// const serviceAccount = require("./service-account.json");
const Stripe = require("stripe");
const cors = require("cors")({origin: true});
const {GoogleAuth} = require("google-auth-library");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore();

exports.createStripeCustomer =
functions.auth.user().onCreate(async (user) => {
  try {
    const {uid, email} = user;
    const stripeApiKey = functions.config().stripe.testkey;
    const stripe = new Stripe(stripeApiKey);
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

exports.savePaymentMethod = onCall(
    {
      secrets: [stripeTestKey],
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
        const stripe = new Stripe(stripeTestKey.value());
        const userDoc =
    await db.collection("users").doc(userId).get();
        const customerId = userDoc.data().stripeCustomerId;
        if (!customerId) {
          throw new Error("Stripe customer ID not found for this user.");
        }
        await stripe.paymentMethods
            .attach(paymentMethodId, {customer: customerId});
        await stripe.customers.update(customerId, {
          invoice_settings:
      {default_payment_method: paymentMethodId},
        });
        return {success: true};
      } catch (error) {
        console.error("Error saving payment method:", error);
        throw new Error("Failed to save payment method.");
      }
    });

exports.getSavedCards = onCall(
    {
      secrets: [stripeTestKey],
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
        const stripe = new Stripe(stripeTestKey.value());
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
      secrets: [stripeTestKey],
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
      } = request.data;
      if (!auth) {
        throw new Error("User must be authenticated.");
      }
      if (!paymentMethodId) {
        throw new Error("Payment method ID is required.");
      }
      const userId = auth.uid;
      const userDoc =
  await admin.firestore().collection("users").doc(userId).get();
      const customerId = userDoc.data().stripeCustomerId;
      if (!customerId) {
        throw new Error("Stripe customer ID not found.");
      }
      try {
        const stripe = new Stripe(stripeTestKey.value());
        const acceptedMusician =
    gigData.applicants.find(
        (applicant) => applicant.status === "accepted",
    );
        const musicianId = acceptedMusician ? acceptedMusician.id : null;
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
            musicianId: musicianId,
            paymentMessageId: paymentMessageId,
          },
        });
        return {success: true, paymentIntent};
      } catch (error) {
        console.error("Error confirming payment:", error);
        if (error.type === "StripeCardError") {
          return {success: false, error: error.message};
        } else if (error.type === "StripeInvalidRequestError") {
          return {success: false, error: "Invalid payment request."};
        } else if (error.type === "StripeAPIError") {
          return {
            success: false, error: "Payment service is currently unavailable.",
          };
        } else if (error.type === "StripeConnectionError") {
          return {success: false, error: "Network error."};
        } else if (error.type === "StripeAuthenticationError") {
          return {success: false, error: "Authentication error."};
        } else {
          return {success: false, error: "An unexpected error occurred."};
        }
      }
    });

exports.getCustomerData = onCall(
    {
      secrets: [stripeTestKey],
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
        const stripe = new Stripe(stripeTestKey.value());
        const customer =
    await stripe.customers.retrieve(customerId);
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: "card",
        });
        const charges = await stripe.charges.list({
          customer: customerId,
          limit: 100,
        });
        const receipts = charges.data
            .filter(
                (charge) => charge.status === "succeeded" && charge.receipt_url,
            );
        return {
          customer,
          receipts,
          paymentMethods: paymentMethods.data,
        };
      } catch (error) {
        console.error("Error fetching customer data:", error);
        throw new Error("Unable to fetch customer data.");
      }
    });

exports.deleteCard = onCall(
    {
      secrets: [stripeTestKey],
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
        const stripe = new Stripe(stripeTestKey.value());
        await stripe.paymentMethods.detach(cardId);
        return {success: true};
      } catch (error) {
        console.error("Error deleting card:", error);
        throw new Error(
            "internal", "Unable to delete the card.",
        );
      }
    });

exports.stripeWebhook = onRequest(
    {
      maxInstances: 3,
      secrets: [stripeTestKey],
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      const stripe = new Stripe(stripeTestKey.value());
      let event;
      const endpointSecret =
      "whsec_b5010dd6cb1cdf2819609636f802f29fb7dc33adfe6c937c65058a48c42a9d56";
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
            break;
          case "payment_intent.payment_failed":
            await handlePaymentFailure(event.data.object);
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

exports.clearPendingFee = onTaskDispatched(
    {
      secrets: [stripeTestKey],
      timeoutSeconds: 3600,
    },
    async (event) => {
      console.log("Task payload received:", event.data);
      const {
        musicianId,
        gigId,
        amount,
        disputeClearingTime,
        venueId,
        gigDate,
        gigTime,
      } = event.data;
      if (
        !musicianId ||
      !gigId ||
      !disputeClearingTime ||
      !venueId ||
      !gigDate ||
      !gigTime ||
      !amount
      ) {
        console.error("Invalid payload received in task.");
        throw new Error("Invalid payload received.");
      }
      const stripe = new Stripe(stripeTestKey.value());
      try {
        const firestore = getFirestore();
        const musicianProfileRef =
      firestore.collection("musicianProfiles").doc(musicianId);
        const musicianDoc = await musicianProfileRef.get();
        if (!musicianDoc.exists) {
          console.error(`Musician doc ${musicianId} not found.`);
          return;
        }
        const musicianData = musicianDoc.data();
        const stripeAccountId = musicianData.stripeAccountId;
        const pendingFees = musicianData.pendingFees || [];
        const clearedFee = pendingFees.find((fee) => fee.gigId === gigId);
        if (!clearedFee) {
          console.error(`Fee for gig ${gigId} already cleared or not found.`);
          return;
        }
        const gigRef = firestore.collection("gigs").doc(gigId);
        const gigDoc = await gigRef.get();
        if (!gigDoc.exists) {
          console.error(`Gig ${gigId} not found.`);
          return;
        }
        const gigData = gigDoc.data();
        if (clearedFee.disputeLogged || gigData.disputeLogged) {
          console.error(`Dispute logged for gig ${gigId}`);
          return;
        }
        let stripeTransferId = null;
        if (stripeAccountId) {
          const transfer = await stripe.transfers.create({
            amount: Math.round(amount * 100),
            currency: "gbp",
            destination: stripeAccountId,
            metadata: {
              musicianId,
              gigId,
              description:
            "Gig fee transferred after dispute period cleared",
            },
          });
          console.log(`Stripe transfer successful: ${transfer.id}`);
          stripeTransferId = transfer.id;
        } else {
          console.log(`Musician ${musicianId} has no Stripe account`);
        }
        await gigRef.update({
          musicianFeeStatus: "cleared",
        });
        const updatedPendingFees =
      pendingFees.filter((fee) => fee.gigId !== gigId);
        const clearedFees = musicianData.clearedFees || [];
        const updatedClearedFees = [
          ...clearedFees,
          {
            ...clearedFee,
            feeCleared: true,
            status: "cleared",
            stripeTransferId,
          },
        ];
        const totalEarnings = (musicianData.totalEarnings || 0) + amount;
        const withdrawableEarnings =
      (musicianData.withdrawableEarnings || 0) + amount;
        await musicianProfileRef.update({
          pendingFees: updatedPendingFees,
          clearedFees: updatedClearedFees,
          totalEarnings: totalEarnings,
          withdrawableEarnings: withdrawableEarnings,
        });
        console.log(`Fee cleared for musician ${musicianId}, gig ${gigId}.`);
        return {success: true};
      } catch (error) {
        console.error("Error clearing fee:", error);
        throw new Error("Failed to clear pending fee.");
      }
    },
);

exports.stripeAccountSession = onRequest(
    {
      secrets: [stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      cors(req, res, async () => {
        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }
        try {
          const stripe = new Stripe(stripeTestKey.value());
          const {account} = req.body;
          const accountSession = await stripe.accountSessions.create({
            account: account,
            components: {
              account_onboarding: {enabled: true},
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
      secrets: [stripeTestKey],
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
          const stripe = new Stripe(stripeTestKey.value());
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

exports.payoutToBankAccount = onCall(
    {
      secrets: [stripeTestKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const stripe = new Stripe(stripeTestKey.value());
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

let auth;

// [START v2GetFunctionUri]
/**
 * Get the URL of a given v2 cloud function.
 *
 * @param {string} name the function's name
 * @param {string} location the function's location
 * @return {Promise<string>} The URL of the function
 */

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
  const musicianId = paymentIntent.metadata.musicianId;
  const venueId = paymentIntent.metadata.venueId;
  const gigTime = paymentIntent.metadata.time;
  const gigDate = paymentIntent.metadata.date;
  const transactionId = paymentIntent.id;
  const formattedGigDate = new Date(gigDate);
  const [hours, minutes] = gigTime.split(":").map(Number);
  formattedGigDate.setHours(hours);
  formattedGigDate.setMinutes(minutes);
  formattedGigDate.setSeconds(0);
  const disputePeriodDate =
  new Date(formattedGigDate.getTime() + 24 * 60 * 60 * 1000);
  if (!gigId || !musicianId || !venueId) {
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
    const updatedApplicants =
    gigData.applicants.map((applicant) => {
      if (applicant.id === musicianId) {
        return {...applicant, status: "confirmed"};
      }
      return {...applicant};
    });
    await gigRef.update({
      applicants: updatedApplicants,
      transactionId: transactionId,
      status: "closed",
      paid: true,
      paymentStatus: "succeeded",
      musicianFeeStatus: "pending",
      disputeClearingTime: disputePeriodDate,
      disputeLogged: false,
    });
    const musicianProfileRef = admin.firestore()
        .collection("musicianProfiles").doc(musicianId);
    await musicianProfileRef.update({
      confirmedGigs: FieldValue.arrayUnion(gigId),
      pendingFees: FieldValue.arrayUnion({
        gigId: gigId,
        venueId: venueId,
        amount: parseFloat(
            (parseFloat(
                gigData.agreedFee.replace("£", ""),
            ) * 0.95).toFixed(2),
        ),
        currency: paymentIntent.currency || "gbp",
        timestamp: timestamp,
        gigDate: gigDate,
        gigTime: gigTime,
        disputeClearingTime: Timestamp.fromDate(disputePeriodDate),
        disputeLogged: false,
        disputeDetails: null,
        status: "pending",
        feeCleared: false,
        paymentIntentId: paymentIntent.id,
      }),
    });
    const payload = {
      musicianId,
      gigId,
      venueId,
      gigDate,
      gigTime,
      amount:
      parseFloat(
          (parseFloat(gigData.agreedFee.replace("£", "")) * 0.95).toFixed(2),
      ),
      disputeClearingTime:
      Timestamp.fromDate(disputePeriodDate).toMillis(),
    };
    const queue = getFunctions().taskQueue("clearPendingFee");
    const targetUri = await getFunctionUrl("clearPendingFee");
    const disputePeriodDateSimulated = new Date(Date.now() + 5 * 60 * 1000);
    await queue.enqueue(payload, {
      scheduleTime: disputePeriodDateSimulated,
      dispatchDeadlineSeconds: 60 * 5,
      uri: targetUri,
    });
    // const response = await fetch("https://clearpendingfee-gxujnzd2uq-uc.a.run.app", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(payload),
    // });
    // if (!response.ok) {
    //   const errorText = await response.text();
    //   throw new Error(`Failed with status ${response.status}: ${errorText}`);
    // }
    console.log(
        `Task queued for musician ${musicianId} at ${disputePeriodDate}`,
    );
    const conversationsRef =
    admin.firestore().collection("conversations");
    const conversationsSnapshot =
    await conversationsRef.where("gigId", "==", gigId).get();
    conversationsSnapshot.forEach(async (conversationDoc) => {
      const conversationId = conversationDoc.id;
      const conversationData = conversationDoc.data();
      const isVenueAndMusicianConversation =
        conversationData.participants.includes(venueId) &&
        conversationData.participants.includes(musicianId);
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
            senderId: venueId,
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
              lastMessageSenderId: venueId,
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
          senderId: venueId,
          text: "This gig has been booked or deleted.",
          timestamp: timestamp,
          type: "announcement",
          status: "gig booked",
        });
        await admin.firestore().collection("conversations")
            .doc(conversationId).update({
              lastMessage: "This gig has been booked or deleted.",
              lastMessageTimestamp: timestamp,
              lastMessageSenderId: venueId,
              status: "closed",
            });
      }
    });
    console.log(
        `Gig ${gigId} updated successfully after payment confirmation.`,
    );
  } catch (error) {
    console.error("Error handling payment success:", error);
    throw new Error("Error updating gig and related data.");
  }
};

const handlePaymentFailure = async (failedIntent) => {
  const gigId = failedIntent.metadata.gigId;
  const venueId = failedIntent.metadata.venueId;
  const musicianId = failedIntent.metadata.musicianId;
  const transactionId = failedIntent.id;
  if (!gigId || !venueId || !musicianId) {
    console.error("Missing required metadata in failedIntent");
    return;
  }
  try {
    const timestamp = Timestamp.now();
    const gigRef = admin.firestore().collection("gigs").doc(gigId);
    await gigRef.update({
      paymentStatus: "failed",
      paid: false,
      transactionId,
      status: "open",
    });
    const conversationsRef = admin.firestore().collection("conversations");
    const conversationQuery = conversationsRef
        .where("gigId", "==", gigId)
        .where("participants", "array-contains", venueId)
        .where("participants", "array-contains", musicianId);
    const conversationsSnapshot = await conversationQuery.get();
    if (!conversationsSnapshot.empty) {
      const conversationDoc = conversationsSnapshot.docs[0];
      const conversationId = conversationDoc.id;
      const messagesRef = admin
          .firestore()
          .collection("conversations")
          .doc(conversationId)
          .collection("messages");
      await messagesRef.add({
        senderId: venueId,
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
            lastMessageSenderId: venueId,
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
