import { getLocalGigDateTime } from '@services/utils/filtering';

function isVenueHireLikeGig(g) {
  if (!g) return false;
  if (g.itemType === 'venue_hire') return true;
  if (g.kind === 'Venue Rental' || g.bookingMode === 'rental') return true;
  return false;
}

/** Calendar yyyy-mm-dd for a gig row (dashboard `gigs` often omit `dateIso`; use startDateTime / date). */
export function resolveGigDateIso(g) {
  if (!g) return '';
  if (g.dateIso != null && String(g.dateIso).trim()) {
    return String(g.dateIso).trim();
  }
  const dt = getLocalGigDateTime(g);
  if (dt && !Number.isNaN(dt.getTime())) {
    return dt.toISOString().split('T')[0];
  }
  if (typeof g.date?.toDate === 'function') {
    const d = g.date.toDate();
    if (d && !Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return '';
}

/** Strip trailing "(Set N)" for grouping multi-set nights that share one event name. */
export function baseGigNameForMultiSlotHeuristic(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/\s*\(Set\s+\d+\)\s*$/i, '').trim();
}

/**
 * When `gigSlots` is missing on docs, infer same-night sets from the dashboard's flat `gigs`
 * array: same venue, calendar date, and base gig name. Excludes `anchor`; returns other slot rows only.
 */
/** True when this slot has a confirmed / accepted / paid artist (set-tab status pill). */
export function gigSlotHasConfirmedArtist(slotGig) {
  if (!slotGig || !Array.isArray(slotGig.applicants)) return false;
  return slotGig.applicants.some((a) =>
    ['confirmed', 'accepted', 'paid', 'payment processing'].includes(a?.status)
  );
}

/** True when this slot has applicants not yet marked viewed (set-tab notification dot). */
export function gigSlotHasUnviewedApplicants(slotGig) {
  if (!slotGig || !Array.isArray(slotGig.applicants) || slotGig.applicants.length === 0) {
    return false;
  }
  return slotGig.applicants.some(
    (a) =>
      a &&
      a.viewed !== true &&
      String(a.status || '').toLowerCase() !== 'withdrawn'
  );
}

/**
 * Every set in an artist-booking night has a booked act. The anchor Firestore doc may stay
 * `status: "open"` while sibling slot docs hold confirmations — use merged slot list + `gigs`.
 *
 * @param {object} params
 * @param {object|null|undefined} params.normalisedGig
 * @param {object|null|undefined} params.rawGig
 * @param {object[]|null|undefined} params.artistBookingSlotGigs - e.g. shell `allSlots`
 * @param {object[]|null|undefined} params.gigs - dashboard list for fresh applicant rows
 */
export function isArtistBookingNightFullyBooked({
  normalisedGig,
  rawGig,
  artistBookingSlotGigs,
  gigs,
}) {
  if (!normalisedGig || normalisedGig.bookingMode !== 'artist_booking') return false;
  if (normalisedGig.status === 'confirmed') return true;
  if (!rawGig?.gigId) return false;

  const byId = new Map();
  const addSlot = (g) => {
    if (g?.gigId) byId.set(g.gigId, g);
  };
  if (Array.isArray(artistBookingSlotGigs)) {
    artistBookingSlotGigs.forEach(addSlot);
  }
  if (Array.isArray(rawGig.gigSlots) && rawGig.gigSlots.length > 0) {
    rawGig.gigSlots.forEach((idOrObj) => {
      const gid = typeof idOrObj === 'string' ? idOrObj : idOrObj?.gigId;
      if (!gid || byId.has(gid)) return;
      const fromGigs = Array.isArray(gigs) ? gigs.find((g) => g.gigId === gid) : null;
      addSlot(fromGigs || { gigId: gid });
    });
  }
  if (Array.isArray(normalisedGig.perSlotSummaries) && normalisedGig.perSlotSummaries.length > 0) {
    normalisedGig.perSlotSummaries.forEach((s) => {
      const gid = s?.gigId;
      if (!gid || byId.has(gid)) return;
      const fromGigs = Array.isArray(gigs) ? gigs.find((g) => g.gigId === gid) : null;
      addSlot(fromGigs || { gigId: gid });
    });
  }
  if (byId.size === 0) {
    addSlot(rawGig);
  }

  const slots = [...byId.values()];
  if (!slots.length) return false;
  return slots.every((slotGig) => {
    const fresh =
      Array.isArray(gigs) && slotGig?.gigId ? gigs.find((g) => g.gigId === slotGig.gigId) : null;
    const merged = fresh ? { ...slotGig, ...fresh } : slotGig;
    return gigSlotHasConfirmedArtist(merged);
  });
}

export function findSlotSiblingsFromFlatGigs(anchor, flatGigs) {
  if (!anchor?.gigId || !Array.isArray(flatGigs)) return [];
  if (isVenueHireLikeGig(anchor)) return [];

  const base = baseGigNameForMultiSlotHeuristic(anchor.gigName || anchor.title || '');
  const iso = resolveGigDateIso(anchor);
  const vid = anchor.venueId;
  if (!iso || !vid || !base) return [];

  const out = [];
  for (const g of flatGigs) {
    if (!g?.gigId || g.gigId === anchor.gigId) continue;
    if (isVenueHireLikeGig(g)) continue;
    if (g.venueId !== vid) continue;
    const gIso = resolveGigDateIso(g);
    if (gIso !== iso) continue;
    const gBase = baseGigNameForMultiSlotHeuristic(g.gigName || g.title || '');
    if (gBase === base) out.push(g);
  }
  return out;
}
