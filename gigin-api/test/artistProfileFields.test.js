import test from "node:test";
import assert from "node:assert/strict";
import { clientProfileUpdates } from "../lib/artistProfileFields.js";

test("profile updates keep editor fields and drop server-managed ones", () => {
  const next = clientProfileUpdates({
    bio: "A trio.",
    spotifyUrl: "https://open.spotify.com/artist/1",
    youtubeUrl: "https://youtube.com/watch?v=1",
    instagramUrl: "https://instagram.com/trio",
    websiteUrl: "https://trio.example",
    techRider: { pa: true },
    heroMedia: { path: "artistProfiles/a/hero/a.jpg" },
    status: "live",
    slug: "hacked",
    playedAt: [{ venueName: "nope" }],
    source: "guest_keep",
    guestApplicationIds: ["x"],
    contactEmailHash: "abc",
  });
  assert.equal(next.bio, "A trio.");
  assert.equal(next.spotifyUrl, "https://open.spotify.com/artist/1");
  assert.deepEqual(next.techRider, { pa: true });
  assert.equal(next.heroMedia.path, "artistProfiles/a/hero/a.jpg");
  assert.equal(Object.prototype.hasOwnProperty.call(next, "status"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(next, "slug"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(next, "playedAt"), false);
  assert.equal(clientProfileUpdates({ status: "complete" }).status, "complete");
  assert.equal(clientProfileUpdates({ status: "draft" }).status, "draft");
});
