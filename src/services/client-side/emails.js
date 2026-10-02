import { post } from '../http';
import { createGigInvite } from '../api/gigInvites';

function send(kind, body = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return post(`/mail/${kind}`, { body: { ...body, origin } });
}

export async function sendGigInviteEmail({ gigId, inviteId, crmEntryId, email, artistName, expiresAt } = {}) {
  let id = inviteId;
  if (!id) {
    const created = await createGigInvite({ gigId, crmEntryId, email, artistName, expiresAt });
    id = created?.inviteId;
  }
  return send('gig-invite', { inviteId: id });
}

export const sendVenueInviteEmail = ({ inviteId } = {}) => send('venue-invite', { inviteId });

export const sendGigTimingEmail = ({
  gigId,
  applicantId,
  oldStartTime,
  newStartTime,
  oldDuration,
  newDuration,
} = {}) => send('gig-timing', {
  gigId,
  applicantId,
  oldStartTime,
  newStartTime,
  oldDuration,
  newDuration,
});

export const sendGigApplicationEmail = ({ gigId } = {}) => send('gig-application', { gigId });
export const sendNegotiationEmail = ({ gigId } = {}) => send('negotiation', { gigId });
export const sendGigAcceptedEmail = ({ gigId, applicantId } = {}) => send('gig-accepted', { gigId, applicantId });
export const sendGigDeclinedEmail = ({ gigId, applicantId } = {}) => send('gig-declined', { gigId, applicantId });
export const sendCounterOfferEmail = ({ gigId, applicantId } = {}) => send('counter-offer', { gigId, applicantId });
export const sendInvitationAcceptedEmailToVenue = ({ gigId } = {}) => send('invitation-accepted', { gigId });

const removed = () => Promise.resolve({ sent: false });
export const sendDisputeNoticeEmail = removed;
export const sendBandInviteEmail = removed;
export const sendArtistInviteEmail = removed;
export const sendTestimonialRequestEmail = removed;
export const sendDisputeLoggedEmail = removed;
export const sendVenueDisputeLoggedEmail = removed;
