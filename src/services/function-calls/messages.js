import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';


/**
 * Sends a text message via CF and updates conversation metadata.
 * @param {string} conversationId
 * @param {{ senderId: string, text: string }} message
 * @returns {Promise<number>} timestamp (ms)
 */
export async function sendMessage(conversationId, message) {
    const fn = httpsCallable(functions, "sendMessage");
    const { data } = await fn({ conversationId, message });
    return data?.timestamp ?? null;
}

/**
 * Sends gig-accepted announcement via CF and updates conversation metadata.
 * @returns {Promise<number>} timestamp in ms
 */
export async function sendGigAcceptedMessage(
    conversationId,
    originalMessageId,
    senderId,
    agreedFee,
    userRole,
    nonPayableGig = false
  ) {
    const fn = httpsCallable(functions, "sendGigAcceptedMessage");
    const { data } = await fn({
      conversationId,
      originalMessageId,
      senderId,
      agreedFee,
      userRole,
      nonPayableGig,
    });
    return data?.timestamp ?? null;
}

/**
 * Marks an application message as declined and updates conversation metadata.
 */
export async function updateDeclinedApplicationMessage(
    conversationId,
    originalMessageId,
    senderId,
    userRole,
    fee = null
  ) {
    const fn = httpsCallable(functions, "updateDeclinedApplicationMessage");
    const { data } = await fn({
      conversationId,
      originalMessageId,
      senderId,
      userRole,
      fee,
    });
    return data;
}

/**
 * Sends a counter-offer message via CF and updates conversation metadata.
 * @returns {Promise<number>} timestamp (ms)
 */
export async function sendCounterOfferMessage(
    conversationId,
    messageId,
    senderId,
    newFee,
    oldFee,
    userRole
  ) {
    const fn = httpsCallable(functions, "sendCounterOfferMessage");
    const { data } = await fn({
      conversationId,
      messageId,
      senderId,
      newFee,
      oldFee,
      userRole,
    });
    return data?.timestamp ?? null;
}


/**
 * Sends a system dispute message to a conversation via CF.
 * @returns {Promise<number>} timestamp (ms)
 */
export async function sendDisputeMessage(conversationId, venueName) {
    const fn = httpsCallable(functions, "sendDisputeMessage");
    const { data } = await fn({ conversationId, venueName });
    return data?.timestamp ?? null;
}

/**
 * Closes the most recent 'review' message and updates convo metadata via CF.
 * @param {string} conversationId
 * @param {Array<Object>} messages // pass the messages you already have in memory
 * @param {string} userId
 * @returns {Promise<string|null>} messageId that was closed
 */
export async function updateReviewMessageStatus(conversationId, messages, userId) {
    const fn = httpsCallable(functions, "updateReviewMessageStatus");
    const { data } = await fn({ conversationId, messages, userId });
    return data?.messageId ?? null;
}

/**
 * Posts a cancellation message via CF.
 * @param {string} conversationId
 * @param {string} senderId
 * @param {string} message
 * @param {string} cancellingParty
 */
export async function postCancellationMessage(conversationId, senderId, message, cancellingParty) {
    const fn = httpsCallable(functions, "postCancellationMessage");
    const { data } = await fn({ conversationId, senderId, message, cancellingParty });
    return data?.success === true;
  }