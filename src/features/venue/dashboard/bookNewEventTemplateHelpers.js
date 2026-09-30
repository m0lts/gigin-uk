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
  /** Multi-set Book an Event: slot 0 + extras (times, fees per set). */
  'startTime',
  'duration',
  'extraSlots',
  'slotBudgets',
];

/** Multi-select “Looking for” — stored on `gig.gigType` as comma-separated labels (legacy-safe). */
export const LOOKING_FOR_OPTIONS = ['Musician/Band', 'DJ', 'Promoter'];
export const LOOKING_FOR_DEFAULT = 'Musician/Band';

export function parseLookingForSelection(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return [LOOKING_FOR_DEFAULT];
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  const knownOrdered = LOOKING_FOR_OPTIONS.filter((o) => parts.includes(o));
  const unknown = parts.filter((p) => !LOOKING_FOR_OPTIONS.includes(p));
  const out = [...knownOrdered, ...unknown];
  return out.length ? out : [LOOKING_FOR_DEFAULT];
}

export function serializeLookingForSelection(selected) {
  const uniq = [...new Set((selected || []).filter(Boolean))];
  const ordered = [
    ...LOOKING_FOR_OPTIONS.filter((o) => uniq.includes(o)),
    ...uniq.filter((u) => !LOOKING_FOR_OPTIONS.includes(u)),
  ];
  return ordered.length ? ordered.join(', ') : LOOKING_FOR_DEFAULT;
}

/** Toggle one known option; keeps unknown legacy tokens; never leaves an empty selection. */
export function toggleLookingForOption(currentRaw, opt) {
  const sel = parseLookingForSelection(currentRaw);
  const unknown = sel.filter((s) => !LOOKING_FOR_OPTIONS.includes(s));
  let known = LOOKING_FOR_OPTIONS.filter((o) => sel.includes(o));
  if (known.includes(opt)) known = known.filter((x) => x !== opt);
  else known = [...known, opt];
  if (known.length === 0) known = [LOOKING_FOR_DEFAULT];
  return serializeLookingForSelection([...known, ...unknown]);
}

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

  const extraSlots = Array.isArray(gig?.extraSlots)
    ? JSON.parse(JSON.stringify(gig.extraSlots))
    : [];
  const slotCount = 1 + extraSlots.length;
  const rawBudgets = gig?.slotBudgets;
  const slotBudgets =
    Array.isArray(rawBudgets) && rawBudgets.length >= slotCount
      ? rawBudgets.slice(0, slotCount).map((x) => (x === undefined || x === null ? '£' : x))
      : Array.from({ length: slotCount }, (_, i) =>
          rawBudgets && rawBudgets[i] !== undefined && rawBudgets[i] !== null ? rawBudgets[i] : '£',
        );

  let paymentModel = gig?.paymentModel ?? '';
  if (slotCount > 1 && paymentModel === 'artist_pays_venue') {
    paymentModel = 'no_fee';
  }

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
    paymentModel,
    unifiedFeeAmount: gig?.unifiedFeeAmount ?? '£',
    ticketingModel: gig?.ticketingModel ?? '',
    showOnVenueProfile: !!gig?.showOnVenueProfile,
    gigName: gig?.gigName ?? '',
    kind: gig?.kind ?? 'Live Music',
    gigType: gig?.gigType ?? 'Musician/Band',
    rentalCapacity: gig?.rentalCapacity ?? '',
    listingDocEntries: listingClone,
    moreDetailsSectionOpen: !!gig?.moreDetailsSectionOpen,
    startTime: gig?.startTime ?? '',
    duration: gig?.duration != null && gig?.duration !== '' ? gig.duration : '',
    extraSlots,
    slotBudgets,
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

  if (Array.isArray(t.extraSlots)) {
    next.extraSlots = JSON.parse(JSON.stringify(t.extraSlots));
  }
  if (t.startTime !== undefined && t.startTime !== null) {
    next.startTime = t.startTime;
  }
  if (t.duration !== undefined && t.duration !== null && t.duration !== '') {
    next.duration = t.duration;
  }
  if (Array.isArray(t.slotBudgets)) {
    const n = 1 + (Array.isArray(next.extraSlots) ? next.extraSlots.length : 0);
    const budgets = t.slotBudgets.slice(0, n);
    next.slotBudgets = [
      ...budgets,
      ...Array.from({ length: Math.max(0, n - budgets.length) }, () => '£'),
    ];
  }

  const appliedSlotCount = 1 + (Array.isArray(next.extraSlots) ? next.extraSlots.length : 0);
  if (appliedSlotCount > 1 && next.paymentModel === 'artist_pays_venue') {
    next.paymentModel = 'no_fee';
  }

  // Template values are treated as explicit user choices, so the venue-change
  // effect in AddGigsModal won't clobber them on a later venue switch.
  next._gigNameAutoFromVenue = false;
  next._rentalCapacityAutoFromVenue = false;
  next._listingDocsVenueId = t.venueId ?? null;

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

  if (Array.isArray(t.extraSlots)) {
    next.extraSlots = JSON.parse(JSON.stringify(t.extraSlots));
  }
  if (t.startTime !== undefined && t.startTime !== null) {
    next.startTime = t.startTime;
  }
  if (t.duration !== undefined && t.duration !== null && t.duration !== '') {
    next.duration = t.duration;
  }
  if (Array.isArray(t.slotBudgets)) {
    const n = 1 + (Array.isArray(next.extraSlots) ? next.extraSlots.length : 0);
    const budgets = t.slotBudgets.slice(0, n);
    next.slotBudgets = [
      ...budgets,
      ...Array.from({ length: Math.max(0, n - budgets.length) }, () => '£'),
    ];
  }

  const appliedSlotCountAddExisting = 1 + (Array.isArray(next.extraSlots) ? next.extraSlots.length : 0);
  if (appliedSlotCountAddExisting > 1 && next.paymentModel === 'artist_pays_venue') {
    next.paymentModel = 'no_fee';
  }

  // Template values are treated as explicit user choices, so the venue-change
  // effect in AddGigsModal won't clobber them on a later venue switch.
  // (Add-existing variant does not overwrite gigName, so we don't touch that flag.)
  next._rentalCapacityAutoFromVenue = false;
  next._listingDocsVenueId = t.venueId ?? null;

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

/** Summary line for template picker UI: fee model · amount · times · venue. */
export function formatBookNewTemplateSummaryLine(template, venueName = '') {
  if (!template) return '';
  const pm = template.paymentModel;
  let feePart = 'No fee';
  if (pm === 'venue_pays_artist') feePart = 'Venue pays';
  else if (pm === 'artist_pays_venue') feePart = 'Hire fee';
  const digits = String(template.unifiedFeeAmount ?? '').replace(/[^\d]/g, '');
  const amountPart = digits ? `£${digits}` : '—';
  const start = String(template.timingMusicStartTime ?? '').trim();
  const stop = String(template.timingMusicStopTime ?? '').trim();
  const timePart = start && stop ? `${start}–${stop}` : start || stop || '—';
  const v = String(venueName || '').trim();
  const tail = v ? ` · ${v}` : '';
  return `${feePart} · ${amountPart} · ${timePart}${tail}`;
}
