/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { admin, db, FieldValue } from "../config/admin.js";
import { getStripe } from "../lib/stripeClient.js";

const router = express.Router();

// POST /api/billing/getSavedCards
router.post("/getSavedCards", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.auth.uid;
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User doc not found" });
  const userData = userSnap.data() || {};

  const customerIds = new Set();
  const ownerMap = {};
  const userCustomerId = userData.stripeCustomerId || null;
  if (userCustomerId) {
    customerIds.add(userCustomerId);
    ownerMap[userCustomerId] = { ownerType: 'user', userName: userData.name };
  }
  const venueIds = Array.isArray(userData.venueProfiles)
    ? userData.venueProfiles.map(v => (typeof v === 'string' ? v : v?.venueId)).filter(Boolean)
    : [];
  if (venueIds.length) {
    const refs = venueIds.map(id => db.collection('venueProfiles').doc(id));
    const venueDocs = await db.getAll(...refs);
    venueDocs.forEach(doc => {
      if (!doc?.exists) return;
      const v = doc.data() || {};
      if (v.stripeCustomerId) {
        ownerMap[v.stripeCustomerId] = { ownerType: 'venue', venueId: doc.id, venueName: v.name || v.displayName || doc.id };
        customerIds.add(v.stripeCustomerId);
      }
    });
  }
  if (customerIds.size === 0) return res.json({ data: { paymentMethods: [] } });
  const stripe = getStripe();
  const fetchBundle = async (cid) => {
    const [customer, pmList] = await Promise.all([
      stripe.customers.retrieve(cid, { expand: ["invoice_settings.default_payment_method"] }),
      stripe.paymentMethods.list({ customer: cid, type: "card" }),
    ]);
    const defaultId = customer?.invoice_settings?.default_payment_method?.id || null;
    const owner = ownerMap[cid] || { ownerType: 'unknown' };
    return pmList.data.map(pm => ({ ...pm, default: pm.id === defaultId, customer: cid, ownerType: owner.ownerType, venueId: owner.venueId || null, venueName: owner.venueName || null }));
  };
  const arrays = await Promise.all(Array.from(customerIds).map(fetchBundle));
  const paymentMethods = arrays.flat();
  return res.json({ data: { paymentMethods } });
}));

// POST /api/billing/confirmPayment
router.post("/confirmPayment", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.auth.uid;
  const { paymentMethodId, amountToCharge, gigData, gigDate, paymentMessageId, musicianProfileId, customerId: requestedCustomerId } = req.body || {};
  if (!paymentMethodId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "paymentMethodId required" });
  if (!gigData?.gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData.gigId required" });
  if (!(Number.isInteger(amountToCharge) && amountToCharge > 0)) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "amountToCharge must be positive integer (minor units)" });
  const venueId = gigData?.venueId;
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const venueSnap = await venueRef.get();
  if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "venue" });
  const venue = venueSnap.data() || {};
  const isOwner = venue?.createdBy === userId || venue?.userId === userId;
  let canPay = isOwner;
  if (!canPay) {
    const memberSnap = await venueRef.collection('members').doc(userId).get();
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const isActiveMember = !!memberData && memberData.status === 'active';
    const perms = (memberData && memberData.permissions) ? memberData.permissions : {};
    canPay = isActiveMember && !!perms['gigs.pay'];
  }
  if (!canPay) return res.status(403).json({ error: 'PERMISSION_DENIED', message: 'requires gigs.pay' });
  const userSnap = await admin.firestore().collection("users").doc(userId).get();
  const userCustomerId = userSnap.data()?.stripeCustomerId || null;
  const customerId = requestedCustomerId || userCustomerId;
  if (!customerId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Stripe customer ID not found" });

  const stripe = getStripe();
  // Validate accepted applicant
  const acceptedMusician = Array.isArray(gigData.applicants)
    ? gigData.applicants.find((a) => a?.status === "accepted" && a?.id === musicianProfileId)
    : null;
  if (!acceptedMusician || acceptedMusician.id !== musicianProfileId) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Accepted applicant doesn't match musician ID" });
  }
  let applicantId = acceptedMusician.id;
  let recipientMusicianId = applicantId;
  const applicantType = acceptedMusician.type || "musician";
  if (applicantType === "band") {
    const bandSnap = await admin.firestore().collection("bands").doc(applicantId).get();
    if (!bandSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Band profile not found" });
    const band = bandSnap.data() || {};
    recipientMusicianId = band?.admin?.musicianId;
    if (!recipientMusicianId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Band missing admin musician id" });
  }
  try {
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
        applicantId,
        applicantType,
        recipientMusicianId,
        paymentMessageId,
        paymentMadeById: userId,
        paymentMadeByName: userSnap.data()?.name,
      },
    });
    const gigRef = db.collection("gigs").doc(gigData.gigId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(gigRef);
      if (!snap.exists) throw new Error(`Gig ${gigData.gigId} not found while marking payment.`);
      const data = snap.data() || {};
      const applicants = Array.isArray(data.applicants) ? data.applicants : [];
      const updatedApplicants = applicants.map((a) => a?.id === applicantId ? { ...a, status: "payment processing" } : { ...a });
      tx.update(gigRef, { applicants: updatedApplicants, paymentStatus: "processing", paymentIntentId: paymentIntent.id, paid: false });
    });
    await db.collection("payments").doc(paymentIntent.id).set({
      gigId: gigData.gigId,
      applicantId,
      recipientMusicianId,
      venueId: gigData.venueId,
      payerCustomerId: customerId,
      payerUid: userId,
      status: "processing",
      createdAt: FieldValue.serverTimestamp(),
      lastCheckedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return res.json({ data: { success: true, paymentIntent } });
  } catch (error) {
    const pi = error?.raw?.payment_intent;
    const needsSCA = error?.code === "authentication_required" || (pi && (pi.status === "requires_action" || pi.status === "requires_source_action" || pi.status === "requires_payment_method"));
    if (needsSCA && pi?.client_secret) {
      await admin.firestore().collection("payments").doc(pi.id).set({
        gigId: gigData.gigId,
        applicantId,
        recipientMusicianId,
        venueId: gigData.venueId,
        payerCustomerId: customerId,
        payerUid: userId,
        status: "requires_action",
        createdAt: FieldValue.serverTimestamp(),
        lastCheckedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.json({ data: { success: false, requiresAction: true, clientSecret: pi.client_secret, paymentIntentId: pi.id, paymentMethodId, error: "Authentication required" } });
    }
    return res.status(400).json({ error: "PAYMENT_FAILED", message: error?.message || "Payment failed" });
  }
}));

