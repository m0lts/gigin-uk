/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  useMailOrigin,
  sendDisputeNoticeEmail,
  sendGigTimingEmail,
  sendGigApplicationEmail,
  sendNegotiationEmail,
  sendGigAcceptedEmail,
  sendGigDeclinedEmail,
  sendCounterOfferEmail,
  sendInvitationAcceptedEmailToVenue,
  sendBandInviteEmail,
  sendVenueInviteEmail,
  sendArtistInviteEmail,
  sendGigInviteEmail,
  sendTestimonialRequestEmail,
  sendDisputeLoggedEmail,
  sendVenueDisputeLoggedEmail,
} from "../lib/legacyMail.js";

const router = express.Router();

const kinds = {
  "dispute-notice": sendDisputeNoticeEmail,
  "gig-timing": sendGigTimingEmail,
  "gig-application": sendGigApplicationEmail,
  negotiation: sendNegotiationEmail,
  "gig-accepted": sendGigAcceptedEmail,
  "gig-declined": sendGigDeclinedEmail,
  "counter-offer": sendCounterOfferEmail,
  "invitation-accepted": sendInvitationAcceptedEmailToVenue,
  "band-invite": sendBandInviteEmail,
  "venue-invite": sendVenueInviteEmail,
  "artist-invite": sendArtistInviteEmail,
  "gig-invite": sendGigInviteEmail,
  "testimonial-request": sendTestimonialRequestEmail,
  "dispute-logged": sendDisputeLoggedEmail,
  "venue-dispute-logged": sendVenueDisputeLoggedEmail,
};

router.post("/:kind", requireAuth, asyncHandler(async (req, res) => {
  const send = kinds[req.params.kind];
  if (!send) return res.status(404).json({ error: "Not Found" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  useMailOrigin(body.origin);
  const args = { ...body };
  delete args.origin;
  await send(args);
  return res.json({ sent: true });
}));

export default router;
