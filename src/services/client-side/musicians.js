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
import { getBandMembers } from './bands';
import { getMostRecentMessage } from './messages';
import { updateGigDocument } from '../function-calls/gigs';


/*** CREATE OPERATIONS ***/

/**
 * Creates or updates a musician profile in Firestore.
 */
export const createMusicianProfile = async (musicianId, data, userId) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    await setDoc(ref, { ...data, userId }, { merge: true });
  } catch (error) {
    console.error('[Firestore Error] createMusicianProfile:', error);
  }
};

/**
 * Creates a request for a musician to play at a venue.
 * @returns {Promise<string|null>} The new request ID or null on error.
 */
export const createVenueRequest = async (requestData) => {
  try {
    const docRef = await addDoc(collection(firestore, 'venueRequests'), requestData);
    return docRef.id;
  } catch (error) {
    console.error('[Firestore Error] createVenueRequest:', error);
  }
};


/*** READ OPERATIONS ***/

/**
 * Subscribes to real-time updates for a musician profile document.
 */
export const subscribeToMusicianProfile = (musicianId, callback, onError) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    const onErr = (e) => {
      if (onError) onError(e);
      else console.error('[Firestore Error] subscribeToMusicianProfile snapshot:', e);
    };
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) callback({ id: snap.id, ...snap.data() });
        else callback(null);
      },
      onErr
    );
  } catch (error) {
    console.error('[Firestore Error] subscribeToMusicianProfile init:', error);
  }
};

/**
 * Fetches the musician profile associated with a given user ID.
 */
export const getMusicianProfileByUserId = async (userId) => {
  try {
    const qy = query(collection(firestore, 'musicianProfiles'), where('userId', '==', userId));
    const snapshot = await getDocs(qy);
    const d = snapshot.docs[0];
    return d ? { id: d.id, ...d.data() } : null;
  } catch (error) {
    console.error('[Firestore Error] getMusicianProfileByUserId:', error);
  }
};

/**
 * Fetches a musician profile by its Firestore document ID.
 */
export const getMusicianProfileByMusicianId = async (musicianId) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('[Firestore Error] getMusicianProfileByMusicianId:', error);
  }
};

/**
 * Fetches multiple musician profiles by their Firestore document IDs.
 */
export const getMusicianProfilesByIds = async (musicianIds) => {
  try {
    if (!musicianIds || musicianIds.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < musicianIds.length; i += 10) chunks.push(musicianIds.slice(i, i + 10));

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const qy = query(collection(firestore, 'musicianProfiles'), where(documentId(), 'in', chunk));
        const snapshot = await getDocs(qy);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      })
    );
    return results.flat();
  } catch (error) {
    console.error('[Firestore Error] getMusicianProfilesByIds:', error);
  }
};

/**
 * Fetches musician profiles with simple pagination & filters.
 */
export const fetchMusiciansPaginated = async ({ lastDocId, limitCount = 50, type, genres, location, search }) => {
  try {
    let base = collection(firestore, 'musicianProfiles');
    const constraints = [];

    if (type === 'Musician') constraints.push(where('musicianType', '==', 'Musician'));
    else if (type === 'Band') constraints.push(where('musicianType', '==', 'Band'));
    else if (type === 'DJ') constraints.push(where('musicianType', '==', 'DJ'));

    if (genres?.length) constraints.push(where('genres', 'array-contains-any', genres));
    // if (location) constraints.push(where('location.city', '==', location));
    if (search) constraints.push(where('searchKeywords', 'array-contains', search.toLowerCase()));

    if (lastDocId) {
      const lastDocSnap = await getDoc(doc(firestore, 'musicianProfiles', lastDocId));
      if (lastDocSnap.exists()) constraints.push(startAfter(lastDocSnap));
    }

    constraints.push(limit(limitCount));
    const qy = query(base, ...constraints);

    const snap = await getDocs(qy);
    const musicians = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastDoc = snap.docs.at(-1)?.id || null;

    return { musicians, lastDocId: lastDoc };
  } catch (error) {
    console.error('[Firestore Error] fetchMusiciansPaginated:', error);
  }
};

/**
 * Fetches the cleared and pending fees for a given musician profile.
 */