// POST /api/billing/createGigPaymentIntent
router.post("/createGigPaymentIntent", requireAuth, asyncHandler(async (req, res) => {
  const { amountToCharge, gigData, musicianProfileId, paymentMessageId, gigDate, customerId: requestedCustomerId } = req.body || {};
  const auth = { uid: req.auth.uid };
  // reuse confirmPayment-like validation and permission
  if (!Number.isInteger(amountToCharge) || amountToCharge <= 0) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "amountToCharge invalid" });
  if (!gigData?.gigId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "gigData.gigId required" });
  const userId = auth.uid;
  const venueId = gigData?.venueId;
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const venueSnap = await venueRef.get();
  if (!venueSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "venue" });
  const venue = venueSnap.data() || {};
  const isOwner = venue?.createdBy === userId || venue?.userId === userId;
  let canPay = isOwner;
  if (!canPay) {
    const memberSnap = await venueRef.collection('members').doc(userId).get();
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const isActiveMember = !!memberData && memberData.status === 'active';
    const perms = (memberData && memberData.permissions) ? memberData.permissions : {};
    canPay = isActiveMember && !!perms['gigs.pay'];
  }
  if (!canPay) return res.status(403).json({ error: 'PERMISSION_DENIED', message: 'requires gigs.pay' });
  const userSnap = await db.collection("users").doc(userId).get();
  const userCustomerId = userSnap.data()?.stripeCustomerId || null;
  const customerId = requestedCustomerId || userCustomerId;
  if (!customerId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Stripe customer ID not found" });
  const stripe = getStripe();

  // resolve band admin if needed
  let applicantType = "musician";
  let recipientMusicianId = musicianProfileId || null;
  if (musicianProfileId) {
    const accepted = Array.isArray(gigData.applicants) ? gigData.applicants.find((a) => a?.id === musicianProfileId && a?.status === "accepted") : null;
    if (!accepted) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Accepted applicant doesn't match musician ID" });
    applicantType = accepted.type || "musician";
    if (applicantType === "band") {
      const bandSnap = await db.collection("bands").doc(musicianProfileId).get();
      if (!bandSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: `Band ${musicianProfileId} n/a` });
      const band = bandSnap.data() || {};
      recipientMusicianId = band?.admin?.musicianId;
      if (!recipientMusicianId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: `Band ${musicianProfileId} missing admin id` });
    }
  }
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
      applicantId: musicianProfileId || null,
      applicantType,
      recipientMusicianId: recipientMusicianId || null,
      paymentMessageId: paymentMessageId || null,
      paymentMadeById: userId,
      paymentMadeByName: userSnap.data()?.name,
    },
  });
  await db.collection("payments").doc(pi.id).set({
    gigId: gigData.gigId,
    applicantId: musicianProfileId || null,
    recipientMusicianId: recipientMusicianId || null,
    venueId: gigData.venueId || null,
    payerCustomerId: customerId,
    status: "requires_confirmation",
    payerUid: userId,
    createdAt: FieldValue.serverTimestamp(),
    lastCheckedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return res.json({ data: { clientSecret: pi.client_secret, paymentIntentId: pi.id } });
}));

