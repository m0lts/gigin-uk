export const PERM_KEYS = [
    "gigs.read","gigs.create","gigs.update","gigs.applications.manage","gigs.invite",
    "reviews.create","gigs.pay","finances.read","finances.update","venue.update",
    "members.invite","members.update",
];
  
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
  
export function sanitizePermissions(input = {}) {
    const out = { ...PERM_DEFAULTS };
    if (input && typeof input === "object") {
      for (const [k, v] of Object.entries(input)) {
        if (PERM_KEYS.includes(k)) out[k] = !!v;
      }
    }
    out["gigs.read"] = true;
    return out;
}
  
export async function assertVenuePerm(db, callerUid, venueId, permKey) {
    if (!callerUid) {
      const e = new Error("PERMISSION_DENIED");
      e.code = "permission-denied";
      throw e;
    }
    if (!venueId || typeof venueId !== "string") {
      const e = new Error("INVALID_ARGUMENT: venueId required");
      e.code = "invalid-argument";
      throw e;
    }
    const venueRef = db.doc(`venueProfiles/${venueId}`);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) {
      const e = new Error("NOT_FOUND: venue");
      e.code = "not-found";
      throw e;
    }
    const venue = venueSnap.data() || {};
    const isOwner = venue.createdBy === callerUid || venue.userId === callerUid;
    if (isOwner) return true;
  
    const memberSnap = await venueRef.collection("members").doc(callerUid).get();
    const memberData = memberSnap.exists ? (memberSnap.data() || {}) : null;
    const isActiveMember = !!memberData && memberData.status === "active";
    const perms = sanitizePermissions(memberData?.permissions || {});
    if (!(isActiveMember && perms[permKey])) {
      const e = new Error(`PERMISSION_DENIED: requires ${permKey}`);
      e.code = "permission-denied";
      throw e;
    }
    return true;
}

/** Artist Profile Permissions */
export const ARTIST_PERM_KEYS = [
    "profile.viewer",
    "profile.edit",
    "gigs.book",
    "finances.edit",
];

export const ARTIST_PERM_DEFAULTS = {
    "profile.viewer": true,
    "profile.edit": false,
    "gigs.book": false,
    "finances.edit": false,
};

export function sanitizeArtistPermissions(input = {}) {
    const out = { ...ARTIST_PERM_DEFAULTS };
    if (input && typeof input === "object") {
      for (const [k, v] of Object.entries(input)) {
        if (ARTIST_PERM_KEYS.includes(k)) out[k] = !!v;
      }
    }
    // Always enforce profile.viewer = true
    out["profile.viewer"] = true;
    return out;
}

export async function assertArtistPerm(db, callerUid, artistProfileId, permKey) {
    if (!callerUid) {
      const e = new Error("PERMISSION_DENIED");
      e.code = "permission-denied";
      throw e;
    }
    if (!artistProfileId || typeof artistProfileId !== "string") {
      const e = new Error("INVALID_ARGUMENT: artistProfileId required");
      e.code = "invalid-argument";
      throw e;
    }
    const artistRef = db.doc(`artistProfiles/${artistProfileId}`);
    const artistSnap = await artistRef.get();
    if (!artistSnap.exists) {
      const e = new Error("NOT_FOUND: artist profile");
      e.code = "not-found";
      throw e;
    }
    const artist = artistSnap.data() || {};
    const isOwner = artist.userId === callerUid || artist.createdBy === callerUid;
    if (isOwner) return true;
  
    const memberSnap = await artistRef.collection("members").doc(callerUid).get();
    const memberData = memberSnap.exists ? (memberSnap.data() || {}) : null;
    const isActiveMember = !!memberData && memberData.status === "active";
    const perms = sanitizeArtistPermissions(memberData?.permissions || {});
    if (!(isActiveMember && perms[permKey])) {
      const e = new Error(`PERMISSION_DENIED: requires ${permKey}`);
      e.code = "permission-denied";
      throw e;
    }
    return true;
}

/** Assert that caller is the owner of the given artist profile. */
export async function assertArtistOwner(db, callerUid, artistProfileId) {
    if (!callerUid) {
      const e = new Error("PERMISSION_DENIED");
      e.code = "permission-denied";
      throw e;
    }
    if (!artistProfileId || typeof artistProfileId !== "string") {
      const e = new Error("INVALID_ARGUMENT: artistProfileId required");
      e.code = "invalid-argument";
      throw e;
    }
    const artistRef = db.doc(`artistProfiles/${artistProfileId}`);
    const artistSnap = await artistRef.get();
    if (!artistSnap.exists) {
      const e = new Error("NOT_FOUND: artist profile");
      e.code = "not-found";
      throw e;
    }
    const artist = artistSnap.data() || {};
    const isOwner = artist.userId === callerUid || artist.createdBy === callerUid;
    if (!isOwner) {
      const e = new Error("PERMISSION_DENIED: requires artist owner");
      e.code = "permission-denied";
      throw e;
    }
    return true;
}