/**
 * Builds client-only gig + venue shapes for the Book an Event live listing preview.
 * Mirrors AddGigsModal save logic (venue hire vs artist gig) without persisting.
 */

function timeToMinutesHHMM(t) {
  if (!t || !String(t).trim()) return null;
  const [h, m] = String(t).trim().split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function diffMinutesEndAfterStart(start, end) {
  const sm = timeToMinutesHHMM(start);
  const em = timeToMinutesHHMM(end);
  if (sm == null || em == null) return 60;
  let d = em - sm;
  if (d <= 0) d += 24 * 60;
  return d;
}

function pickArtistPerformanceStart(gig) {
  const g = gig || {};
  if (String(g.timingMusicStartTime || '').trim()) return g.timingMusicStartTime.trim();
  if (String(g.timingSoundcheckTime || '').trim()) return g.timingSoundcheckTime.trim();
  if (String(g.timingAccessTime || '').trim()) return g.timingAccessTime.trim();
  return '';
}

function pickArtistPerformanceEnd(gig) {
  const g = gig || {};
  if (String(g.timingMusicStopTime || '').trim()) return g.timingMusicStopTime.trim();
  if (String(g.timingVacateTime || '').trim()) return g.timingVacateTime.trim();
  return '';
}

function pickRentalStart(gig) {
  const g = gig || {};
  if (String(g.timingAccessTime || '').trim()) return g.timingAccessTime.trim();
  if (String(g.timingSoundcheckTime || '').trim()) return g.timingSoundcheckTime.trim();
  if (String(g.timingMusicStartTime || '').trim()) return g.timingMusicStartTime.trim();
  return '';
}

function pickRentalEnd(gig) {
  const g = gig || {};
  if (String(g.timingMusicStopTime || '').trim()) return g.timingMusicStopTime.trim();
  if (String(g.timingVacateTime || '').trim()) return g.timingVacateTime.trim();
  return '';
}

function buildEventTimingsForStorage(gig) {
  const g = gig || {};
  const o = {};
  if (String(g.timingAccessTime || '').trim()) o.accessFrom = g.timingAccessTime.trim();
  if (String(g.timingSoundcheckTime || '').trim()) o.soundcheck = g.timingSoundcheckTime.trim();
  if (String(g.timingMusicStartTime || '').trim()) o.musicStart = g.timingMusicStartTime.trim();
  if (String(g.timingMusicStopTime || '').trim()) o.musicStop = g.timingMusicStopTime.trim();
  if (String(g.timingVacateTime || '').trim()) o.mustVacate = g.timingVacateTime.trim();
  return Object.keys(o).length ? o : undefined;
}

function normalizeListingDocumentsForPreview(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((e) => e && e.included && (String(e.body || '').trim() || (e.sourceUrl && String(e.sourceUrl).trim())))
    .map((e) => ({
      key: e.key,
      title: e.title || 'Document',
      body: String(e.body || '').trim(),
      sourceUrl: e.sourceUrl && String(e.sourceUrl).trim() ? String(e.sourceUrl).trim() : null,
    }));
}

function getBudgetValue(b) {
  const n = parseInt(String(b ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function formatPounds(n) {
  return n === 0 ? '£' : `£${Number(n).toLocaleString('en-GB')}`;
}

function getStartDateTime(dateIso, startTime) {
  const timeStr = String(startTime ?? '').trim();
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date(`${dateIso}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  d.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return d;
}

function mapVenueToProfile(venue) {
  if (!venue) {
    return {
      name: 'Venue',
      photos: [],
      address: '',
      description: '',
      extraInformation: '',
      website: '',
      socialMedia: null,
      techRider: null,
    };
  }
  return {
    name: venue.name ?? 'Venue',
    photos: Array.isArray(venue.photos) ? venue.photos : [],
    address: venue.address ?? '',
    description: venue.description ?? '',
    extraInformation: venue.extraInformation ?? '',
    website: venue.website ?? '',
    socialMedia: venue.socialMedia ?? null,
    techRider: venue.techRider ?? null,
  };
}

/**
 * @param {object} params
 * @param {object} params.gig - current book-new gig form slice
 * @param {object|null} params.venue - selected venue row
 * @param {string} params.dateIso - yyyy-MM-dd active tab
 * @returns {{ mode: 'hire' | 'gig', gigData: object, venueProfile: object } | null}
 */
export function buildBookNewListingPreview({ gig, venue, dateIso }) {
  if (!gig || !dateIso) return null;

  const venueProfile = mapVenueToProfile(venue);
  const venueLite = { venueName: venueProfile.name, address: venueProfile.address };
  const extraInformation = String(gig.extraInformation ?? '').trim();
  const eventTimings = buildEventTimingsForStorage(gig);
  const listingDocuments = normalizeListingDocumentsForPreview(gig.listingDocEntries);
  const ticketingResponsibility = gig.ticketingModel;
  const privateListing = !gig.showOnVenueProfile;
  const kind = gig.kind && String(gig.kind).trim() ? gig.kind.trim() : 'Live Music';
  const gigType = gig.gigType && String(gig.gigType).trim() ? gig.gigType.trim() : 'Musician/Band';
  const capacityFromForm = parseInt(String(gig.rentalCapacity ?? '').replace(/[^\d]/g, ''), 10);
  const capacityFromVenue = parseInt(String(venue?.capacity ?? '').replace(/[^\d]/g, ''), 10);
  const capacityNum =
    Number.isFinite(capacityFromForm) && capacityFromForm > 0
      ? capacityFromForm
      : Number.isFinite(capacityFromVenue) && capacityFromVenue > 0
        ? capacityFromVenue
        : null;

  if (gig.paymentModel === 'artist_pays_venue') {
    const rentalStart = pickRentalStart(gig);
    const rentalEnd = pickRentalEnd(gig);
    const startDateTime = getStartDateTime(dateIso, rentalStart);
    const feeValueBn = getBudgetValue(gig.unifiedFeeAmount ?? '£');
    const feeTextBn = formatPounds(feeValueBn);
    const hireTitle =
      String(gig.gigName ?? '').trim() || (venue ? `${venueProfile.name} For Hire` : 'Venue hire');

    const gigData = {
      gigId: 'preview',
      venueId: venue?.venueId ?? 'preview',
      gigName: hireTitle,
      startDateTime,
      date: startDateTime,
      startTime: rentalStart || '',
      endTime: rentalEnd || '',
      duration: null,
      budget: feeValueBn === 0 ? 'Free' : feeTextBn,
      depositAmount: null,
      applicants: [],
      venue: venueLite,
      private: privateListing,
      status: 'open',
      itemType: 'venue_hire',
      kind,
      gigType,
      accountName: venueProfile.name ?? 'Venue',
      ticketingResponsibility,
      listingDocuments,
      eventTimings,
      technicalInformation: extraInformation,
      extraInformation,
    };
    return { mode: 'hire', gigData, venueProfile };
  }

  const startTimeBn = pickArtistPerformanceStart(gig);
  const endTimeBn = pickArtistPerformanceEnd(gig);
  const durationBn = diffMinutesEndAfterStart(startTimeBn, endTimeBn);
  const slotPayTypeBn = gig.paymentModel === 'no_fee' ? 'no_payment' : 'flat_fee';
  const feeValueBn = slotPayTypeBn === 'flat_fee' ? getBudgetValue(gig.unifiedFeeAmount ?? '£') : 0;
  const slotBudgetTextBn = formatPounds(feeValueBn);
  const startDateTimeBn = getStartDateTime(dateIso, startTimeBn);
  const artistTitle =
    String(gig.gigName ?? '').trim() || (venue ? `Gig at ${venueProfile.name}` : 'Gig');

  const gigData = {
    gigId: 'preview',
    venueId: venue?.venueId ?? 'preview',
    gigName: artistTitle,
    startDateTime: startDateTimeBn,
    date: startDateTimeBn,
    startTime: startTimeBn,
    duration: durationBn,
    endTime: endTimeBn,
    budget: slotBudgetTextBn,
    applicants: [],
    venue: venueLite,
    private: privateListing,
    status: 'open',
    itemType: undefined,
    kind,
    gigType,
    genre: '',
    accountName: venueProfile.name ?? 'Venue',
    ticketingResponsibility,
    listingDocuments,
    eventTimings,
    technicalInformation: extraInformation,
    extraInformation,
    loadInTime: String(gig.timingAccessTime || '').trim() || undefined,
    soundCheckTime: String(gig.timingSoundcheckTime || '').trim() || undefined,
    rentalCapacity: capacityNum ?? undefined,
  };

  return { mode: 'gig', gigData, venueProfile };
}
