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
  arrayRemove
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

