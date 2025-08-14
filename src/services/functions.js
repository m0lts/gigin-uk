import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

/**
 * Fetch saved payment methods for the current user.
 * @returns {Promise<Object[]>}
 */
export const fetchSavedCards = async () => {
  const getSavedCards = httpsCallable(functions, 'getSavedCards');
  const response = await getSavedCards();
  return response.data.paymentMethods;
};

/**
 * Confirms payment for a gig using a saved card.
 * @param {Object} options
 * @param {string} options.cardId - The Stripe payment method ID.
 * @param {Object} options.gigData - The full gig object.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const confirmGigPayment = async ({ cardId, gigData }) => {
    if (!gigData?.agreedFee) throw new Error('Missing agreed fee');
    let amount = typeof gigData.agreedFee === 'string'
      ? parseFloat(gigData.agreedFee.replace('£', ''))
      : gigData.agreedFee;
    const amountToCharge = Math.round(amount * 1.05 * 100);
    const gigDate = gigData.date.toDate();
    const confirmPayment = httpsCallable(functions, 'confirmPayment');
    const response = await confirmPayment({
      paymentMethodId: cardId,
      amountToCharge,
      gigData,
      gigDate,
    });
    return response.data;
  };

/**
 * Triggers a payout to a musician's connected bank account.
 * @param {string} musicianId
 * @param {number} amount - Amount in decimal (not cents)
 * @returns {Promise<boolean>} - Returns true if successful
 */
export const payoutToBankAccount = async (musicianId, amount) => {
    if (!musicianId || !amount || amount <= 0) {
      throw new Error('Invalid payout parameters.');
    }
  
    const payoutFunction = httpsCallable(functions, 'payoutToBankAccount');
    const response = await payoutFunction({
      musicianId,
      amount,
    });
  
    return response.data.success || false;
};

/**
 * Transfers funds to a Stripe connected account.
 * @param {string} connectedAccountId
 * @param {number} amountInCents
 * @returns {Promise<boolean>}
 */
export const transferStripeFunds = async (connectedAccountId, amountInCents) => {
    const transferFunds = httpsCallable(functions, 'transferFunds');
    const result = await transferFunds({ connectedAccountId, amount: amountInCents });
    return result.data.success || false;
  };

/**
 * Creates a Stripe payment method using the card element and billing details.
 * @param {Stripe} stripe - Stripe instance
 * @param {CardNumberElement} cardElement - Card element from Stripe Elements
 * @param {string} name - Cardholder's name
 * @param {object} address - Billing address object
 * @returns {Promise<object>} - Returns a formatted payment method or throws
 */
export const createStripePaymentMethod = async (stripe, cardElement, name, address) => {
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name,
        address,
      },
    });
  
    if (error) throw error;
  
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
 * Saves a Stripe payment method via Firebase Callable Function.
 * @param {string} paymentMethodId - Stripe payment method ID
 * @returns {Promise<boolean>} - Returns true if successful
 */
export const saveStripePaymentMethod = async (paymentMethodId) => {
    const savePaymentMethod = httpsCallable(functions, 'savePaymentMethod');
    const response = await savePaymentMethod({ paymentMethodId });
    return response;
};

/**
 * Delete a saved card by its ID.
 * @param {string} cardId
 * @returns {Promise<Object>}
 */
export const deleteSavedCard = async (cardId) => {
  const deleteCard = httpsCallable(functions, 'deleteCard');
  const response = await deleteCard({ cardId });
  return response.data;
};

/**
 * Change default card by its ID.
 * @param {string} cardId
 * @returns {Promise<Object>}
 */
export const changeDefaultCard = async (cardId) => {
  const defaultCard = httpsCallable(functions, 'setDefaultPaymentMethod');
  const response = await defaultCard({ paymentMethodId: cardId });
  return response.data;
};

/**
 * Get Stripe customer info, receipts, and saved payment methods.
 * @returns {Promise<{ customer: Object, receipts: Object[], paymentMethods: Object[] }>}
 */
export const fetchCustomerData = async () => {
  const getCustomerData = httpsCallable(functions, 'getCustomerData');
  const response = await getCustomerData();
  return response.data;
};

/**
 * Initiates payout for a musician.
 * @param {string} musicianId
 * @param {number} amount
 * @returns {Promise<Object>}
 */
export const requestPayout = async (musicianId, amount) => {
  const payoutToBank = httpsCallable(functions, 'payoutToBankAccount');
  const response = await payoutToBank({ musicianId, amount });
  return response.data;
};

/**
 * Cancels a scheduled Cloud Task by task name.
 * @param {string} taskName - The name of the task to cancel.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export const cancelTask = async (taskName) => {
    try {
      const cancelCloudTask = httpsCallable(functions, 'cancelCloudTask');
      const result = await cancelCloudTask({ taskName });
      return result.data?.success || false;
    } catch (error) {
      console.error('Failed to cancel task:', error);
      return false;
    }
  };

/**
 * Cancels scheduled tasks and processes a refund for a given gig.
 * @param {Object} options
 * @param {string[]} options.taskNames - Array of Cloud Task names to cancel.
 * @param {string} options.transactionId - The transaction ID to refund.
 * @returns {Promise<void>}
 */
export const cancelGigAndRefund = async ({ taskNames, transactionId }) => {
    const cancelCloudTask = httpsCallable(functions, 'cancelCloudTask');
    const processRefund = httpsCallable(functions, 'processRefund');
  
    for (const taskName of taskNames) {
      if (taskName) {
        await cancelCloudTask({ taskName });
      }
    }
  
    if (transactionId) {
      await processRefund({ transactionId });
    }
};

/**
 * Delete a Stripe Connect account for a musicianId.
 * Will fail if the connected account has a positive available balance.
 * @param {string} musicianId
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const deleteStripeConnectAccount = async (musicianId) => {
  const fn = httpsCallable(functions, 'deleteStripeConnectedAccount');
  const res = await fn({musicianId});
  return res.data;
};

/** Get status for a Stripe Connect account. */
export const getConnectAccountStatus = async () => {
  const fn = httpsCallable(functions, 'getConnectAccountStatus');
  const { data } = await fn();
  return data;
};