export const getMusicianFees = async (musicianProfileId) => {
  try {
    if (!musicianProfileId) {
      console.error('[Firestore Error] getMusicianFees: missing musicianProfileId');
      return { clearedFees: [], pendingFees: [] };
    }
    const clearedFeesRef = collection(firestore, `musicianProfiles/${musicianProfileId}/clearedFees`);
    const pendingFeesRef = collection(firestore, `musicianProfiles/${musicianProfileId}/pendingFees`);
    const [clearedSnapshot, pendingSnapshot] = await Promise.all([getDocs(clearedFeesRef), getDocs(pendingFeesRef)]);
    const clearedFees = clearedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const pendingFees = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { clearedFees, pendingFees };
  } catch (error) {
    console.error('[Firestore Error] getMusicianFees:', error);
  }
};


/*** UPDATE OPERATIONS ***/

/**
 * Updates the musician profile document with the provided data.
 */
export const updateMusicianProfile = async (musicianId, data) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    await updateDoc(ref, data);
  } catch (error) {
    console.error('[Firestore Error] updateMusicianProfile:', error);
  }
};

/**
 * Adds an application record to a musician’s profile.
 */
export const updateMusicianGigApplications = async (profile, gigId) => {
  try {
    const musicianRef = doc(firestore, 'musicianProfiles', profile.musicianId);
    const entry = { gigId, profileId: profile.musicianId, name: profile.name };
    await updateDoc(musicianRef, { gigApplications: arrayUnion(entry) });
  } catch (error) {
    console.error('[Firestore Error] updateMusicianGigApplications:', error);
  }
};

/**
 * Adds a gig application record to the band profile.
 */
export const updateBandMembersGigApplications = async (band, gigId) => {
  try {
    const batch = writeBatch(firestore);
    const bandEntry = { gigId, profileId: band.musicianId, name: band.name };
    const bandRef = doc(firestore, 'musicianProfiles', band.musicianId);
    batch.update(bandRef, { gigApplications: arrayUnion(bandEntry) });
    await batch.commit();
  } catch (error) {
    console.error('[Firestore Error] updateBandMembersGigApplications:', error);
  }
};

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
    console.error('[Firestore Error] markInviteAsViewed:', error)
  }
};

/**
 * Find the pending fee doc for a gig under a musician profile.
 */
export const findPendingFeeByGigId = async (musicianId, gigId) => {
  try {
    const colRef = collection(firestore, 'musicianProfiles', musicianId, 'pendingFees');
    const qy = query(colRef, where('gigId', '==', gigId), limit(1));
    const snap = await getDocs(qy);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { docId: d.id, data: d.data() };
  } catch (error) {
    console.error('[Firestore Error] findPendingFeeByGigId:', error);
  }
};


/*** DELETE OPERATIONS ***/

/**
 * Deletes a musician profile from Firestore.
 */
export const deleteMusicianProfile = async (musicianId) => {
  try {
    const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
    await deleteDoc(musicianRef);
  } catch (error) {
    console.error('[Firestore Error] deleteMusicianProfile:', error);
  }
};

/**
 * Withdraw a musician/band application from a gig.
 * @returns {Promise<Object[]|null>} Updated applicants array, or null on error/not found.
 */
