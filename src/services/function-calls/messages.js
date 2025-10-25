import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';


/**
 * Sends a text message via CF and updates conversation metadata.
 */
export async function sendMessage(conversationId, message) {
  try {
    const fn = httpsCallable(functions, "sendMessage");
    const { data } = await fn({ conversationId, message });
    return data?.timestamp ?? null;
  } catch (error) {
    console.error("[CloudFn Error] sendMessage:", error);
  }
}

/**
 * Updates a text message via CF and updates conversation metadata.
 */
export async function updateMessage(conversationId, messageId, updates, conversationUpdates) {
  try {
    const fn = httpsCallable(functions, "updateMessageDoc");
    const { data } = await fn({ conversationId, messageId, updates, conversationUpdates });
    return data?.timestamp ?? null;
  } catch (error) {
    console.error("[CloudFn Error] updateMessage:", error);
  }
}

/**
 * Sends gig-accepted announcement via CF and updates conversation metadata.
 */
export async function sendGigAcceptedMessage(
  conversationId,
  originalMessageId,
  senderId,
  agreedFee,
  userRole,
  nonPayableGig = false
) {
  try {
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
  } catch (error) {
    console.error("[CloudFn Error] sendGigAcceptedMessage:", error);
  }
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
  try {
    const fn = httpsCallable(functions, "updateDeclinedApplicationMessage");
    const { data } = await fn({
      conversationId,
      originalMessageId,
      senderId,
      userRole,
      fee,
    });
    return data;
  } catch (error) {
    console.error("[CloudFn Error] updateDeclinedApplicationMessage:", error);
  }
}

/**
 * Sends a counter-offer message via CF and updates conversation metadata.
 */
export async function sendCounterOfferMessage(
  conversationId,
  messageId,
  senderId,
  newFee,
  oldFee,
  userRole
) {
  try {
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
  } catch (error) {
    console.error("[CloudFn Error] sendCounterOfferMessage:", error);
  }
}

/**
 * Sends a system dispute message to a conversation via CF.
 */
export async function sendDisputeMessage(conversationId, venueName) {
  try {
    const fn = httpsCallable(functions, "sendDisputeMessage");
    const { data } = await fn({ conversationId, venueName });
    return data?.timestamp ?? null;
  } catch (error) {
    console.error("[CloudFn Error] sendDisputeMessage:", error);
  }
}

/**
 * Closes the most recent 'review' message and updates convo metadata via CF.
 */
export async function updateReviewMessageStatus(conversationId, messages, userId) {
  try {
    const fn = httpsCallable(functions, "updateReviewMessageStatus");
    const { data } = await fn({ conversationId, messages, userId });
    return data?.messageId ?? null;
  } catch (error) {
    console.error("[CloudFn Error] updateReviewMessageStatus:", error);
  }
}

/**
 * Posts a cancellation message via CF.
 */
export async function postCancellationMessage(conversationId, senderId, message, cancellingParty) {
  try {
    const fn = httpsCallable(functions, "postCancellationMessage");
    const { data } = await fn({ conversationId, senderId, message, cancellingParty });
    return data?.success === true;
  } catch (error) {
    console.error("[CloudFn Error] postCancellationMessage:", error);
  }
}