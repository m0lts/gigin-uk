import { post } from '../http';

// Base: /api/conversations

export function getOrCreateConversation({ musicianProfile, gigData, venueProfile, type = 'application' }) {
  return post('/conversations/getOrCreateConversation', {
    body: { musicianProfile, gigData, venueProfile, type },
  });
}

export function updateConversationDocument({ convId, updates }) {
  return post('/conversations/updateConversationDocument', {
    body: { convId, updates },
  });
}

export function markGigApplicantAsViewed({ gigId, musicianId }) {
  return post('/conversations/markGigApplicantAsViewed', {
    body: { gigId, musicianId },
  });
}

export function notifyOtherApplicantsGigConfirmed({ gigData, acceptedMusicianId }) {
  return post('/conversations/notifyOtherApplicantsGigConfirmed', {
    body: { gigData, acceptedMusicianId },
  });
}

export function deleteConversation({ conversationId }) {
  return post('/conversations/deleteConversation', {
    body: { conversationId },
  });
}

export function addUserToVenueConversations({ venueId, uid }) {
  return post('/conversations/addUserToVenueConversations', {
    body: { venueId, uid },
  });
}


