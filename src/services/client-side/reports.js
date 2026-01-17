import { firestore } from '@lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  orderBy,
  increment
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

/**
 * Increments the proClicks counter in the system collection metadata document.
 * Creates the document if it doesn't exist.
 * @returns {Promise<void>}
 */
export const incrementProClicks = async () => {
  try {
    const metadataRef = doc(firestore, 'system', 'metadata');
    const metadataSnap = await getDoc(metadataRef);
    
    if (!metadataSnap.exists()) {
      // Create the document with proClicks: 0 if it doesn't exist
      await setDoc(metadataRef, {
        proClicks: 0
      });
    }
    
    // Now increment it
    await updateDoc(metadataRef, {
      proClicks: increment(1)
    });
  } catch (error) {
    console.error('[Firestore Error] incrementProClicks:', error);
  }
};