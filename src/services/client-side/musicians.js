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
import { getOrCreateConversation, updateConversationDocument } from '../function-calls/conversations';
import { updateMessage } from '../function-calls/messages';


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
export async function withdrawMusicianApplication(gigId, profile, userId) {
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

    await updateGigDocument(gigId, 'musician.withdraw.application', { applicants: updatedApplicants });

    const batch = writeBatch(firestore);
    const pruneApps = (apps = []) =>
      apps.filter(entry => !(entry?.gigId === gigId && entry?.profileId === applicantId));

    const musicianRef = doc(firestore, 'musicianProfiles', applicantId);
    let apps = Array.isArray(profile.gigApplications) ? profile.gigApplications : null;
    if (!apps) {
      const musSnap = await getDoc(musicianRef);
      apps = Array.isArray(musSnap.data()?.gigApplications) ? musSnap.data().gigApplications : [];
    }
    batch.update(musicianRef, { gigApplications: pruneApps(apps) });


    await batch.commit();

    const venueRef = doc(firestore, 'venueProfiles', gig.venueId);
    const venueSnap = await getDoc(venueRef);
    const venueProfile = venueSnap.exists() ? (venueSnap.data() || {}) : {};

    const conversationId = await getOrCreateConversation(
      profile,
      { ...gig, gigId },
      venueProfile,
      'withdrawal'
    );

    const lastAppMsg = await getMostRecentMessage(conversationId, 'application');
    const lastNegMsg = await getMostRecentMessage(conversationId, 'negotiation');

    if (lastAppMsg?.id) {
      await updateMessage(
        conversationId,
        lastAppMsg.id,
        { status: "withdrawn" },
        {
          lastMessage: `${profile.name} has withdrawn their application.`,
          lastMessageSenderId: "system",
        },
      );
    }
    
    // Do the same for negotiation, if present
    if (lastNegMsg?.id) {
      await updateMessage(
        conversationId,
        lastNegMsg.id,
        { status: "withdrawn" },
        {
          lastMessage: `${profile.name} has withdrawn their application.`,
          lastMessageSenderId: "system",
        },
      );
    }

    return updatedApplicants;
  } catch (error) {
    console.error('[Firestore Error] withdrawMusicianApplication:', error);
  }
}
