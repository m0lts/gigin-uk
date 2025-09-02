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
  setDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  orderBy,
  arrayRemove,
  documentId,
  writeBatch,
  limit,
  startAfter,
  arrayUnion
} from 'firebase/firestore';
import { getBandDataOnly, getBandMembers } from './bands';

/*** CREATE OPERATIONS ***/

/**
 * Creates or updates a musician profile in Firestore.
 *
 * @param {string} musicianId - The Firestore document ID to use for the musician profile.
 * @param {Object} data - The profile data to set.
 * @param {string} userId - The user ID to associate with this profile.
 * @returns {Promise<void>}
 */
export const createMusicianProfile = async (musicianId, data, userId) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    await setDoc(ref, {
      ...data,
      userId,
    }, { merge: true });
  } catch (error) {
    console.error('Error creating musician profile:', error);
    throw error;
  }
};


/**
 * Creates a request for a musician to play at a venue.
 * @param {Object} requestData - The request information.
 * @param {string} requestData.venueId - The venue receiving the request.
 * @param {string} requestData.musicianId - The requesting musician's ID.
 * @param {string} requestData.musicianName - Display name of the musician.
 * @param {string} [requestData.musicianImage] - Optional image of the musician.
 * @param {string} [requestData.message] - Optional message sent to the venue.
 * @param {Date} requestData.createdAt - Timestamp of request creation.
 * @returns {Promise<string>} The ID of the created request document.
 */
export const createVenueRequest = async (requestData) => {
  const docRef = await addDoc(collection(firestore, 'venueRequests'), requestData);
  return docRef.id;
};


/*** READ OPERATIONS ***/

/**
 * Subscribes to real-time updates for a musician profile document.
 *
 * @param {string} musicianId - The Firestore document ID of the musician profile.
 * @param {function(Object|null):void} callback - Called with the profile data or `null` if not found.
 * @param {function(Error):void} [onError] - Optional error handler.
 * @returns {function():void} Unsubscribe function to stop listening.
 */
export const subscribeToMusicianProfile = (musicianId, callback, onError) => {
  const ref = doc(firestore, 'musicianProfiles', musicianId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() });
      } else {
        callback(null);
      }
    },
    (error) => {
      if (onError) onError(error);
      else console.error('subscribeToMusicianProfile error:', error);
    }
  );
};

/**
 * Fetches the musician profile associated with a given user ID.
 *
 * @param {string} userId - The Firebase Auth UID of the user.
 * @returns {Promise<Object|null>} An object containing the profile data (`{ id, ref, ...data }`) or `null` if not found.
 */
export const getMusicianProfileByUserId = async (userId) => {
    const q = query(
      collection(firestore, 'musicianProfiles'),
      where('user', '==', userId)
    );
    const snapshot = await getDocs(q);
    const doc = snapshot.docs[0];
    return doc ? { id: doc.id, ...doc.data() } : null;
};

/**
 * Fetches a musician profile by its Firestore document ID.
 *
 * @param {string} musicianId - The document ID of the musician profile.
 * @returns {Promise<Object|null>} An object containing the profile data (`{ id, ref, ...data }`) or `null` if not found.
 */
export const getMusicianProfileByMusicianId = async (musicianId) => {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Fetches multiple musician profiles by their Firestore document IDs.
 *
 * @param {string[]} musicianIds - An array of musician profile document IDs.
 * @returns {Promise<Array<Object>>} An array of musician profile objects.
 */
export const getMusicianProfilesByIds = async (musicianIds) => {
  if (!musicianIds || musicianIds.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < musicianIds.length; i += 10) {
    chunks.push(musicianIds.slice(i, i + 10));
  }
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(
        collection(firestore, 'musicianProfiles'),
        where(documentId(), 'in', chunk)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    })
  );
  return results.flat();
};

/**
 * Fetches all musician profiles from Firestore.
 *
 * @returns {Promise<Array<Object>>} - Array of musician profile objects with IDs.
 */
