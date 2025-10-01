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
  limit
} from 'firebase/firestore';


/*** CREATE OPERATIONS ***/

/**
 * Sends a gig application message to a conversation thread.
 */
export const sendGigApplicationMessage = async (conversationId, { senderId, text, profileId, profileType }) => {
  try {
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      text,
      type: 'application',
      status: 'pending',
      profileId: profileId || null,
      profileType: profileType || null,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('[Firestore Error] sendGigApplicationMessage:', error);
  }
};

/**
 * Sends a negotiation message in an existing conversation thread.
 */
export const sendNegotiationMessage = async (conversationId, { senderId, oldFee, newFee, text }) => {
  try {
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      text,
      oldFee,
      newFee,
      type: 'negotiation',
      status: 'pending',
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('[Firestore Error] sendNegotiationMessage:', error);
  }
};

/**
 * Sends a gig invitation message to a conversation thread.
 */
export const sendGigInvitationMessage = async (conversationId, { senderId, text }) => {
  try {
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      text,
      type: 'invitation',
      status: 'pending',
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('[Firestore Error] sendGigInvitationMessage:', error);
  }
};


/*** READ OPERATIONS ***/

/**
 * Subscribes to real-time message updates for a conversation.
 */
export const listenToMessages = (conversationId, onUpdate) => {
  try {
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const onErr = (e) => console.error('[Firestore Error] listenToMessages snapshot:', e);
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(messages);
    }, onErr);
  } catch (error) {
    console.error('[Firestore Error] listenToMessages init:', error);
    return () => {};
  }
};

/**
 * Fetches the most recent message of a given type from a conversation.
 */
export const getMostRecentMessage = async (conversationId, type) => {
  try {
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    const messageQuery = query(
      messagesRef,
      where('type', '==', type),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(messageQuery);

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('[Firestore Error] getMostRecentMessage:', error);
    return null;
  }
};