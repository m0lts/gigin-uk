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
  GeoPoint,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { distanceBetween } from 'geofire-common';
import { PERM_DEFAULTS, sanitizePermissions } from '../utils/permissions';
import { v4 as uuid } from "uuid";

/*** CREATE OPERATIONS ***/

/**
 * Creates or updates a venue profile in Firestore and
 * ensures the creator is added as a member with full permissions.
 *
 * - Writes the venue doc (merge).
 * - If the creator is not already a member, creates
 *   `venueProfiles/{venueId}/members/{userId}` with all permissions = true.
 *
 * NOTE: We do **not** modify the user doc here. You already call
 * `updateUserDocument(..., { venueProfiles: arrayUnion(venueId) })` outside.
 *
 * @param {string} venueId - The Firestore document ID to use for the venue profile.
 * @param {Object} data - The profile data to set.
 * @param {string} userId - The user ID creating this profile.
 * @returns {Promise<void>}
 */
export const createVenueProfile = async (venueId, data, userId) => {
  try {
    const venueRef = doc(firestore, "venueProfiles", venueId);
    const memberRef = doc(firestore, "venueProfiles", venueId, "members", userId);
    await setDoc(
      venueRef,
      {
        ...data,
        userId,
        createdBy: userId,
      },
      { merge: true }
    );
    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
      const allTruePermissions = Object.fromEntries(
        Object.keys(PERM_DEFAULTS).map((k) => [k, true])
      );
      await setDoc(
        memberRef,
        {
          status: "active",
          permissions: {
            ...allTruePermissions,
            "gigs.read": true,
          },
          addedBy: userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          role: "owner",
        },
        { merge: false }
      );
    }
  } catch (error) {
    console.error("Error creating venue profile:", error);
    throw error;
  }
};


/**
 * Create a venue invite with optional initial permissions.
 * @param {string} venueId
 * @param {string} invitedByUid
 * @param {string} email
 * @param {Record<string, boolean>} permsSparse - sparse map of true keys
 * @returns {Promise<string>} inviteId
 */
export async function createVenueInvite(venueId, invitedByUid, email, permissionsInput = PERM_DEFAULTS, invitedByName) {
  const inviteId = uuid();
  const permissions = sanitizePermissions(permissionsInput);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await setDoc(doc(firestore, "venueInvites", inviteId), {
    venueId,
    invitedBy: invitedByUid,
    invitedByName,
    email: email?.trim().toLowerCase() || null,
    permissions,
    createdAt: Timestamp.now(),
    expiresAt,
    status: "pending",
  });

  return inviteId;
}

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

/**
 * Fetches a venue invite document by its inviteId.
 *
 * @async
 * @param {string} inviteId - The unique ID of the invite (document ID in `venueInvites` collection).
 * @returns {Promise<Object|null>} The invite document data with `id` included,
 *   or null if the invite does not exist.
 *
 * @example
 * const invite = await getVenueInviteById('abc-123');
 * if (invite) {
 *   console.log(invite.venueId, invite.expiresAt.toDate());
 * }
 */
export const getVenueInviteById = async (inviteId) => {
  if (!inviteId) return null;
  try {
    const ref = doc(firestore, 'venueInvites', inviteId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return null;
    }
    return {
      id: snap.id,
      ...snap.data(),
    };
  } catch (error) {
    console.error('Error fetching venue invite:', error);
    throw error;
  }
};


/**
 * Fetches the current user's membership document for a given venue profile.
 *
 * Use this when you already have the venue profile data (to avoid
 * duplicate Firestore reads) but still need the logged-in user’s
 * membership details (permissions, status, etc.).
 *
 * @async
 * @function fetchMyVenueMembership
 * @param {Object} venue - The venue profile object that has already been fetched.
 * @param {string} uid - The UID of the current authenticated user.
 * @returns {Promise<Object>} A copy of the venue object with `myMembership` added:
 *   {
 *     ...venue,                 // all existing venue fields passed in
 *     myMembership: {           // current user's membership doc (if exists)
 *       id: string,
 *       status: string,
 *       permissions: Object,
 *       createdAt: Timestamp,
 *       updatedAt: Timestamp,
 *       ...etc
 *     } | null
 *   }
 *
 * @example
 * const venueProfilesWithMembership = await Promise.all(
 *   completeVenues.map((venue) => fetchMyVenueMembership(venue, currentUser.uid))
 * );
 */
export async function fetchMyVenueMembership(venue, uid) {
  if (!venue?.venueId) return null;
  const myMemberRef = doc(firestore, "venueProfiles", venue.venueId, "members", uid);
  const myMemberSnap = await getDoc(myMemberRef);
  const myMembership = myMemberSnap.exists()
    ? { id: myMemberSnap.id, ...myMemberSnap.data() }
    : null;
  return { ...venue, myMembership };
}

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
  const batch = writeBatch(firestore);
  venueProfileIds.forEach((profile) => {
    const profileRef = doc(firestore, 'venueProfiles', profile.id);
    batch.update(profileRef, { accountName: newAccountName });
  });
  await batch.commit();
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

