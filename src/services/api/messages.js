import { post } from '../http';

export async function sendMessage({ conversationId, message }) {
  const data = await post('/messages/sendMessage', { body: { conversationId, message } });
  return data;
}

export async function sendCounterOfferMessage({ conversationId, messageId, senderId, newFee, oldFee, userRole }) {
  const data = await post('/messages/sendCounterOfferMessage', { body: { conversationId, messageId, senderId, newFee, oldFee, userRole } });
  return data;
}

export async function sendGigAcceptedMessage({ conversationId, originalMessageId, senderId, agreedFee, userRole, nonPayableGig = false }) {
  const data = await post('/messages/sendGigAcceptedMessage', { body: { conversationId, originalMessageId, senderId, agreedFee, userRole, nonPayableGig } });
  return data;
}

export async function sendGigAcceptanceAnnouncement({ conversationId, senderId, text, nonPayableGig = false }) {
  const data = await post('/messages/sendGigAcceptanceAnnouncement', { body: { conversationId, senderId, text, nonPayableGig } });
  return data;
}

export async function postCancellationMessage({ conversationId, senderId, message, cancellingParty }) {
  const data = await post('/messages/postCancellationMessage', { body: { conversationId, senderId, message, cancellingParty } });
  return data;
}

export async function sendDisputeMessage({ conversationId, venueName }) {
  const data = await post('/messages/sendDisputeMessage', { body: { conversationId, venueName } });
  return data;
}

export async function updateDeclinedApplicationMessage({ conversationId, originalMessageId, senderId, userRole, fee = null }) {
  const data = await post('/messages/updateDeclinedApplicationMessage', { body: { conversationId, originalMessageId, senderId, userRole, fee } });
  return data;
}

export async function updateMessageDoc({ conversationId, messageId, updates, conversationUpdates }) {
  const data = await post('/messages/updateMessageDoc', { body: { conversationId, messageId, updates, conversationUpdates } });
  return data;
}

export async function updateReviewMessageStatus({ conversationId, messages, userId }) {
  const data = await post('/messages/updateReviewMessageStatus', { body: { conversationId, messages, userId } });
  return data;
}