export default router;

// -------- Additional billing endpoints --------

// POST /api/billing/savePaymentMethod
router.post("/savePaymentMethod", requireAuth, asyncHandler(async (req, res) => {
  const { paymentMethodId, customerId: requestedCustomerId } = req.body || {};
  const userId = req.auth.uid;
  if (!paymentMethodId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "paymentMethodId is required" });
  try {
    const stripe = getStripe();
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User doc not found" });
    const userData = userDoc.data() || {};
    const userCustomerId = userData.stripeCustomerId || null;
    let targetCustomerId = userCustomerId;
    if (requestedCustomerId) {
      if (requestedCustomerId === userCustomerId) targetCustomerId = requestedCustomerId;
      else {
        const venueQuery = await db.collection("venueProfiles").where("stripeCustomerId", "==", requestedCustomerId).limit(1).get();
        if (venueQuery.empty) return res.status(403).json({ error: "UNAUTHORIZED", message: "customerId not linked to a venue" });
        targetCustomerId = requestedCustomerId;
      }
    }
    if (!targetCustomerId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Stripe customer ID not found" });
    const paymentMethodUpdate = await stripe.paymentMethods.attach(paymentMethodId, { customer: targetCustomerId });
    const customerUpdate = await stripe.customers.update(targetCustomerId, { invoice_settings: { default_payment_method: paymentMethodId } });
    return res.json({ data: { success: true, paymentMethodUpdate, customerUpdate } });
  } catch (error) {
    console.error("Error saving payment method:", error);
    return res.status(500).json({ error: "INTERNAL", message: "Failed to save payment method" });
  }
}));

// POST /api/billing/setDefaultPaymentMethod
router.post("/setDefaultPaymentMethod", requireAuth, asyncHandler(async (req, res) => {
  const { paymentMethodId, customerId: requestedCustomerId } = req.body || {};
  const userId = req.auth.uid;
  if (!paymentMethodId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "paymentMethodId required" });
  const stripe = getStripe();
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User document not found" });
  const { stripeCustomerId } = userSnap.data() || {};
  const targetCustomerId = requestedCustomerId || stripeCustomerId;
  if (!targetCustomerId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Stripe customer ID not found" });
  const updatedCustomer = await stripe.customers.update(targetCustomerId, { invoice_settings: { default_payment_method: paymentMethodId } });
  return res.json({ data: { success: true, updatedCustomer } });
}));

// POST /api/billing/deleteCard
router.post("/deleteCard", requireAuth, asyncHandler(async (req, res) => {
  const { cardId, customerId: requestedCustomerId } = req.body || {};
  const userId = req.auth.uid;
  if (!cardId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "cardId required" });
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User doc not found" });
  const userCustomerId = userDoc.data()?.stripeCustomerId || null;
  const customerId = requestedCustomerId || userCustomerId;
  if (!customerId) return res.status(404).json({ error: "NOT_FOUND", message: "Stripe customer ID not found" });
  try {
    const stripe = getStripe();
    await stripe.paymentMethods.detach(cardId);
    return res.json({ data: { success: true } });
  } catch (error) {
    console.error("Error deleting card:", error);
    return res.status(500).json({ error: "INTERNAL", message: "Unable to delete the card" });
  }
}));

