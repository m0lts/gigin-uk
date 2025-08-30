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
  setDoc,
  runTransaction,
  GeoPoint
} from 'firebase/firestore';
import { updateVenueGigsAccountName } from './gigs';
import { rewriteVenueConversationsAndMessages } from './conversations';
import { distanceBetween } from 'geofire-common';

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
 * Fetches venues near the specified location from Firestore using a geobounding query,
 * then filters by precise radius and sorts by distance.
 *
 * @param {Object} options
 * @param {{ latitude: number, longitude: number }} options.location - Center point
 * @param {number} [options.radiusInKm=50]
 * @param {number} [options.limitCount=50]
 * @param {import('firebase/firestore').QueryDocumentSnapshot} [options.lastDoc]
 * @param {Object} [filters]
 * @param {string} [filters.status] - e.g. 'active'
 * @param {string[]} [filters.genres] - optional: if you tag venues with genres
 * @param {number} [filters.minBudget] - optional: if venues store a budgetValue
 * @param {number} [filters.maxBudget]
 * @returns {Promise<{ venues: Array<Object>, lastVisible: import('firebase/firestore').QueryDocumentSnapshot | null }>}
 */
export const fetchNearbyVenues = async ({
  location,
  radiusInKm = 50,
  limitCount = 50,
  lastDoc = null,
}) => {
  const center = [location.latitude, location.longitude];
  const lat = location.latitude;
  const lng = location.longitude;
  const latDelta = radiusInKm / 111;
  const lngDelta = radiusInKm / (111 * Math.cos((lat * Math.PI) / 180));
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;
  const venuesRef = collection(firestore, 'venueProfiles');
  let q = query(
    venuesRef,
    where('geopoint', '>=', new GeoPoint(minLat, minLng)),
    where('geopoint', '<=', new GeoPoint(maxLat, maxLng)),
    orderBy('geopoint')
  );

  const snapshot = await getDocs(q);
  const enriched = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .map((v) => {
      const gp = v.geopoint;
      const distKm = gp ? distanceBetween(center, [gp.latitude, gp.longitude]) : Infinity;
      return { ...v, _distanceKm: distKm };
    })
    .filter((v) => v._distanceKm <= radiusInKm)
    .sort((a, b) => a._distanceKm - b._distanceKm)
    .slice(0, limitCount);
  const venues = enriched.map((v) => ({
    ...v,
  }));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  return { venues, lastVisible };
};

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
 * Fetches all venue requests for a given array of venue IDs.
 * @param {string[]} venueIds - Array of venue document IDs.
 * @returns {Promise<Object[]>} Array of venue request objects.
 */
export const getVenueRequestsByVenueIds = async (venueIds) => {
  if (!venueIds || venueIds.length === 0) return [];

  const requestsRef = collection(firestore, 'venueRequests');

  // Firestore 'in' queries only support up to 10 values
  const chunks = [];
  for (let i = 0; i < venueIds.length; i += 10) {
    chunks.push(venueIds.slice(i, i + 10));
  }

  const allResults = [];
  for (const chunk of chunks) {
    const q = query(requestsRef, where('venueId', 'in', chunk));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      allResults.push({ id: doc.id, ...doc.data() });
    });
  }

  return allResults;
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

