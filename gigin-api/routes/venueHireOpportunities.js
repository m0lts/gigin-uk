/* eslint-disable */
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db, Timestamp } from "../config/admin.js";
import { assertVenuePerm } from "../utils/permissions.js";

const router = express.Router();
const COLLECTION = "venueHireOpportunities";

function toAdminTimestamp(input) {
  try {
    if (!input) return null;
    if (input instanceof Date) return Timestamp.fromDate(input);
    if (typeof input === "number") return Timestamp.fromDate(new Date(input));
    if (typeof input === "string") return Timestamp.fromDate(new Date(input));
    if (typeof input === "object") {
      const seconds = input.seconds ?? input._seconds;
      const nanoseconds = input.nanoseconds ?? input._nanoseconds;
      if (typeof seconds === "number" && typeof nanoseconds === "number") {
        return new Timestamp(seconds, nanoseconds);
      }
      if (typeof input.toDate === "function") {
        return Timestamp.fromDate(input.toDate());
      }
    }
  } catch (_) {}
  return null;
}

/** Remove undefined values from an object (and nested plain objects). */
function stripUndefined(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => (v && typeof v === "object" && !(v instanceof Date) && typeof v.toDate !== "function" && !(v && v.seconds != null) ? stripUndefined(v) : v));
  if (typeof obj !== "object" || obj instanceof Date || (typeof obj.toDate === "function")) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && typeof v.toDate !== "function" && !(v && v.seconds != null) ? stripUndefined(v) : v;
  }
  return out;
}

function buildHirePayload(data, now) {
  const technicalSetup = data.technicalSetup ?? {};
  const setupClean = {};
  if (technicalSetup.paIncluded != null) setupClean.paIncluded = technicalSetup.paIncluded;
  if (technicalSetup.soundEngineerIncluded != null) setupClean.soundEngineerIncluded = technicalSetup.soundEngineerIncluded;
  if (technicalSetup.paForHirePrice != null && technicalSetup.paForHirePrice !== undefined) setupClean.paForHirePrice = technicalSetup.paForHirePrice;
  if (technicalSetup.soundEngineerForHirePrice != null && technicalSetup.soundEngineerForHirePrice !== undefined) setupClean.soundEngineerForHirePrice = technicalSetup.soundEngineerForHirePrice;

  const dateTs = toAdminTimestamp(data.date) ?? data.date;
  return stripUndefined({
    venueId: data.venueId,
    createdByUserId: data.createdByUserId ?? data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
    status: data.status ?? "available",
    date: dateTs ?? data.date,
    startTime: data.startTime ?? "",
    endTime: data.endTime ?? "",
    accessFrom: data.accessFrom ?? null,
    curfew: data.curfew ?? null,
    hireFee: data.hireFee ?? "",
    depositRequired: !!data.depositRequired,
    depositAmount: data.depositAmount ?? null,
    depositPaid: data.depositPaid ?? null,
    technicalSetup: Object.keys(setupClean).length ? setupClean : { paIncluded: "no", soundEngineerIncluded: "no" },
    documents: Array.isArray(data.documents) ? data.documents : [],
    notesInternal: data.notesInternal ?? "",
    hirerType: data.hirerType ?? "none",
    hirerContactId: data.hirerContactId ?? null,
    hirerUserId: data.hirerUserId ?? null,
    hirerName: data.hirerName ?? null,
    performers: Array.isArray(data.performers) ? data.performers : [],
    private: !!data.private,
    linkedGigId: data.linkedGigId ?? null,
    ...(data.startDateTime && { startDateTime: toAdminTimestamp(data.startDateTime) }),
    ...(data.endDateTime && { endDateTime: toAdminTimestamp(data.endDateTime) }),
  });
}

// POST /api/venueHireOpportunities/createBatch
router.post("/createBatch", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { venueId, items } = req.body || {};
  if (!venueId || typeof venueId !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueId required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "items array required" });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: "TOO_MANY", message: "Max 50 venue hire opportunities per request" });
  }

  await assertVenuePerm(db, caller, venueId, "gigs.create");

  const now = Timestamp.fromDate(new Date());
  const ids = [];
  const coll = db.collection(COLLECTION);

  for (const raw of items) {
    const id = raw.id || uuidv4();
    const payload = buildHirePayload({ ...raw, venueId }, now);
    await coll.doc(id).set(payload);
    ids.push(id);
  }

  return res.json({ data: { ids } });
}));

// POST /api/venueHireOpportunities/update
router.post("/update", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { id, updates } = req.body || {};
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "id required" });
  }
  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "updates object required" });
  }

  const ref = db.doc(`${COLLECTION}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Venue hire opportunity not found" });
  }
  const venueId = snap.data()?.venueId;
  if (!venueId) {
    return res.status(400).json({ error: "FAILED_PRECONDITION", message: "Document missing venueId" });
  }

  await assertVenuePerm(db, caller, venueId, "gigs.update");

  const technicalSetup = updates.technicalSetup;
  let normalizedUpdates = { ...updates, updatedAt: Timestamp.fromDate(new Date()) };
  if (technicalSetup && typeof technicalSetup === "object") {
    const setupClean = {};
    if (technicalSetup.paIncluded != null) setupClean.paIncluded = technicalSetup.paIncluded;
    if (technicalSetup.soundEngineerIncluded != null) setupClean.soundEngineerIncluded = technicalSetup.soundEngineerIncluded;
    if (technicalSetup.paForHirePrice != null && technicalSetup.paForHirePrice !== undefined) setupClean.paForHirePrice = technicalSetup.paForHirePrice;
    if (technicalSetup.soundEngineerForHirePrice != null && technicalSetup.soundEngineerForHirePrice !== undefined) setupClean.soundEngineerForHirePrice = technicalSetup.soundEngineerForHirePrice;
    normalizedUpdates.technicalSetup = Object.keys(setupClean).length ? setupClean : undefined;
  }
  if (normalizedUpdates.date != null) {
    const dateTs = toAdminTimestamp(normalizedUpdates.date);
    if (dateTs) normalizedUpdates.date = dateTs;
  }
  if (normalizedUpdates.startDateTime != null) {
    const startTs = toAdminTimestamp(normalizedUpdates.startDateTime);
    if (startTs) normalizedUpdates.startDateTime = startTs;
  }
  if (normalizedUpdates.endDateTime != null) {
    const endTs = toAdminTimestamp(normalizedUpdates.endDateTime);
    if (endTs) normalizedUpdates.endDateTime = endTs;
  }

  normalizedUpdates = stripUndefined(normalizedUpdates);
  await ref.update(normalizedUpdates);

  return res.json({ data: { success: true } });
}));

// POST /api/venueHireOpportunities/delete
router.post("/delete", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { id } = req.body || {};
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "id required" });
  }

  const ref = db.doc(`${COLLECTION}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Venue hire opportunity not found" });
  }
  const venueId = snap.data()?.venueId;
  if (!venueId) {
    return res.status(400).json({ error: "FAILED_PRECONDITION", message: "Document missing venueId" });
  }

  await assertVenuePerm(db, caller, venueId, "gigs.update");
  await ref.delete();

  return res.json({ data: { success: true } });
}));

export default router;
