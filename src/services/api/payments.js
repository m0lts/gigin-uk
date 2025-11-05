import { post } from '../http';
import { cancelTask } from './tasks';

export async function fetchSavedCards() {
  const data = await post('/billing/getSavedCards');
  return data?.paymentMethods ?? [];
}

export async function confirmGigPayment({ cardId, gigData, musicianProfileId, customerId }) {
  if (!gigData?.agreedFee) throw new Error('Missing agreed fee');
  const amount = typeof gigData.agreedFee === 'string' ? parseFloat(gigData.agreedFee.replace('£', '')) : gigData.agreedFee;
  const amountToCharge = Math.round(amount * 100);
  const gigDate = gigData.startDateTime.toDate();
  const payload = { paymentMethodId: cardId, amountToCharge, gigData, gigDate, musicianProfileId, customerId };
  return await post('/billing/confirmPayment', { body: payload });
}

export async function confirmPaymentIntent({ amountToCharge, gigData, musicianProfileId, customerId }) {
  const gigDate = gigData.startDateTime.toDate();
  const payload = { amountToCharge, gigData, gigDate, musicianProfileId, customerId };
  return await post('/billing/createGigPaymentIntent', { body: payload });
}

export async function deleteSavedCard({ cardId, customerId }) {
  return await post('/billing/deleteCard', { body: { cardId, customerId } });
}

export async function changeDefaultCard({ cardId, customerId }) {
  return await post('/billing/setDefaultPaymentMethod', { body: { paymentMethodId: cardId, customerId } });
}

export async function saveStripePaymentMethod({ paymentMethodId, customerId }) {
  return await post('/billing/savePaymentMethod', { body: { paymentMethodId, customerId } });
}

export async function fetchCustomerData({ customerId } = {}) {
  return await post('/billing/getCustomerData', { body: customerId ? { customerId } : {} });
}

export async function deleteStripeConnectAccount({ musicianId }) {
  return await post('/billing/deleteStripeConnectedAccount', { body: { musicianId } });
}

export async function getConnectAccountStatus() {
  return await post('/billing/getConnectAccountStatus');
}

export async function transferStripeFunds({ connectedAccountId, amount }) {
  return await post('/billing/transferFunds', { body: { connectedAccountId, amount } });
}

export async function payoutToBankAccount({ musicianId, amount }) {
  return await post('/billing/payoutToBankAccount', { body: { musicianId, amount } });
}

export async function processRefund({ paymentIntentId }) {
  return await post('/billing/processRefund', { body: { paymentIntentId } });
}

export async function cancelGigAndRefund({ taskNames, transactionId, gigId, venueId }) {
  try {
    for (const taskName of taskNames) {
      if (taskName) {
        await cancelTask({ taskName, gigId, venueId });
      }
    }
    if (transactionId) {
      await processRefund({ paymentIntentId: transactionId });
    }
    return { success: true };
  } catch (error) {
    console.error("[CloudFn Error] cancelGigAndRefund:", error);
  }
};
