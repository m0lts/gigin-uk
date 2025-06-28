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

