import test from "node:test";
import assert from "node:assert/strict";
import { verificationContinueUrl } from "../lib/verificationLink.js";

test("verification continue URL uses BASE_URL, not the page origin", () => {
  assert.equal(
    verificationContinueUrl({ BASE_URL: "https://giginltd-dev.web.app" }),
    "https://giginltd-dev.web.app/",
  );
  assert.equal(
    verificationContinueUrl({ BASE_URL: "https://giginmusic.com/" }),
    "https://giginmusic.com/",
  );
  assert.equal(verificationContinueUrl({}), "https://giginmusic.com/");
});
