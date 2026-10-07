const WAITING = new Set(['pending', 'sent']);

export function isWaitingApplication(applicant) {
  if (!applicant) return false;
  return WAITING.has(String(applicant.status || 'pending').toLowerCase());
}

/** Unopened application that is still waiting for a decision. */
export function isNewApplicant(applicant) {
  if (!applicant || applicant.viewed === true || applicant.invited === true) return false;
  return isWaitingApplication(applicant);
}

/** Home "Needs your attention". A full night stays off unless someone is still waiting. */
export function nightNeedsAttention(night) {
  if (!night || !(night.fresh > 0)) return false;
  if (night.fullyBooked && !(night.applications || []).some(isWaitingApplication)) return false;
  return true;
}
