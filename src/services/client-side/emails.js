import { post } from '../http';

function send(kind, body = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return post(`/mail/${kind}`, { body: { ...body, origin } });
}

export const sendDisputeNoticeEmail = (body) => send('dispute-notice', body);
export const sendGigTimingEmail = (body) => send('gig-timing', body);
export const sendGigApplicationEmail = (body) => send('gig-application', body);
export const sendNegotiationEmail = (body) => send('negotiation', body);
export const sendGigAcceptedEmail = (body) => send('gig-accepted', body);
export const sendGigDeclinedEmail = (body) => send('gig-declined', body);
export const sendCounterOfferEmail = (body) => send('counter-offer', body);
export const sendInvitationAcceptedEmailToVenue = (body) => send('invitation-accepted', body);
export const sendBandInviteEmail = (body) => send('band-invite', body);
export const sendVenueInviteEmail = (body) => send('venue-invite', body);
export const sendArtistInviteEmail = (body) => send('artist-invite', body);
export const sendGigInviteEmail = (body) => send('gig-invite', body);
export const sendTestimonialRequestEmail = (body) => send('testimonial-request', body);
export const sendDisputeLoggedEmail = (body) => send('dispute-logged', body);
export const sendVenueDisputeLoggedEmail = (body) => send('venue-dispute-logged', body);
