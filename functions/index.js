const {onRequest, onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler")
const functions = require('firebase-functions');
const {getFirestore, Timestamp, FieldValue} = require('firebase-admin/firestore');
const {defineSecret} = require("firebase-functions/params");
const admin = require('firebase-admin');
const stripeTestKey = defineSecret("STRIPE_TEST_KEY");
// const endpointSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// Load the Stripe library using the secret
const Stripe = require("stripe");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// // Create a stripe customer when the user signs up
// exports.createStripeCustomer = functions.auth.user().onCreate(async (user) => {
//   try {
//     const { uid, email } = user; // Extract user ID and email from the event

//     // Create a Stripe customer
//     const stripe = new Stripe(stripeTestKey.value());
//     const customer = await stripe.customers.create({ email });

//     // Save the Stripe customer ID to Firestore under the user's document
//     await db.collection('users').doc(uid).set(
//       {
//         stripeCustomerId: customer.id,
//       },
//       { merge: true } // Merge to avoid overwriting existing data
//     );

//     console.log(`Stripe customer created for UID: ${uid}, Customer ID: ${customer.id}`);
//   } catch (error) {
//     console.error('Error creating Stripe customer:', error);
//     throw new functions.https.HttpsError('internal', 'Failed to create Stripe customer');
//   }
// });


exports.savePaymentMethod = onCall(
  { secrets: [stripeTestKey] },
  async (request) => {
    const { paymentMethodId } = request.data;
    if (!request.auth) {
      throw new Error('Unauthenticated request. User must be signed in.');
    }
    const userId = request.auth.uid;
    try {
      const stripe = new Stripe(stripeTestKey.value());
      const userDoc = await db.collection('users').doc(userId).get();
      const customerId = userDoc.data()?.stripeCustomerId;
      if (!customerId) {
        throw new Error('Stripe customer ID not found for this user.');
      }
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      return { success: true };
    } catch (error) {
      console.error('Error saving payment method:', error);
      throw new Error('Failed to save payment method.');
    }
  }
);

exports.getSavedCards = onCall(
  { secrets: [stripeTestKey] },
  async (request) => {
  const { auth } = request;
  if (!auth) {
    throw new Error('User must be authenticated.');
  }
  const userId = auth.uid;
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const customerId = userDoc.data()?.stripeCustomerId;
  if (!customerId) {
    throw new Error('Stripe customer ID not found.');
  }
  try {
    const stripe = new Stripe(stripeTestKey.value());
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return { paymentMethods: paymentMethods.data };
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw new Error('Unable to fetch payment methods.');
  }
});

exports.confirmPayment = onCall(
  { secrets: [stripeTestKey] },
  async (request) => {
  const { auth } = request;
  const { paymentMethodId, amountToCharge, gigData, gigDate, paymentMessageId } = request.data;
  if (!auth) {
    throw new Error('User must be authenticated.');
  }
  if (!paymentMethodId) {
    throw new Error('Payment method ID is required.');
  }
  const userId = auth.uid;
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const customerId = userDoc.data()?.stripeCustomerId;
  if (!customerId) {
    throw new Error('Stripe customer ID not found.');
  }
  try {
    const stripe = new Stripe(stripeTestKey.value());
    const acceptedMusician = gigData.applicants.find((applicant) => applicant.status === 'accepted');
    const musicianId = acceptedMusician ? acceptedMusician.id : null;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountToCharge,
      currency: 'gbp',
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
      }
    });
    return { success: true, paymentIntent };
  } catch (error) {
    console.error('Error confirming payment:', error);
    if (error.type === 'StripeCardError') {
      return { success: false, error: error.message };
    } else if (error.type === 'StripeInvalidRequestError') {
      return { success: false, error: 'Invalid payment request. Please try again.' };
    } else if (error.type === 'StripeAPIError') {
      return { success: false, error: 'Payment service is currently unavailable. Please try again later.' };
    } else if (error.type === 'StripeConnectionError') {
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    } else if (error.type === 'StripeAuthenticationError') {
      return { success: false, error: 'Authentication error. Please contact support.' };
    } else {
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  }
});

exports.getCustomerData = onCall(
  { secrets: [stripeTestKey] },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new Error('User must be authenticated.');
    }
    const userId = auth.uid;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const customerId = userDoc.data()?.stripeCustomerId;
    if (!customerId) {
      throw new Error('Stripe customer ID not found.');
    }
    try {
      const stripe = new Stripe(stripeTestKey.value());
      const customer = await stripe.customers.retrieve(customerId);
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
      const charges = await stripe.charges.list({
        customer: customerId,
        limit: 100,
      });
      const receipts = charges.data
        .filter((charge) => charge.status === 'succeeded' && charge.receipt_url)
      return {
        customer,
        receipts,
        paymentMethods: paymentMethods.data,
      };
    } catch (error) {
      console.error('Error fetching customer data:', error);
      throw new Error('Unable to fetch customer data.');
    }
  }
);

