/* eslint-disable */
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { ingestNewApplicants } from "../services/applicationEmails.js";

/**
 * Sends or queues a new-application email when an applicant is added to a gig.
 * Offers (`invited: true`) do not send. Batching state lives on the gig.
 */
export const onGigApplication = onDocumentUpdated(
  {
    region: REGION_PRIMARY,
    document: "gigs/{gigId}",
    maxInstances: 10,
  },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const gigId = event.params.gigId;
    if (after.applicationsRootGigId && after.applicationsRootGigId !== gigId) return;
    const beforeIds = new Set((before.applicants || []).map((applicant) => applicant?.id).filter(Boolean));
    const settled = new Set(["confirmed", "accepted", "paid", "declined", "withdrawn", "expired"]);
    const added = (after.applicants || []).filter((applicant) => (
      applicant?.id
      && !beforeIds.has(applicant.id)
      && applicant.invited !== true
      && !settled.has(String(applicant.status || "pending").toLowerCase())
    ));
    if (!added.length) return;
    await ingestNewApplicants(event.params.gigId, added.map((applicant) => applicant.id));
  },
);
