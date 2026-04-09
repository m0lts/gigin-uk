/** Fields persisted for Book an Event → Save as template (and reapplied on Use template). */
export const BOOK_NEW_TEMPLATE_FIELD_KEYS = [
  'timingAccessTime',
  'timingSoundcheckTime',
  'timingMusicStartTime',
  'timingMusicStopTime',
  'timingVacateTime',
  'extraInformation',
  'paymentModel',
  'unifiedFeeAmount',
  'ticketingModel',
  'showOnVenueProfile',
  'gigName',
  'kind',
  'gigType',
  'rentalCapacity',
  'listingDocEntries',
  'moreDetailsSectionOpen',
];

export function filterBookNewEventTemplatesForVenue(templates, venueId) {
  if (!venueId || !Array.isArray(templates)) return [];
  return templates.filter((t) => t && t.bookNewEventTemplate === true && t.venueId === venueId);
}

export function templateDocId(t) {
  return t?.templateId || t?.id;
}

export function buildBookNewTemplatePayload(gig, venueId, templateId, templateName) {
  const trimmed = String(templateName || '').trim();
  const entries = gig?.listingDocEntries;
  const listingClone = Array.isArray(entries) ? JSON.parse(JSON.stringify(entries)) : null;

  return {
    venueId,
    templateId,
    templateName: trimmed,
    bookNewEventTemplate: true,
    timingAccessTime: gig?.timingAccessTime ?? '',
    timingSoundcheckTime: gig?.timingSoundcheckTime ?? '',
    timingMusicStartTime: gig?.timingMusicStartTime ?? '',
    timingMusicStopTime: gig?.timingMusicStopTime ?? '',
    timingVacateTime: gig?.timingVacateTime ?? '',
    extraInformation: gig?.extraInformation ?? '',
    paymentModel: gig?.paymentModel ?? '',
    unifiedFeeAmount: gig?.unifiedFeeAmount ?? '£',
    ticketingModel: gig?.ticketingModel ?? '',
    showOnVenueProfile: !!gig?.showOnVenueProfile,
    gigName: gig?.gigName ?? '',
    kind: gig?.kind ?? 'Live Music',
    gigType: gig?.gigType ?? 'Musician/Band',
    rentalCapacity: gig?.rentalCapacity ?? '',
    listingDocEntries: listingClone,
    moreDetailsSectionOpen: !!gig?.moreDetailsSectionOpen,
  };
}

/** Overwrite book-new template fields on `gig` from a stored template document. */
export function applyBookNewTemplateToGig(gig, template) {
  if (!gig || !template) return gig;
  const next = { ...gig };
  const t = template;

  next.timingAccessTime = t.timingAccessTime ?? '';
  next.timingSoundcheckTime = t.timingSoundcheckTime ?? '';
  next.timingMusicStartTime = t.timingMusicStartTime ?? '';
  next.timingMusicStopTime = t.timingMusicStopTime ?? '';
  next.timingVacateTime = t.timingVacateTime ?? '';
  next.extraInformation = t.extraInformation ?? '';
  next.paymentModel = t.paymentModel ?? '';
  next.unifiedFeeAmount = t.unifiedFeeAmount ?? '£';
  next.ticketingModel = t.ticketingModel ?? '';
  next.showOnVenueProfile = t.showOnVenueProfile !== undefined ? !!t.showOnVenueProfile : true;
  next.gigName = t.gigName ?? '';
  next.kind = t.kind ?? 'Live Music';
  next.gigType = t.gigType ?? 'Musician/Band';
  next.rentalCapacity = t.rentalCapacity ?? '';
  next.moreDetailsSectionOpen = !!t.moreDetailsSectionOpen;
  if (Array.isArray(t.listingDocEntries)) {
    next.listingDocEntries = JSON.parse(JSON.stringify(t.listingDocEntries));
  } else {
    next.listingDocEntries = null;
  }

  return next;
}

/**
 * Apply a Book an Event template to Add existing event: timings, payment, ticketing,
 * more-details fields (kind, gig type, capacity, docs). Does not overwrite description,
 * listing title, visibility, or booked-name fields.
 */
export function applyBookNewTemplateToGigAddExisting(gig, template) {
  if (!gig || !template) return gig;
  const next = { ...gig };
  const t = template;

  next.timingAccessTime = t.timingAccessTime ?? '';
  next.timingSoundcheckTime = t.timingSoundcheckTime ?? '';
  next.timingMusicStartTime = t.timingMusicStartTime ?? '';
  next.timingMusicStopTime = t.timingMusicStopTime ?? '';
  next.timingVacateTime = t.timingVacateTime ?? '';
  next.paymentModel = t.paymentModel ?? '';
  next.unifiedFeeAmount = t.unifiedFeeAmount ?? '£';
  next.ticketingModel = t.ticketingModel ?? '';
  next.kind = t.kind ?? 'Live Music';
  next.gigType = t.gigType ?? 'Musician/Band';
  next.rentalCapacity = t.rentalCapacity ?? '';
  next.moreDetailsSectionOpen = !!t.moreDetailsSectionOpen;
  if (Array.isArray(t.listingDocEntries)) {
    next.listingDocEntries = JSON.parse(JSON.stringify(t.listingDocEntries));
  }

  return next;
}

export function templateNameExistsForVenue(templates, venueId, name, excludeTemplateId) {
  const norm = String(name || '').trim().toLowerCase();
  if (!norm) return false;
  return filterBookNewEventTemplatesForVenue(templates, venueId).some((t) => {
    if (excludeTemplateId && templateDocId(t) === excludeTemplateId) return false;
    return String(t.templateName || '').trim().toLowerCase() === norm;
  });
}
