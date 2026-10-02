import test from "node:test";
import assert from "node:assert/strict";
import {
  artistContactDecision,
  capacityMatches,
  nextSlug,
  pressKitDecision,
  publicProfileHasSecrets,
  reminderEligible,
  confirmClaimDecision,
  passwordAcceptable,
  slugify,
  toPublicProfile,
  emailIndexKey,
  venueContactDecision,
} from "../lib/keepProfileLogic.js";

test("slug is unique and kebab-cased", () => {
  assert.equal(slugify("The Fen Street Trio"), "the-fen-street-trio");
  assert.equal(nextSlug("Trio", new Set(["trio"])), "trio-2");
  assert.equal(nextSlug("Trio", new Set(["trio", "trio-2"])), "trio-3");
});

test("public profile never includes email or phone", () => {
  const profile = toPublicProfile({
    name: "Trio",
    slug: "trio",
    status: "live",
    email: "secret@example.com",
    phone: "07000000000",
    contactEmail: "secret@example.com",
    contactEmailHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    whatsapp: true,
    bio: "A trio.",
    publicFields: { photo: true, bio: true, links: true, members: true, tech: true },
  }, "id-1");
  assert.equal(publicProfileHasSecrets(profile), false);
  assert.equal(profile.bio, "A trio.");
  assert.equal(JSON.stringify(profile).includes("secret@example.com"), false);
  assert.equal(JSON.stringify(profile).includes("07000000000"), false);
  assert.equal(JSON.stringify(profile).includes("contactEmailHash"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, "contactEmailHash"), false);
});

test("email index key is an HMAC and fails closed without a secret", () => {
  const key = emailIndexKey("Artist@Example.com", "server-secret");
  assert.equal(key, emailIndexKey("  artist@example.com ", "server-secret"));
  assert.notEqual(key, emailIndexKey("artist@example.com", "other-secret"));
  assert.equal(key.length, 64);
  assert.equal(emailIndexKey("artist@example.com", ""), "");
});

test("switched-off sections are omitted", () => {
  const profile = toPublicProfile({
    name: "Trio",
    bio: "Hidden bio",
    publicFields: { bio: false, links: false, members: false, tech: false, photo: false },
    heroMedia: { path: "secret" },
  });
  assert.equal(profile.bio, undefined);
  assert.equal(profile.heroMedia, undefined);
});

test("artist contact is only for an application or a booking", () => {
  assert.equal(artistContactDecision({ applied: false, booked: false, cancelled: false }).allow, false);
  assert.equal(artistContactDecision({ applied: true, booked: false, cancelled: false }).reason, "applied");
  assert.equal(artistContactDecision({ applied: true, booked: true, cancelled: false }).reason, "booked");
  assert.equal(artistContactDecision({ applied: true, booked: false, cancelled: true }).allow, true);
});

test("press kit download requires a live booking", () => {
  assert.equal(pressKitDecision({ booked: false, cancelled: false, empty: false }).reason, "not_booked");
  assert.equal(pressKitDecision({ booked: false, cancelled: true, empty: false }).reason, "cancelled");
  assert.equal(pressKitDecision({ booked: true, cancelled: false, empty: true }).state, "empty");
  assert.equal(pressKitDecision({ booked: true, cancelled: false, empty: false }).state, "active");
});

test("venue contact values are withheld unless the viewer is allowed", () => {
  assert.equal(venueContactDecision({ signedIn: false }).show, "placeholder");
  assert.equal(venueContactDecision({ signedIn: true }).show, "open");
  assert.equal(venueContactDecision({ visibility: "invited", signedIn: true, invited: false }).show, "invited_only");
  assert.equal(venueContactDecision({ visibility: "invited", invited: true }).show, "open");
  assert.equal(venueContactDecision({ visibility: "nobody", signedIn: true, invited: true }).show, "nobody");
  assert.equal(venueContactDecision({ listed: true, signedIn: false }).show, "placeholder");
  assert.equal(venueContactDecision({ listed: true, signedIn: true }).show, "website");
});

test("the quiet reminder is sent at most when the offer was skipped", () => {
  assert.equal(reminderEligible({ keepProfileOffer: "dismissed", hasLiveProfile: false, reminderCount: 0 }), true);
  assert.equal(reminderEligible({ keepProfileOffer: "none", hasLiveProfile: false, reminderCount: 1 }), true);
  assert.equal(reminderEligible({ keepProfileOffer: "none", hasLiveProfile: false, reminderCount: 2 }), false);
  assert.equal(reminderEligible({ keepProfileOffer: "confirmed", hasLiveProfile: false, reminderCount: 0 }), false);
  assert.equal(reminderEligible({ keepProfileOffer: "sent", hasLiveProfile: false, reminderCount: 0 }), false);
  assert.equal(reminderEligible({ keepProfileOffer: "dismissed", hasLiveProfile: true, reminderCount: 0 }), false);
});

test("a kept profile needs a real password, and an existing account must log in", () => {
  assert.equal(passwordAcceptable("short"), false);
  assert.equal(passwordAcceptable("alllowercase1!"), false);
  assert.equal(passwordAcceptable("NoNumber!"), false);
  assert.equal(passwordAcceptable("NoSpecial1"), false);
  assert.equal(passwordAcceptable("GoodPass1!"), true);
  assert.equal(confirmClaimDecision({ tokenState: "ok", hasAuthUser: false }).action, "create");
  assert.equal(confirmClaimDecision({ tokenState: "ok", hasAuthUser: true, signedInUid: null }).action, "login");
  assert.equal(confirmClaimDecision({
    tokenState: "ok",
    hasAuthUser: true,
    signedInUid: "uid-1",
    existingUid: "uid-1",
    signedInEmail: "a@giginmusic.com",
    profileEmail: "a@giginmusic.com",
  }).action, "link");
  assert.equal(confirmClaimDecision({
    tokenState: "ok",
    hasAuthUser: true,
    signedInUid: "other",
    existingUid: "uid-1",
    signedInEmail: "a@giginmusic.com",
    profileEmail: "a@giginmusic.com",
  }).action, "forbidden");
  assert.equal(confirmClaimDecision({ tokenState: "expired", hasAuthUser: false }).action, "expired");
  assert.equal(confirmClaimDecision({ tokenState: "used", hasAuthUser: false }).action, "used");
});

test("capacity bands", () => {
  assert.equal(capacityMatches(40, "upto80"), true);
  assert.equal(capacityMatches(100, "upto80"), false);
  assert.equal(capacityMatches(100, "80to150"), true);
  assert.equal(capacityMatches(200, "150plus"), true);
  assert.equal(capacityMatches(null, "upto80"), false);
});
