import test from "node:test";
import assert from "node:assert/strict";
import { declinedApplicationMessage } from "../lib/outboundMail.js";

test("a decline names the venue and gig it was for", () => {
  const mail = declinedApplicationMessage({
    firstName: "Sam",
    booker: "Toby",
    venueName: "Hot Numbers",
    gigName: "Discovery Sessions",
    when: "Thu 10 Dec",
    kindWord: "Really liked Small Hours.",
    openGigs: [{
      url: "https://giginmusic.com/gig/sunday",
      name: "Sunday Sessions",
      place: "Thirsty · Chesterton Road",
      when: "Sun 10",
    }],
    venueUrl: "https://giginmusic.com/venues/hot",
  });
  assert.match(mail.subject, /Discovery Sessions/);
  assert.match(mail.text, /couldn't fit you in this time/);
  assert.match(mail.text, /Hot Numbers has your details/);
  assert.match(mail.text, /Toby wrote/);
  assert.match(mail.text, /Really liked Small Hours/);
  assert.match(mail.text, /Gigs looking for acts like you/);
  assert.match(mail.text, /Sunday Sessions/);
  assert.match(mail.html, /https:\/\/giginmusic.com\/gig\/sunday/);
  assert.match(mail.html, /See upcoming gigs at Hot Numbers/);
  assert.doesNotMatch(mail.text, /Jesus College/);
  assert.doesNotMatch(mail.text, /the bar/i);
});

test("a decline with no kind word and no other gigs leaves both out", () => {
  const mail = declinedApplicationMessage({
    firstName: "Ada",
    booker: "Sam",
    venueName: "The Mill",
    gigName: "Thursday Folk",
    when: "Thu 2 Apr",
    kindWord: "   ",
    openGigs: [],
    venueUrl: "https://giginmusic.com/venues/mill",
  });
  assert.equal(mail.text.includes("wrote"), false);
  assert.equal(mail.text.includes("Gigs looking for acts like you"), false);
  assert.match(mail.text, /The Mill/);
  assert.match(mail.text, /Thursday Folk/);
  assert.match(mail.text, /couldn't fit you in this time/);
});
