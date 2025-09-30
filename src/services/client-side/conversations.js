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
  writeBatch,
  limit,
  startAfter,
  serverTimestamp
} from 'firebase/firestore';


/*** READ OPERATIONS ***/

/**
 * Subscribes to real-time updates for all conversations involving the user's musician or venue profiles.
 * 
 * @param {Object} user - The current authenticated user.
 * @param {function} callback - Function to call with the full merged list of updated conversations.
 * @returns {function} - Unsubscribe function to stop listening.
 */
export const listenToUserConversations = (user, callback) => {
  const convoRef = collection(firestore, 'conversations');
  const queries = [];
  if (user.musicianProfile?.musicianId) {
    queries.push(query(convoRef, where('participants', 'array-contains', user.musicianProfile.musicianId)));
  }
  if (user.venueProfiles?.length) {
    user.venueProfiles.forEach(venue => {
      queries.push(query(convoRef, where('participants', 'array-contains', venue.id)));
    });
  }
  const mergedConversations = new Map();
  const unsubFns = queries.map(q =>
    onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        const data = { id: change.doc.id, ...change.doc.data() };
        if (change.type === 'removed') {
          mergedConversations.delete(change.doc.id);
        } else {
          mergedConversations.set(change.doc.id, data);
        }
      });
      callback(Array.from(mergedConversations.values()));
    })
  );

  return () => unsubFns.forEach(unsub => unsub());
};

/**
 * Fetches all conversations that include a specific participant ID.
 *
 * @param {string} participantId - The ID of the participant to search for in the conversation.
 * @returns {Promise<Array<Object>>} An array of conversation documents (`{ id, ref, ...data }`).
 */
export const getConversationsByParticipantId = async (participantId) => {
    const q = query(collection(firestore, 'conversations'), where('participants', 'array-contains', participantId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

/**
 * Fetches all conversations that include a specific participant ID and match a specific gig ID.
 *
 * @param {string} gigId - The ID of the gig to filter conversations by.
 * @param {string} participantId - The ID of the participant to search for in the conversation.
 * @returns {Promise<Array<Object>>} An array of conversation documents (`{ id, ref, ...data }`).
 */
export const getConversationsByParticipantAndGigId = async (gigId, participantId) => {
  const q = query(
    collection(firestore, 'conversations'),
    where('participants', 'array-contains', participantId),
    where('gigId', '==', gigId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

/**
 * Fetches all conversations that include any of the specified participant IDs.
 *
 * @param {string[]} participantIds - An array of participant IDs.
 * @returns {Promise<Array<Object>>} An array of conversation documents (`{ id, ref, ...data }`).
 */
export const getConversationsByParticipants = async (participantIds) => {
    if (!participantIds.length) return [];
    const q = query(collection(firestore, 'conversations'), where('participants', 'array-contains-any', participantIds));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

/*** UPDATE OPERATIONS ***/

/**
 * Updates the 'lastViewed' timestamp for a conversation for a specific user.
 * 
 * @param {string} conversationId 
 * @param {string} userId 
 */
export const updateConversationLastViewed = async (conversationId, userId) => {
    const conversationRef = doc(firestore, 'conversations', conversationId);
    await updateDoc(conversationRef, {
        [`lastViewed.${userId}`]: Timestamp.now()
    });
};
