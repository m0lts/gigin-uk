import { firestore } from '@lib/firebase';
import {
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';

/*** READ OPERATIONS ***/

/**
 * Retrieves a user document from Firestore using the Firebase Auth user ID.
 *
 * @param {string} userId - The UID of the user in Firebase Authentication.
 * @returns {Promise<Object|null>} - An object containing the user document's ID, Firestore reference, and data; or `null` if the document doesn't exist.
 */
export const getUserById = async (userId) => {
  const userRef = doc(firestore, 'users', userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/*** UPDATE OPERATIONS ***/
/**
 * Updates a user document in Firestore.
 *
 * @param {string} userId - The ID of the user.
 * @param {Object} data - The data to update on the user document.
 * @returns {Promise<void>}
 */
export const updateUserDocument = async (userId, data) => {
  try {
    const userRef = doc(firestore, 'users', userId);
    await updateDoc(userRef, data);
  } catch (error) {
    console.error('Error updating user document:', error);
    throw error;
  }
};