export const getAllMusicianProfiles = async () => {
  try {
    const musiciansRef = collection(firestore, 'musicianProfiles');
    const snapshot = await getDocs(musiciansRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching musician profiles:', error);
    throw error;
  }
};


export const fetchMusiciansPaginated = async ({ lastDocId, limitCount = 50, type, genres, location, search }) => {
  let q = collection(firestore, 'musicianProfiles');

  const constraints = [];

  if (type === 'Musician') {
    constraints.push(where('musicianType', '==', 'Musician'));
  } else if (type === 'Band') {
    constraints.push(where('musicianType', '==', 'Band'));
  } else if (type === 'DJ') {
    constraints.push(where('musicianType', '==', 'DJ'));
  }

  if (genres?.length) constraints.push(where('genres', 'array-contains-any', genres));
  // if (location) constraints.push(where('location.city', '==', location)); // adjust path if needed
  if (search) constraints.push(where('searchKeywords', 'array-contains', search.toLowerCase()));

  if (lastDocId) {
    const lastDocSnap = await getDoc(doc(firestore, 'musicianProfiles', lastDocId));
    if (lastDocSnap.exists()) {
      constraints.push(startAfter(lastDocSnap));
    }
  }

  constraints.push(limit(limitCount));
  const queryRef = query(q, ...constraints);

  const snap = await getDocs(queryRef);
  const musicians = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const lastDoc = snap.docs.at(-1)?.id || null;

  return { musicians, lastDocId: lastDoc };
};

/**
 * Fetches the cleared and pending fees for a given musician profile from their
 * respective subcollections in Firestore.
 *
 * @param {string} musicianProfileId - The Firestore document ID of the musician profile.
 * @returns {Promise<{ clearedFees: Array<Object>, pendingFees: Array<Object> }>} 
 * An object containing arrays of cleared and pending fee objects.
 *
 * @throws {Error} If fetching from Firestore fails.
 */
export const getMusicianFees = async (musicianProfileId) => {
  if (!musicianProfileId) {
      throw new Error("musicianProfileId is required to fetch fees");
  }
  const clearedFeesRef = collection(firestore, `musicianProfiles/${musicianProfileId}/clearedFees`);
  const pendingFeesRef = collection(firestore, `musicianProfiles/${musicianProfileId}/pendingFees`);
  const [clearedSnapshot, pendingSnapshot] = await Promise.all([
      getDocs(clearedFeesRef),
      getDocs(pendingFeesRef)
  ]);
  const clearedFees = clearedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const pendingFees = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return { clearedFees, pendingFees };
};

/*** UPDATE OPERATIONS ***/

/**
 * Updates the musician profile document with the provided data.
 *
 * @param {string} musicianId - Firestore document ID of the musician profile.
 * @param {Object} data - The data to update.
 * @returns {Promise<void>}
 */
export const updateMusicianProfile = async (musicianId, data) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    await updateDoc(ref, data);
  } catch (error) {
    console.error('Error updating musician profile:', error);
    throw error;
  }
};

/**
 * Adds an application record to a musician’s profile.
 * @param {Object} profile - Musician or Band profile object.
 * @param {string} gigId - The gig ID being applied to.
 */
export const updateMusicianGigApplications = async (profile, gigId) => {
  const musicianRef = doc(firestore, 'musicianProfiles', profile.musicianId);
  const existingApps = Array.isArray(profile.gigApplications) ? profile.gigApplications : [];
  const alreadyApplied = existingApps.some(
    entry => entry.gigId === gigId && entry.profileId === profile.musicianId
  );
  if (alreadyApplied) return;
  const updatedArray = [...existingApps, { gigId, profileId: profile.musicianId, name: profile.name }];
  await updateDoc(musicianRef, { gigApplications: updatedArray });
};

/**
 * Adds a gig application record to every band member’s profile and the band profile.
 * @param {Object} band - The band profile object.
 * @param {string} gigId - The gig ID being applied to.
 */
export const updateBandMembersGigApplications = async (band, gigId) => {
  const members = await getBandMembers(band.musicianId);
  const batch = writeBatch(firestore);

  // Update each band member's profile
  members.forEach(member => {
    const gigApplications = Array.isArray(member.gigApplications) ? member.gigApplications : [];
    const alreadyApplied = gigApplications.some(
      entry => entry.gigId === gigId && entry.profileId === band.musicianId
    );
    if (!alreadyApplied) {
      const musicianRef = doc(firestore, 'musicianProfiles', member.id);
      batch.update(musicianRef, {
        gigApplications: [...gigApplications, {
          gigId,
          profileId: band.musicianId,
          name: band.name,
        }],
      });
    }
  });

  // Update band profile
  const bandRef = doc(firestore, 'musicianProfiles', band.musicianId);
  const bandGigApplications = Array.isArray(band.gigApplications) ? band.gigApplications : [];
  const bandAlreadyApplied = bandGigApplications.some(entry => entry.gigId === gigId);

  if (!bandAlreadyApplied) {
    batch.update(bandRef, {
      gigApplications: [...bandGigApplications, {
        gigId,
        profileId: band.musicianId,
        name: band.name,
      }],
    });
  }

  await batch.commit();
};

