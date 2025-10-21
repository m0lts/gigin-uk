/** Flat, explicit permission keys for venue-scoped actions. */
export const PERM_KEYS = [
    "gigs.read",                 // viewing gigs (default true)
    "gigs.create",               // posting gigs
    "gigs.update",               // editing gigs
    "gigs.applications.manage",  // accept/decline/negotiate gig applications
    "gigs.invite",               // inviting musicians to gigs
    "gigs.pay",                  // paying for gigs
    "reviews.create",            // reviewing musicians
    "finances.read",             // access venue finances
    "finances.update",           // edit venue finances
    "venue.update",              // edit venue profile
    "members.invite",            // invite new members
    "members.update",            // edit member permissions
];

export const PERMS_DISPLAY = {
    "gigs.create": "Post gigs",
    "gigs.update": "Edit gigs",
    "gigs.applications.manage": "Manage gig applications",
    "gigs.invite": "Invite musicians to gigs",
    "gigs.pay": "Pay for gigs",
    "reviews.create": "Review and dispute artist performances",
    "finances.read": "View venue finances",
    "finances.update": "Edit venue finances",
    "venue.update": "Edit venue profile",
    "members.invite": "Invite new members",
    "members.update": "Edit member permissions",
};

export const PERM_DEFAULTS = {
    "gigs.read": true,
    "gigs.create": false,
    "gigs.update": false,
    "gigs.applications.manage": false,
    "gigs.invite": false,
    "gigs.pay": false,
    "reviews.create": false,
    "finances.read": false,
    "finances.update": false,
    "venue.update": false,
    "members.invite": false,
    "members.update": false,
};
  
/** Runtime guard to validate keys coming from UI / network. */
export function isValidPermKey(key) {
    return PERM_KEYS.includes(key);
}

export function sanitizePermissions(input) {
    const out = { ...PERM_DEFAULTS };
    if (input && typeof input === "object") {
      for (const [k, v] of Object.entries(input)) {
        if (isValidPermKey(k)) out[k] = !!v;
      }
    }
    // always ensure read is true
    out["gigs.read"] = true;
    return out;
}

export const hasVenuePerm = (venueProfiles, venueId, key) => {
    const vp = venueProfiles?.find(v => (v.id ?? v.venueId) === venueId);
    const role = vp?.myMembership?.role;
    if (role === "owner") return true;
    return !!vp?.myMembership?.permissions?.[key];
};

/**
 * Ensure the permissions object always has the full PERM_DEFAULTS shape.
 * @param {Object|undefined} incoming
 * @returns {Object} full map of booleans
 */
export function normalizePermissions(incoming) {
    const base = { ...PERM_DEFAULTS };
    if (incoming && typeof incoming === "object") {
      for (const k of PERM_KEYS) {
        if (Object.prototype.hasOwnProperty.call(incoming, k)) {
          base[k] = !!incoming[k];
        }
      }
      // Always enforce view gigs = true
      base["gigs.read"] = true;
    }
    return base;
}