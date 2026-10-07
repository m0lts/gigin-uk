import test from "node:test";
import assert from "node:assert/strict";
import { ownerName } from "../lib/ownerName.js";

test("wording uses the venue owner's first name", () => {
  assert.equal(ownerName({ accountName: "Sam Hart", name: "Jesus College Bar", bookerDisplayName: "Jez" }), "Sam");
  assert.equal(ownerName({ name: "Jesus College Bar" }), "Jesus College Bar");
  assert.equal(ownerName({}, { venue: { venueName: "The Bar" } }), "The Bar");
  assert.equal(ownerName({}), "the venue");
});
