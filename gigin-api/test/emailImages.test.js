import test from "node:test";
import assert from "node:assert/strict";
import {
  durableEmailImageUrl,
  emailImageOrigin,
  storageObjectPath,
  venueImageSource,
} from "../lib/emailImages.js";
import { applicationNoticeMessage } from "../lib/venueApplicationNotice.js";
import { renderArtistEmail } from "../lib/artistEmails.js";

const THUMB = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/email-thumbs%2Fabcdef0123456789abcdef0123456789.jpg?alt=media&token=stable-token";
const API_THUMB = "https://api.giginmusic.com/api/email-images/abcdef0123456789abcdef0123456789.jpg";
const SIGNED = "https://storage.googleapis.com/giginltd-dev.appspot.com/guest-applications/app/photo.jpg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=900&X-Goog-Signature=abc";
const ORIGINAL = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/guest-applications%2Fapp%2Fphoto.jpg?alt=media&token=rotating";

test("only a published email JPEG is embedded", () => {
  assert.equal(durableEmailImageUrl(THUMB), THUMB);
  assert.equal(durableEmailImageUrl(API_THUMB), API_THUMB);
  assert.equal(durableEmailImageUrl(SIGNED), "");
  assert.equal(durableEmailImageUrl(ORIGINAL), "");
  assert.equal(durableEmailImageUrl("http://127.0.0.1:9199/v0/b/bucket/o/email-thumbs%2Fabcdef0123456789abcdef0123456789.jpg"), "");
  assert.equal(durableEmailImageUrl(""), "");
  assert.equal(storageObjectPath("guest-applications/app/photo.jpg", "bucket"), "guest-applications/app/photo.jpg");
  assert.equal(storageObjectPath("../secret.jpg", "bucket"), "");
  assert.equal(storageObjectPath(SIGNED, "giginltd-dev.appspot.com"), "guest-applications/app/photo.jpg");
  assert.equal(storageObjectPath(SIGNED, "other-bucket"), "");
  assert.equal(venueImageSource({ photos: ["venues/bar/front.jpg"] }), "venues/bar/front.jpg");
  assert.equal(venueImageSource({}), "");
});

test("email image origin ignores local and non-https hosts", () => {
  const previous = process.env.EMAIL_IMAGE_ORIGIN;
  process.env.EMAIL_IMAGE_ORIGIN = "http://127.0.0.1:8080";
  assert.equal(emailImageOrigin(), "");
  process.env.EMAIL_IMAGE_ORIGIN = "https://api.giginmusic.com/";
  assert.equal(emailImageOrigin(), "https://api.giginmusic.com");
  if (previous == null) delete process.env.EMAIL_IMAGE_ORIGIN;
  else process.env.EMAIL_IMAGE_ORIGIN = previous;
});

test("a venue request email shows a thumbnail and leaves the frame out when there is no picture", () => {
  const bare = applicationNoticeMessage([{
    actName: "Maya",
    gigName: "Sunday Soul",
    reviewUrl: "https://giginmusic.com/venues/dashboard/gigs/gig-applications?gig=1&tab=applications",
    photoUrl: SIGNED,
    venueMarkUrl: ORIGINAL,
  }]);
  assert.equal(bare.text.includes("Maya"), true);
  assert.equal(bare.text.includes("Listen and decide"), true);
  assert.equal(bare.html.includes("<img"), false);
  assert.equal(bare.html.includes("width=\"72\""), false);
  assert.equal(bare.html.includes("width=\"36\""), false);
  const shown = applicationNoticeMessage([{
    actName: "Maya",
    gigName: "Sunday Soul",
    reviewUrl: "https://giginmusic.com/listen",
    photoUrl: THUMB,
    venueMarkUrl: API_THUMB,
  }]);
  assert.equal(shown.html.includes("email-thumbs%2Fabcdef0123456789abcdef0123456789.jpg"), true);
  assert.equal(shown.html.includes(API_THUMB), true);
  assert.equal(shown.text.length > 0, true);
});

test("booked, declined and promo mail keep a text part and omit an empty venue mark", () => {
  const booked = renderArtistEmail({
    subject: "You're in",
    heading: "You're playing Sunday Soul",
    paras: ["Hi Maya,"],
    brand: { name: "The Mill", imageUrl: SIGNED },
    callout: { title: "Send your promo", body: "A bio, a photo and a track." },
    button: ["Send your promo", "https://giginmusic.com/promo"],
    footer: "Sent by Gigin.",
  });
  assert.equal(booked.text.includes("You're playing Sunday Soul"), true);
  assert.equal(booked.text.includes("https://giginmusic.com/promo"), true);
  assert.equal(booked.html.includes("<img"), false);
  assert.equal(booked.html.includes("width:36px"), false);
  assert.equal(booked.html.includes("prefers-color-scheme"), false);
  const withMark = renderArtistEmail({
    subject: "Update",
    heading: "Thanks for applying",
    brand: { name: "The Mill", imageUrl: THUMB },
    footer: "Sent by Gigin.",
  });
  assert.equal(withMark.html.includes("email-thumbs%2Fabcdef0123456789abcdef0123456789.jpg"), true);
  assert.equal(withMark.text.includes("Thanks for applying"), true);
});
