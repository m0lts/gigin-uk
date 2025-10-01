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
  orderBy
} from 'firebase/firestore';

/*** CREATE OPERATIONS ***/

/**
 * Submits user feedback to the Firestore `feedback` collection.
 *
 * @param {Object} feedback - The feedback object, must include `scale` and `feedback` properties.
 * @returns {Promise<void>}
 */
export const submitUserFeedback = async (feedback) => {
  try {
    const feedbackRef = collection(firestore, 'feedback');
    await addDoc(feedbackRef, {
      ...feedback,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('[Firestore Error] submitUserFeedback:', error);
  }
  };