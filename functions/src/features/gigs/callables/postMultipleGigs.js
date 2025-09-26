/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { requirePerm } from "../../../lib/authz.js"; // 

const ALLOWED_FIELDS = new Set([
  // venue-bound fields you allow clients to propose
  "gigId",
  "gigName",
  "gigType",
  "kind",
  "genre",
  "privacy",
  "date",
  "dateUndecided",
  "startTime",
  "duration",
  "budget",
  "budgetValue",
  "extraInformation",
  "privateApplications",
  "privateApplicationsLink",
  "limitApplications",
  "openMicApplications",
  "loadInTime",
  "soundCheckTime",
  "soundTechnicianRequired",
  "technicalInformation",
  "accountName",
  "status",
  "complete",
  "startDateTime",   // you can recompute server-side if you prefer
  "coordinates",
  "geohash",
  "geopoint",
  "venue",           // small metadata block used in your app
  // NOTE: we *intentionally* do NOT accept applicants from client
]);

function sanitizeGig(base, { venueId }) {
    const out = {};
    for (const k of Object.keys(base || {})) {
      if (ALLOWED_FIELDS.has(k)) out[k] = base[k];
    }
  
    // Force/override sensitive fields
    out.venueId = venueId;
    out.createdAt = base?.createdAt || Timestamp.now(); // keep original if edit, else now
    out.status = typeof out.status === "string" ? out.status : "open";
    out.complete = out.complete === true;
  
    // Applicants: preserve on edit, else empty
    if (Array.isArray(base?.applicants)) {
      out.applicants = base.applicants;
    } else {
      out.applicants = [];
    }
  
    // Defensive: must have gigId
    if (!out.gigId || typeof out.gigId !== "string") {
      throw new Error("INVALID_GIG: missing gigId");
    }
  
    return out;
  }

export const postMultipleGigs = callable(
  { region: REGION_PRIMARY, timeoutSeconds: 60, authRequired: true },
  async (req) => {
    const uid = req.auth.uid;
    const { venueId, gigDocuments } = req.data || {};

    if (!venueId || !Array.isArray(gigDocuments) || gigDocuments.length === 0) {
      throw new Error("INVALID_ARGUMENT");
    }
    if (gigDocuments.length > 20) {
      // keep batches reasonable; tweak as needed
      throw new Error("TOO_MANY_GIGS");
    }

    // Server-side permission check
    await requirePerm(venueId, uid, "gigs.create");

    // Sanitize + prepare batch
    const batch = db.batch();
    const gigIds = [];

    for (const raw of gigDocuments) {
      const gig = sanitizeGig(raw, { venueId });
      const gigRef = db.collection("gigs").doc(gig.gigId);
      batch.set(gigRef, gig, { merge: false });
      gigIds.push(gig.gigId);
    }

    // push IDs into venueProfiles/{venueId}.gigs
    const uniqueIds = Array.from(new Set(gigIds));
    const venueRef = db.collection("venueProfiles").doc(venueId);
    batch.set(venueRef, { gigs: FieldValue.arrayUnion(...uniqueIds) }, { merge: true });

    // (optional) audit
    batch.set(db.collection("auditLogs").doc(), {
      type: "gigsCreated",
      venueId,
      count: uniqueIds.length,
      gigIds: uniqueIds,
      byUid: uid,
      at: Timestamp.now(),
    });

    await batch.commit();
    return { ok: true, gigIds: uniqueIds };
  }
);