const {onRequest, onCall} = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripeProductionKey = defineSecret("STRIPE_PRODUCTION_KEY");
const endpointSecret = defineSecret("STRIPE_PROD_WEBHOOK");
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

exports.createStripeCustomer =
functions.auth.user().onCreate(async (user) => {
  try {
    const {uid, email} = user;
    const stripeApiKey = functions.config().stripe.production;
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
      secrets: [stripeProductionKey],
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
        const stripe = new Stripe(stripeProductionKey.value());
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
      secrets: [stripeProductionKey],
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
        const stripe = new Stripe(stripeProductionKey.value());
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
      secrets: [stripeProductionKey],
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
        const stripe = new Stripe(stripeProductionKey.value());
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
      secrets: [stripeProductionKey],
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
        const stripe = new Stripe(stripeProductionKey.value());
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
      secrets: [stripeProductionKey],
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
        const stripe = new Stripe(stripeProductionKey.value());
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
      secrets: [stripeProductionKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const {auth} = request;
      const {transactionId} = request.data;
      if (!auth) {
        throw new Error("unauthenticated", "User must be authenticated.");
      }
      if (!transactionId) {
        console.error("Transaction ID is required for a refund.");
        throw new Error("Missing transactionId parameter.");
      }
      try {
        const stripe = new Stripe(stripeProductionKey.value());
        await stripe.refunds.create({
          payment_intent: transactionId,
        });
        console.log(`Refund created for transaction: ${transactionId}`);
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
      secrets: [stripeProductionKey, endpointSecret],
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      const stripe = new Stripe(stripeProductionKey.value());
      let event;
      const prodEndpointSecret = endpointSecret.value();
      try {
        event =
    stripe.webhooks.constructEvent(req.rawBody, sig, prodEndpointSecret);
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
    if (!musicianId || !gigId || !disputeClearingTime || !venueId || !gigDate || !gigTime || !amount) {
      console.error("Invalid payload received in task.");
      return res.status(400).send("Invalid payload.");
    }
    const stripe = new Stripe(stripeProductionKey.value());
    const firestore = getFirestore();
    try {
      const musicianProfileRef = firestore.collection("musicianProfiles").doc(musicianId);
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
      const clearedFee = (musicianData.pendingFees || []).find((fee) => fee.gigId === gigId);
      if (!clearedFee) {
        console.error(`Fee for gig ${gigId} already cleared or not found.`);
        return res.status(400).send(`Fee for gig ${gigId} already cleared.`);
      }
      if (clearedFee.disputeLogged || gigData.disputeLogged) {
        console.error(`Dispute logged for gig ${gigId}`);
        return res.status(400).send(`Dispute logged for gig ${gigId}`);
      }
      const updatedApplications = gigData.applicants.map((application) =>
        application.id === musicianId ? { ...application, status: "paid" } : application
      );
      await gigRef.update({
        musicianFeeStatus: "cleared",
        applicants: updatedApplications,
      });
      const mailRef = firestore.collection("mail");
      if (isBand) {
        const membersSnap = await firestore.collection("bands").doc(musicianId).collection("members").get();
        const bandMembers = membersSnap.docs.map(doc => doc.data());
        for (const member of bandMembers) {
          const { musicianProfileId, split } = member;
          const memberAmount = parseFloat((amount * (split / 100)).toFixed(2));
          const memberRef = firestore.collection("musicianProfiles").doc(musicianProfileId);
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
          const updatedPendingFees = (memberData.pendingFees || []).filter((fee) => fee.gigId !== gigId);
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
        const updatedPendingFees = (musicianData.pendingFees || []).filter((fee) => fee.gigId !== gigId);
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
          withdrawableEarnings: (musicianData.withdrawableEarnings || 0) + amount,
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
      return res.status(200).send({ success: true });
    } catch (error) {
      console.error("Error clearing fee:", error);
      return res.status(500).send("Internal Server Error.");
    }
  }
);

// exports.clearPendingFee = onRequest(
//     {
//       secrets: [stripeProductionKey],
//       timeoutSeconds: 3600,
//     },
//     async (req, res) => {
//       const {
//         musicianId,
//         gigId,
//         amount,
//         disputeClearingTime,
//         venueId,
//         gigDate,
//         gigTime,
//         musicianEmail,
//         musicianName,
//         venueName,
//       } = req.body;
//       if (
//         !musicianId ||
//       !gigId ||
//       !disputeClearingTime ||
//       !venueId ||
//       !gigDate ||
//       !gigTime ||
//       !amount
//       ) {
//         console.error("Invalid payload received in task.");
//         res.status(400).send("Invalid payload.");
//         return;
//       }
//       const stripe = new Stripe(stripeProductionKey.value());
//       try {
//         const firestore = getFirestore();
//         const musicianProfileRef =
//       firestore.collection("musicianProfiles").doc(musicianId);
//         const musicianDoc = await musicianProfileRef.get();
//         if (!musicianDoc.exists) {
//           console.error(`Musician doc ${musicianId} not found.`);
//           res.status(400).send(`Musician doc ${musicianId} not found.`);
//           return;
//         }
//         const musicianData = musicianDoc.data();
//         const stripeAccountId = musicianData.stripeAccountId;
//         const pendingFees = musicianData.pendingFees || [];
//         const clearedFee = pendingFees.find((fee) => fee.gigId === gigId);
//         if (!clearedFee) {
//           console.error(`Fee for gig ${gigId} already cleared or not found.`);
//           res.status(400).send(`Fee for gig ${gigId} already cleared.`);
//           return;
//         }
//         const gigRef = firestore.collection("gigs").doc(gigId);
//         const gigDoc = await gigRef.get();
//         if (!gigDoc.exists) {
//           console.error(`Gig ${gigId} not found.`);
//           res.status(400).send(`Gig ${gigId} not found.`);
//           return;
//         }
//         const gigData = gigDoc.data();
//         if (clearedFee.disputeLogged || gigData.disputeLogged) {
//           console.error(`Dispute logged for gig ${gigId}`);
//           res.status(400).send(`Dispute logged for gig ${gigId}`);
//           return;
//         }
//         let stripeTransferId = null;
//         if (stripeAccountId) {
//           const transfer = await stripe.transfers.create({
//             amount: Math.round(amount * 100),
//             currency: "gbp",
//             destination: stripeAccountId,
//             metadata: {
//               musicianId,
//               gigId,
//               description:
//             "Gig fee transferred after dispute period cleared",
//             },
//           });
//           console.log(`Stripe transfer successful: ${transfer.id}`);
//           stripeTransferId = transfer.id;
//         } else {
//           console.log(`Musician ${musicianId} has no Stripe account`);
//         }
//         const updatedApplications =
//         gigData.applicants.map((application) => {
//           if (application.id === musicianId) {
//             return {...application, status: "paid"};
//           }
//           return {application};
//         });
//         await gigRef.update({
//           musicianFeeStatus: "cleared",
//           applicants: updatedApplications,
//         });
//         const updatedPendingFees =
//       pendingFees.filter((fee) => fee.gigId !== gigId);
//         const clearedFees = musicianData.clearedFees || [];
//         const updatedClearedFees = [
//           ...clearedFees,
//           {
//             ...clearedFee,
//             feeCleared: true,
//             status: "cleared",
//             stripeTransferId,
//           },
//         ];
//         const totalEarnings = (musicianData.totalEarnings || 0) + amount;
//         const withdrawableEarnings =
//       (musicianData.withdrawableEarnings || 0) + amount;
//         await musicianProfileRef.update({
//           pendingFees: updatedPendingFees,
//           clearedFees: updatedClearedFees,
//           totalEarnings: totalEarnings,
//           withdrawableEarnings: withdrawableEarnings,
//         });
//         const mailRef = firestore.collection("mail");
//         await mailRef.add({
//           to: musicianEmail,
//           message: {
//             subject: "Your gig fee is available!",
//             text: `We have just cleared your gig fee.
//              You can now withdraw it to your bank account.`,
//             html: `
//                   <p>Hi ${musicianName},</p>
//                   <p>We hope your gig at
//                    <strong>${venueName}</strong> went well!</p>
//                   <p><a href="https://gigin.ltd">Log on to Gigin</a> to withdraw it to your bank account.</p>
//                   <p>Thanks,<br />The Gigin Team</p>
//               `,
//           },
//         });
//         console.log(`Fee cleared for musician ${musicianId}, gig ${gigId}.`);
//         res.status(200).send({success: true});
//       } catch (error) {
//         console.error("Error clearing fee:", error);
//         res.status(500).send("Internal Server Error.");
//       }
//     },
// );

exports.intermediateTaskQueue = onRequest(
    {
      secrets: [stripeProductionKey],
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      const {
        musicianId,
        gigId,
        venueId,
        disputeClearingTime,
        transactionId,
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
                gigId,
                venueId,
                disputeClearingTime,
                transactionId,
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
                gigId,
                venueId,
                disputeClearingTime,
                transactionId,
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
      secrets: [stripeProductionKey],
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      const {
        musicianId,
        gigId,
        venueId,
        gigDate,
        gigTime,
        amount,
        transactionId,
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
                gigId,
                venueId,
                gigDate,
                gigTime,
                amount,
                transactionId,
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
                gigId,
                venueId,
                gigDate,
                gigTime,
                amount,
                transactionId,
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
      secrets: [stripeProductionKey],
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      const {
        musicianId,
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
    !musicianName
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
            .where("participants", "array-contains", musicianId);
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
      secrets: [stripeProductionKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (req, res) => {
      cors(req, res, async () => {
        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }
        try {
          const stripe = new Stripe(stripeProductionKey.value());
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
      secrets: [stripeProductionKey],
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
          const stripe = new Stripe(stripeProductionKey.value());
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
      secrets: [stripeProductionKey],
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
        const stripe = new Stripe(stripeProductionKey.value());
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

exports.changeBankDetails = onCall(
    {
      secrets: [stripeProductionKey],
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
          const stripe = new Stripe(stripeProductionKey.value());
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

exports.payoutToBankAccount = onCall(
    {
      secrets: [stripeProductionKey],
      region: "europe-west3",
      timeoutSeconds: 3600,
    },
    async (request) => {
      const stripe = new Stripe(stripeProductionKey.value());
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
  const maxAllowedDate = new Date(Date.now() + 720 * 60 * 60 * 1000);
  const gigStartDate =
  new Date(formattedGigDate.getTime());
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
    const venueName = gigData.venue.venueName;
    const musicianProfileRef = admin.firestore()
        .collection("musicianProfiles").doc(musicianId);
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
      musicianEmail,
      musicianName,
      venueName,
    };
    const automaticMessagePayload = {
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
      transactionId,
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
      transactionId: transactionId,
      status: "closed",
      paid: true,
      paymentStatus: "succeeded",
      musicianFeeStatus: "pending",
      disputeClearingTime: disputePeriodDate,
      disputeLogged: false,
      clearPendingFeeTaskName: feeTaskName,
      automaticMessageTaskName: messageTaskName,
    });
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
