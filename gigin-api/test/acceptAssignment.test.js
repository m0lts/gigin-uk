/**
 * Accepting onto a set, leaving a two-set night unassigned, and auto-placing a one-set night.
 */
import { registerHooks } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";
import { store } from "./acceptAssignmentFixture.js";

const fixtureUrl = new URL("./acceptAssignmentFixture.js", import.meta.url).href;

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

const { acceptApplication, assignApplication } = await import("../lib/nightApplicationOps.js");

function applicant(rootId, id) {
  return (store.get(`gigs/${rootId}/private/applications`).applicants || [])
    .find((entry) => entry.id === id);
}

function mailTo(address) {
  return store.mail().filter((mail) => mail.to === address);
}

test("accept with a set books that set and leaves the other open", async () => {
  const result = await acceptApplication({
    gigId: "gig-a",
    applicantId: "booked-act",
    slotGigId: "gig-b",
  });
  assert.equal(result.ok, true);
  assert.equal(applicant("gig-a", "booked-act").status, "accepted");
  assert.equal(applicant("gig-a", "booked-act").assignedSlotGigId, "gig-b");
  assert.equal(store.get("gigs/gig-b").bookedApplicantId, "booked-act");
  assert.equal(store.get("gigs/gig-a").bookedApplicantId || null, null);
  const lineup = store.get("gigs/gig-b").applicants || [];
  assert.equal(lineup.some((entry) => entry.id === "booked-act" && entry.status === "confirmed"), true);
  assert.equal((store.get("gigs/gig-a").applicants || []).some((entry) => entry.id === "booked-act"), false);
});

test("choose later on a two-set night stays unassigned until a set is assigned", async () => {
  const accepted = await acceptApplication({
    gigId: "gig-c",
    applicantId: "later-act",
    slotGigId: null,
    deferSet: true,
  });
  assert.equal(accepted.ok, true);
  assert.match(accepted.toast, /set time is still to be confirmed/);
  const waiting = applicant("gig-c", "later-act");
  assert.equal(waiting.status, "accepted");
  assert.equal(waiting.assignedSlotGigId, null);
  assert.equal(store.get("gigs/gig-c").bookedApplicantId || null, null);
  assert.equal(store.get("gigs/gig-d").bookedApplicantId || null, null);
  assert.equal((store.get("gigs/gig-c").applicants || []).some((entry) => entry.id === "later-act"), false);
  assert.equal((store.get("gigs/gig-d").applicants || []).some((entry) => entry.id === "later-act"), false);
  const letter = mailTo("later@guest.test").map((mail) => mail.message?.text || "").join("\n");
  assert.match(letter, /we'll confirm your set time/i);
  assert.equal(letter.includes("20:00"), false);
  assert.equal(letter.includes("21:00"), false);
  assert.equal(letter.includes("Set 1"), false);
  assert.equal(letter.includes("Set 2"), false);

  const assigned = await assignApplication({
    gigId: "gig-c",
    applicantId: "later-act",
    slotGigId: "gig-c",
  });
  assert.equal(assigned.ok, true);
  assert.equal(applicant("gig-c", "later-act").assignedSlotGigId, "gig-c");
  assert.equal(store.get("gigs/gig-c").bookedApplicantId, "later-act");
  assert.equal(store.get("gigs/gig-d").bookedApplicantId || null, null);
});

test("a one-set night with no slot id is placed on the only set", async () => {
  const result = await acceptApplication({ gigId: "gig-one", applicantId: "solo-act" });
  assert.equal(result.ok, true);
  const solo = (store.get("gigs/gig-one/private/applications").applicants || [])
    .find((entry) => entry.id === "solo-act");
  assert.equal(solo.status, "accepted");
  assert.equal(solo.assignedSlotGigId, "gig-one");
  assert.equal(store.get("gigs/gig-one").bookedApplicantId, "solo-act");
});
