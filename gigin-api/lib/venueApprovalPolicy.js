/** Pure checks for venue self-signup. No Firebase. */

export const APPROVAL_DEV_PROJECT = "giginltd-dev";
export const APPROVAL_DAYS = 14;
export const SIGNUP_LIMIT = 3;
export const SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export const SERVER_VENUE_FIELDS = [
  "approvalStatus",
  "approvedAt",
  "approvedBy",
  "approvalNotifiedAt",
  "ownerEmail",
];

/**
 * A venue with no approvalStatus is already live. Only an explicit
 * pending or rejected value is blocked.
 */
export function venueIsApproved(data) {
  if (!data || typeof data !== "object") return false;
  if (!Object.prototype.hasOwnProperty.call(data, "approvalStatus")) return true;
  const status = data.approvalStatus;
  if (status == null || status === "") return true;
  return status === "approved";
}

export function projectNeedsTypedConfirmation(project) {
  return String(project || "").trim() !== APPROVAL_DEV_PROJECT;
}

export function confirmationMatches(project, typed) {
  return String(typed || "").trim() === String(project || "").trim() && String(project || "").trim() !== "";
}

export function cityFromAddress(address) {
  if (typeof address !== "string") return "";
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 3];
  return parts[0] || "";
}

export function tokenState(token, now = Date.now()) {
  if (!token) return "missing";
  if (token.usedAt) return "used";
  const expires = token.expiresAt ? new Date(token.expiresAt).getTime() : 0;
  if (!expires || expires < now) return "expired";
  return "ok";
}
