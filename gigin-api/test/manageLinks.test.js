import test from "node:test";
import assert from "node:assert/strict";
import { applicationDateLabel, createWindowLimiter, isUpcomingOrRecent, manageLinksText } from "../lib/manageLinks.js";

test("a gig 14 London days ago is still recent and 15 days ago is not", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  assert.equal(isUpcomingOrRecent(new Date("2026-11-06T20:00:00Z"), now), true);
  assert.equal(isUpcomingOrRecent(new Date("2026-11-04T20:00:00Z"), now), false);
  assert.equal(isUpcomingOrRecent(null, now), false);
});

test("application dates read like Friday 14 November", () => {
  assert.equal(applicationDateLabel(new Date("2026-11-14T19:30:00Z")), "Saturday 14 November");
});

test("manage-link mail lists every application and the private-link footer", () => {
  const text = manageLinksText([
    { gigName: "Friday Night Live", venueName: "The Old Bakery", dateLabel: "Friday 14 November", url: "https://giginmusic.com/gig/1/application/abc" },
  ]);
  assert.match(text, /Here are the private links for your applications on Gigin/);
  assert.match(text, /Friday Night Live · The Old Bakery · Friday 14 November/);
  assert.match(text, /These links are private\. Don't forward them/);
});

test("rate limit allows 3 per email and then stops", () => {
  const limit = createWindowLimiter({ max: 3, windowMs: 1000 });
  assert.equal(limit.allow("a@b.co", 0), true);
  assert.equal(limit.allow("a@b.co", 10), true);
  assert.equal(limit.allow("a@b.co", 20), true);
  assert.equal(limit.allow("a@b.co", 30), false);
  assert.equal(limit.allow("a@b.co", 2000), true);
});
