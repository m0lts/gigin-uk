/**
 * Normalised gig view model for venue-side full gig page.
 * Single source of truth for display; behaviour is NOT driven by event type (kind).
 * @param {Object} rawGig - Raw gig from API/context
 * @param {Object} [options] - Optional: { allSlots?: Array } for multi-slot time range
 * @returns {Object} NormalisedGig
 */
export function normaliseGig(rawGig, options = {}) {
  if (!rawGig) {
    return getDefaultNormalisedGig();
  }

  const allSlots = options.allSlots || [rawGig].filter(Boolean);
  const sortedSlots = [...allSlots].sort((a, b) => {
    if (!a?.startTime || !b?.startTime) return 0;
    const [aH, aM] = a.startTime.split(':').map(Number);
    const [bH, bM] = b.startTime.split(':').map(Number);
    return (aH * 60 + (aM || 0)) - (bH * 60 + (bM || 0));
  });

  const bookingMode = inferBookingMode(rawGig);
  const status = inferStatus(rawGig);
  const eventTypeLabel = getEventTypeLabel(rawGig);
  const { dateLabel, timeRangeLabel } = buildDateAndTimeLabels(rawGig, sortedSlots);
  const fee = buildFeeLabel(rawGig);
  const depositAmount = rawGig.depositAmount ?? rawGig.deposit ?? null;
  const depositStatus = rawGig.depositStatus ?? (rawGig.depositPaid === true ? 'paid' : rawGig.depositPaid === false ? 'unpaid' : null);
  const capacity = rawGig.capacity ?? null;
  const accessFrom = rawGig.rentalAccessFrom ?? rawGig.accessFrom ?? null;
  const curfew = rawGig.rentalHardCurfew ?? rawGig.curfew ?? null;
  const bookedBy = buildBookedBySummary(rawGig);
  const performers = buildPerformersSummary(rawGig);
  const links = buildLinks(rawGig);

  return {
    id: rawGig.gigId || rawGig.id || '',
    title: rawGig.gigName?.trim() || 'Gig',
    eventTypeLabel: eventTypeLabel || '—',
    bookingMode,
    status,
    dateLabel,
    timeRangeLabel,
    fee,
    depositAmount: depositAmount != null ? depositAmount : null,
    depositStatus: depositStatus || null,
    capacity,
    accessFrom: accessFrom || null,
    curfew: curfew || null,
    bookedBy,
    performers,
    links,
  };
}

function getDefaultNormalisedGig() {
  return {
    id: '',
    title: 'Gig',
    eventTypeLabel: '—',
    bookingMode: 'artist_booking',
    status: 'open',
    dateLabel: '—',
    timeRangeLabel: '—',
    fee: null,
    depositAmount: null,
    depositStatus: null,
    capacity: null,
    accessFrom: null,
    curfew: null,
    bookedBy: { type: 'manual', name: null, subtitle: null },
    performers: { count: 0, previewNames: [], items: [] },
    links: { gigLinkUrl: null, messagesUrl: null },
  };
}

function inferBookingMode(gig) {
  if (gig.itemType === 'venue_hire') return 'venue_hire';
  if (gig.kind === 'Venue Rental' || gig.bookingMode === 'rental') return 'venue_hire';
  return 'artist_booking';
}

function inferStatus(gig) {
  if (gig.status === 'cancelled' || gig.status === 'closed') return 'cancelled';
  if (gig.status === 'past') return 'completed';
  const applicants = gig.applicants || [];
  const hasConfirmed = applicants.some((a) => a?.status === 'confirmed' || a?.status === 'paid');
  if (hasConfirmed) return 'confirmed';
  if (gig.renterName && String(gig.renterName).trim()) return 'confirmed'; // venue hire with renter
  return 'open';
}

function getEventTypeLabel(gig) {
  const k = gig.kind;
  if (typeof k !== 'string' || !k.trim()) return '—';
  const trimmed = k.trim();
  // Booking mode is venue hire; event type is Live Music / Wedding etc. Do not surface "Venue hire" as event type.
  if (trimmed === 'Venue Rental') return '—';
  return trimmed;
}

function toDateObj(v) {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v);
  if (v?.seconds != null) return new Date(v.seconds * 1000);
  return null;
}

