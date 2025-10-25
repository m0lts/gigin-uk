import { firestore } from '@lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
} from 'firebase/firestore';

/*** CREATE OPERATIONS ***/

/**
 * Submits a testimonial for a musician.
 *
 * @param {string} musicianId - The ID of the musician the testimonial is for.
 * @param {Object} data - The testimonial content.
 * @param {string} data.title - The testimonial title.
 * @param {string} data.message - The testimonial message.
 * @returns {Promise<void>}
 */
export const submitTestimonial = async (musicianId, { title, message }) => {
  try {
    if (!title.trim() || !message.trim()) {
      throw new Error('Both title and message are required.');
    }
    const testimonialRef = collection(firestore, 'testimonials');
    await addDoc(testimonialRef, {
      musicianId,
      testimonial: {
        title,
        message,
        submittedAt: Timestamp.now()
      }
    });
  } catch (error) {
    console.error('[Firestore Error] submitTestimonial:', error);
  }
};

/*** READ OPERATIONS ***/

/**
 * Fetches all reviews associated with a specific venue ID.
 *
 * @param {string} venueId - The Firestore document ID of the venue.
 * @returns {Promise<Array<Object>>} An array of review documents (`{ id, ref, ...data }`).
 */
export const getReviewsByVenueId = async (venueId) => {
  try {
    const q = query(collection(firestore, 'reviews'), where('venueId', '==', venueId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getReviewsByVenueId:', error);
  }
};

/**
 * Fetches all reviews associated with an array of venue IDs.
 *
 * @param {string[]} venueIds - An array of venue document IDs.
 * @returns {Promise<Array<Object>>} An array of review documents (`{ id, ref, ...data }`).
 */
export const getReviewsByVenueIds = async (venueIds) => {
  try {
    if (!venueIds.length) return [];
    const q = query(collection(firestore, 'reviews'), where('venueId', 'in', venueIds));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getReviewsByVenueIds:', error);
  }
};

/**
 * Fetches all reviews associated with a specific musician ID.
 *
 * @param {string} musicianId - The Firestore document ID of the musician.
 * @returns {Promise<Array<Object>>} An array of review documents (`{ id, ref, ...data }`).
 */
export const getReviewsByMusicianId = async (musicianId) => {
  try {
    const q = query(collection(firestore, 'reviews'), where('musicianId', '==', musicianId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getReviewsByMusicianId:', error);
  }
};
