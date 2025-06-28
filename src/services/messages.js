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
  orderBy
} from 'firebase/firestore';

/*** CREATE OPERATIONS ***/

/**
 * Sends a new message and updates the conversation metadata.
 * @param {string} conversationId
 * @param {object} messageData { senderId, text }
 */
export const sendMessage = async (conversationId, { senderId, text }) => {
    const timestamp = Timestamp.now();
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      text,
      timestamp,
      type: 'text',
    });
    const conversationRef = doc(firestore, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      lastMessage: text,
      lastMessageTimestamp: timestamp,
      lastMessageSenderId: senderId,
    });
  };

/**
 * Sends a gig application message to a conversation thread.
 * 
 * @param {string} conversationId - The Firestore ID of the conversation.
 * @param {Object} options - Message details.
 * @param {string} options.senderId - UID of the sender.
 * @param {string} options.receiverId - UID of the receiver.
 * @param {string} options.text - Message content.
 * @returns {Promise<void>}
 */
export const sendGigApplicationMessage = async (conversationId, { senderId, receiverId, text, profileId, profileType }) => {
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      receiverId,
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
 * @param {string} options.receiverId - UID of the venue.
 * @param {string|number} options.oldFee - The originally listed fee.
 * @param {string|number} options.newFee - The newly proposed fee.
 * @param {string} options.text - The message content.
 */
export const sendNegotiationMessage = async (conversationId, { senderId, receiverId, oldFee, newFee, text }) => {
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
        senderId,
        receiverId,
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
 * @param {string} options.receiverId - UID of the receiver.
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


/**
 * Sends an announcement message after a gig is accepted and updates the conversation metadata.
 *
 * @param {string} conversationId - The ID of the conversation.
 * @param {string} originalMessageId - The ID of the offer message that's been accepted.
 * @param {string} senderId - The UID of the user who accepted the gig.
 * @param {string} agreedFee - The agreed fee for the gig.
 * @param {'musician' | 'venue'} userRole - The role of the user who accepted the gig.
 * @returns {Promise<Timestamp>} - The timestamp of the sent message.
 */
export const sendGigAcceptedMessage = async (conversationId, originalMessageId, senderId, agreedFee, userRole) => {
    const messageRef = doc(firestore, 'conversations', conversationId, 'messages', originalMessageId);
    await updateDoc(messageRef, {
        status: 'accepted',
    });
    const timestamp = Timestamp.now();
    const announcement = `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`;
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      text: announcement,
      timestamp,
      type: 'announcement',
      status: 'awaiting payment',
    });
    const conversationRef = doc(firestore, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      lastMessage: announcement,
      lastMessageTimestamp: timestamp,
      lastMessageSenderId: senderId,
    });
  
    return timestamp;
};

/**
 * Sends an announcement message after a gig is declined and updates the conversation metadata.
 * @param {string} conversationId
 * @param {string} messageId
 * @param {string} senderId
 * @param {string} userRole
 * @param {string | number} fee
 * @returns {Promise<void>}
 */
export const updateDeclinedApplicationMessage = async (
    conversationId,
    originalMessageId,
    senderId,
    userRole,
    fee = false,
  ) => {
    const timestamp = Timestamp.now();
    const messageRef = doc(firestore, 'conversations', conversationId, 'messages', originalMessageId);
    const lastMessage = fee ? `The fee of ${fee} was declined by the ${userRole}.` : 'The gig application has been declined.';
    await updateDoc(messageRef, {
      status: 'declined',
      timestamp,
    });
    const conversationRef = doc(firestore, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      lastMessage,
      lastMessageTimestamp: timestamp,
      lastMessageSenderId: senderId,
    });
  };

/**
 * Adds a new negotiation message, updates the countered message, and updates the conversation metadata.
 * @param {string} conversationId - ID of the conversation.
 * @param {string} messageId - ID of the original message being countered.
 * @param {string} senderId - ID of the user sending the counter.
 * @param {number} newFee - The newly proposed fee.
 * @param {number} oldFee - The previous fee.
 * @param {'musician' | 'venue'} userRole - Role of the sender.
 * @returns {Promise<void>}
 */
export const sendCounterOfferMessage = async (
    conversationId,
    messageId,
    senderId,
    newFee,
    oldFee,
    userRole
  ) => {
    const timestamp = Timestamp.now();
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      text: `The ${userRole} proposes a new fee:`,
      timestamp,
      type: 'negotiation',
      status: 'pending',
      oldFee,
      newFee,
    });
  
    const counteredRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(counteredRef, { status: 'countered' });
  
    const conversationRef = doc(firestore, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      lastMessage: `The ${userRole} proposes a new fee of ${newFee}.`,
      lastMessageTimestamp: timestamp,
      lastMessageSenderId: senderId,
    });
};

/**
 * Sends a system dispute message to a conversation.
 *
 * @param {string} conversationId - ID of the conversation.
 * @param {string} venueName - Name of the venue.
 * @param {string} gigDate - ISO string or formatted gig date.
 * @returns {Promise<void>}
 */
export const sendDisputeMessage = async (conversationId, venueName) => {
  const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
  await addDoc(messagesRef, {
    senderId: 'system',
    text: `${venueName} has reported this gig. We have withheld the gig fee until the dispute is resolved. We will be in touch shortly.`,
    type: 'announcement',
    status: 'dispute',
    timestamp: Timestamp.now(),
  });
};

/**
 * Closes the most recent 'review' message and updates the conversation metadata.
 * @param {string} conversationId
 * @param {Array} messages
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const updateReviewMessageStatus = async (conversationId, messages, userId) => {
    const recentReviewMessage = messages
      .filter((message) => message.type === 'review')
      .reduce((latest, current) =>
        !latest || current.timestamp > latest.timestamp ? current : latest,
        null
      );
    if (!recentReviewMessage) return;
    const messageRef = doc(firestore, 'conversations', conversationId, 'messages', recentReviewMessage.id);
    const conversationRef = doc(firestore, 'conversations', conversationId);
    await Promise.all([
      updateDoc(messageRef, { status: 'closed' }),
      updateDoc(conversationRef, {
        lastMessage: 'Review submitted.',
        lastMessageTimestamp: Timestamp.now(),
        lastMessageSenderId: userId,
      }),
    ]);
    return recentReviewMessage.id;
  };

/**
 * Sends an announcement message into the conversation for a cancelled gig.
 * @param {string} conversationId - The conversation ID.
 * @param {string} senderId - The UID of the cancelling user.
 * @param {string} message - The cancellation message to send.
 * @returns {Promise<void>}
 */
export const postCancellationMessage = async (conversationId, senderId, message) => {
  const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
  await addDoc(messagesRef, {
    senderId,
    text: message,
    type: 'announcement',
    status: 'cancellation',
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
export const getMostRecentApplicationMessage = async (conversationId, type) => {
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