/**
 * Removes the gig from the musician's profile data.
 * @param {string} musicianId - The ID of the cancelling musician.
 * @param {string} gigId - The gig ID to remove.
 * @returns {Promise<void>}
 */
export const updateMusicianCancelledGig = async (musicianId, gigId) => {
  const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
  const snapshot = await getDoc(musicianRef);

  if (!snapshot.exists()) throw new Error('Musician profile not found.');

  const data = snapshot.data();
  const updatedGigApplications = (data.gigApplications || []).filter(app => app.gigId !== gigId);

  await updateDoc(musicianRef, {
    gigApplications: updatedGigApplications,
    confirmedGigs: arrayRemove(gigId),
  });
};

/**
 * Marks an invited gig as viewed
 * @param {string} applicantId - The ID of the applicant that's been invited.
 * @param {string} gigId - The gig ID to update.
 * @returns {Promise<void>}
 */

export const markInviteAsViewed = async (gigId, applicantId) => {
  try {
    const gigRef = doc(firestore, 'gigs', gigId);
    const gigSnap = await getDoc(gigRef);
    const gigData = gigSnap.data();
    const updatedApplicants = gigData.applicants.map(app =>
      app.id === applicantId ? { ...app, viewed: true } : app
      );  
    await updateDoc(gigRef, { applicants: updatedApplicants });
  } catch (error) {
    console.error(error)
  }
};

/**
 * Saves a gig ID to the `savedGigs` array for all provided musician/band profiles.
 * @async
 * @param {string} gigId - The ID of the gig to save.
 * @param {string[]} profileIds - Array of musician or band profile IDs to update.
 * @returns {Promise<void>} Resolves when all updates are complete.
 * @throws {Error} If the update to Firestore fails.
 */
export async function saveGigToMusicianProfile(gigId, profileIds) {
  try {
    const updates = profileIds.map(async (id) => {
      const profileRef = doc(firestore, 'musicianProfiles', id);
      await updateDoc(profileRef, {
        savedGigs: arrayUnion(gigId),
      });
    });
    await Promise.all(updates);
  } catch (error) {
    console.error('Error saving gig to musician profile(s):', error);
    throw error;
  }
}

/**
 * Removes a gig ID from the `savedGigs` array for all provided musician/band profiles.
 * @async
 * @param {string} gigId - The ID of the gig to remove.
 * @param {string[]} profileIds - Array of musician or band profile IDs to update.
 * @returns {Promise<void>} Resolves when all updates are complete.
 * @throws {Error} If the update to Firestore fails.
 */
export async function unSaveGigFromMusicianProfile(gigId, profileIds) {
  try {
    const updates = profileIds.map(async (id) => {
      const profileRef = doc(firestore, 'musicianProfiles', id);
      await updateDoc(profileRef, {
        savedGigs: arrayRemove(gigId),
      });
    });
    await Promise.all(updates);
  } catch (error) {
    console.error('Error removing gig from musician profile(s):', error);
    throw error;
  }
}

/*** DELETE OPERATIONS ***/

/**
 * Deletes a musician profile from Firestore.
 *
 * @param {string} musicianId - Firestore document ID of the musician profile to delete.
 * @returns {Promise<void>}
 */
export const deleteMusicianProfile = async (musicianId) => {
  try {
    const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
    await deleteDoc(musicianRef);
  } catch (error) {
    console.error('Error deleting musician profile:', error);
    throw error;
  }
};

/**
 * Removes a gig ID from the gigApplications array in a musician's profile.
 *
 * @param {string} musicianId - Firestore document ID of the musician.
 * @param {string} gigId - ID of the gig to remove.
 * @returns {Promise<void>}
 */
export const removeGigFromMusician = async (musicianId, gigId) => {
  const ref = doc(firestore, 'musicianProfiles', musicianId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const updated = (snap.data().gigApplications || []).filter(id => id !== gigId);
    await updateDoc(ref, { gigApplications: updated });
  }
};