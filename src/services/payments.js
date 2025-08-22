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
import { fetchCustomerData } from '@services/functions';


/*** READ OPERATIONS ***/

export const fetchStripeCustomerData = async () => {
  const { customer, receipts = [], paymentMethods = [], defaultPaymentMethodId, defaultSourceId } =
    await fetchCustomerData();

  // Mark default and keep original fields intact
  const savedCards = paymentMethods.map(pm => ({
    ...pm,
    default: pm.id === defaultPaymentMethodId
  }));

  // (Optional) put default first
  savedCards.sort((a, b) => (b.default === a.default ? 0 : b.default ? 1 : -1));

  return {
    customerDetails: customer,
    savedCards,
    receipts: receipts.filter(r => r?.metadata?.gigId),
    defaultPaymentMethodId,
    defaultSourceId
  };
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
};


/*** UPDATE OPERATIONS ***/

/**
 * Clears musician's balance after fees have been transferred to stripe account.
 *
 * @param {string} musicianId - Musician profile ID.
 * @returns {Promise<boolean>} - Whether the transfer was successful.
 */
export const clearMusicianBalance = async (musicianId) => {
    const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
    await updateDoc(musicianRef, { withdrawableFunds: 0 });
};

/**
	•	Find the pending fee doc for a gig under a musician profile.
	•	Looks up: musicianProfiles/{musicianId}/pendingFees where gigId == {gigId}
	•	@param {string} musicianId
	•	@param {string} gigId
	•	@returns {Promise<{docId: string, data: object} | null>}
*/
export const findPendingFeeByGigId = async (musicianId, gigId) => {
  const colRef = collection(firestore, 'musicianProfiles', musicianId, 'pendingFees');
  const q = query(colRef, where('gigId', '==', gigId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
    const d = snap.docs[0];
    return { docId: d.id, data: d.data() };
  };
  
/**
  •	Mark a pending fee as “in dispute” and clear its clearing time.
  •	@param {string} musicianId
  •	@param {string} docId - pendingFees document ID (typically the PaymentIntent id)
  •	@param {object} updates - extra fields to write (e.g., { disputeReason, details })
  •	@returns {Promise}
*/
export const markPendingFeeInDispute = async (musicianId, docId, updates = {}) => {
    const ref = doc(firestore, 'musicianProfiles', musicianId, 'pendingFees', docId);
    await updateDoc(ref, {
      disputeLogged: true,
      status: 'in dispute',
      disputeClearingTime: null,
      ...updates,
    });
};