export async function withdrawMusicianApplication(gigId, profile) {
  try {
    if (!gigId || !profile?.musicianId) {
      console.error('[Firestore Error] withdrawMusicianApplication: missing gigId or profile.musicianId');
      return null;
    }

    const applicantId = profile.musicianId;
    const gigRef = doc(firestore, 'gigs', gigId);
    const gigSnap = await getDoc(gigRef);
    if (!gigSnap.exists()) return null;

    const gig = gigSnap.data() || {};
    const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
    const hasApplied = applicants.some(a => a?.id === applicantId);
    if (!hasApplied) return applicants;

    const target = applicants.find(a => a?.id === applicantId);
    if (target?.status === 'accepted' || target?.status === 'confirmed') {
      console.error('[Firestore Error] withdrawMusicianApplication: cannot withdraw accepted/confirmed application');
      return applicants;
    }

    const updatedApplicants = applicants.map(a =>
      a?.id === applicantId ? { ...a, status: 'withdrawn' } : a
    );
    await updateGigDocument(gigId, { applicants: updatedApplicants });

    const batch = writeBatch(firestore);
    const pruneApps = (apps = []) =>
      apps.filter(entry => !(entry?.gigId === gigId && entry?.profileId === applicantId));

    if (profile.bandProfile) {
      const bandRef = doc(firestore, 'musicianProfiles', applicantId);
      const bandSnap = await getDoc(bandRef);
      if (bandSnap.exists()) {
        const bandApps = Array.isArray(bandSnap.data().gigApplications)
          ? bandSnap.data().gigApplications
          : [];
        batch.update(bandRef, { gigApplications: pruneApps(bandApps) });
      }
      const members = await getBandMembers(applicantId);
      members.forEach(member => {
        const memberRef = doc(firestore, 'musicianProfiles', member.id);
        const memberApps = Array.isArray(member.gigApplications) ? member.gigApplications : [];
        const next = pruneApps(memberApps);
        if (next.length !== memberApps.length) {
          batch.update(memberRef, { gigApplications: next });
        }
      });
    } else {
      const musicianRef = doc(firestore, 'musicianProfiles', applicantId);
      let apps = Array.isArray(profile.gigApplications) ? profile.gigApplications : null;
      if (!apps) {
        const musSnap = await getDoc(musicianRef);
        apps = Array.isArray(musSnap.data()?.gigApplications) ? musSnap.data().gigApplications : [];
      }
      batch.update(musicianRef, { gigApplications: pruneApps(apps) });
    }

    await batch.commit();

    const convQ = query(
      collection(firestore, 'conversations'),
      where('gigId', '==', gigId),
      where('participants', 'array-contains', applicantId)
    );
    const convSnap = await getDocs(convQ);
    if (!convSnap.empty) {
      const convDoc = convSnap.docs[0];
      const conversationId = convDoc.id;

      const lastAppMsg = await getMostRecentMessage(conversationId, 'application');
      if (lastAppMsg?.id) {
        const msgRef = doc(firestore, 'conversations', conversationId, 'messages', lastAppMsg.id);
        await updateDoc(msgRef, { status: 'withdrawn' });
      }

      const lastNegMsg = await getMostRecentMessage(conversationId, 'negotiation');
      if (lastNegMsg?.id) {
        const msgRef = doc(firestore, 'conversations', conversationId, 'messages', lastNegMsg.id);
        await updateDoc(msgRef, { status: 'withdrawn' });
      }

      await updateDoc(doc(firestore, 'conversations', conversationId), {
        lastMessage: 'Application withdrawn by musician.',
        lastMessageTimestamp: Timestamp.now(),
      });
    }

    return updatedApplicants;
  } catch (error) {
    console.error('[Firestore Error] withdrawMusicianApplication:', error);
  }
}


// /*** CREATE OPERATIONS ***/

// /**
//  * Creates or updates a musician profile in Firestore.
//  *
//  * @param {string} musicianId - The Firestore document ID to use for the musician profile.
//  * @param {Object} data - The profile data to set.
//  * @param {string} userId - The user ID to associate with this profile.
//  * @returns {Promise<void>}
//  */
// export const createMusicianProfile = async (musicianId, data, userId) => {
//   try {
//     const ref = doc(firestore, 'musicianProfiles', musicianId);
//     await setDoc(ref, {
//       ...data,
//       userId,
//     }, { merge: true });
//   } catch (error) {
//     console.error('Error creating musician profile:', error);
//   }
// };


// /**
//  * Creates a request for a musician to play at a venue.
//  * @param {Object} requestData - The request information.
//  * @param {string} requestData.venueId - The venue receiving the request.
//  * @param {string} requestData.musicianId - The requesting musician's ID.
//  * @param {string} requestData.musicianName - Display name of the musician.
//  * @param {string} [requestData.musicianImage] - Optional image of the musician.
//  * @param {string} [requestData.message] - Optional message sent to the venue.
//  * @param {Date} requestData.createdAt - Timestamp of request creation.
//  * @returns {Promise<string>} The ID of the created request document.
//  */
// export const createVenueRequest = async (requestData) => {
//   const docRef = await addDoc(collection(firestore, 'venueRequests'), requestData);
//   return docRef.id;
// };


// /*** READ OPERATIONS ***/

// /**
//  * Subscribes to real-time updates for a musician profile document.
//  *
//  * @param {string} musicianId - The Firestore document ID of the musician profile.
//  * @param {function(Object|null):void} callback - Called with the profile data or `null` if not found.
//  * @param {function(Error):void} [onError] - Optional error handler.
//  * @returns {function():void} Unsubscribe function to stop listening.
//  */
// export const subscribeToMusicianProfile = (musicianId, callback, onError) => {
//   const ref = doc(firestore, 'musicianProfiles', musicianId);
//   return onSnapshot(
//     ref,
//     (snap) => {
//       if (snap.exists()) {
//         callback({ id: snap.id, ...snap.data() });
//       } else {
//         callback(null);
//       }
//     },
//     (error) => {
//       if (onError) onError(error);
//       else console.error('subscribeToMusicianProfile error:', error);
//     }
//   );
// };

