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

export const listenToUserConversations = (user, callback) => {
  try {
    const q = query(
      collection(firestore, 'conversations'),
      where('authorizedUserIds', 'array-contains', user.uid)
    );

    const merged = new Map();
    return onSnapshot(
      q,
      (snap) => {
        snap.docChanges().forEach((chg) => {
          const data = { id: chg.doc.id, ...chg.doc.data() };
          if (chg.type === 'removed') merged.delete(chg.doc.id);
          else merged.set(chg.doc.id, data);
        });
        callback(Array.from(merged.values()));
      },
      (e) => console.error('[Firestore Error] listenToUserConversations snapshot:', e)
    );
  } catch (e) {
    console.error('[Firestore Error] listenToUserConversations init:', e);
    return () => {};
  }
};

/**
 * Fetches all conversations that include a specific authorized user UID.
 */
export const getConversationsByParticipantId = async (participantId) => {
  try {
    const q = query(
      collection(firestore, 'conversations'),
      where('authorizedUserIds', 'array-contains', participantId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getConversationsByParticipantId:', error);
    return [];
  }
};

/**
 * Fetches all conversations that include a specific authorized user UID and match a specific gig ID.
 */
export const getConversationsByParticipantAndGigId = async (gigId, participantId) => {
  try {
    const q = query(
      collection(firestore, 'conversations'),
      where('authorizedUserIds', 'array-contains', participantId),
      where('gigId', '==', gigId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getConversationsByParticipantAndGigId:', error);
    return [];
  }
};

/**
 * Fetches all conversations that include any of the specified authorized user UIDs.
 */
export const getConversationsByParticipants = async (participantIds) => {
  try {
    if (!participantIds.length) return [];
    const q = query(
      collection(firestore, 'conversations'),
      where('authorizedUserIds', 'array-contains-any', participantIds)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getConversationsByParticipants:', error);
    return [];
  }
};

// /**
//  * Subscribes to real-time updates for all conversations involving the user's musician or venue profiles.
//  */
// export const listenToUserConversations = (user, callback) => {
//   try {
//     const convoRef = collection(firestore, 'conversations');
//     const queries = [];
//     if (user.musicianProfile?.musicianId) {
//       queries.push(query(convoRef, where('participants', 'array-contains', user.musicianProfile.musicianId)));
//     }
//     if (user.venueProfiles?.length) {
//       user.venueProfiles.forEach(venue => {
//         queries.push(query(convoRef, where('participants', 'array-contains', venue.id)));
//       });
//     }
//     const mergedConversations = new Map();
//     const onErr = (e) => console.error('[Firestore Error] listenToUserConversations snapshot:', e);

//     const unsubFns = queries.map(q =>
//       onSnapshot(
//         q,
//         (snapshot) => {
//           snapshot.docChanges().forEach(change => {
//             const data = { id: change.doc.id, ...change.doc.data() };
//             if (change.type === 'removed') {
//               mergedConversations.delete(change.doc.id);
//             } else {
//               mergedConversations.set(change.doc.id, data);
//             }
//           });
//           callback(Array.from(mergedConversations.values()));
//         },
//         onErr
//       )
//     );

//     return () => unsubFns.forEach(unsub => unsub());
//   } catch (error) {
//     console.error('[Firestore Error] listenToUserConversations init:', error);
//   }
// };

// /**
//  * Fetches all conversations that include a specific participant ID.
//  */
// export const getConversationsByParticipantId = async (participantId) => {
//   try {
//     const q = query(collection(firestore, 'conversations'), where('participants', 'array-contains', participantId));
//     const snapshot = await getDocs(q);
//     return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
//   } catch (error) {
//     console.error('[Firestore Error] getConversationsByParticipantId:', error);
//   }
// };

// /**
//  * Fetches all conversations that include a specific participant ID and match a specific gig ID.
//  */
// export const getConversationsByParticipantAndGigId = async (gigId, participantId) => {
//   try {
//     const q = query(
//       collection(firestore, 'conversations'),
//       where('participants', 'array-contains', participantId),
//       where('gigId', '==', gigId)
//     );
//     const snapshot = await getDocs(q);
//     return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
//   } catch (error) {
//     console.error('[Firestore Error] getConversationsByParticipantAndGigId:', error);
//   }
// };

// /**
//  * Fetches all conversations that include any of the specified participant IDs.
//  */
// export const getConversationsByParticipants = async (participantIds) => {
//   try {
//     if (!participantIds.length) return [];
//     const q = query(collection(firestore, 'conversations'), where('participants', 'array-contains-any', participantIds));
//     const snap = await getDocs(q);
//     return snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
//   } catch (error) {
//     console.error('[Firestore Error] getConversationsByParticipants:', error);
//   }
// };

/*** UPDATE OPERATIONS ***/

/**
 * Updates the 'lastViewed' timestamp for a conversation for a specific user.
 */
export const updateConversationLastViewed = async (conversationId, userId) => {
  try {
    const conversationRef = doc(firestore, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      [`lastViewed.${userId}`]: Timestamp.now()
    }, { merge: true });
  } catch (error) {
    console.error('[Firestore Error] updateConversationLastViewed:', error);
  }
};