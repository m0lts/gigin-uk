import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTICE_WINDOW_MS,
  actKind,
  applicationNoticeMessage,
  applicationReviewUrl,
  noticeTrack,
  planVenueNotice,
  shouldNotify,
} from "../lib/venueApplicationNotice.js";

const item = (actName, extra = {}) => ({
  actName,
  gigName: "Sunday Soul",
  openSets: "Set 2",
  message: "We would love this night.",
  reviewUrl: "https://giginmusic.com/venues/dashboard/gigs/gig-applications?gig=night-1&tab=applications",
  applicantId: actName,
  othersWaiting: 0,
  ...extra,
});

test("the first application opens a window and waits to send", () => {
  const now = Date.parse("2026-10-02T12:00:00.000Z");
  const plan = planVenueNotice(null, item("Preference Act"), now);
  assert.equal(plan.batched, false);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.previousMailId, null);
  assert.equal(plan.sendAt, now + NOTICE_WINDOW_MS);
  const message = applicationNoticeMessage(plan.items);
  assert.equal(message.subject, "New request: Preference Act for Sunday Soul");
  assert.match(message.text, /Preference Act for Sunday Soul/);
  assert.match(message.text, /Sets still open: Set 2/);
  assert.match(message.text, /Listen and decide/);
  assert.match(message.html, /Listen and decide/);
  assert.match(message.html, /tab=applications/);
  assert.doesNotMatch(message.html, /Review the application/);
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
  assert.equal(applicationNoticeMessage(second.items).subject, "2 new requests");
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

test("the request card uses a real track and leaves where they have played out until it exists", () => {
  const message = applicationNoticeMessage([item("Maya", {
    actType: "Duo",
    trackUrl: "https://open.spotify.com/track/abc",
    othersWaiting: 2,
  })]);
  assert.match(message.html, /https:\/\/open\.spotify\.com\/track\/abc/);
  assert.doesNotMatch(message.html, /Where you've played/);
  assert.match(message.text, /2 more requests are waiting/);
  const played = applicationNoticeMessage([item("Maya", { played: "The Mill" })]);
  assert.match(played.html, /The Mill/);
  const file = noticeTrack({ assets: [{ name: "demo.mp3", contentType: "audio/mpeg" }] });
  assert.equal(file.trackName, "demo.mp3");
  assert.equal(actKind([{ name: "Maya" }, { name: "Jo" }]), "Duo");
  assert.equal(actKind([{ name: "Maya", instruments: ["Vocals"] }, { instruments: ["Guitar"] }]), "Duo · vocals, guitar");
  assert.equal(actKind([{ name: "" }, { instruments: [] }]), "");
  assert.match(applicationNoticeMessage([item("Maya", { actType: "Duo · vocals, guitar" })]).html, /Duo · vocals, guitar/);
  assert.match(applicationReviewUrl("night-1"), /tab=applications/);
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