// POST /api/billing/getCustomerData
router.post("/getCustomerData", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.auth.uid;
  const { customerId: requestedCustomerId, include } = req.body || {};
  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  if (!userDoc.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User doc not found" });
  const userCustomerId = userDoc.data()?.stripeCustomerId || null;
  let scope = { type: "personal", canPay: true, canRead: true, canUpdate: true };
  let customerId = userCustomerId;
  if (requestedCustomerId && requestedCustomerId !== userCustomerId) {
    const venueQuery = await admin.firestore().collection("venueProfiles").where("stripeCustomerId", "==", requestedCustomerId).limit(1).get();
    if (venueQuery.empty) return res.status(403).json({ error: "PERMISSION_DENIED", message: "customerId not linked to a venue" });
    const venueSnap = venueQuery.docs[0];
    const venue = venueSnap.data() || {};
    const venueRef = venueSnap.ref;
    const isOwner = venue?.createdBy === userId || venue?.userId === userId;
    let canPay = isOwner, canRead = isOwner, canUpdate = isOwner;
    if (!isOwner) {
      const mSnap = await venueRef.collection("members").doc(userId).get();
      const m = mSnap.exists ? mSnap.data() : null;
      const active = !!m && m.status === "active";
      const perms = (m && m.permissions) ? m.permissions : {};
      if (active) {
        canPay    = !!perms["gigs.pay"];
        canRead   = !!perms["finances.read"];
        canUpdate = !!perms["finances.update"];
      } else { canPay = canRead = canUpdate = false; }
    }
    scope = { type: "venue", canPay, canRead, canUpdate };
    customerId = requestedCustomerId;
  }
  if (!customerId) return res.status(404).json({ error: "NOT_FOUND", message: "Stripe customer ID not found" });
  const needCustomer = include ? include.includes("customer") || include.includes("defaultPaymentMethod") || include.includes("paymentMethods") : true;
  const needPMs      = scope.type === "personal" ? true : scope.canUpdate && (include ? include.includes("paymentMethods") : true);
  const needDefault  = scope.type === "personal" ? true : scope.canPay && (include ? include.includes("defaultPaymentMethod") : true);
  const needReceipts = scope.type === "personal" ? true : scope.canRead && (include ? include.includes("receipts") : true);
  const stripe = getStripe();
  let customer = null, paymentMethods = [], defaultPaymentMethodId = null, defaultSourceId = null, receipts = [];
  if (needCustomer || needDefault) {
    customer = await stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method", "default_source"] });
    const defaultPm = customer?.invoice_settings?.default_payment_method || null;
    defaultPaymentMethodId = defaultPm ? defaultPm.id : null;
    defaultSourceId = customer?.default_source || null;
  }
  if (needPMs) {
    const pmList = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
    paymentMethods = pmList.data;
  }
  if (needReceipts) {
    const charges = await stripe.charges.list({ customer: customerId, limit: 100 });
    receipts = charges.data.filter(c => c.status === "succeeded" && c.receipt_url).sort((a, b) => (b.created || 0) - (a.created || 0));
  }
  if (scope.type === "venue") {
    if (!scope.canUpdate) paymentMethods = [];
    if (!scope.canRead) receipts = [];
    if (!scope.canPay) { defaultPaymentMethodId = null; defaultSourceId = null; }
  }
  return res.json({ data: { customer: needCustomer ? customer : { id: customerId }, receipts, paymentMethods, defaultPaymentMethodId, defaultSourceId, scope } });
}));

// POST /api/billing/deleteStripeConnectedAccount
router.post("/deleteStripeConnectedAccount", requireAuth, asyncHandler(async (req, res) => {
  const { musicianId } = req.body || {};
  if (!musicianId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "musicianId required" });
  const uid = req.auth.uid;
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
  const userData = userSnap.data() || {};
  const stripeConnectId = userData.stripeConnectId;
  
  // Legacy: check musicianProfile if no stripeConnectId on user
  let stripeAccountId = stripeConnectId;
  if (!stripeAccountId) {
  const musicRef = db.collection("musicianProfiles").doc(musicianId);
  const musicSnap = await musicRef.get();
  if (!musicSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Musician profile not found" });
    const { userId, stripeAccountId: legacyStripeAccountId } = musicSnap.data() || {};
    if (userId !== uid) return res.status(403).json({ error: "PERMISSION_DENIED" });
    stripeAccountId = legacyStripeAccountId;
  }
  
  if (!stripeAccountId) return res.json({ data: { success: true, message: "No Stripe account attached." } });
  const stripe = getStripe();
  const balance = await stripe.balance.retrieve({ stripeAccount: stripeAccountId });
  const availableTotal = (balance.available || []).reduce((sum, b) => sum + (b.amount || 0), 0);
  if (availableTotal > 0) return res.json({ data: { success: false, message: "Please withdraw your available balance before deleting your account." } });
  await stripe.accounts.del(stripeAccountId);
  
  // Update user document (new model)
  await userRef.update({ 
    stripeConnectId: admin.firestore.FieldValue.delete(),
    withdrawableEarnings: 0 
  });
  
  // Legacy: also update musicianProfile if it exists
  const musicRef = db.collection("musicianProfiles").doc(musicianId);
  const musicSnap = await musicRef.get();
  if (musicSnap.exists) {
    await musicRef.update({ 
      stripeAccountId: admin.firestore.FieldValue.delete(), 
      bankDetailsAdded: false 
    });
  }
  
  return res.json({ data: { success: true } });
}));