exports.deleteCard = onCall(
  { secrets: [stripeTestKey] }, // Use your Stripe secret key
  async (request) => {
    const { auth } = request;
    const { cardId } = request.data;
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    if (!cardId) {
      throw new functions.https.HttpsError('invalid-argument', 'Card ID is required.');
    }
    const userId = auth.uid;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const customerId = userDoc.data()?.stripeCustomerId;
    if (!customerId) {
      throw new functions.https.HttpsError('not-found', 'Stripe customer ID not found.');
    }
    try {
      const stripe = new Stripe(stripeTestKey.value());
      await stripe.paymentMethods.detach(cardId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting card:', error);
      throw new functions.https.HttpsError('internal', 'Unable to delete the card.');
    }
  }
);

exports.stripeWebhook = onRequest(
  {
    maxInstances: 3,
    secrets: [stripeTestKey]
  },
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const stripe = new Stripe(stripeTestKey.value());
    let event;
    const endpointSecret = "whsec_b5010dd6cb1cdf2819609636f802f29fb7dc33adfe6c937c65058a48c42a9d56";
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          console.log('PaymentIntent succeeded:', paymentIntent);
          await handlePaymentSuccess(paymentIntent);
          break;
        case 'payment_intent.payment_failed':
          const failedIntent = event.data.object;
          console.warn('PaymentIntent failed:', failedIntent);
          await handlePaymentFailure(failedIntent);
          break;
        default:
          console.info(`Unhandled event type ${event.type}`);
      }
      res.status(200).send({ received: true });
    } catch (err) {
      console.error('Error handling webhook event:', err.message);
      res.status(500).send(`Webhook handler error: ${err.message}`);
    }
  }
);

exports.clearPendingFees = onSchedule('every 1 hours', async (event) => {
  const firestore = getFirestore();
  const currentTime = Timestamp.now();
  try {
    const musicianProfilesSnapshot = await firestore.collection('musicianProfiles').get();
    const batch = firestore.batch();
    musicianProfilesSnapshot.forEach((musicianDoc) => {
      const musicianData = musicianDoc.data();
      const musicianId = musicianDoc.id;
      const feesToClear = musicianData.pendingFees?.filter((fee) => {
        return fee.disputePeriod.toMillis() <= currentTime.toMillis() && !fee.disputeLogged;
      });
      if (feesToClear && feesToClear.length > 0) {
        const updatedPendingFees = musicianData.pendingFees.filter((fee) => {
          return !(fee.disputePeriod.toMillis() <= currentTime.toMillis() && !fee.disputeLogged);
        });
        const updatedClearedFees = musicianData.clearedFees
          ? [...musicianData.clearedFees, ...feesToClear]
          : [...feesToClear];
        const totalClearedAmount = feesToClear.reduce((sum, fee) => sum + fee.amount, 0);
        batch.update(firestore.collection('musicianProfiles').doc(musicianId), {
          pendingFees: updatedPendingFees,
          clearedFees: updatedClearedFees,
          earnings: (musicianData.earnings || 0) + totalClearedAmount,
        });
      }
    });
    await batch.commit();
    console.log('Pending fees cleared successfully and moved to cleared fees.');
  } catch (error) {
    console.error('Error clearing pending fees:', error);
    throw new Error('Failed to clear pending fees.');
  }
});

