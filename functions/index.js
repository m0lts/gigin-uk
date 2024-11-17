const {onRequest, onCall} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require('firebase-admin');
const stripeTestKey = defineSecret("STRIPE_TEST_KEY");

// Load the Stripe library using the secret
const Stripe = require("stripe");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.createCheckoutSession = onCall(
  { secrets: [stripeTestKey] },
  async (request) => {
    const { gigId, fee } = request.data;

    try {
      // Create the Stripe Checkout session
      const stripe = new Stripe(stripeTestKey.value());
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd', // Change to your preferred currency
              product_data: {
                name: `Gig Payment for Gig ID: ${gigId}`,
              },
              unit_amount: fee, // Amount in cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          gigId, // Pass gig ID for tracking
        },
        success_url: `https://your-frontend.com/payment-success?gigId=${gigId}`,
        cancel_url: `https://your-frontend.com/payment-cancelled`,
      });

      // Return the session URL to the client
      return { url: session.url };
    } catch (error) {
      console.error('Error creating Stripe Checkout session:', error);
      throw new Error('Could not create Stripe Checkout session.');
    }
  }
);

exports.stripeWebhook = onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = 'your_webhook_secret';
  const stripe = new Stripe(stripeTestKey.value());

  let event;
  try {
      const body = await rawBody(req); // Ensure the raw body is used
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const gigId = session.metadata.gigId;

      // Update Firestore gig status
      const gigRef = admin.firestore().collection('gigs').doc(gigId);
      await gigRef.update({
          status: 'Confirmed',
          paymentStatus: 'Paid',
      });

      console.log(`Gig ${gigId} marked as confirmed.`);
  }

  res.status(200).send('Webhook received');
});

exports.stripeAccountSession = onRequest(
    {secrets: [stripeTestKey]},
    async (req, res) => {
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

exports.stripeAccount = onRequest(
    {secrets: [stripeTestKey]},
    async (req, res) => {
      try {
        const stripe = new Stripe(stripeTestKey.value());
        const account = await stripe.accounts.create({
          capabilities: {
            transfers: {requested: true},
          },
          country: "GB",
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
        console.log(account);
        console.log("Account creation successful");
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