// POST /api/billing/getStripeBalance
router.post("/getStripeBalance", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
  const userData = userSnap.data() || {};
  
  // If user has Stripe Connect account, get balance from Stripe
  if (userData.stripeConnectId) {
    try {
      const stripe = getStripe();
      const balance = await stripe.balance.retrieve({ stripeAccount: userData.stripeConnectId });
      // Sum all available balances (can be multiple currencies)
      const availableTotal = (balance.available || []).reduce((sum, b) => sum + (b.amount || 0), 0);
      const availableTotalGBP = availableTotal / 100; // Convert from pence to pounds
      return res.json({ data: { withdrawableEarnings: availableTotalGBP, source: "stripe" } });
    } catch (error) {
      console.error("Error fetching Stripe balance:", error);
      // Fall back to user document if Stripe query fails
      const withdrawableEarnings = userData.withdrawableEarnings || 0;
      return res.json({ data: { withdrawableEarnings, source: "fallback" } });
    }
  }
  
  // If no Stripe account, return withdrawableEarnings from user document
  const withdrawableEarnings = userData.withdrawableEarnings || 0;
  return res.json({ data: { withdrawableEarnings, source: "user_document" } });
}));

// POST /api/billing/getConnectAccountStatus
router.post("/getConnectAccountStatus", requireAuth, asyncHandler(async (req, res) => {
  const uid = req.auth.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
  const userData = userSnap.data() || {};
  
  // Check for Stripe Connect account on user document (new structure)
  if (!userData.stripeConnectId) {
    return res.json({ data: { exists: false, status: "no_account", reason: "no_stripe_account" } });
  }
  
  const stripe = getStripe();
  const accountId = userData.stripeConnectId;
  const account = await stripe.accounts.retrieve(accountId);
  const reqs = account.requirements;
  const currentlyDueArr = reqs.currently_due;
  const pastDueArr = reqs.past_due;
  const pendingVerificationArr = reqs.pending_verification;
  const eventuallyDueArr = reqs.eventually_due;
  const disabledReason = reqs.disabled_reason;
  const verification = account.individual?.verification || {};
  const verificationStatus = verification.status;
  const verificationDetails = verification.details;
  const verificationCode = verification.details_code;
  let status = "all_good";
  if (pastDueArr.length > 0 || disabledReason || currentlyDueArr.length > 0) status = "urgent"; else if (verificationStatus === "unverified" || eventuallyDueArr.length > 0) status = "warning";
  const actions = Array.from(new Set([ ...currentlyDueArr, ...pastDueArr, ...pendingVerificationArr, ...eventuallyDueArr ]));
  const needsOnboarding = (currentlyDueArr.length > 0) || (pastDueArr.length > 0) || !account.details_submitted;
  let resolveUrl = null;
  if (status !== "all_good" || needsOnboarding) {
    const link = await stripe.accountLinks.create({ 
      account: accountId, 
      refresh_url: "https://giginmusic.com/account?show=payouts&retry=true", 
      return_url: "https://giginmusic.com/account?show=payouts&done=true", 
      type: needsOnboarding ? "account_onboarding" : "account_update" 
    });
    resolveUrl = link.url;
  }
  return res.json({ data: { exists: true, status, counts: { currentlyDue: currentlyDueArr.length, pastDue: pastDueArr.length, eventuallyDue: eventuallyDueArr.length }, payoutsEnabled: !!account.payouts_enabled, disabledReason, actions, verification: { status: verificationStatus, details: verificationDetails, code: verificationCode }, resolveUrl, raw: { detailsSubmitted: account.details_submitted, capabilities: account.capabilities } } });
}));