// /**
//  * Fetches the musician profile associated with a given user ID.
//  *
//  * @param {string} userId - The Firebase Auth UID of the user.
//  * @returns {Promise<Object|null>} An object containing the profile data (`{ id, ref, ...data }`) or `null` if not found.
//  */
// export const getMusicianProfileByUserId = async (userId) => {
//     const q = query(
//       collection(firestore, 'musicianProfiles'),
//       where('userId', '==', userId)
//     );
//     const snapshot = await getDocs(q);
//     const doc = snapshot.docs[0];
//     return doc ? { id: doc.id, ...doc.data() } : null;
// };

// /**
//  * Fetches a musician profile by its Firestore document ID.
//  *
//  * @param {string} musicianId - The document ID of the musician profile.
//  * @returns {Promise<Object|null>} An object containing the profile data (`{ id, ref, ...data }`) or `null` if not found.
//  */
// export const getMusicianProfileByMusicianId = async (musicianId) => {
//     const ref = doc(firestore, 'musicianProfiles', musicianId);
//     const snap = await getDoc(ref);
//     return snap.exists() ? { id: snap.id, ...snap.data() } : null;
// };

// /**
//  * Fetches multiple musician profiles by their Firestore document IDs.
//  *
//  * @param {string[]} musicianIds - An array of musician profile document IDs.
//  * @returns {Promise<Array<Object>>} An array of musician profile objects.
//  */
// export const getMusicianProfilesByIds = async (musicianIds) => {
//   if (!musicianIds || musicianIds.length === 0) return [];
//   const chunks = [];
//   for (let i = 0; i < musicianIds.length; i += 10) {
//     chunks.push(musicianIds.slice(i, i + 10));
//   }
//   const results = await Promise.all(
//     chunks.map(async (chunk) => {
//       const q = query(
//         collection(firestore, 'musicianProfiles'),
//         where(documentId(), 'in', chunk)
//       );
//       const snapshot = await getDocs(q);
//       return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//     })
//   );
//   return results.flat();
// };

// /**
//  * Fetches all musician profiles from Firestore.
//  *
//  * @returns {Promise<Array<Object>>} - Array of musician profile objects with IDs.
//  */
// export const fetchMusiciansPaginated = async ({ lastDocId, limitCount = 50, type, genres, location, search }) => {
//   let q = collection(firestore, 'musicianProfiles');

//   const constraints = [];

//   if (type === 'Musician') {
//     constraints.push(where('musicianType', '==', 'Musician'));
//   } else if (type === 'Band') {
//     constraints.push(where('musicianType', '==', 'Band'));
//   } else if (type === 'DJ') {
//     constraints.push(where('musicianType', '==', 'DJ'));
//   }

//   if (genres?.length) constraints.push(where('genres', 'array-contains-any', genres));
//   // if (location) constraints.push(where('location.city', '==', location)); // adjust path if needed
//   if (search) constraints.push(where('searchKeywords', 'array-contains', search.toLowerCase()));

//   if (lastDocId) {
//     const lastDocSnap = await getDoc(doc(firestore, 'musicianProfiles', lastDocId));
//     if (lastDocSnap.exists()) {
//       constraints.push(startAfter(lastDocSnap));
//     }
//   }

//   constraints.push(limit(limitCount));
//   const queryRef = query(q, ...constraints);

//   const snap = await getDocs(queryRef);
//   const musicians = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//   const lastDoc = snap.docs.at(-1)?.id || null;

//   return { musicians, lastDocId: lastDoc };
// };

// /**
//  * Fetches the cleared and pending fees for a given musician profile from their
//  * respective subcollections in Firestore.
//  *
//  * @param {string} musicianProfileId - The Firestore document ID of the musician profile.
//  * @returns {Promise<{ clearedFees: Array<Object>, pendingFees: Array<Object> }>} 
//  * An object containing arrays of cleared and pending fee objects.
//  *
//  * @throws {Error} If fetching from Firestore fails.
//  */
// export const getMusicianFees = async (musicianProfileId) => {
//   if (!musicianProfileId) {
//       throw new Error("musicianProfileId is required to fetch fees");
//   }
//   const clearedFeesRef = collection(firestore, `musicianProfiles/${musicianProfileId}/clearedFees`);
//   const pendingFeesRef = collection(firestore, `musicianProfiles/${musicianProfileId}/pendingFees`);
//   const [clearedSnapshot, pendingSnapshot] = await Promise.all([
//       getDocs(clearedFeesRef),
//       getDocs(pendingFeesRef)
//   ]);
//   const clearedFees = clearedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//   const pendingFees = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//   return { clearedFees, pendingFees };
// };

