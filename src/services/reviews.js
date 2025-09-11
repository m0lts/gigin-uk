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
  arrayUnion
} from 'firebase/firestore';
import { incrementRating } from '@services/utils/misc';

/*** CREATE OPERATIONS ***/

/**
 * Submits a review to the Firestore database and updates the relevant profiles and gig.
 *
 * @param {Object} params
 * @param {'venue'|'musician'} params.reviewer - Who is submitting the review.
 * @param {string} params.musicianId - Musician's Firestore document ID.
 * @param {string} params.venueId - Venue's Firestore document ID.
 * @param {string} params.gigId - Gig's Firestore document ID.
 * @param {number} params.rating - Rating score.
 * @param {string|null} params.reviewText - Optional review message.
 * @param {Object} params.profile - The reviewee's profile data (used to calculate avg).
 * @returns {Promise<string>} - Returns the ID of the submitted review document.
 */
export const submitReview = async ({
  reviewer,
  musicianId,
  venueId,
  gigId,
  rating,        // now "positive" | "negative"
  reviewText,
  profile,
}) => {
  const reviewData = {
    musicianId,
    venueId,
    gigId,
    reviewWrittenBy: reviewer,
    rating, // store raw "positive"/"negative"
    reviewText: reviewText?.trim() || null,
    timestamp: Timestamp.now(),
  };

  const reviewRef = await addDoc(collection(firestore, 'reviews'), reviewData);
  const reviewId = reviewRef.id;

  // ensure profile.avgReviews has sane defaults
  const currentStats = profile?.avgReviews || {
    totalReviews: 0,
    positive: 0,
    negative: 0,
  };

  const updatedStats = {
    totalReviews: currentStats.totalReviews + 1,
    positive: currentStats.positive + (rating === "positive" ? 1 : 0),
    negative: currentStats.negative + (rating === "negative" ? 1 : 0),
  };

  if (reviewer === 'venue') {
    await updateDoc(doc(firestore, 'musicianProfiles', musicianId), {
      reviews: arrayUnion(reviewId),
      avgReviews: updatedStats,
    });
    await updateDoc(doc(firestore, 'gigs', gigId), {
      venueHasReviewed: true,
    });
  } else if (reviewer === 'musician') {
    await updateDoc(doc(firestore, 'venueProfiles', venueId), {
      reviews: arrayUnion(reviewId),
      avgReviews: updatedStats,
    });
    await updateDoc(doc(firestore, 'gigs', gigId), {
      musicianHasReviewed: true,
    });
  }

  return reviewId;
};

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
};

/**
 * Logs a new dispute in Firestore.
 *
 * @param {Object} disputeDetails - Dispute object containing required metadata.
 * @returns {Promise<DocumentReference>} - The created dispute document reference.
 */
export const logDispute = async (disputeDetails) => {
    const disputeRef = collection(firestore, 'disputes');
    return await addDoc(disputeRef, disputeDetails);
};

/*** READ OPERATIONS ***/

/**
 * Fetches all reviews associated with a specific venue ID.
 *
 * @param {string} venueId - The Firestore document ID of the venue.
 * @returns {Promise<Array<Object>>} An array of review documents (`{ id, ref, ...data }`).
 */
export const getReviewsByVenueId = async (venueId) => {
    const q = query(collection(firestore, 'reviews'), where('venueId', '==', venueId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

/**
 * Fetches all reviews associated with an array of venue IDs.
 *
 * @param {string[]} venueIds - An array of venue document IDs.
 * @returns {Promise<Array<Object>>} An array of review documents (`{ id, ref, ...data }`).
 */
export const getReviewsByVenueIds = async (venueIds) => {
    if (!venueIds.length) return [];
    const q = query(collection(firestore, 'reviews'), where('venueId', 'in', venueIds));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

/**
 * Fetches all reviews associated with a specific musician ID.
 *
 * @param {string} musicianId - The Firestore document ID of the musician.
 * @returns {Promise<Array<Object>>} An array of review documents (`{ id, ref, ...data }`).
 */
export const getReviewsByMusicianId = async (musicianId) => {
    const q = query(collection(firestore, 'reviews'), where('musicianId', '==', musicianId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Fetches all reviews written for a profile (musician or venue) from the Firestore.
 *
 * @param {'musician' | 'venue'} profileType - Type of profile ('musician' or 'venue').
 * @param {string} profileId - The ID of the musician or venue.
 * @returns {Promise<Array>} An array of enriched review objects.
 */
export const fetchProfileReviews = async (profileId, profileType, writtenBy) => {
    try {
      const isMusician = profileType === 'musician';
      const reviewsRef = collection(firestore, 'reviews');
      const q = query(
        reviewsRef,
        where(isMusician ? 'musicianId' : 'venueId', '==', profileId),
        where('reviewWrittenBy', '==', writtenBy === 'venue' ? 'venue' : 'musician')
      );
      const querySnapshot = await getDocs(q);
      const enrichedReviews = await Promise.all(
        querySnapshot.docs.map(async (reviewDoc) => {
          const reviewData = { id: reviewDoc.id, ...reviewDoc.data() };
          const reviewerId = isMusician ? reviewData.venueId : reviewData.musicianId;
          if (reviewerId) {
            const profileRef = doc(
              firestore,
              isMusician ? 'venueProfiles' : 'musicianProfiles',
              reviewerId
            );
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
              reviewData.reviewer = { id: profileSnap.id, ...profileSnap.data() };
            } else {
              console.warn(`Reviewer not found for ID: ${reviewerId}`);
            }
          }
          return reviewData;
        })
      );
      return enrichedReviews;
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }
  };
  
  /**
   * Fetches testimonials for a musician profile.
   *
   * @param {string} musicianId - The musician ID.
   * @returns {Promise<Array>} An array of testimonial objects.
   */
  export const fetchMusicianTestimonials = async (musicianId) => {
    try {
      const testimonialsRef = collection(firestore, 'testimonials');
      const q = query(testimonialsRef, where('musicianId', '==', musicianId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching testimonials:', error);
      return [];
    }
  };

/*** DELETE OPERATIONS ***/

/**
 * Deletes a review from Firestore.
 *
 * @param {string} reviewId - Firestore document ID of the review to delete.
 * @returns {Promise<void>}
 */
export const deleteReview = async (reviewId) => {
    try {
      const reviewRef = doc(firestore, 'reviews', reviewId);
      await deleteDoc(reviewRef);
    } catch (error) {
      console.error('Error deleting review profile:', error);
      throw error;
    }
  };