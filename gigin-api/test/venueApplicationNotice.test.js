import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTICE_WINDOW_MS,
  applicationNoticeMessage,
  planVenueNotice,
  shouldNotify,
} from "../lib/venueApplicationNotice.js";

const item = (actName) => ({
  actName,
  nightDate: "Friday 2 October",
  preferredSet: "Set 2",
  reviewUrl: `https://giginmusic.com/venues/dashboard/gigs/gig-applications?gig=${actName}`,
  applicantId: actName,
});

test("the first application opens a window and waits to send", () => {
  const now = Date.parse("2026-10-02T12:00:00.000Z");
  const plan = planVenueNotice(null, item("Preference Act"), now);
  assert.equal(plan.batched, false);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.previousMailId, null);
  assert.equal(plan.sendAt, now + NOTICE_WINDOW_MS);
  const message = applicationNoticeMessage(plan.items);
  assert.equal(message.subject, "New application from Preference Act");
  assert.match(message.text, /Preference Act/);
  assert.match(message.text, /Friday 2 October/);
  assert.match(message.text, /Set 2/);
  assert.match(message.html, /Review the application/);
});

test("a second application inside the hour replaces the mail with one batch", () => {
  const now = Date.parse("2026-10-02T12:00:00.000Z");
  const first = planVenueNotice(null, item("Preference Act"), now);
  const second = planVenueNotice({
    openedAt: first.openedAt,
    items: first.items,
    mailId: "mail-1",
  }, item("Later Act"), now + 10 * 60 * 1000);
  assert.equal(second.batched, true);
  assert.equal(second.previousMailId, "mail-1");
  assert.equal(second.sendAt, now + NOTICE_WINDOW_MS);
  assert.deepEqual(second.items.map((row) => row.actName), ["Preference Act", "Later Act"]);
  assert.equal(applicationNoticeMessage(second.items).subject, "2 new applications");
});

test("an application after the hour starts a new email", () => {
  const now = Date.parse("2026-10-02T12:00:00.000Z");
  const first = planVenueNotice(null, item("Preference Act"), now);
  const later = planVenueNotice({
    openedAt: first.openedAt,
    items: first.items,
    mailId: "mail-1",
  }, item("Next Act"), now + NOTICE_WINDOW_MS);
  assert.equal(later.batched, false);
  assert.equal(later.previousMailId, null);
  assert.deepEqual(later.items.map((row) => row.actName), ["Next Act"]);
});

test("a venue with no inbox is skipped", () => {
  assert.equal(shouldNotify(null), false);
  assert.equal(shouldNotify(""), false);
  assert.equal(shouldNotify("not-an-email"), false);
  assert.equal(shouldNotify("booker@venue.test"), true);
});

test("act names are escaped so the email cannot carry markup", () => {
  const message = applicationNoticeMessage([{
    actName: "Amp <script>",
    nightDate: "Friday 2 October",
    preferredSet: "No preference",
    reviewUrl: "https://giginmusic.com/venues/dashboard/gigs/gig-applications?gig=1",
  }]);
  assert.match(message.html, /Amp &lt;script&gt;/);
  assert.doesNotMatch(message.html, /<script>/);
});
