import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationsRootGigId,
  publicSlots,
  readNight,
  readSlotApplicants,
  slotTaken,
} from "../lib/nightApplications.js";

const slot = (gigId, startTime, extra = {}) => ({
  gigId,
  startTime,
  duration: 60,
  hint: extra.hint || "",
  applicants: extra.applicants || [],
  ...extra,
});

test("applications root is the earliest slot, and a single slot points at itself", () => {
  assert.equal(applicationsRootGigId([slot("late", "21:30"), slot("early", "20:00")]), "early");
  assert.equal(applicationsRootGigId([slot("only", "20:00")]), "only");
});

test("a stored applications root is kept when every slot agrees", () => {
  const slots = [
    slot("late", "21:30", { applicationsRootGigId: "early" }),
    slot("early", "20:00", { applicationsRootGigId: "early" }),
  ];
  assert.equal(applicationsRootGigId(slots), "early");
  const moved = [
    slot("late", "19:00", { applicationsRootGigId: "early" }),
    slot("early", "20:00", { applicationsRootGigId: "early" }),
  ];
  assert.equal(applicationsRootGigId(moved), "early");
});

test("old slotGigIds become the preference and copies de-duplicate by applicant id", () => {
  const night = readNight([
    slot("set-1", "20:00", {
      applicants: [{ id: "maya", name: "Maya Reid", status: "pending", slotGigIds: ["set-1", "set-2"] }],
    }),
    slot("set-2", "21:30", {
      applicants: [{ id: "maya", name: "Maya Reid", status: "pending", slotGigIds: ["set-1", "set-2"] }],
    }),
  ]);
  assert.equal(night.applications.length, 1);
  assert.deepEqual(night.applications[0].preferredSlotGigIds, ["set-1", "set-2"]);
  assert.equal(night.applications[0].assignedSlotGigId, null);
  assert.equal(night.applications[0].status, "pending");
  assert.equal(night.applicationsRootGigId, "set-1");
});

test("an empty preference is not replaced by slotGigIds", () => {
  const night = readNight([
    slot("set-1", "20:00", {
      applicants: [{
        id: "maya",
        status: "pending",
        preferredSlotGigIds: [],
        slotGigIds: ["set-1"],
      }],
    }),
  ]);
  assert.deepEqual(night.applications[0].preferredSlotGigIds, []);
});

test("logged-in copies with no slotGigIds prefer the slots they were written on", () => {
  const night = readNight([
    slot("set-1", "20:00", { applicants: [{ id: "band", status: "pending", name: "Blue" }] }),
    slot("set-2", "21:30", { applicants: [{ id: "band", status: "pending", name: "Blue" }] }),
  ]);
  assert.equal(night.applications.length, 1);
  assert.deepEqual(night.applications[0].preferredSlotGigIds, ["set-1", "set-2"]);
});

test("a confirmed copy is the assignment and the stronger status", () => {
  const night = readNight([
    slot("set-1", "20:00", {
      applicants: [{ id: "maya", status: "pending", slotGigIds: ["set-1", "set-2"], name: "Maya Reid" }],
    }),
    slot("set-2", "21:30", {
      applicants: [{ id: "maya", status: "confirmed", slotGigIds: ["set-1", "set-2"], name: "Maya Reid" }],
    }),
  ]);
  const maya = night.applications[0];
  assert.equal(maya.status, "confirmed");
  assert.equal(maya.assignedSlotGigId, "set-2");
  assert.equal(night.slots[1].bookedApplicantId, "maya");
  assert.equal(night.slots[1].taken, true);
  assert.equal(night.slots[0].taken, false);
});

test("an explicit empty assignment is not inferred from a confirmed row", () => {
  const night = readNight([
    slot("set-1", "20:00", {
      bookedApplicantId: null,
      applicants: [{
        id: "maya",
        status: "confirmed",
        assignedSlotGigId: null,
        preferredSlotGigIds: ["set-2"],
        name: "Maya Reid",
      }],
    }),
  ]);
  assert.equal(night.applications[0].assignedSlotGigId, null);
  assert.equal(night.slots[0].bookedApplicantId, null);
  assert.equal(slotTaken(night.slots[0]), false);
  assert.equal(night.slots[0].applicants.some((entry) => entry.status === "confirmed"), false);
});

test("public slots expose taken and no act names", () => {
  const slots = publicSlots([
    slot("set-2", "21:30", {
      hint: "Late",
      applicants: [{ id: "maya", status: "confirmed", name: "Maya Reid", email: "maya@example.com" }],
    }),
    slot("set-1", "20:00", { hint: "Early" }),
  ]);
  assert.deepEqual(slots, [
    { gigId: "set-1", startTime: "20:00", duration: 60, hint: "Early", taken: false },
    { gigId: "set-2", startTime: "21:30", duration: 60, hint: "Late", taken: true },
  ]);
  assert.equal(JSON.stringify(slots).includes("Maya"), false);
  assert.equal(JSON.stringify(slots).includes("maya@example.com"), false);
});

test("private fields on one copy survive de-duplication", () => {
  const night = readNight([
    slot("set-1", "20:00", {
      applicants: [{ id: "maya", status: "pending", slotGigIds: ["set-1", "set-2"], name: "Maya Reid" }],
    }),
    slot("set-2", "21:30", {
      applicants: [{
        id: "maya",
        status: "pending",
        slotGigIds: ["set-1", "set-2"],
        name: "Maya Reid",
        email: "maya@example.com",
        manageTokenHash: "abc",
      }],
    }),
  ]);
  assert.equal(night.applications.length, 1);
  assert.equal(night.applications[0].email, "maya@example.com");
  assert.equal(night.applications[0].manageTokenHash, "abc");
});

test("a stored booking is mirrored as confirmed for existing per-slot screens", () => {
  const applicants = readSlotApplicants(
    { gigId: "set-1", bookedApplicantId: "maya", applicants: [] },
    [{ id: "maya", name: "Maya Reid", status: "accepted", preferredSlotGigIds: [], email: "secret@example.com" }],
  );
  assert.equal(applicants.length, 1);
  assert.equal(applicants[0].status, "confirmed");
  assert.equal(applicants[0].name, "Maya Reid");
  assert.equal(applicants[0].assignedSlotGigId, "set-1");
  assert.equal(applicants[0].email, undefined);
});
