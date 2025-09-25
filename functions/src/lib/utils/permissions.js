/* eslint-disable */
export const PERM_KEYS = [
    "gigs.read",
    "gigs.create",
    "gigs.update",
    "gigs.applications.manage",
    "gigs.invite",
    "reviews.create",
    "gigs.pay",
    "finances.read",
    "finances.update",
    "venue.update",
  ];
  export function defaultVenueMemberPerms() {
    return { "gigs.read": true };
  }
  export function isValidPermKey(key) {
    return PERM_KEYS.includes(key);
  }