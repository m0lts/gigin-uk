/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { assertVenuePerm } from "../../../lib/utils/permissions.js";


export const updateGigDocument = callable(
  { 
    region: REGION_PRIMARY,
    authRequired: true,
    enforceAppCheck: true,
    // concurrency: 80,
    // minInstances: 1,
    // maxInstances: 20,
    // memory: '256MiB',
    // cpu: 1,
  },
  async (req) => {
    const caller = req.auth?.uid;
    const { gigId, action, updates } = req.data || {};
    if (!gigId || typeof gigId !== "string") {
      const e = new Error("INVALID_ARGUMENT: gigId is required");
      e.code = "invalid-argument";
      throw e;
    }
    if (!updates || typeof updates !== "object") {
      const e = new Error("INVALID_ARGUMENT: updates object required");
      e.code = "invalid-argument";
      throw e;
    }
    if (!action || typeof action !== "string") {
      const e = new Error("INVALID_ARGUMENT: action is required");
      e.code = "invalid-argument";
      throw e;
    }
    const gigRef = db.doc(`gigs/${gigId}`);
    const gigSnap = await gigRef.get();
    if (!gigSnap.exists) {
      const e = new Error("NOT_FOUND: gig");
      e.code = "not-found";
      throw e;
    }
    const gig = gigSnap.data() || {};
    const venueId = gig?.venueId;
    if (!venueId) {
      const e = new Error("FAILED_PRECONDITION: gig missing venueId");
      e.code = "failed-precondition";
      throw e;
    }
    switch (action) {
      case "gigs.applications.manage":
        await assertVenuePerm(caller, venueId, "gigs.applications.manage");
        break;
      case "gigs.update":
        await assertVenuePerm(caller, venueId, "gigs.update");
        break;
      case "reviews.create":
        await assertVenuePerm(caller, venueId, "reviews.create");
        break;
      case "musician.withdraw.application": {
        const userSnap = await db.doc(`users/${caller}`).get();
        const user = userSnap.data() || {};
        const callerMusicianIds = Array.isArray(user.musicianProfile)
          ? user.musicianProfile
          : user.musicianProfile
            ? [user.musicianProfile]
            : [];
        const applicants = Array.isArray(gig?.applicants) ? gig.applicants : [];
        const callerIsApplicant = applicants.some(a => callerMusicianIds.includes(a?.id));
        if (!callerIsApplicant) {
          const e = new Error("PERMISSION_DENIED: caller is not an applicant on this gig");
          e.code = "permission-denied";
          throw e;
        }
        break;
      }
      default: {
        const e = new Error(`INVALID_ARGUMENT: unsupported action "${action}"`);
        e.code = "invalid-argument";
        throw e;
      }
    }
    await gigRef.update(updates);
    return { success: true };
  }
);