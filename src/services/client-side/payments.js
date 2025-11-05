import { firestore } from '@lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  orderBy,
  arrayRemove,
  limit
} from 'firebase/firestore';
import { fetchCustomerData } from '@services/api/payments';


/*** READ OPERATIONS ***/

export const fetchStripeCustomerData = async () => {
  try {
    const { customer, receipts = [], paymentMethods = [], defaultPaymentMethodId, defaultSourceId } =
      await fetchCustomerData();
    const savedCards = paymentMethods.map(pm => ({
      ...pm,
      default: pm.id === defaultPaymentMethodId
    }));
    savedCards.sort((a, b) => (b.default === a.default ? 0 : b.default ? 1 : -1));
    return {
      customerDetails: customer,
      savedCards,
      receipts: receipts.filter(r => r?.metadata?.gigId),
      defaultPaymentMethodId,
      defaultSourceId
    };
  } catch (error) {
    console.error('[Firestore Error] fetchStripeCustomerData:', error);
  }
};

/**
 * Listen for real-time updates to a payment's status in Firestore.
 * 
 * This function subscribes to changes on the `payments/{paymentIntentId}` document.
 * When the status field changes, it calls the provided callback with the new status.
 * 
 * @param {string} paymentIntentId - The Stripe PaymentIntent ID to listen for.
 * @param {(status: 'processing' | 'succeeded' | 'failed', data: object) => void} callback 
 *        Function to run when the payment status changes. Receives the status string and full document data.
 * @returns {Function} Unsubscribe function to stop listening for changes.
 * 
 * @example
 * const unsubscribe = listenToPaymentStatus('pi_123456', (status, data) => {
 *   console.log('Payment status:', status);
 *   if (status === 'succeeded') {
 *     // Show success UI
 *   }
 * });
 * 
 * // Later...
 * unsubscribe();
 */
export const listenToPaymentStatus = (paymentIntentId, callback) => {
  try {
    if (!paymentIntentId) {
      console.warn('listenToPaymentStatus called without a paymentIntentId');
      return () => {};
    }
    const ref = doc(firestore, 'payments', paymentIntentId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        console.warn(`No payment document found for ${paymentIntentId}`);
        return;
      }
      const data = snap.data();
      callback(data.status, data);
    }, (err) => {
      console.error('Error listening to payment status:', err);
    });
  } catch (error) {
    console.error('[Firestore Error] listenToPaymentStatus:', error);
  }
};
