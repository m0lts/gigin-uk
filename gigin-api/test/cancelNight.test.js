/**
 * Cancelling a night closes every set, keeps the applications, and queues
 * emails only for accepted acts and people still waiting.
 */
import { registerHooks } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";
import { store } from "./cancelNightFixture.js";

const fixtureUrl = new URL("./cancelNightFixture.js", import.meta.url).href;

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

const { cancelNight, undoCancelNight } = await import("../lib/nightApplicationOps.js");
const { NIGHTS_CLOSED_MESSAGE } = await import("../lib/venueApproval.js");

const OWNER = "owner-1";

function statuses(gigId) {
  const doc = store.get(`gigs/${gigId}/private/applications`);
  return Object.fromEntries((doc?.applicants || []).map((app) => [app.id, app.status]));
}

test("cancel emails the right people, is safe to repeat, and undo restores the night", async () => {
  const first = await cancelNight({
    gigId: "gig-night",
    reason: "The cellar flooded",
    callerUid: OWNER,
  });
  assert.equal(first.ok, true);
  assert.equal(first.accepted, 1);
  assert.equal(first.waiting, 1);

  for (const id of ["gig-night", "gig-set2"]) {
    const gig = store.get(`gigs/${id}`);
    assert.equal(gig.status, "cancelled");
    assert.equal(gig.applicationsOpen, false);
  }
  assert.deepEqual(statuses("gig-night"), {
    "accepted-act": "accepted",
    "waiting-act": "pending",
    "declined-act": "declined",
    "withdrawn-act": "withdrawn",
  });
  const lineup = store.get("gigs/gig-set2").applicants;
  assert.equal(lineup.length, 1);
  assert.equal(lineup[0].id, "accepted-act");
  assert.equal(lineup[0].status, "cancelled");
  assert.equal(store.get("gigs/gig-set2").bookedApplicantId, "accepted-act");

  const queued = store.mail();
  assert.equal(queued.length, 2);
  const recipients = queued.map((mail) => mail.to).sort();
  assert.deepEqual(recipients, ["accepted@guest.test", "waiting@guest.test"]);
  const acceptedMail = queued.find((mail) => mail.to === "accepted@guest.test");
  const waitingMail = queued.find((mail) => mail.to === "waiting@guest.test");
  assert.match(acceptedMail.message.subject, /^Jesus College Bar has cancelled Cellar Night on /);
  assert.match(acceptedMail.message.html, /The cellar flooded/);
  assert.match(acceptedMail.message.html, /Sam/);
  assert.doesNotMatch(acceptedMail.message.html, /Jez/);
  assert.match(acceptedMail.message.html, /\/application\/token-accepted/);
  assert.match(waitingMail.message.subject, /This night has been cancelled/);
  assert.match(waitingMail.message.html, /token-waiting/);
  assert.doesNotMatch(waitingMail.message.html, /Jez/);
  for (const mail of queued) {
    const delay = new Date(mail.delivery.startTime).getTime() - Date.now();
    assert.ok(delay > 4 * 60 * 1000 && delay < 6 * 60 * 1000, `email delay ${delay}`);
  }

  const mailBefore = store.mail().map((mail) => mail.path).sort();
  const second = await cancelNight({ gigId: "gig-night", reason: "again", callerUid: OWNER });
  assert.equal(second.already, true);
  assert.deepEqual(store.mail().map((mail) => mail.path).sort(), mailBefore);
  assert.equal(store.get("gigs/gig-night").status, "cancelled");
  assert.deepEqual(statuses("gig-night")["accepted-act"], "accepted");

  const undone = await undoCancelNight({ gigId: "gig-night", callerUid: OWNER });
  assert.equal(undone.ok, true);
  assert.equal(store.mail().length, 0);
  for (const id of ["gig-night", "gig-set2"]) {
    const gig = store.get(`gigs/${id}`);
    assert.equal(gig.status, "open");
    assert.equal(gig.applicationsOpen, true);
    assert.equal(gig.cancellationReason, undefined);
  }
  assert.equal(store.get("gigs/gig-set2").applicants[0].status, "confirmed");
  assert.equal(store.get("gigs/gig-night/private/applications").cancelUndo, undefined);
  assert.equal(statuses("gig-night")["accepted-act"], "accepted");
  assert.equal(statuses("gig-night")["waiting-act"], "pending");
});

test("a caller without gigs.update is refused and the night stays open", async () => {
  await assert.rejects(
    () => cancelNight({ gigId: "gig-locked", reason: "no", callerUid: "stranger" }),
    (error) => {
      assert.match(error.message, /PERMISSION_DENIED/);
      return true;
    },
  );
  assert.equal(store.get("gigs/gig-locked").status, "open");
  assert.equal(store.mail().some((mail) => mail.to === "locked@guest.test"), false);
});

test("a venue waiting for approval cannot cancel a night", async () => {
  await assert.rejects(
    () => cancelNight({ gigId: "gig-pending", reason: "no", callerUid: OWNER }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.message, NIGHTS_CLOSED_MESSAGE);
      return true;
    },
  );
  assert.equal(store.get("gigs/gig-pending").status, "open");
  assert.equal(store.get("gigs/gig-pending").applicationsOpen, true);
  assert.equal(store.mail().some((mail) => mail.to === "pending-venue@guest.test"), false);
});