// /*** UPDATE OPERATIONS ***/

// /**
//  * Updates the musician profile document with the provided data.
//  *
//  * @param {string} musicianId - Firestore document ID of the musician profile.
//  * @param {Object} data - The data to update.
//  * @returns {Promise<void>}
//  */
// export const updateMusicianProfile = async (musicianId, data) => {
//   try {
//     const ref = doc(firestore, 'musicianProfiles', musicianId);
//     await updateDoc(ref, data);
//   } catch (error) {
//     console.error('Error updating musician profile:', error);
//     throw error;
//   }
// };

// /**
//  * Adds an application record to a musician’s profile.
//  * @param {Object} profile - Musician or Band profile object.
//  * @param {string} gigId - The gig ID being applied to.
//  */
// export const updateMusicianGigApplications = async (profile, gigId) => {
//   const musicianRef = doc(firestore, 'musicianProfiles', profile.musicianId);
//   const entry = { gigId, profileId: profile.musicianId, name: profile.name };
//   await updateDoc(musicianRef, { gigApplications: arrayUnion(entry) });
// };

// /**
//  * Adds a gig application record to every band member’s profile and the band profile.
//  * @param {Object} band - The band profile object.
//  * @param {string} gigId - The gig ID being applied to.
//  */
// export const updateBandMembersGigApplications = async (band, gigId) => {
//   const batch = writeBatch(firestore);
//   const bandEntry = { gigId, profileId: band.musicianId, name: band.name };
//   const bandRef = doc(firestore, 'musicianProfiles', band.musicianId);
//   batch.update(bandRef, { gigApplications: arrayUnion(bandEntry) });
//   await batch.commit();
// };

// /**
//  * Removes the gig from the musician's profile data.
//  * @param {string} musicianId - The ID of the cancelling musician.
//  * @param {string} gigId - The gig ID to remove.
//  * @returns {Promise<void>}
//  */
// export const updateMusicianCancelledGig = async (musicianId, gigId) => {
//   const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
//   const snapshot = await getDoc(musicianRef);

//   if (!snapshot.exists()) throw new Error('Musician profile not found.');

//   const data = snapshot.data();
//   const updatedGigApplications = (data.gigApplications || []).filter(app => app.gigId !== gigId);

//   await updateDoc(musicianRef, {
//     gigApplications: updatedGigApplications,
//     confirmedGigs: arrayRemove(gigId),
//   });
// };

// /**
//  * Marks an invited gig as viewed
//  * @param {string} applicantId - The ID of the applicant that's been invited.
//  * @param {string} gigId - The gig ID to update.
//  * @returns {Promise<void>}
//  */

// export const markInviteAsViewed = async (gigId, applicantId) => {
//   try {
//     const gigRef = doc(firestore, 'gigs', gigId);
//     const gigSnap = await getDoc(gigRef);
//     const gigData = gigSnap.data();
//     const updatedApplicants = gigData.applicants.map(app =>
//       app.id === applicantId ? { ...app, viewed: true } : app
//       );  
//     await updateDoc(gigRef, { applicants: updatedApplicants });
//   } catch (error) {
//     console.error(error)
//   }
// };

// /**
// 	•	Find the pending fee doc for a gig under a musician profile.
// 	•	Looks up: musicianProfiles/{musicianId}/pendingFees where gigId == {gigId}
// 	•	@param {string} musicianId
// 	•	@param {string} gigId
// 	•	@returns {Promise<{docId: string, data: object} | null>}
// */
// export const findPendingFeeByGigId = async (musicianId, gigId) => {
//   const colRef = collection(firestore, 'musicianProfiles', musicianId, 'pendingFees');
//   const q = query(colRef, where('gigId', '==', gigId), limit(1));
//   const snap = await getDocs(q);
//   if (snap.empty) return null;
//     const d = snap.docs[0];
//     return { docId: d.id, data: d.data() };
//   };


// /*** DELETE OPERATIONS ***/

// /**
//  * Deletes a musician profile from Firestore.
//  *
//  * @param {string} musicianId - Firestore document ID of the musician profile to delete.
//  * @returns {Promise<void>}
//  */
// export const deleteMusicianProfile = async (musicianId) => {
//   try {
//     const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
//     await deleteDoc(musicianRef);
//   } catch (error) {
//     console.error('Error deleting musician profile:', error);
//     throw error;
//   }
// };