// POST /api/billing/transferFunds
router.post("/transferFunds", requireAuth, asyncHandler(async (req, res) => {
  const { connectedAccountId, amount } = req.body || {};
  if (!connectedAccountId || !amount) return res.status(400).json({ error: "INVALID_ARGUMENT" });
  const stripe = getStripe();
  try {
    const transfer = await stripe.transfers.create({ amount, currency: "gbp", destination: connectedAccountId });
    return res.json({ data: { success: true, transfer } });
  } catch (error) {
    console.error("Error transferring funds:", error);
    return res.status(500).json({ error: "INTERNAL", message: "Failed to transfer funds" });
  }
}));

// POST /api/billing/payoutToBankAccount
router.post("/payoutToBankAccount", requireAuth, asyncHandler(async (req, res) => {
  const { musicianId, amount } = req.body || {};
  if (!musicianId || !amount || amount <= 0) return res.status(400).json({ error: "INVALID_ARGUMENT" });
  const uid = req.auth.uid;
  const stripe = getStripe();
  
  // Get user document (new model)
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
  const userData = userSnap.data() || {};
  const stripeConnectId = userData.stripeConnectId;
  
  // Legacy: fallback to musicianProfile if no stripeConnectId on user
  let stripeAccountId = stripeConnectId;
  if (!stripeAccountId) {
  const musicianDoc = await admin.firestore().collection("musicianProfiles").doc(musicianId).get();
  if (!musicianDoc.exists) return res.status(404).json({ error: "NOT_FOUND", message: "Musician profile not found" });
  const musicianData = musicianDoc.data() || {};
    stripeAccountId = musicianData.stripeAccountId;
    if (!stripeAccountId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Stripe account ID not found" });
  }
  
  // Check available balance from Stripe (source of truth for users with Stripe accounts)
  if (stripeAccountId) {
    try {
      const balance = await stripe.balance.retrieve({ stripeAccount: stripeAccountId });
      const availableTotal = (balance.available || []).reduce((sum, b) => sum + (b.amount || 0), 0);
      const availableTotalGBP = availableTotal / 100; // Convert from pence to pounds
      
      if (availableTotalGBP < amount) {
        return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Insufficient balance in Stripe account" });
      }
    } catch (error) {
      console.error("Error checking Stripe balance:", error);
      return res.status(500).json({ error: "INTERNAL", message: "Failed to check Stripe balance" });
    }
  } else {
    // Fallback: check withdrawableEarnings from user document (for users without Stripe)
    const withdrawableEarnings = userData.withdrawableEarnings || 0;
    if (withdrawableEarnings < amount) {
      return res.status(400).json({ error: "INVALID_ARGUMENT", message: "Insufficient withdrawable earnings" });
    }
  }
  
  try {
    const payout = await stripe.payouts.create({ 
      amount: Math.round(amount * 100), 
      currency: "gbp", 
      metadata: { 
        userId: uid,
        musicianId, 
        description: "Payout of withdrawable funds" 
      } 
    }, { stripeAccount: stripeAccountId });
    
    // Record withdrawal in user document (for tracking, not for balance calculation)
    await userRef.update({ 
      withdrawals: FieldValue.arrayUnion({ 
        amount, 
        status: "complete", 
        timestamp: admin.firestore.Timestamp.now(), 
        stripePayoutId: payout.id 
      })
    });
    
    // Legacy: also update musicianProfile if it exists
    const musicianDoc = await admin.firestore().collection("musicianProfiles").doc(musicianId).get();
    if (musicianDoc.exists) {
      await admin.firestore().collection("musicianProfiles").doc(musicianId).update({ 
        withdrawals: FieldValue.arrayUnion({ 
          amount, 
          status: "complete", 
          timestamp: admin.firestore.Timestamp.now(), 
          stripePayoutId: payout.id 
        }) 
      });
    }
    
    return res.json({ data: { success: true, payoutId: payout.id } });
  } catch (error) {
    console.error("Error creating payout:", error);
    return res.status(500).json({ error: "INTERNAL", message: "Failed to create payout" });
  }
}));

// POST /api/billing/processRefund
router.post("/processRefund", requireAuth, asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.body || {};
  if (!paymentIntentId) return res.status(400).json({ error: "INVALID_ARGUMENT", message: "paymentIntentId required" });
  try {
    const stripe = getStripe();
    await stripe.refunds.create({ payment_intent: paymentIntentId });
    return res.json({ data: { success: true } });
  } catch (error) {
    console.error("Error processing refund:", error);
    return res.status(500).json({ error: "INTERNAL", message: `Failed to process refund: ${error.message}` });
  }
}));


