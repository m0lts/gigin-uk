/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * saveGigTemplate (CF)
 * Auth: required + AppCheck
 * Input:
 *   {
 *     templateId?: string,          // optional; CF will create if missing
 *     venueId: string,              // required
 *     name: string,                 // required (display name)
 *     description?: string,
 *     kind?: string,                // e.g. 'Live Music', 'Open Mic'
 *     gigType?: string,             // e.g. 'Band', 'Solo'
 *     genre?: string[] | string,
 *     fields?: object,              // any structured form config you support
 *     images?: string[]             // optional preview images
 *   }
 * Behavior:
 *   - Verifies caller is venue owner or active member
 *   - Creates/updates templates/{templateId} (merge)
 *   - Ensures template stays pinned to the same venueId if it already exists
 *   - Adds templateId to venueProfiles/{venueId}.templates atomically
 * Output: { templateId }
 */
export const saveGigTemplate = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const caller = req.auth.uid;
    const payload = req.data || {};

    // -------- Validate input
    const venueId = String(payload.venueId || "");
    if (!venueId) {
      const e = new Error("INVALID_ARGUMENT: venueId is required");
      e.code = "invalid-argument";
      throw e;
    }

    // Load venue
    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) {
      const e = new Error("NOT_FOUND: venue");
      e.code = "not-found";
      throw e;
    }
    const venue = venueSnap.data() || {};
    const ownerUid = venue.createdBy || venue.userId || null;

    // -------- Authorization: owner or active member
    const isOwner = ownerUid === caller;
    let isActiveMember = false;
    if (!isOwner) {
      const memberRef = venueRef.collection("members").doc(caller);
      const memberSnap = await memberRef.get();
      isActiveMember = memberSnap.exists && (memberSnap.data()?.status === "active");
    }
    if (!isOwner && !isActiveMember) {
      const e = new Error("FORBIDDEN: only the venue owner or an active member can save templates");
      e.code = "permission-denied";
      throw e;
    }

    // -------- Prepare templateId
    const templateId = payload.templateId
      ? String(payload.templateId)
      : venueRef.collection("templates-meta").doc().id; // cheap way to mint an id

    const templateRef = db.doc(`templates/${templateId}`);

    // -------- Whitelist/sanitize incoming fields
    const allowedKeys = new Set([
      "name",
      "description",
      "kind",
      "gigType",
      "genre",
      "fields",
      "images",
    ]);

    const sanitized = {};
    for (const [k, v] of Object.entries(payload)) {
      if (allowedKeys.has(k)) sanitized[k] = v;
    }

    // Always enforce venue & metadata on server
    sanitized.venueId = venueId;
    sanitized.updatedAt = new Date();
    sanitized.updatedBy = caller;

    // -------- Transaction: upsert template + add to venue.templates (unique)
    await db.runTransaction(async (tx) => {
      const existingT = await tx.get(templateRef);
      const isCreate = !existingT.exists;

      if (!isCreate) {
        // If template exists, it must belong to the same venue — prevent hijack
        const existingVenueId = existingT.data()?.venueId;
        if (existingVenueId && existingVenueId !== venueId) {
          const e = new Error("FAILED_PRECONDITION: template belongs to a different venue");
          e.code = "failed-precondition";
          throw e;
        }
      }

      if (isCreate) {
        // Set immutable metadata on first create
        sanitized.createdAt = new Date();
        sanitized.createdBy = caller;
      }

      // Merge write
      tx.set(templateRef, sanitized, { merge: true });

      // Add to venue.templates as a unique set
      const currentVenue = (await tx.get(venueRef)).data() || {};
      const currentList = Array.isArray(currentVenue.templates) ? currentVenue.templates : [];
      if (!currentList.includes(templateId)) {
        const nextList = currentList.concat(templateId);
        tx.update(venueRef, { templates: nextList });
      }
    });

    return { templateId };
  }
);