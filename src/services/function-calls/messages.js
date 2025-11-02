import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '@lib/firebase';

// Cloud Run API URL (for migrated functions)
// Set VITE_API_URL in .env file, e.g., VITE_API_URL=http://localhost:8080
const API_URL = import.meta.env.VITE_API_URL;

/**
 * Get Firebase ID token for authenticated requests
 */
async function getIdToken() {
  if (!auth.currentUser) {
    throw new Error("User not authenticated");
  }
  return auth.currentUser.getIdToken();
}

/**
 * Sends a text message via Cloud Run API or Cloud Functions (fallback).
 * 
 * If VITE_API_URL is set, uses Cloud Run API.
 * Otherwise, falls back to Cloud Functions.
 */
export async function sendMessage(conversationId, message) {
  try {
    // Try Cloud Run API first if URL is configured
    if (API_URL) {
      const token = await getIdToken();
      const response = await fetch(`${API_URL}/api/messages/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data?.timestamp ?? null;
    }

    // Fallback to Cloud Functions
    const fn = httpsCallable(functions, "sendMessage");
    const { data } = await fn({ conversationId, message });
    return data?.timestamp ?? null;
  } catch (error) {
    console.error("[API Error] sendMessage:", error);
    throw error; // Re-throw so UI can handle it
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