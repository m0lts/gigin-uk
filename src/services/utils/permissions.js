/** Flat, explicit permission keys for venue-scoped actions. */
export const PERM_KEYS = [
    "gigs.read",                 // viewing gigs (default true)
    "gigs.create",               // posting gigs
    "gigs.update",               // editing gigs
    "gigs.applications.manage",  // accept/decline/negotiate gig applications
    "gigs.invite",               // inviting musicians to gigs
    "reviews.create",            // reviewing musicians
    "gigs.pay",                  // paying for gigs
    "finances.read",             // access venue finances
    "finances.update",           // edit venue finances
    "venue.update",              // edit venue profile
  ];
  
/**
 * Default permissions for a new member:
 * - all false except viewing gigs (`gigs.read`)
 * Return a sparse map; only include true keys to keep docs small.
 */
export function defaultVenueMemberPerms() {
    return {
        "gigs.read": true,
    };
}
  
/** Runtime guard to validate keys coming from UI / network. */
export function isValidPermKey(key) {
    return PERM_KEYS.includes(key);
}