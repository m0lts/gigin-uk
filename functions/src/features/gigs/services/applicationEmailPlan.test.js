import test from "node:test";
import assert from "node:assert/strict";
import {
  earliestFlush,
  planFlush,
  planRecipientWindow,
} from "./applicationEmailPlan.js";

const NOW = 1_700_000_000_000;

test("first application sends now and opens a 60 minute window", () => {
  const plan = planRecipientWindow({
    now: NOW,
    window: null,
    applicantIds: ["a"],
    viewedIds: new Set(),
  });
  assert.equal(plan.sends.length, 1);
  assert.equal(plan.sends[0].kind, "single");
  assert.deepEqual(plan.sends[0].applicantIds, ["a"]);
  assert.equal(plan.window.until, NOW + 60 * 60 * 1000);
  assert.deepEqual(plan.window.queued, []);
});

test("later applications in the same write queue behind the single", () => {
  const plan = planRecipientWindow({
    now: NOW,
    window: null,
    applicantIds: ["a", "b", "c"],
    viewedIds: new Set(),
  });
  assert.deepEqual(plan.sends[0].applicantIds, ["a"]);
  assert.deepEqual(plan.window.queued, ["b", "c"]);
});

test("applications inside the window are queued and not sent", () => {
  const plan = planRecipientWindow({
    now: NOW + 10 * 60 * 1000,
    window: {until: NOW + 60 * 60 * 1000, queued: ["b"]},
    applicantIds: ["c"],
    viewedIds: new Set(),
  });
  assert.deepEqual(plan.sends, []);
  assert.deepEqual(plan.window.queued, ["b", "c"]);
});

test("viewed applicants are skipped", () => {
  const plan = planRecipientWindow({
    now: NOW,
    window: null,
    applicantIds: ["a"],
    viewedIds: new Set(["a"]),
  });
  assert.deepEqual(plan.sends, []);
  assert.equal(plan.window, null);
});

test("flush sends a batch, or a single when only one remains", () => {
  const batch = planFlush({
    now: NOW + 60 * 60 * 1000,
    window: {until: NOW + 60 * 60 * 1000, queued: ["b", "c"]},
    viewedIds: new Set(),
  });
  assert.equal(batch.sends[0].kind, "batch");
  assert.equal(batch.window, null);

  const single = planFlush({
    now: NOW + 60 * 60 * 1000,
    window: {until: NOW + 60 * 60 * 1000, queued: ["b", "c"]},
    viewedIds: new Set(["b"]),
  });
  assert.equal(single.sends[0].kind, "single");
  assert.deepEqual(single.sends[0].applicantIds, ["c"]);

  const none = planFlush({
    now: NOW + 60 * 60 * 1000,
    window: {until: NOW + 60 * 60 * 1000, queued: ["b"]},
    viewedIds: new Set(["b"]),
  });
  assert.deepEqual(none.sends, []);
  assert.equal(none.window, null);
});

test("flush waits while the window is open", () => {
  const plan = planFlush({
    now: NOW,
    window: {until: NOW + 1000, queued: ["b"]},
    viewedIds: new Set(),
  });
  assert.deepEqual(plan.sends, []);
  assert.ok(plan.window);
});

test("earliest flush is the soonest queued window", () => {
  const at = earliestFlush({
    one: {until: NOW + 5000, queued: ["a"]},
    two: {until: NOW + 1000, queued: []},
    three: {until: NOW + 2000, queued: ["b"]},
  });
  assert.equal(at, NOW + 2000);
});