function formatDateLabel(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '—';
  const day = dateObj.getDate();
  const weekday = dateObj.toLocaleDateString('en-GB', { weekday: 'long' });
  const month = dateObj.toLocaleDateString('en-GB', { month: 'long' });
  const suffix = day > 3 && day < 21 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th';
  return `${weekday} ${day}${suffix} ${month}`;
}

function calculateEndTime(startTime, duration) {
  if (!startTime || duration == null) return null;
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = (h || 0) * 60 + (m || 0) + (duration || 0);
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function buildDateAndTimeLabels(gig, sortedSlots) {
  const dateObj = toDateObj(gig.date);
  const dateLabel = formatDateLabel(dateObj);

  if (sortedSlots.length > 1) {
    const withTime = sortedSlots.filter((s) => s?.startTime && s?.duration);
    if (withTime.length > 0) {
      const first = withTime[0];
      const last = withTime[withTime.length - 1];
      const end = calculateEndTime(last.startTime, last.duration);
      const timeRangeLabel = end ? `${first.startTime}–${end}` : first.startTime || '—';
      return { dateLabel, timeRangeLabel };
    }
  }

  if (gig.startTime && gig.duration != null) {
    const end = calculateEndTime(gig.startTime, gig.duration);
    const timeRangeLabel = end ? `${gig.startTime}–${end}` : gig.startTime;
    return { dateLabel, timeRangeLabel };
  }

  return { dateLabel, timeRangeLabel: gig.startTime || '—' };
}

function buildFeeLabel(gig) {
  if (gig.kind === 'Ticketed Gig') return null;
  if (gig.kind === 'Open Mic') return null;
  const budget = gig.budget || gig.hireFee || '';
  if (budget === '£0' || budget === '£') return 'No fee';
  const numeric = String(budget).replace(/[^0-9.]/g, '');
  if (numeric && parseFloat(numeric) > 0) return `£${numeric}`;
  return budget || null;
}

function buildBookedBySummary(gig) {
  const renterName = gig.renterName && String(gig.renterName).trim();
  if (renterName) {
    return {
      type: 'manual',
      name: renterName,
      contactId: null,
      userId: null,
      subtitle: 'Manually entered',
    };
  }
  // If we had a Gigin booking we could set type: 'gigin', contactId, etc.
  return { type: 'manual', name: null, contactId: null, userId: null, subtitle: null };
}

/**
 * Normalised performer ref for display. Single source of truth for "On Gigin" vs manual/CRM.
 * - source: 'gigin' only when linked to a real Gigin user (userId/artistId). CRM contacts are 'manual'.
 * - contactId: CRM contact id when added from venue CRM (not a Gigin account id).
 */
function normalisePerformersList(gig) {
  const list = gig.performers && Array.isArray(gig.performers) ? gig.performers : null;
  if (list && list.length > 0) {
    return list.map((p) => {
      const hasGiginLink = !!(p.userId || p.artistId);
      const source = p.source === 'gigin' || hasGiginLink ? 'gigin' : 'manual';
      return {
        source,
        displayName: p.displayName || '',
        userId: p.userId,
        artistId: p.artistId,
        contactId: p.contactId,
      };
    });
  }
  // Backwards compatibility: migrate from legacy bookedPerformerIds + bookedPerformerNames (all manual/CRM)
  const ids = gig.bookedPerformerIds || [];
  const names = gig.bookedPerformerNames || [];
  const fromIds = ids.map((id) => ({ source: 'manual', displayName: '', contactId: id }));
  const fromNames = names.map((displayName) => ({ source: 'manual', displayName, contactId: undefined }));
  return [...fromIds, ...fromNames];
}

function buildPerformersSummary(gig) {
  const items = normalisePerformersList(gig);
  const previewNames = items.map((p) => p.displayName).filter(Boolean);
  return {
    count: items.length,
    previewNames,
    items,
  };
}

function buildLinks(gig) {
  const base = typeof window !== 'undefined' ? window.location?.origin : '';
  const gigId = gig.gigId || gig.id;
  return {
    gigLinkUrl: gigId ? `${base}/gig/${gigId}` : null,
    messagesUrl: null,
  };
}
