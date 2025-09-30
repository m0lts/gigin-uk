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
 * 
 * @param {string} conversationId - The Firestore ID of the conversation.
 * @param {Object} options - Message details.
 * @param {string} options.senderId - UID of the sender.
 * @param {string} options.text - Message content.
 * @returns {Promise<void>}
 */
export const sendGigApplicationMessage = async (conversationId, { senderId, text, profileId, profileType }) => {
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
};

/**
 * Sends a negotiation message in an existing conversation thread.
 * 
 * @param {string} conversationId - The Firestore ID of the conversation.
 * @param {Object} options
 * @param {string} options.senderId - UID of the musician.
 * @param {string|number} options.oldFee - The originally listed fee.
 * @param {string|number} options.newFee - The newly proposed fee.
 * @param {string} options.text - The message content.
 */
export const sendNegotiationMessage = async (conversationId, { senderId, oldFee, newFee, text }) => {
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
};

/**
 * Sends a gig application message to a conversation thread.
 * 
 * @param {string} conversationId - The Firestore ID of the conversation.
 * @param {Object} options - Message details.
 * @param {string} options.senderId - UID of the sender.
 * @param {string} options.text - Message content.
 * @returns {Promise<void>}
 */
export const sendGigInvitationMessage = async (conversationId, { senderId, text }) => {
  const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
  await addDoc(messagesRef, {
    senderId,
    text,
    type: 'invitation',
    status: 'pending',
    timestamp: Timestamp.now(),
  });
};



/*** READ OPERATIONS ***/

/**
 * Subscribes to real-time message updates for a conversation.
 * @param {string} conversationId - ID of the conversation.
 * @param {function} onUpdate - Callback to receive the updated array of messages.
 * @returns {function} Unsubscribe function.
 */
export const listenToMessages = (conversationId, onUpdate) => {
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    return onSnapshot(q, snapshot => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(messages);
    });
};

/**
 * Fetches the most recent 'application' type message from a conversation.
 *
 * @param {string} conversationId - ID of the conversation to search in.
 * @returns {Promise<Object|null>} - The most recent application message or null if not found.
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
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching application message:', error);
    throw error;
  }
};


