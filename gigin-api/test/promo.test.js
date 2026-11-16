import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPromoDay,
  preparePromo,
  bookedPromoWaiting,
  promoCaption,
  promoDueKey,
  promoMissingSentence,
  promoReminderCopy,
  promoZipPlan,
  promoEditable,
  promoIsIncomplete,
  promoReminderDue,
  promoReminderKey,
} from "../lib/promo.js";

const noon = (day) => `${day}T12:00:00.000Z`;

test("the due date is the later of two weeks before the gig and three days after acceptance", () => {
  assert.equal(promoDueKey(noon("2026-12-20"), noon("2026-11-01")), "2026-12-06");
  assert.equal(promoDueKey(noon("2026-12-10"), noon("2026-12-01")), "2026-12-04");
});

test("the due date is never after the day before the gig", () => {
  assert.equal(promoDueKey(noon("2026-12-05"), noon("2026-12-04")), "2026-12-04");
});

test("the reminder is once, three days before the due date, and not after the due date", () => {
  const due = promoDueKey(noon("2026-12-20"), noon("2026-11-01"));
  assert.equal(promoReminderKey(due), "2026-12-03");
  const base = {
    gigDate: noon("2026-12-20"),
    acceptedAt: noon("2026-11-01"),
    promo: {},
    status: "accepted",
    cancelled: false,
  };
  assert.equal(promoReminderDue({ ...base, todayKey: "2026-12-03" }), true);
  assert.equal(promoReminderDue({ ...base, todayKey: "2026-12-04" }), false);
  assert.equal(promoReminderDue({ ...base, todayKey: "2026-12-03", reminderSentAt: "2026-12-03T10:00:00.000Z" }), false);
  assert.equal(promoReminderDue({
    ...base,
    todayKey: "2026-12-03",
    promo: { bio: "Songs", photos: [{ path: "p" }], track: { url: "https://open.spotify.com/track/1" } },
  }), false);
  assert.equal(promoReminderDue({ ...base, todayKey: "2026-12-07" }), false);
});

test("a promo is missing until it has a bio, a photo, and a track", () => {
  assert.equal(promoIsIncomplete({}), true);
  assert.equal(promoIsIncomplete({ bio: "Songs", photos: [{ path: "p" }] }), true);
  assert.equal(promoIsIncomplete({ bio: "Songs", photos: [{ url: "https://example.com/a.jpg" }], track: { url: "https://example.com/song" } }), false);
  assert.equal(promoIsIncomplete({ bio: "Songs", photos: [{ path: "p" }], track: { path: "audio" }, played: "" }), false);
});

test("promo can be edited through the gig date", () => {
  assert.equal(promoEditable(noon("2026-12-20"), new Date(noon("2026-12-20"))), true);
  assert.equal(promoEditable(noon("2026-12-20"), new Date(noon("2026-12-21"))), false);
});

test("sending promo needs the permission tick, a bio, photos, and a track", () => {
  const who = { contactName: "Maya Reid", email: "maya@example.com" };
  assert.match(preparePromo({ permission: false }, who).error, /permission/i);
  assert.match(preparePromo({ permission: true, bio: "  ", photos: [{}], track: { url: "https://example.com" } }, who).error, /bio/i);
  assert.match(preparePromo({ permission: true, bio: "Songs", photos: [], track: { url: "https://example.com" } }, who).error, /photo/i);
  const five = [1, 2, 3, 4, 5].map((n) => ({ path: String(n) }));
  assert.match(preparePromo({ permission: true, bio: "Songs", photos: five, track: { url: "https://example.com" } }, who).error, /4/);
  assert.match(preparePromo({ permission: true, bio: "Songs", photos: [{ path: "p" }], track: {} }, who).error, /track/i);
  assert.match(preparePromo({ permission: true, bio: "Songs", photos: [{ path: "p" }], track: { url: "spotify:track" } }, who).error, /http/);
  const ready = preparePromo({
    permission: true,
    bio: " Songs from Cambridge ",
    photos: [{ path: "p" }],
    track: { url: "https://open.spotify.com/track/1" },
    videoUrl: "https://youtu.be/abc",
    played: "Hidden Rooms, The Portland Arms",
  }, who);
  assert.equal(ready.error, undefined);
  assert.equal(ready.promo.bio, "Songs from Cambridge");
  assert.equal(ready.promo.played, "Hidden Rooms, The Portland Arms");
  assert.equal(ready.promo.videoUrl, "https://youtu.be/abc");
  assert.equal(ready.track.url, "https://open.spotify.com/track/1");
  assert.equal(ready.permission.name, "Maya Reid");
  assert.equal(ready.permission.email, "maya@example.com");
  assert.ok(ready.permission.at);
  assert.equal(formatPromoDay("2026-11-26"), "Thu 26 Nov");
});

test("the promo caption uses the night and one line of each bio", () => {
  const caption = promoCaption({
    title: "Sunday Soul · Sunday 20 December at The Mill",
    acts: [
      { booked: true, name: "Maya", bio: "Songs from Cambridge\nSecond line" },
      { booked: false },
    ],
  });
  assert.match(caption, /Sunday Soul/);
  assert.match(caption, /Maya: Songs from Cambridge/);
  assert.doesNotMatch(caption, /Second line/);
  assert.match(caption, /The act is still to be announced/);
});

test("the missing promo sentence names the act and the due date", () => {
  assert.equal(
    promoMissingSentence([{ name: "Maya", missing: ["a photo", "a track"], dueLabel: "Thu 26 Nov" }]),
    "Maya needs a photo and a track by Thu 26 Nov.",
  );
});

test("a promo zip keeps stored files and leaves outside paths out", () => {
  const entries = promoZipPlan([{
    id: "app-1",
    name: "Maya Reid",
    bio: "Songs",
    photos: [{ path: "guest-applications/app-1/photo.jpg", name: "photo.jpg" }, { path: "../secret" }],
    track: { path: "guest-applications/app-1/song.mp3", name: "song.mp3" },
    videoUrl: "https://youtu.be/abc",
  }]);
  assert.deepEqual(entries.map((entry) => entry.name), [
    "Maya-Reid/promo.txt",
    "Maya-Reid/1-photo.jpg",
    "Maya-Reid/track-song.mp3",
  ]);
  assert.match(entries[0].text, /https:\/\/youtu.be\/abc/);
});

test("a manual promo reminder uses the same copy as the scheduled one", () => {
  const copy = promoReminderCopy({
    firstName: "Maya",
    venueName: "The Mill",
    gigName: "Sunday Soul",
    dueLabel: "Thu 26 Nov",
    manageUrl: "https://giginmusic.com/gig/1/application/token",
  });
  assert.equal(copy.subject, "Your promo for Sunday Soul is due Thu 26 Nov");
  assert.equal(copy.button[0], "Send your promo");
  assert.match(copy.paras[1], /The Mill still needs a bio, a photo and a track/);
});

test("promo waiting counts booked acts that still owe a bio, a photo, or a track", () => {
  const booked = { status: "accepted", assignedSlotGigId: "set-1" };
  assert.equal(bookedPromoWaiting([
    { ...booked, promo: { bio: "Songs", photos: [{ url: "https://example.com/a.jpg" }], track: { url: "https://open.spotify.com/track/1" } } },
    { ...booked, assignedSlotGigId: "set-2", promo: { bio: "Songs" } },
    { status: "pending", promo: null },
    { status: "accepted", promo: null },
  ]), 1);
});
