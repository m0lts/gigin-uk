/** Pure keep-profile rules. No Firebase imports, so tests can load this file alone. */

const PUBLIC_KEYS = new Set([
  "id", "slug", "name", "status", "source", "bio", "heroMedia",
  "spotifyUrl", "youtubeUrl", "instagramUrl", "websiteUrl",
  "members", "techRider", "playedAt", "publicFields", "userId",
]);

const SECRET_KEYS = ["email", "phone", "whatsapp", "contactEmail", "contactPhone", "contactName"];

export function passwordAcceptable(password) {
  const value = String(password || "");
  return value.length >= 6
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

export function confirmClaimDecision({ tokenState, hasAuthUser, signedInUid, existingUid, signedInEmail, profileEmail }) {
  if (tokenState !== "ok") return { action: tokenState === "expired" || tokenState === "used" ? tokenState : "missing" };
  const sameEmail = Boolean(signedInEmail && profileEmail && signedInEmail === profileEmail);
  if (hasAuthUser && (!signedInUid || !sameEmail)) return { action: "login" };
  if (hasAuthUser && existingUid && signedInUid !== existingUid) return { action: "forbidden" };
  if (hasAuthUser && signedInUid && sameEmail) return { action: "link" };
  return { action: "create" };
}

export function slugify(name) {
  const base = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "artist";
}

export function nextSlug(base, taken) {
  const root = slugify(base);
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

export function maskEmail(email) {
  const raw = String(email || "").trim().toLowerCase();
  const at = raw.indexOf("@");
  if (at < 1) return "";
  return `${raw.slice(0, 1)}•••@${raw.slice(at + 1)}`;
}

export function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

export function firstSentence(bio, max = 120) {
  const text = String(bio || "").trim();
  if (!text) return "";
  const sentence = text.split(/(?<=[.!?])\s/)[0] || text;
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max - 1).trim()}…`;
}

export function ogDescription(profile) {
  const sentence = firstSentence(profile?.bio, 120);
  if (sentence) return `${sentence}. Music, band and tech rider in one place.`;
  return "Artist profile on Gigin.";
}

export function enabledSections(profile) {
  const fields = profile?.publicFields || {};
  const on = (key) => fields[key] !== false;
  const names = [];
  if (on("photo") && profile?.heroMedia) names.push("Press photo");
  if (on("bio") && profile?.bio) names.push("Bio");
  if (on("links") && (profile?.spotifyUrl || profile?.youtubeUrl || profile?.instagramUrl || profile?.websiteUrl)) {
    names.push("Music and video links");
  }
  if (on("members") && (profile?.members || []).some((member) => member?.name)) names.push("Band members");
  if (on("tech") && profile?.techRider) names.push("Tech rider");
  return names;
}

/** Public profile payload. Email and phone are never included, even if present on the doc. */
export function toPublicProfile(data = {}, id = "") {
  const fields = data.publicFields || {};
  const on = (key) => fields[key] !== false;
  const profile = {
    id: id || data.id || "",
    slug: data.slug || "",
    name: data.name || "",
    status: data.status || "live",
    source: data.source || null,
    userId: data.userId || null,
    playedAt: Array.isArray(data.playedAt) ? data.playedAt.map((row) => ({
      venueId: row.venueId || null,
      venueName: row.venueName || "",
      city: row.city || "",
      gigId: row.gigId || null,
      date: row.date || null,
      confirmedAt: row.confirmedAt || null,
    })) : [],
  };
  if (on("photo") && data.heroMedia) profile.heroMedia = { path: data.heroMedia.path || null, contentType: data.heroMedia.contentType || null, name: data.heroMedia.name || "" };
  if (on("bio") && data.bio) profile.bio = data.bio;
  if (on("links")) {
    profile.spotifyUrl = data.spotifyUrl || "";
    profile.youtubeUrl = data.youtubeUrl || "";
    profile.instagramUrl = data.instagramUrl || "";
    profile.websiteUrl = data.websiteUrl || "";
  }
  if (on("members")) {
    profile.members = (Array.isArray(data.members) ? data.members : [])
      .filter((member) => member && String(member.name || "").trim())
      .map((member) => ({ name: member.name, instruments: member.instruments || [] }));
  }
  if (on("tech") && data.techRider) profile.techRider = data.techRider;
  for (const key of SECRET_KEYS) delete profile[key];
  return profile;
}

export function toEditorProfile(data = {}, id = "") {
  const profile = toPublicProfile({
    ...data,
    publicFields: { photo: true, bio: true, links: true, members: true, tech: true },
  }, id);
  profile.publicFields = data.publicFields || { photo: true, bio: true, links: true, members: true, tech: true };
  profile.status = data.status || profile.status;
  profile.homeWelcomeDismissedAt = data.homeWelcomeDismissedAt || null;
  profile.source = data.source || null;
  return profile;
}

export function publicProfileHasSecrets(profile) {
  return SECRET_KEYS.some((key) => profile && Object.prototype.hasOwnProperty.call(profile, key));
}

export function isPubliclyReadableStatus(status) {
  return status == null || status === "live";
}

export function artistContactDecision({ applied, booked, cancelled }) {
  if (booked) return { allow: true, reason: "booked" };
  if (cancelled) return { allow: true, reason: "cancelled" };
  if (applied) return { allow: true, reason: "applied" };
  return { allow: false, reason: null };
}

export function pressKitDecision({ booked, cancelled, empty }) {
  if (booked) return empty ? { state: "empty", http: 200 } : { state: "active", http: 200 };
  if (cancelled) return { state: "ended", http: 403, reason: "cancelled" };
  return { state: "locked", http: 403, reason: "not_booked" };
}

/**
 * Venue contact visibility. `show: 'open'` is the only case that may include
 * booker email and phone. Listed website email is a separate public-info field.
 */
export function venueContactDecision({ visibility = "signed_in", signedIn = false, invited = false, listed = false }) {
  if (listed) {
    if (signedIn) return { show: "website" };
    return { show: "placeholder", carrot: true };
  }
  if (visibility === "nobody") return { show: "nobody" };
  if (visibility === "invited") {
    if (invited) return { show: "open" };
    return { show: "invited_only" };
  }
  if (signedIn) return { show: "open" };
  return { show: "placeholder", carrot: true };
}

export function reminderEligible({ keepProfileOffer, hasLiveProfile, reminderCount }) {
  const offer = keepProfileOffer || "none";
  if (offer === "confirmed" || offer === "sent") return false;
  if (hasLiveProfile) return false;
  if (Number(reminderCount) >= 2) return false;
  return offer === "none" || offer === "dismissed" || offer === "ignored";
}

export function capacityMatches(capacity, band) {
  if (!band || band === "any") return true;
  if (capacity == null || capacity === "") return false;
  const n = Number(capacity);
  if (!Number.isFinite(n)) return false;
  if (band === "upto80") return n <= 80;
  if (band === "80to150") return n >= 80 && n <= 150;
  if (band === "150plus") return n >= 150;
  return true;
}

export function dealText(model, label) {
  if (label) return label;
  const map = {
    door: "Bands keep the door",
    fee: "Fixed fee",
    split: "Door split",
    agreed: "Agreed per gig",
    room_hire: "Room hire",
  };
  return map[model] || "";
}

export function bookText(value) {
  const map = {
    gigin: "Applications on Gigin",
    email: "By email",
    seasonal: "Seasonal sessions",
    promoters: "Through promoters",
  };
  return map[value] || value || "";
}

export const APP_ORIGIN = "https://giginmusic.com";
export const MAIL_FROM = "Gigin <noreply@giginmusic.com>";

export function profileUrl(slug) {
  return `${APP_ORIGIN}/artist/${slug}`;
}

export const LISTED_VENUE_EMPTY = {
  name: "",
  area: "",
  location: null,
  city: "Cambridge",
  hasPA: null,
  soundSummary: "",
  capacity: null,
  dealModel: "",
  dealLabel: "",
  howTheyBook: "",
  takesOriginals: null,
  genres: [],
  websiteUrl: "",
  websiteEmail: "",
  source: "",
  checkedAt: null,
  street: "",
  heroPhoto: "",
};

export { PUBLIC_KEYS };
