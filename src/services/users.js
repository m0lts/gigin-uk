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
  deleteField
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
    return snap.exists() ? { id: snap.id, ref: userRef, ...snap.data() } : null;
};

/**
 * Looks up a user by email (case-sensitive by default).
 * @param {string} email
 * @returns {Promise<{id:string, data:object} | null>}
 */
export async function getUserByEmail(email) {
  const q = query(collection(firestore, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}


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

/*** DELETE OPERATIONS ***/

/**
 * Deletes a user document from Firestore.
 *
 * @param {string} userId - Firestore document ID of the user profile to delete.
 * @returns {Promise<void>}
 */
export const deleteUserDocument = async (userId) => {
  try {
    const userRef = doc(firestore, 'users', userId);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
};

/**
 * Deletes a musician document reference from the user document in Firestore.
 *
 * @param {string} userId - Firestore document ID of the user profile to delete.
 * @returns {Promise<void>}
 */
export const deleteMusicianProfileInUserDocument = async (userId) => {
  try {
    const userRef = doc(firestore, 'users', userId);
    await updateDoc(userRef, { musicianProfile: deleteField() });
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
};