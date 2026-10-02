/** Fields written by keepProfile.js. Clients must not set them. */
export const SERVER_PROFILE_FIELDS = [
  "slug",
  "status",
  "source",
  "playedAt",
  "guestApplicationIds",
  "contactEmailHash",
  "venueName",
  "confirmedAt",
  "deletedAt",
  "homeWelcomeDismissedAt",
  "pressKitRightsConfirmedAt",
  "userId",
  "createdBy",
  "createdAt",
  "updatedAt",
];

/** Onboarding still marks a draft complete. Every other server field is dropped. */
export function clientProfileUpdates(updates) {
  const next = { ...(updates || {}) };
  for (const key of SERVER_PROFILE_FIELDS) {
    if (key === "status" && (next.status === "draft" || next.status === "complete")) continue;
    delete next[key];
  }
  return next;
}