const handlePaymentSuccess = async (paymentIntent) => {
  const gigId = paymentIntent.metadata?.gigId;
  const musicianId = paymentIntent.metadata?.musicianId;
  const venueId = paymentIntent.metadata?.venueId;
  const gigTime = paymentIntent.metadata?.time;
  const gigDate = paymentIntent.metadata?.date;
  const transactionId = paymentIntent.id;
  const formattedGigDate = new Date(gigDate);
  const [hours, minutes] = gigTime.split(':').map(Number);
  formattedGigDate.setHours(hours);
  formattedGigDate.setMinutes(minutes);
  formattedGigDate.setSeconds(0);
  const disputePeriodDate = new Date(formattedGigDate.getTime() + 24 * 60 * 60 * 1000);
  if (!gigId || !musicianId || !venueId) {
    console.error('Missing required metadata in paymentIntent');
    return;
  }
  try {
    const timestamp = Timestamp.now();
    const gigRef = admin.firestore().collection('gigs').doc(gigId);
    const gigDoc = await gigRef.get();
    if (!gigDoc.exists) {
      throw new Error(`Gig with ID ${gigId} not found`);
    }
    const gigData = gigDoc.data();
    const updatedApplicants = gigData.applicants.map(applicant => {
      if (applicant.id === musicianId) {
        return { ...applicant, status: 'confirmed' };
      }
      return { ...applicant };
    });
    await gigRef.update({
      applicants: updatedApplicants,
      transactionId: transactionId,
      status: 'closed',
      paid: true,
      paymentStatus: 'succeeded',
      musicianFeeStatus: 'pending',
      disputeClearingTime: disputePeriodDate,
    });
    const musicianProfileRef = admin.firestore().collection('musicianProfiles').doc(musicianId);
    await musicianProfileRef.update({
      confirmedGigs: FieldValue.arrayUnion(gigId),
      pendingFees: FieldValue.arrayUnion({
        gigId: gigId,
        venueId: venueId,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency || 'gbp',
        timestamp: timestamp,
        gigDate: gigDate,
        gigTime: gigTime,
        disputeClearingTime: Timestamp.fromDate(disputePeriodDate),
        disputeLogged: false,
        disputeDetails: null,
        status: 'pending',
        feeCleared: false,
        paymentIntentId: paymentIntent.id,
      }),
    });
    const conversationsRef = admin.firestore().collection('conversations');
    const conversationsSnapshot = await conversationsRef.where('gigId', '==', gigId).get();
    conversationsSnapshot.forEach(async (conversationDoc) => {
      const conversationId = conversationDoc.id;
      const conversationData = conversationDoc.data();
      const isVenueAndMusicianConversation =
        conversationData.participants.includes(venueId) &&
        conversationData.participants.includes(musicianId);
      const messagesRef = admin.firestore().collection('conversations').doc(conversationId).collection('messages');
      if (isVenueAndMusicianConversation) {
        const awaitingPaymentQuery = messagesRef.where('status', '==', 'awaiting payment');
        const awaitingPaymentSnapshot = await awaitingPaymentQuery.get();
        if (!awaitingPaymentSnapshot.empty) {
          const awaitingMessageId = awaitingPaymentSnapshot.docs[0].id;
          const awaitingMessageRef = messagesRef.doc(awaitingMessageId);
          await awaitingMessageRef.update({
            senderId: venueId,
            text: `The fee of ${gigData.agreedFee} has been paid by the venue. The gig is now confirmed.`,
            timestamp: timestamp,
            type: 'announcement',
            status: 'gig confirmed',
          });
        }
        await admin.firestore().collection('conversations').doc(conversationId).update({
          lastMessage: `The fee of ${gigData.agreedFee} has been paid by the venue. The gig is now confirmed.`,
          lastMessageTimestamp: timestamp,
          lastMessageSenderId: venueId,
          status: 'closed',
        });
      } else {
        const pendingMessagesQuery = messagesRef.where('status', '==', 'pending');
        const pendingMessagesSnapshot = await pendingMessagesQuery.get();
        if (!pendingMessagesSnapshot.empty) {
          pendingMessagesSnapshot.forEach(async (pendingMessageDoc) => {
            const pendingMessageRef = messagesRef.doc(pendingMessageDoc.id);
            await pendingMessageRef.update({
              status: 'declined',
            });
          });
        }
        await messagesRef.add({
          senderId: venueId,
          text: 'This gig has been booked or deleted.',
          timestamp: timestamp,
          type: 'announcement',
          status: 'gig booked',
        });
        await admin.firestore().collection('conversations').doc(conversationId).update({
          lastMessage: 'This gig has been booked or deleted.',
          lastMessageTimestamp: timestamp,
          lastMessageSenderId: venueId,
          status: 'closed',
        });
      }
    });
    console.log(`Gig ${gigId} updated successfully after payment confirmation.`);
  } catch (error) {
    console.error('Error handling payment success:', error);
    throw new Error('Error updating gig and related data.');
  }
};

