/**
 * Per-listing application caps (matches GigPage / acceptGigOffer / Book New Event wizard).
 * Open Mic without an explicit maxApplicants is treated as unlimited until the venue closes the gig.
 */

const BOOKED_STATUSES_DEFAULT = ['confirmed', 'accepted', 'paid', 'payment processing'];

/**
 * @param {object|null|undefined} gig
 * @returns {number} Finite cap, or Infinity when new applications are not capped by count.
 */
export function resolveMaxApplicantsForGig(gig) {
  const rawMax = Number(gig?.maxApplicants);
  const hasExplicitMax = Number.isFinite(rawMax) && rawMax >= 1;
  const isOpenMicGig = gig?.kind === 'Open Mic';
  if (hasExplicitMax) return Math.max(1, Math.floor(rawMax));
  if (isOpenMicGig) return Number.POSITIVE_INFINITY;
  return 1;
}

/**
 * Applicants that count toward “this set is filled” for limiting new applies.
 * @param {object|null|undefined} gig
 * @returns {number}
 */
export function countBookedApplicantsForGig(gig) {
  const applicants = gig?.applicants;
  if (!Array.isArray(applicants)) return 0;
  if (gig?.kind === 'Open Mic') {
    return applicants.filter((a) => a?.status === 'confirmed').length;
  }
  return applicants.filter((a) => BOOKED_STATUSES_DEFAULT.includes(a?.status)).length;
}

/**
 * True when no new applications / negotiations should be allowed for this listing
 * (public apply, negotiate fee, etc.). Invite-accept is enforced separately on the API.
 *
 * @param {object|null|undefined} gig
 * @returns {boolean}
 */
export function isGigClosedToNewApplicants(gig) {
  if (!gig) return false;
  if (gig.applicationsOpen === false) return true;
  const max = resolveMaxApplicantsForGig(gig);
  if (!Number.isFinite(max)) return false;
  return countBookedApplicantsForGig(gig) >= max;
}

/**
 * Whether this musician already holds a booked slot on the listing (may complete payment / invite flow).
 * @param {object|null|undefined} gig
 * @param {string|null|undefined} musicianProfileId
 * @returns {boolean}
 */
export function musicianOccupiesBookedSlotOnGig(gig, musicianProfileId) {
  if (!musicianProfileId) return false;
  const me = (Array.isArray(gig?.applicants) ? gig.applicants : []).find((a) => a?.id === musicianProfileId);
  if (!me) return false;
  if (gig?.kind === 'Open Mic') {
    return me.status === 'confirmed';
  }
  return BOOKED_STATUSES_DEFAULT.includes(me.status);
}
