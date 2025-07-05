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
  setDoc
} from 'firebase/firestore';

/*** CREATE OPERATIONS ***/

/**
 * Creates or updates a venue profile in Firestore.
 *
 * @param {string} venueId - The Firestore document ID to use for the venue profile.
 * @param {Object} data - The profile data to set.
 * @param {string} userId - The user ID to associate with this profile.
 * @returns {Promise<void>}
 */
export const createVenueProfile = async (venueId, data, userId) => {
    try {
      const ref = doc(firestore, 'venueProfiles', venueId);
      await setDoc(ref, {
        ...data,
        userId,
      }, { merge: true });
    } catch (error) {
      console.error('Error creating venue profile:', error);
      throw error;
    }
  };

/*** READ OPERATIONS ***/

/**
 * Fetches a single venue profile document from Firestore using its document ID.
 *
 * @param {string} venueId - The Firestore document ID of the venue profile.
 * @returns {Promise<{ id: string, [key: string]: any } | null>} 
 * A Promise that resolves to an object containing the venue profile data 
 * (including its ID) if found, or `null` if the document does not exist.
 */
export const getVenueProfileById = async (venueId) => {
    const ref = doc(firestore, 'venueProfiles', venueId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Fetches all venue profiles associated with a specific user.
 *
 * @param {string} userId - The ID of the user who owns the venue profiles.
 * @returns {Promise<Array>} - An array of venue profile objects, each including its Firestore document reference.
 */
export const getVenueProfilesByUserId = async (userId) => {
    const q = query(
        collection(firestore, 'venueProfiles'),
        where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

/**
 * Sets up real-time listeners for templates belonging to the provided venue IDs.
 * Supports >10 IDs by batching `in` queries.
 *
 * @param {string[]} venueIds - List of venue IDs.
 * @param {function} onUpdate - Callback that receives the full merged template list.
 * @returns {function} - Call this function to unsubscribe all listeners.
 */
export const listenToTemplatesByVenueIds = (venueIds, onUpdate) => {
    if (!Array.isArray(venueIds) || venueIds.length === 0) return () => {};
    const chunkArray = (arr, size) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };
    const chunks = chunkArray(venueIds, 10);
    const unsubscribers = [];
    const allTemplatesMap = new Map();
    chunks.forEach((chunk) => {
      const templatesRef = collection(firestore, 'templates');
      const templatesQuery = query(templatesRef, where('venueId', 'in', chunk));
      const unsubscribe = onSnapshot(templatesQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
          const docData = change.doc.data();
          const docId = change.doc.id;
  
          if (change.type === 'removed') {
            allTemplatesMap.delete(docId);
          } else {
            allTemplatesMap.set(docId, docData);
          }
        });
        onUpdate(Array.from(allTemplatesMap.values()));
      });
      unsubscribers.push(unsubscribe);
    });
  
    return () => unsubscribers.forEach(unsub => unsub());
  };

  /*** UPDATE OPERATIONS ***/

/**
 * Updates the account name on all venue profile documents associated with a user.
 *
 * @param {string} userId - The UID of the user.
 * @param {string[]} venueProfileIds - Array of venue profile document IDs.
 * @param {string} newAccountName - The new account name to set.
 * @returns {Promise<void>} Resolves when the update is complete.
 * @throws Will throw an error if the update operation fails.
 */
export const updateVenueProfileAccountNames = async (userId, venueProfileIds, newAccountName) => {
  if (!userId || !venueProfileIds?.length || !newAccountName) return;

  const batch = writeBatch(db);

  venueProfileIds.forEach((profileId) => {
    const profileRef = doc(db, 'venueProfiles', profileId);
    batch.update(profileRef, { accountName: newAccountName });
  });

  await batch.commit();
};

/*** DELETE OPERATIONS ***/

/**
 * Deletes a venue profile from Firestore.
 *
 * @param {string} venueId - Firestore document ID of the venue profile to delete.
 * @returns {Promise<void>}
 */
export const deleteVenueProfile = async (venueId) => {
    try {
      const venueRef = doc(firestore, 'venueProfiles', venueId);
      await deleteDoc(venueRef);
    } catch (error) {
      console.error('Error deleting venue profile:', error);
      throw error;
    }
  };

/**
 * Removes a venueId from the venueProfiles array in a user document.
 *
 * @param {string} userId - Firestore document ID of the user.
 * @param {string} venueIdToRemove - The venueId to remove from the user's venueProfiles.
 * @returns {Promise<void>}
 */
export const removeVenueIdFromUser = async (userId, venueIdToRemove) => {
    try {
      const userRef = doc(firestore, 'users', userId);
      const userSnap = await getDoc(userRef);
  
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const updatedVenueProfiles = (userData.venueProfiles || []).filter(id => id !== venueIdToRemove);
        await updateDoc(userRef, { venueProfiles: updatedVenueProfiles });
      } else {
        console.warn(`User document not found for ID: ${userId}`);
      }
    } catch (error) {
      console.error('Error removing venueId from user document:', error);
      throw error;
    }
};

/**
 * Removes a gig ID from the gigs array in a venue's profile.
 *
 * @param {string} venueId - Firestore document ID of the venue.
 * @param {string} gigId - ID of the gig to remove.
 * @returns {Promise<void>}
 */
export const removeGigFromVenue = async (venueId, gigId) => {
    const ref = doc(firestore, 'venueProfiles', venueId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const updated = (snap.data().gigs || []).filter(id => id !== gigId);
      await updateDoc(ref, { gigs: updated });
    }
};

/**
 * Deletes all templates associated with a specific venue ID.
 *
 * @param {string} venueId - The Firestore document ID of the venue.
 * @returns {Promise<void>}
 */
export const deleteTemplatesByVenueId = async (venueId) => {
    try {
      const templatesQuery = query(
        collection(firestore, 'templates'),
        where('venueId', '==', venueId)
      );
      const templatesSnapshot = await getDocs(templatesQuery);
  
      const deletionPromises = templatesSnapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletionPromises);
    } catch (error) {
      console.error('Error deleting templates for venue:', error);
      throw error;
    }
  };



