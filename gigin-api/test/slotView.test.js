import test from "node:test";
import assert from "node:assert/strict";
import { slotView } from "../lib/nightApplicationOps.js";

test("the document id wins over a stored gigId field", () => {
  const view = slotView({
    id: "set-2",
    data: () => ({ gigId: "set-1", gigName: "Thursday (Set 2)", startTime: "21:00" }),
  });
  assert.equal(view.gigId, "set-2");
  assert.equal(view.gigName, "Thursday (Set 2)");
  assert.equal(view.startTime, "21:00");
});

test("a slot record with a plain data object keeps the document id", () => {
  const view = slotView({ id: "set-2", data: { gigId: "set-1", startTime: "21:15" } });
  assert.equal(view.gigId, "set-2");
  assert.equal(view.startTime, "21:15");
});