// /**
//  * Withdraw a musician/band application from a gig.
//  *
//  * @param {string} gigId
//  * @param {Object} profile  // musician or band profile (same shape you pass to applyToGig)
//  *   - profile.musicianId (string)  // id used in applicants[].id and conversations.participants
//  *   - profile.bandProfile (boolean)
//  *   - profile.name (string)        // optional, not required here
//  *   - profile.gigApplications? (array) // optional, helpful to avoid extra reads
//  * @returns {Promise<Object[]|null>} Updated applicants array, or null if no gig/applicant found
//  */
// export async function withdrawMusicianApplication(gigId, profile) {
//   if (!gigId || !profile?.musicianId) {
//     throw new Error('gigId and profile.musicianId are required');
//   }
//   const applicantId = profile.musicianId;
//   const gigRef = doc(firestore, 'gigs', gigId);
//   const gigSnap = await getDoc(gigRef);
//   if (!gigSnap.exists()) return null;
//   const gig = gigSnap.data() || {};
//   const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
//   const hasApplied = applicants.some(a => a?.id === applicantId);
//   if (!hasApplied) {
//     return applicants;
//   }
//   const target = applicants.find(a => a?.id === applicantId);
//   if (target?.status === 'accepted' || target?.status === 'confirmed') {
//     throw new Error('Cannot withdraw an accepted/confirmed application.');
//   }
//   const updatedApplicants = applicants.map(a =>
//     a?.id === applicantId ? { ...a, status: 'withdrawn' } : a
//   );
//   await updateGigDocument(gigId, { applicants: updatedApplicants });
//   const batch = writeBatch(firestore);
//   const pruneApps = (apps = []) =>
//     apps.filter(entry => !(entry?.gigId === gigId && entry?.profileId === applicantId));
//   if (profile.bandProfile) {
//     const bandRef = doc(firestore, 'musicianProfiles', applicantId);
//     const bandSnap = await getDoc(bandRef);
//     if (bandSnap.exists()) {
//       const bandApps = Array.isArray(bandSnap.data().gigApplications)
//         ? bandSnap.data().gigApplications
//         : [];
//       batch.update(bandRef, { gigApplications: pruneApps(bandApps) });
//     }
//     const members = await getBandMembers(applicantId);
//     members.forEach(member => {
//       const memberRef = doc(firestore, 'musicianProfiles', member.id);
//       const memberApps = Array.isArray(member.gigApplications) ? member.gigApplications : [];
//       const next = pruneApps(memberApps);
//       if (next.length !== memberApps.length) {
//         batch.update(memberRef, { gigApplications: next });
//       }
//     });
//   } else {
//     const musicianRef = doc(firestore, 'musicianProfiles', applicantId);
//     let apps = Array.isArray(profile.gigApplications) ? profile.gigApplications : null;
//     if (!apps) {
//       const musSnap = await getDoc(musicianRef);
//       apps = Array.isArray(musSnap.data()?.gigApplications) ? musSnap.data().gigApplications : [];
//     }
//     batch.update(musicianRef, { gigApplications: pruneApps(apps) });
//   }
//   await batch.commit();
//   const convQ = query(
//     collection(firestore, 'conversations'),
//     where('gigId', '==', gigId),
//     where('participants', 'array-contains', applicantId)
//   );
//   const convSnap = await getDocs(convQ);
//   if (!convSnap.empty) {
//     const convDoc = convSnap.docs[0];
//     const conversationId = convDoc.id;
//     const lastAppMsg = await getMostRecentMessage(conversationId, 'application');
//     if (lastAppMsg?.id) {
//       const msgRef = doc(
//         firestore,
//         'conversations',
//         conversationId,
//         'messages',
//         lastAppMsg.id
//       );
//       await updateDoc(msgRef, { status: 'withdrawn' });
//     }
//     const lastNegMsg = await getMostRecentMessage(conversationId, 'negotiation');
//     if (lastNegMsg?.id) {
//       const msgRef = doc(
//         firestore,
//         'conversations',
//         conversationId,
//         'messages',
//         lastNegMsg.id
//       );
//       await updateDoc(msgRef, { status: 'withdrawn' });
//     }
//     await updateDoc(doc(firestore, 'conversations', conversationId), {
//       lastMessage: 'Application withdrawn by musician.',
//       lastMessageTimestamp: Timestamp.now(),
//     });
//   }
//   return updatedApplicants;
// }