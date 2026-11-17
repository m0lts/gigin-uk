import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptedPromoEmail,
  bookingEnquiryEmail,
  photosReadyEmail,
  promoNotifyPlan,
  promoReceivedEmail,
  promoRequestEmail,
  promoUpdatedEmail,
} from "../lib/extraEmails.js";

test("the five extra emails name the night and the next step", () => {
  const booked = acceptedPromoEmail({
    actName: "Maya",
    venueName: "Hot Numbers",
    gigName: "Discovery Sessions",
    when: "Thu 10 Dec",
    setLabel: "Set 1 · 19:30 to 20:15",
    place: "Hot Numbers, Cambridge",
  });
  assert.equal(booked.subject, "You're playing Discovery Sessions");
  assert.equal(booked.text.includes("send your promo"), true);
  assert.equal(booked.button, "Send my promo");

  const reminder = promoRequestEmail({
    actName: "Fen Street Trio",
    venueName: "Hot Numbers",
    when: "Thu 10 Dec",
    missing: ["Photos", "Audio or video"],
    hasBio: true,
  });
  assert.equal(reminder.subject, "Hot Numbers is waiting on your promo");
  assert.equal(reminder.text.includes("Your bio is already in"), true);

  const enquiry = bookingEnquiryEmail({
    venueName: "Mill Road Social",
    bookerName: "Sam",
    when: "Sat 16 Jan",
    fee: "",
    message: "Can you play acoustic?",
    onGigin: false,
  });
  assert.equal(enquiry.subject, "New booking enquiry from Mill Road Social");
  assert.equal(enquiry.text.includes("not on Gigin yet"), true);
  assert.equal(enquiry.text.includes("Not given"), true);

  const photos = photosReadyEmail({
    actName: "Maya",
    venueName: "Hot Numbers",
    gigName: "Discovery Sessions",
    when: "Thu 10 Dec",
  });
  assert.equal(photos.subject, "Photos from Discovery Sessions");
  assert.equal(photos.button, "View and download");

  const received = promoReceivedEmail({
    actName: "Maya Reid",
    gigName: "Discovery Sessions",
    when: "Thu 10 Dec",
    done: 1,
    total: 2,
    photos: 2,
    tracks: 1,
    consent: true,
  });
  assert.equal(received.subject, "Maya Reid sent their promo");
  assert.equal(received.text.includes("1 of 2"), true);
  assert.equal(received.text.includes("Consent: Given"), true);
});

test("a promo edit emails the venue at most once an hour", () => {
  const now = Date.parse("2026-11-17T09:00:00Z");
  assert.equal(promoNotifyPlan({ alreadySubmitted: false, now }), "received");
  assert.equal(promoNotifyPlan({ alreadySubmitted: true, lastUpdatedAt: "2026-11-17T08:30:00Z", now }), "skip");
  assert.equal(promoNotifyPlan({ alreadySubmitted: true, lastUpdatedAt: "2026-11-17T07:00:00Z", now }), "updated");
  assert.equal(promoUpdatedEmail({ actName: "Maya Reid", gigName: "Discovery Sessions", when: "Thu 10 Dec", done: 1, total: 2 }).subject, "Maya Reid updated their promo");
});