export const getTemplatesByVenueIds = async (venueIds) => {
  const templatesCol = collection(firestore, 'templates');
  const q = query(templatesCol, where('venueId', 'in', venueIds));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

/**
 * Toggles a musician ID in the savedMusicians array of a user's document.
 *
 * @param {string} userId - Firestore document ID of the user.
 * @param {string} musicianId - ID of the musician to toggle.
 * @returns {Promise<'saved' | 'removed'>} - Returns action performed.
 */
export const saveMusician = async (userId, musicianId) => {
  const ref = doc(firestore, 'users', userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const saved = snap.data().savedMusicians || [];
  let updated, action;

  if (saved.includes(musicianId)) {
    // Remove if already saved
    updated = saved.filter(id => id !== musicianId);
    action = 'removed';
  } else {
    // Add if not saved
    updated = [...saved, musicianId];
    action = 'saved';
  }

  await updateDoc(ref, { savedMusicians: updated });
  return action;
};

/**
 * Marks a venue request as viewed.
 * @param {string} requestId - The ID of the request to update.
 * @returns {Promise<void>}
 */
export const markRequestAsViewed = async (requestId) => {
  const docRef = doc(firestore, 'venueRequests', requestId);
  await updateDoc(docRef, { viewed: true });
};

/**
 * Marks a venue request as removed by setting `removed: true`.
 * @param {string} requestId - The Firestore document ID of the request.
 * @returns {Promise<void>}
 */
export const removeVenueRequest = async (requestId) => {
  if (!requestId) throw new Error('Invalid request ID');
  const requestRef = doc(firestore, 'venueRequests', requestId);
  await updateDoc(requestRef, {
    removed: true,
    updatedAt: new Date()
  });
};

/**
 * Build the lightweight venue summary object stored in a user's venueProfiles array.
 * Adjust fields to match what your Account UI expects (id, name, address, photos...).
 * @param {string} venueId
 * @param {object} data - venue profile doc data
 * @returns {{id:string, name:string, address?:string, photos?:string[]}}
 */
function makeVenueSummary(venueId, data) {
  return {
    id: venueId,
    name: data.name || data.venueName || 'Untitled Venue',
    address: data.address || '',
    photos: Array.isArray(data.photos) ? data.photos : [],
  };
}

/**
 * Transfer ownership of a venue profile (ID-only lists in users docs).
 *
 * Effects (atomically in a transaction):
 * - Updates venueProfiles/{venueId}: sets userId, accountName, email to new owner's data.
 * - Removes venueId from users/{fromUserId}.venueProfiles (array of strings).
 * - Adds venueId to users/{toUserId}.venueProfiles (array of strings, no duplicates).
 *
 * @param {Object} params
 * @param {string} params.venueId - Venue profile document ID being transferred.
 * @param {string} params.fromUserId - Current owner’s user document ID.
 * @param {string} params.toUserId - New owner’s user document ID.
 * @returns {Promise<{venueId:string, fromUserId:string, toUserId:string}>}
 * @throws {Error} If docs are missing, ownership invalid, or the transaction fails.
 */
export async function transferVenueOwnership({ venueId, fromUserId, toUserId }) {
  if (!venueId || !fromUserId || !toUserId) {
    throw new Error('venueId, fromUserId, and toUserId are required');
  }
  if (fromUserId === toUserId) {
    throw new Error('Source and destination users are the same');
  }

  const venueRef = doc(firestore, 'venueProfiles', venueId);
  const fromUserRef = doc(firestore, 'users', fromUserId);
  const toUserRef = doc(firestore, 'users', toUserId);

  await runTransaction(firestore, async (tx) => {
    const venueSnap = await tx.get(venueRef);
    const fromUserSnap = await tx.get(fromUserRef);
    const toUserSnap = await tx.get(toUserRef);

    if (!venueSnap.exists()) throw new Error(`Venue ${venueId} not found`);
    if (!fromUserSnap.exists()) throw new Error(`From user ${fromUserId} not found`);
    if (!toUserSnap.exists()) throw new Error(`To user ${toUserId} not found`);

    const venue = venueSnap.data() || {};
    const fromUser = fromUserSnap.data() || {};
    const toUser = toUserSnap.data() || {};

    // Validate current ownership
    if (venue.userId !== fromUserId) {
      throw new Error('Current user does not own this venue');
    }

    // Users store venue IDs (strings), not objects
    const fromList = Array.isArray(fromUser.venueProfiles) ? fromUser.venueProfiles : [];
    const toList = Array.isArray(toUser.venueProfiles) ? toUser.venueProfiles : [];

    // Remove from source (if present)
    const nextFromList = fromList.filter((id) => id !== venueId);

    // Add to destination (no duplicates)
    const alreadyThere = toList.includes(venueId);
    const nextToList = alreadyThere ? toList : [...toList, venueId];

    // Update venue doc to reflect new owner (and surface owner’s display fields)
    const newAccountName = toUser.name ?? venue.accountName ?? '';
    const newEmail = toUser.email ?? venue.email ?? '';

    tx.update(venueRef, {
      userId: toUserId,
      accountName: newAccountName,
      email: newEmail,
    });

    // Update user docs
    tx.update(fromUserRef, { venueProfiles: nextFromList });
    tx.update(toUserRef, { venueProfiles: nextToList });
  });

  const toUserSnap = await getDoc(doc(firestore, 'users', toUserId));
  const toUser = toUserSnap.data() || {};
  const newAccountName = toUser.name || '';
  const newId = toUserSnap.id;

  // 3) Update gigs' denormalized accountName
  await updateVenueGigsAccountName(venueId, newAccountName, newId);

  // 4) Rewrite conversations & messages
  await rewriteVenueConversationsAndMessages({
    venueId,
    fromUserId,
    toUserId,
    newAccountName,
  });

  return { venueId, fromUserId, toUserId, newAccountName };
}

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

/**
 * Removes a musician ID from the savedMusicians array in a user's document.
 *
 * @param {string} userId - Firestore document ID of the user.
 * @param {string} musicianId - ID of the musician to remove.
 * @returns {Promise<void>}
 */
export const removeMusicianFromUser = async (userId, musicianId) => {
  const ref = doc(firestore, 'users', userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const updated = (snap.data().savedMusicians || []).filter(id => id !== musicianId);
    await updateDoc(ref, { savedMusicians: updated });
  }
};

