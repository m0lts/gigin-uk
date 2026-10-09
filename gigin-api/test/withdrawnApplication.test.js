/**
 * Accepting a withdrawn application must refuse before any write.
 */
import { registerHooks } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";
import { store } from "./withdrawnApplicationFixture.js";

const fixtureUrl = new URL("./withdrawnApplicationFixture.js", import.meta.url).href;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/gigin-api/config/admin.js")) {
      return {
        format: "module",
        shortCircuit: true,
        source: `export { db, admin, FieldValue, Timestamp, GeoPoint } from ${JSON.stringify(fixtureUrl)};\n`,
      };
    }
    return nextLoad(url, context);
  },
});

const { acceptApplication, assignApplication, undoApplication } = await import("../lib/nightApplicationOps.js");

async function assertUnchanged(run) {
  const before = store.snapshot();
  const writesBefore = store.writes.length;
  await assert.rejects(run, (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, "This act has withdrawn.");
    return true;
  });
  assert.equal(store.snapshot(), before);
  assert.equal(store.writes.length, writesBefore);
}

test("accepting a withdrawn application returns 409 and changes nothing", async () => {
  await assertUnchanged(() => acceptApplication({
    gigId: "gig-w",
    applicantId: "withdrawn-act",
    slotGigId: "gig-w",
  }));
});

test("assigning or undoing a withdrawn application returns 409 and changes nothing", async () => {
  await assertUnchanged(() => assignApplication({
    gigId: "gig-w",
    applicantId: "withdrawn-act",
    slotGigId: null,
  }));
  await assertUnchanged(() => undoApplication({
    gigId: "gig-w",
    applicantId: "withdrawn-act",
  }));
});

test("accepting a declined application returns 409 and changes nothing", async () => {
  const before = store.snapshot();
  const writesBefore = store.writes.length;
  await assert.rejects(
    () => acceptApplication({ gigId: "gig-d", applicantId: "declined-act", slotGigId: "gig-d" }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.message, "This act has been declined.");
      return true;
    },
  );
  assert.equal(store.snapshot(), before);
  assert.equal(store.writes.length, writesBefore);
});
