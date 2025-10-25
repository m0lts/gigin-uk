/* eslint-disable */
import { db } from "../admin.js";

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
  "members.invite",            // invite new members
  "members.update",            // edit member permissions
];

export const PERMS_DISPLAY = {
  "gigs.create": "Post gigs",
  "gigs.update": "Edit gigs",
  "gigs.applications.manage": "Manage gig applications",
  "gigs.invite": "Invite musicians to gigs",
  "reviews.create": "Review musicians",
  "gigs.pay": "Pay for gigs",
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
  "reviews.create": false,
  "gigs.pay": false,
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

export async function assertVenuePerm(caller, venueId, permKey) {
  if (!caller) {
    const e = new Error('PERMISSION_DENIED: must be authenticated');
    e.code = 'permission-denied';
    throw e;
  }
  if (!venueId || typeof venueId !== 'string') {
    const e = new Error('INVALID_ARGUMENT: venueId required');
    e.code = 'invalid-argument';
    throw e;
  }
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const venueSnap = await venueRef.get();
  if (!venueSnap.exists) {
    const e = new Error('NOT_FOUND: venue');
    e.code = 'not-found';
    throw e;
  }
  const venue = venueSnap.data() || {};
  const isOwner = venue?.createdBy === caller || venue?.userId === caller;
  if (isOwner) return true;
  const memberSnap = await venueRef.collection('members').doc(caller).get();
  const memberData = memberSnap.exists ? memberSnap.data() : null;
  const isActiveMember = !!memberData && memberData.status === 'active';
  const perms = sanitizePermissions(memberData?.permissions || {});
  const has = !!perms[permKey];
  if (!(isActiveMember && has)) {
    const e= new Error(`PERMISSION_DENIED: requires venue owner or active member with ${permKey}`);
    e.code = 'permission-denied';
    throw e;
  }
  return true;
}