const handlePaymentFailure = async (failedIntent) => {
  const gigId = failedIntent.metadata?.gigId;
  const venueId = failedIntent.metadata?.venueId;
  const musicianId = paymentIntent.metadata?.musicianId;
  const transactionId = failedIntent.id;
  if (!gigId || !venueId || !musicianId) {
    console.error('Missing required metadata in failedIntent');
    return;
  }
  try {
    const timestamp = Timestamp.now();
    const gigRef = admin.firestore().collection('gigs').doc(gigId);
    await gigRef.update({
      paymentStatus: 'failed',
      paid: false,
      transactionId,
      status: 'open',
    });
    const conversationsRef = admin.firestore().collection('conversations');
    const conversationQuery = conversationsRef
      .where('gigId', '==', gigId)
      .where('participants', 'array-contains', venueId)
      .where('participants', 'array-contains', musicianId);
    const conversationsSnapshot = await conversationQuery.get();
    if (!conversationsSnapshot.empty) {
      const conversationDoc = conversationsSnapshot.docs[0];
      const conversationId = conversationDoc.id;
      const messagesRef = admin
        .firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages');
      await messagesRef.add({
        senderId: venueId,
        text: `The payment for this gig failed. Please try again or contact support.`,
        timestamp: timestamp,
        type: 'announcement',
        status: 'payment failed',
      });
      await admin.firestore().collection('conversations').doc(conversationId).update({
        lastMessage: 'The payment for this gig failed.',
        lastMessageTimestamp: timestamp,
        lastMessageSenderId: venueId,
      });
      console.log(`Updated conversation ${conversationId} for payment failure.`);
    } else {
      console.error('No relevant conversation found between venue and musician.');
    }
    console.log(`Handled payment failure for gig ${gigId}`);
  } catch (error) {
    console.error('Error handling payment failure:', error.message);
    throw new Error('Error updating gig and related data after payment failure.');
  }
};



// exports.createCheckoutSession = onCall(
//   { secrets: [stripeTestKey] },
//   async (request) => {
//     const { gigId, fee, conversationId } = request.data;

//     try {
//       // Create the Stripe Checkout session
//       const stripe = new Stripe(stripeTestKey.value());
//       const session = await stripe.checkout.sessions.create({
//         payment_method_types: ['card'],
//         mode: 'payment',
//         line_items: [
//           {
//             price_data: {
//               currency: 'gbp', // Change to your preferred currency
//               product_data: {
//                 name: `Gig Payment for Gig ID: ${gigId}`,
//               },
//               unit_amount: fee, // Amount in cents
//             },
//             quantity: 1,
//           },
//         ],
//         metadata: {
//           gigId, // Pass gig ID for tracking
//         },
//         success_url: `https://localhost:5173/payment-success?gigId=${gigId}`,
//         cancel_url: `http://localhost:5173/messages?conversationId=${conversationId}`,
//       });

//       // Return the session URL to the client
//       return { url: session.url };
//     } catch (error) {
//       console.error('Error creating Stripe Checkout session:', error);
//       throw new Error('Could not create Stripe Checkout session.');
//     }
//   }
// );

// exports.stripeWebhook = onRequest(async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   const endpointSecret = 'your_webhook_secret';
//   const stripe = new Stripe(stripeTestKey.value());

//   let event;
//   try {
//       const body = await rawBody(req); // Ensure the raw body is used
//       event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
//   } catch (err) {
//       console.error('Webhook signature verification failed:', err.message);
//       return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   if (event.type === 'checkout.session.completed') {
//       const session = event.data.object;

//       const gigId = session.metadata.gigId;

//       // Update Firestore gig status
//       const gigRef = admin.firestore().collection('gigs').doc(gigId);
//       await gigRef.update({
//           status: 'Confirmed',
//           paymentStatus: 'Paid',
//       });

//       console.log(`Gig ${gigId} marked as confirmed.`);
//   }

//   res.status(200).send('Webhook received');
// });

// exports.stripeAccountSession = onRequest(
//     {secrets: [stripeTestKey]},
//     async (req, res) => {
//       try {
//         const stripe = new Stripe(stripeTestKey.value());
//         const {account} = req.body;

//         const accountSession = await stripe.accountSessions.create({
//           account: account,
//           components: {
//             account_onboarding: {enabled: true},
//           },
//         });

//         res.json({
//           client_secret: accountSession.client_secret,
//         });
//       } catch (error) {
//         console.error(
//             "Error occurred calling the Stripe API to create account session",
//             error,
//         );
//         res.status(500).send({error: error.message});
//       }
//     });

// exports.stripeAccount = onRequest(
//     {secrets: [stripeTestKey]},
//     async (req, res) => {
//       try {
//         const stripe = new Stripe(stripeTestKey.value());
//         const account = await stripe.accounts.create({
//           capabilities: {
//             transfers: {requested: true},
//           },
//           country: "GB",
//           controller: {
//             stripe_dashboard: {
//               type: "none",
//             },
//             fees: {
//               payer: "application",
//             },
//             losses: {
//               payments: "application",
//             },
//             requirement_collection: "application",
//           },
//         });
//         console.log(account);
//         console.log("Account creation successful");
//         res.json({
//           account: account.id,
//         });
//       } catch (error) {
//         console.error(
//             "Error occurred when calling the Stripe API to create an account",
//             error,
//         );
//         res.status(500).send({error: error.message});
//       }
//     });



