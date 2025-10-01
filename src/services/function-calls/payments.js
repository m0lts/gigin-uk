import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

/**
 * Fetch saved payment methods for the current user.
 * @returns {Promise<Object[]>}
 */
export const fetchSavedCards = async () => {
  try {
    const getSavedCards = httpsCallable(functions, "getSavedCards");
    const { data } = await getSavedCards();
    return data?.paymentMethods ?? [];
  } catch (error) {
    console.error("[CloudFn Error] fetchSavedCards:", error);
  }
};

/**
 * Confirms payment for a gig using a saved card.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const confirmGigPayment = async ({ cardId, gigData, musicianProfileId, customerId }) => {
  try {
    if (!gigData?.agreedFee) throw new Error("Missing agreed fee");
    const amount =
      typeof gigData.agreedFee === "string"
        ? parseFloat(gigData.agreedFee.replace("£", ""))
        : gigData.agreedFee;
    const amountToCharge = Math.round(amount * 1.0 * 100);
    const gigDate = gigData.startDateTime.toDate();

    const confirmPayment = httpsCallable(functions, "confirmPayment");
    const { data } = await confirmPayment({
      paymentMethodId: cardId,
      amountToCharge,
      gigData,
      gigDate,
      musicianProfileId,
      customerId,
    });
    return data;
  } catch (error) {
    console.error("[CloudFn Error] confirmGigPayment:", error);
  }
};

/**
 * Creates a PaymentIntent for a gig.
 * @returns {Promise<any>} underlying callable response.data
 */
export const confirmPaymentIntent = async ({ amountToCharge, gigData, musicianProfileId, customerId }) => {
  try {
    if (!amountToCharge) throw new Error("Missing agreed fee");
    const gigDate = gigData.startDateTime.toDate();

    const createPI = httpsCallable(functions, "createGigPaymentIntent");
    const { data } = await createPI({
      amountToCharge,
      gigData,
      gigDate,
      musicianProfileId,
      customerId,
    });
    return data;
  } catch (error) {
    console.error("[CloudFn Error] confirmPaymentIntent:", error);
  }
};

/**
 * Triggers a payout to a musician's connected bank account.
 * @returns {Promise<boolean>}
 */
export const payoutToBankAccount = async (musicianId, amount) => {
  try {
    if (!musicianId || !amount || amount <= 0) {
      throw new Error("Invalid payout parameters.");
    }
    const payoutFunction = httpsCallable(functions, "payoutToBankAccount");
    const { data } = await payoutFunction({ musicianId, amount });
    return data?.success || false;
  } catch (error) {
    console.error("[CloudFn Error] payoutToBankAccount:", error);
  }
};

/**
 * Transfers funds to a Stripe connected account.
 * @returns {Promise<boolean>}
 */
export const transferStripeFunds = async (connectedAccountId, amountInCents) => {
  try {
    const transferFunds = httpsCallable(functions, "transferFunds");
    const { data } = await transferFunds({ connectedAccountId, amount: amountInCents });
    return data?.success || false;
  } catch (error) {
    console.error("[CloudFn Error] transferStripeFunds:", error);
  }
};

/**
 * Creates a Stripe payment method using the card element and billing details.
 * (Client-side via Stripe.js; throws on error.)
 */
export const createStripePaymentMethod = async (stripe, cardElement, name, address) => {
  const { error, paymentMethod } = await stripe.createPaymentMethod({
    type: "card",
    card: cardElement,
    billing_details: { name, address },
  });
  if (error) {
    console.error("[Stripe.js Error] createStripePaymentMethod:", error);
  }
  return {
    id: paymentMethod.id,
    card: {
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      exp_month: paymentMethod.card.exp_month,
      exp_year: paymentMethod.card.exp_year,
    },
    billing_details: {
      name: paymentMethod.billing_details.name,
      address: paymentMethod.billing_details.address,
    },
  };
};

/**
 * Saves a Stripe payment method via callable.
 * @returns {Promise<any>} response.data
 */
export const saveStripePaymentMethod = async (paymentMethodId, customerId) => {
  try {
    const savePaymentMethod = httpsCallable(functions, "savePaymentMethod");
    const { data } = await savePaymentMethod({ paymentMethodId, customerId });
    return data;
  } catch (error) {
    console.error("[CloudFn Error] saveStripePaymentMethod:", error);
  }
};

/**
 * Delete a saved card by its ID.
 * @returns {Promise<Object>}
 */
export const deleteSavedCard = async (cardId, customerId) => {
  try {
    const deleteCard = httpsCallable(functions, "deleteCard");
    const { data } = await deleteCard({ cardId, customerId });
    return data;
  } catch (error) {
    console.error("[CloudFn Error] deleteSavedCard:", error);
  }
};

/**
 * Change default card by its ID.
 * @returns {Promise<Object>}
 */
export const changeDefaultCard = async (cardId, customerId) => {
  try {
    const setDefault = httpsCallable(functions, "setDefaultPaymentMethod");
    const { data } = await setDefault({ paymentMethodId: cardId, customerId });
    return data;
  } catch (error) {
    console.error("[CloudFn Error] changeDefaultCard:", error);
  }
};

/**
 * Get Stripe customer info, receipts, and saved payment methods.
 * Optionally pass { customerId } to query a specific ID.
 */
export const fetchCustomerData = async (customerId) => {
  try {
    const getCustomerData = httpsCallable(functions, "getCustomerData");
    const { data } = await getCustomerData(customerId ? { customerId } : {});
    return data;
  } catch (error) {
    console.error("[CloudFn Error] fetchCustomerData:", error);
  }
};

/**
 * Delete a Stripe Connect account for a musicianId.
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const deleteStripeConnectAccount = async (musicianId) => {
  try {
    const fn = httpsCallable(functions, "deleteStripeConnectedAccount");
    const { data } = await fn({ musicianId });
    return data;
  } catch (error) {
    console.error("[CloudFn Error] deleteStripeConnectAccount:", error);
  }
};

/**
 * Get status for a Stripe Connect account.
 * @returns {Promise<any>}
 */
export const getConnectAccountStatus = async () => {
  try {
    const fn = httpsCallable(functions, "getConnectAccountStatus");
    const { data } = await fn();
    return data;
  } catch (error) {
    console.error("[CloudFn Error] getConnectAccountStatus:", error);
  }
};