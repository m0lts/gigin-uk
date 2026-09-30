import React, { useEffect, useState } from 'react';
import { DownChevronIcon, UpChevronIcon, NewTabIcon } from '../../shared/ui/extras/Icons';
import {
  LOOKING_FOR_OPTIONS,
  parseLookingForSelection,
  toggleLookingForOption,
} from './bookNewEventTemplateHelpers';
import { FEATURES } from '../../../config/features';

/**
 * Optional whole-event fields (multi-set row + single-set timeline).
 * `placement`: single-set UI inserts these before music start / after music end.
 */
const OPTIONAL_WHOLE_EVENT_STEPS = [
  {
    timeKey: 'timingAccessTime',
    includeKey: 'timingIncludeAccess',
    label: 'Access / load-in',
    rowLabel: 'Load in',
    chipLabel: '+ Load in',
    placement: 'before',
  },
  {
    timeKey: 'timingSoundcheckTime',
    includeKey: 'timingIncludeSoundcheck',
    label: 'Soundcheck',
    rowLabel: 'Soundcheck',
    chipLabel: '+ Soundcheck',
    placement: 'before',
  },
  {
    timeKey: 'timingVacateTime',
    includeKey: 'timingIncludeVacate',
    label: 'Must vacate',
    rowLabel: 'Vacate by',
    chipLabel: '+ Vacate by',
    placement: 'after',
  },
];

function isOptionalTimingVisible(gig, step) {
  if (!gig || !step) return false;
  if (gig[step.includeKey]) return true;
  return String(gig[step.timeKey] ?? '').trim() !== '';
}

/**
 * Kind options shown inside "More Options" for artist-booking flows. Picking
 * a kind only writes the `kind` label — payment and ticketing stay under the
 * user's direct control via their own radios. Legacy gigs may have other
 * labels (Wedding, Background Music, Ticketed Gig); those are preserved on
 * save and not offered as new choices here.
 */
const KIND_OPTIONS = ['Live Music', 'Open Mic'];

function formatPoundsInput(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  return `£${digits}`;
}

/** Add `minutes` to an HH:MM string. Returns '' if the input is empty/invalid. */
function addMinutesToHHMM(hhmm, minutes) {
  const s = String(hhmm || '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(s)) return '';
  const [h, m] = s.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const total = h * 60 + m + (Number.isFinite(Number(minutes)) ? Number(minutes) : 0);
  const norm = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(norm / 60)).padStart(2, '0');
  const mm = String(norm % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Compute minutes between two HH:MM strings (end after start, wraps at midnight). */
function minutesBetweenHHMM(start, end) {
  const a = String(start || '').trim();
  const b = String(end || '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(a) || !/^\d{1,2}:\d{2}$/.test(b)) return 0;
  const [sh, sm] = a.split(':').map(Number);
  const [eh, em] = b.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

/** Music envelope spanning all sets: first set start → last set end (HH:MM). */
function getDerivedMusicEnvelopeFromSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return { start: '', end: '' };
  const firstStart = String(slots[0]?.startTime ?? '').trim();
  const last = slots[slots.length - 1];
  const lastStart = String(last?.startTime ?? '').trim();
  const lastDur = Number(last?.duration);
  const lastEnd =
    lastStart && Number.isFinite(lastDur) && lastDur > 0 ? addMinutesToHHMM(lastStart, lastDur) : '';
  return { start: firstStart, end: lastEnd };
}

/**
 * Unified Book an Event — single scrollable form (addGigsMode === 'bookNew').
 */
export function BookNewEventWizard({
  activeTab,
  currentGig,
  selectedVenue,
  patchGig,
  bookNewTimingError,
  onClearTimingError,
  onOpenSaveTemplateModal,
  listingPreviewOpen = false,
  onToggleListingPreview,
  /** 'bookNew' = public listing flow; 'addExisting' = internal confirmed event (no visibility / preview / templates). */
  variant = 'bookNew',
  /** Set false for add-existing: hides Save as Template + Preview even if variant were wrong. */
  showTemplateAndListingPreview = true,
  /** Multi-slot plumbing — populated for bookNew. Lets the wizard render a slot
   * count picker and per-slot start/duration/fee rows, delegating writes back
   * to AddGigsModal's slot helpers. */
  isEditMode = false,
  allSlotsForActive = [],
  slotBudgetsForActive = [],
  slotArtistNamesForActive = [],
  onSlotCountChange,
  onSlotStartChange,
  onSlotDurationChange,
  onSlotBudgetChange,
  onSlotArtistNameChange,
  onRemoveExtraSlot,
  onAddSlot,
}) {
  const set = patchGig;
  const isAddExisting = variant === 'addExisting';
  const showBookNewListingChrome = showTemplateAndListingPreview && variant === 'bookNew';

  const bookedNameValue = (() => {
    const names = currentGig?.artistNames;
    if (Array.isArray(names) && names.length > 0) return names[0] ?? '';
    return currentGig?.artistName ?? '';
  })();

  const setBookedName = (val) => {
    set({ artistNames: [val], artistName: val });
  };

  // Multi-slot state is derived from the slot rows supplied by AddGigsModal.
  // Computed before the early return so hooks can depend on it.
  const slotCount = Math.max(Array.isArray(allSlotsForActive) ? allSlotsForActive.length : 0, 1);
  const multiSlot = slotCount > 1;

  useEffect(() => {
    if (!activeTab || !currentGig) return;
    if (multiSlot && currentGig.paymentModel === 'artist_pays_venue') {
      patchGig({ paymentModel: 'no_fee' });
    }
  }, [activeTab, currentGig, multiSlot, patchGig]);

  useEffect(() => {
    if (!activeTab || !currentGig || !multiSlot) return;
    const slots = allSlotsForActive || [];
    const { start, end } = getDerivedMusicEnvelopeFromSlots(slots);
    const curS = String(currentGig.timingMusicStartTime ?? '').trim();
    const curE = String(currentGig.timingMusicStopTime ?? '').trim();
    const nextS = start || '';
    const nextE = end || '';
    if (curS !== nextS || curE !== nextE) {
      patchGig({ timingMusicStartTime: nextS, timingMusicStopTime: nextE });
    }
  }, [activeTab, currentGig, multiSlot, allSlotsForActive, patchGig]);

  if (!activeTab || !currentGig) return null;

  // Venue-hire ("they pay to hire the space") skips the kind picker entirely —
  // it's a rental and always stores kind: 'Venue Rental' at save time.
  const isRentalFlow = currentGig.paymentModel === 'artist_pays_venue';
  // Only "Live Music" and "Open Mic" are first-class choices in the UI now;
  // legacy labels (Wedding, Background Music, Ticketed Gig) are preserved
  // on save but aren't offered as new selections.
  const activeKindOption = KIND_OPTIONS.includes(currentGig.kind) ? currentGig.kind : 'Live Music';
  // Slot controls fire in both public-listing (bookNew) and private
  // confirmed-record (addExisting) flows. Rental flows never show slots.
  const showSlotControls = !isRentalFlow;

  // maxApplicants is only meaningful for non-paid artist-booking listings —
  // paid acceptances auto-decline other applicants on the server today, so
  // until that backend pipeline is generalised we restrict the field to
  // free Live Music + Ticketed listings. Open Mic gigs are inherently
  // multi-artist and stay open until the venue closes them manually, so we
  // don't show the cap there (would only be confusing).
  const supportsMaxApplicants = (
    (currentGig.paymentModel === 'no_fee' && currentGig.kind !== 'Open Mic')
    || currentGig.kind === 'Ticketed Gig'
  );
  const maxApplicantsValue = (() => {
    const raw = currentGig.maxApplicants;
    const parsed = Number.isFinite(Number(raw)) ? Number(raw) : 1;
    return Math.max(1, Math.min(10, parsed));
  })();
  const optionalTimingsRemaining = OPTIONAL_WHOLE_EVENT_STEPS.filter((s) => !isOptionalTimingVisible(currentGig, s));
  const showOptionalTimingChips = optionalTimingsRemaining.length > 0;
  const derivedMusicEnvelope = multiSlot ? getDerivedMusicEnvelopeFromSlots(allSlotsForActive || []) : null;
  const musicStartRowValue = multiSlot
    ? (derivedMusicEnvelope?.start ?? '')
    : (currentGig.timingMusicStartTime ?? '');
  const musicEndRowValue = multiSlot
    ? (derivedMusicEnvelope?.end ?? '')
    : (currentGig.timingMusicStopTime ?? '');

  /**
   * When transitioning from single-slot to multi-slot, music start/end are
   * derived from sets; seed slot 0 from the top-level music inputs so the
   * first set row isn't empty when multi-set is enabled.
   */
  const syncSlotZeroFromTimings = () => {
    if (multiSlot) return;
    const startStr = String(currentGig?.timingMusicStartTime || '').trim();
    const stopStr = String(currentGig?.timingMusicStopTime || '').trim();
    if (!startStr) return;
    const patch = { startTime: startStr };
    if (stopStr) {
      const dur = minutesBetweenHHMM(startStr, stopStr);
      if (dur > 0) patch.duration = dur;
    }
    set(patch);
  };

  return (
    <div className="add-gigs-book-new-flow">
      {isAddExisting && !multiSlot && (
        <section
          className="add-gigs-book-new-section add-gigs-book-new-booked-section"
          aria-labelledby={`bn-booked-${activeTab}`}
        >
          <h3 id={`bn-booked-${activeTab}`} className="label add-gigs-section-heading">Who have you booked?</h3>
          <div className="add-gigs-field add-gigs-field--full add-gigs-book-new-booked-name-field">
            <input
              type="text"
              className="input add-gigs-book-new-booked-name-input"
              placeholder="e.g. name of artist / promoter"
              value={bookedNameValue}
              onChange={(e) => setBookedName(e.target.value)}
              autoComplete="off"
            />
          </div>
        </section>
      )}
      <section className="add-gigs-book-new-section add-gigs-book-new-section--timings" aria-labelledby={`bn-timings-${activeTab}`}>
        <h3 id={`bn-timings-${activeTab}`} className="add-gigs-book-new-section-label-upper">Timings</h3>
        <div className="add-gigs-book-new-timeline-wrap">
          <div className="add-gigs-book-new-timing-row">
            {OPTIONAL_WHOLE_EVENT_STEPS.filter((s) => s.placement === 'before').map((step) =>
              isOptionalTimingVisible(currentGig, step) ? (
                <div key={step.timeKey} className="add-gigs-book-new-timing-field">
                  <div className="add-gigs-book-new-timing-cell-head">
                    <label className="add-gigs-book-new-timing-cell-label" htmlFor={`bn-extra-${step.timeKey}-${activeTab}`}>
                      {step.rowLabel}
                    </label>
                    <button
                      type="button"
                      className="add-gigs-book-new-timing-cell-remove"
                      onClick={() => {
                        onClearTimingError?.();
                        set({ [step.includeKey]: false, [step.timeKey]: '' });
                      }}
                      aria-label={`Remove ${step.rowLabel}`}
                    >
                      ×
                    </button>
                  </div>
                  <input
                    id={`bn-extra-${step.timeKey}-${activeTab}`}
                    type="time"
                    className="input add-gigs-book-new-timeline-time add-gigs-book-new-timing-row-input"
                    value={currentGig[step.timeKey] ?? ''}
                    onChange={(e) => {
                      onClearTimingError?.();
                      set({ [step.timeKey]: e.target.value });
                    }}
                  />
                </div>
              ) : null,
            )}
            <div className="add-gigs-book-new-timing-field">
              <div className="add-gigs-book-new-timing-cell-head">
                <label className="add-gigs-book-new-timing-cell-label" htmlFor={`bn-music-start-${activeTab}`}>
                  Music start
                </label>
                <span className="add-gigs-book-new-timing-cell-remove-spacer" aria-hidden="true" />
              </div>
              <input
                id={`bn-music-start-${activeTab}`}
                type="time"
                disabled={multiSlot}
                className={`input add-gigs-book-new-timeline-time add-gigs-book-new-timing-row-input${multiSlot ? ' add-gigs-book-new-timing-row-input--derived' : ''}`}
                value={musicStartRowValue}
                onChange={
                  multiSlot
                    ? undefined
                    : (e) => {
                      onClearTimingError?.();
                      set({ timingMusicStartTime: e.target.value });
                    }
                }
              />
            </div>
            <div className="add-gigs-book-new-timing-field">
              <div className="add-gigs-book-new-timing-cell-head">
                <label className="add-gigs-book-new-timing-cell-label" htmlFor={`bn-music-end-${activeTab}`}>
                  Music end
                </label>
                <span className="add-gigs-book-new-timing-cell-remove-spacer" aria-hidden="true" />
              </div>
              <input
                id={`bn-music-end-${activeTab}`}
                type="time"
                disabled={multiSlot}
                className={`input add-gigs-book-new-timeline-time add-gigs-book-new-timing-row-input${multiSlot ? ' add-gigs-book-new-timing-row-input--derived' : ''}`}
                value={musicEndRowValue}
                onChange={
                  multiSlot
                    ? undefined
                    : (e) => {
                      onClearTimingError?.();
                      set({ timingMusicStopTime: e.target.value });
                    }
                }
              />
            </div>
            {OPTIONAL_WHOLE_EVENT_STEPS.filter((s) => s.placement === 'after').map((step) =>
              isOptionalTimingVisible(currentGig, step) ? (
                <div key={step.timeKey} className="add-gigs-book-new-timing-field">
                  <div className="add-gigs-book-new-timing-cell-head">
                    <label className="add-gigs-book-new-timing-cell-label" htmlFor={`bn-extra-${step.timeKey}-${activeTab}`}>
                      {step.rowLabel}
                    </label>
                    <button
                      type="button"
                      className="add-gigs-book-new-timing-cell-remove"
                      onClick={() => {
                        onClearTimingError?.();
                        set({ [step.includeKey]: false, [step.timeKey]: '' });
                      }}
                      aria-label={`Remove ${step.rowLabel}`}
                    >
                      ×
                    </button>
                  </div>
                  <input
                    id={`bn-extra-${step.timeKey}-${activeTab}`}
                    type="time"
                    className="input add-gigs-book-new-timeline-time add-gigs-book-new-timing-row-input"
                    value={currentGig[step.timeKey] ?? ''}
                    onChange={(e) => {
                      onClearTimingError?.();
                      set({ [step.timeKey]: e.target.value });
                    }}
                  />
                </div>
              ) : null,
            )}
          </div>
          {showOptionalTimingChips ? (
            <div className="add-gigs-book-new-timing-chip-row" role="group" aria-label="Add optional times">
              {OPTIONAL_WHOLE_EVENT_STEPS.map((step) =>
                !isOptionalTimingVisible(currentGig, step) ? (
                  <button
                    key={step.timeKey}
                    type="button"
                    className="add-gigs-book-new-timing-chip"
                    onClick={() => {
                      onClearTimingError?.();
                      set({ [step.includeKey]: true });
                    }}
                  >
                    {step.chipLabel}
                  </button>
                ) : null,
              )}
            </div>
          ) : null}
          {showSlotControls && !isEditMode && !multiSlot ? (
            <div className="add-gigs-book-new-multi-acts-wrap">
              <button
                type="button"
                className="add-gigs-book-new-timing-chip add-gigs-book-new-multi-acts-chip"
                onClick={() => {
                  syncSlotZeroFromTimings();
                  onSlotCountChange?.(2);
                }}
              >
                + Multiple sets for this gig
              </button>
            </div>
          ) : null}
          {multiSlot ? (
            <>
              <div className="add-gigs-book-new-sets-under-timings" aria-labelledby={`bn-sets-${activeTab}`}>
                <h4 id={`bn-sets-${activeTab}`} className="label add-gigs-section-heading add-gigs-book-new-sets-under-timings-title">
                  Sets
                </h4>
                <p className="add-gigs-helper add-gigs-book-new-sets-under-timings-copy">
                  {isAddExisting
                    ? (currentGig.paymentModel === 'venue_pays_artist'
                        ? 'Each set is stored as its own gig on the date. Add the artist and times for each — fees under Payment model.'
                        : 'Each set is stored as its own gig on the date. Add the artist, times and fee for each.')
                    : (currentGig.paymentModel === 'venue_pays_artist'
                        ? 'Each set becomes its own listing. Enter fees under Payment model.'
                        : 'Each set becomes its own listing with its own fee.')}
                </p>
                <div className="add-gigs-book-new-sets-list">
                  {(allSlotsForActive || []).map((slot, index) => {
                    const startVal = (slot?.startTime ?? '').toString();
                    const durationVal = Number.isFinite(Number(slot?.duration)) ? Number(slot.duration) : 60;
                    const endVal = startVal ? addMinutesToHHMM(startVal, durationVal) : '';
                    const artistNameVal = slotArtistNamesForActive?.[index] ?? '';
                    const canRemove = !isEditMode && index > 0 && slotCount > 1;
                    return (
                      <div key={index} className="add-gigs-book-new-set-row">
                        <div className="add-gigs-book-new-set-header">
                          <span className="add-gigs-book-new-set-title">Set {index + 1}</span>
                          {canRemove && (
                            <button
                              type="button"
                              className="add-gigs-book-new-set-remove"
                              onClick={() => onRemoveExtraSlot?.(index - 1)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="add-gigs-book-new-set-fields">
                          {isAddExisting && (
                            <div className="add-gigs-field add-gigs-book-new-set-artist">
                              <label className="label">Artist</label>
                              <input
                                type="text"
                                className="input"
                                placeholder="Artist / promoter name"
                                value={artistNameVal}
                                onChange={(e) => onSlotArtistNameChange?.(index, e.target.value)}
                                autoComplete="off"
                              />
                            </div>
                          )}
                          <div className="add-gigs-book-new-set-time-grid">
                            <label className="label add-gigs-book-new-set-time-label add-gigs-book-new-set-time-label--start" htmlFor={`bn-set-start-${activeTab}-${index}`}>Start</label>
                            <label className="label add-gigs-book-new-set-time-label add-gigs-book-new-set-time-label--end" htmlFor={`bn-set-end-${activeTab}-${index}`}>End</label>
                            <input
                              id={`bn-set-start-${activeTab}-${index}`}
                              type="time"
                              className="input add-gigs-book-new-timeline-time add-gigs-book-new-set-time-input add-gigs-book-new-set-time-input--start"
                              value={startVal}
                              onChange={(e) => {
                                onClearTimingError?.();
                                onSlotStartChange?.(index, e.target.value);
                              }}
                            />
                            <span className="add-gigs-book-new-set-time-between" aria-hidden="true">to</span>
                            <input
                              id={`bn-set-end-${activeTab}-${index}`}
                              type="time"
                              className="input add-gigs-book-new-timeline-time add-gigs-book-new-set-time-input add-gigs-book-new-set-time-input--end"
                              value={endVal}
                              onChange={(e) => {
                                onClearTimingError?.();
                                const nextDuration = minutesBetweenHHMM(startVal, e.target.value);
                                onSlotDurationChange?.(index, nextDuration || 60);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!isEditMode && slotCount < 10 && (
                    <button
                      type="button"
                      className="btn tertiary add-gigs-book-new-set-add"
                      onClick={() => onAddSlot?.()}
                    >
                      + Add another set
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
        {bookNewTimingError && (
          <p className="add-gigs-book-new-error" role="alert">{bookNewTimingError}</p>
        )}
      </section>

      {(FEATURES.payments || FEATURES.ticketing) && (
      <div className="add-gigs-book-new-pay-tix-row">
        {FEATURES.payments && (
        <section className="add-gigs-book-new-section add-gigs-book-new-section--pay-tix-col add-gigs-book-new-section--fee-model" aria-labelledby={`bn-pay-${activeTab}`}>
          <h3 id={`bn-pay-${activeTab}`} className="add-gigs-book-new-section-label-upper add-gigs-book-new-section-label-upper--in-pay-tix-row">Fee model</h3>
          <div className="add-gigs-book-new-payment-stack">
            <div className="add-gigs-book-new-fee-cards" role="radiogroup" aria-labelledby={`bn-pay-${activeTab}`}>
              <label
                className={`add-gigs-book-new-fee-card${currentGig.paymentModel === 'venue_pays_artist' ? ' add-gigs-book-new-fee-card--selected' : ''}`}
              >
                <input
                  type="radio"
                  className="add-gigs-book-new-fee-card-input"
                  name={`payment-model-${activeTab}`}
                  checked={currentGig.paymentModel === 'venue_pays_artist'}
                  onChange={() => set({ paymentModel: 'venue_pays_artist' })}
                />
                <span className="add-gigs-book-new-fee-card-radio" aria-hidden="true" />
                <span className="add-gigs-book-new-fee-card-copy">
                  <span className="add-gigs-book-new-fee-card-title">{multiSlot ? "I'll pay the artists or promoters" : "I'll pay the artist or promoter"}</span>
                  <span className="add-gigs-book-new-fee-card-desc">You offer a fixed fee for the performance</span>
                </span>
              </label>
              {FEATURES.venueHire && (
              <label
                className={`add-gigs-book-new-fee-card${currentGig.paymentModel === 'artist_pays_venue' ? ' add-gigs-book-new-fee-card--selected' : ''}${multiSlot ? ' add-gigs-book-new-fee-card--disabled' : ''}`}
                title={multiSlot ? 'Not available when listing multiple sets on one night' : undefined}
              >
                <input
                  type="radio"
                  className="add-gigs-book-new-fee-card-input"
                  name={`payment-model-${activeTab}`}
                  checked={currentGig.paymentModel === 'artist_pays_venue'}
                  disabled={multiSlot}
                  onChange={() => set({ paymentModel: 'artist_pays_venue' })}
                />
                <span className="add-gigs-book-new-fee-card-radio" aria-hidden="true" />
                <span className="add-gigs-book-new-fee-card-copy">
                  <span className="add-gigs-book-new-fee-card-title">They pay to hire the space</span>
                  <span className="add-gigs-book-new-fee-card-desc">They cover a hire fee to use your venue</span>
                </span>
              </label>
              )}
              <label
                className={`add-gigs-book-new-fee-card${currentGig.paymentModel === 'no_fee' ? ' add-gigs-book-new-fee-card--selected' : ''}`}
              >
                <input
                  type="radio"
                  className="add-gigs-book-new-fee-card-input"
                  name={`payment-model-${activeTab}`}
                  checked={currentGig.paymentModel === 'no_fee'}
                  onChange={() => set({ paymentModel: 'no_fee' })}
                />
                <span className="add-gigs-book-new-fee-card-radio" aria-hidden="true" />
                <span className="add-gigs-book-new-fee-card-copy">
                  <span className="add-gigs-book-new-fee-card-title">No fee</span>
                  <span className="add-gigs-book-new-fee-card-desc">No money changes hands</span>
                </span>
              </label>
            </div>
            {(currentGig.paymentModel === 'venue_pays_artist' || currentGig.paymentModel === 'artist_pays_venue') && !multiSlot && (
              <div className="add-gigs-field add-gigs-book-new-fee-field">
                <label className="add-gigs-book-new-fee-amount-label" htmlFor={`unified-fee-${activeTab}`}>Fee amount (£)</label>
                <input
                  id={`unified-fee-${activeTab}`}
                  type="text"
                  className="input"
                  placeholder="e.g. 150"
                  value={currentGig.unifiedFeeAmount ?? '£'}
                  onChange={(e) => set({ unifiedFeeAmount: formatPoundsInput(e.target.value) })}
                  autoComplete="off"
                />
              </div>
            )}
            {(currentGig.paymentModel === 'venue_pays_artist') && multiSlot && (
              <div className="add-gigs-book-new-multi-venue-pays-fees" aria-label="Fee per set">
                <p className="add-gigs-helper add-gigs-book-new-multi-venue-pays-intro">
                  Amount you&apos;ll pay each artist (one fee per set):
                </p>
                <div className="add-gigs-book-new-multi-venue-pays-fee-fields">
                  {(allSlotsForActive || []).map((_, idx) => (
                    <div key={`pay-set-fee-${idx}`} className="add-gigs-field add-gigs-book-new-multi-venue-pays-fee-field">
                      <label className="label" htmlFor={`set-fee-${activeTab}-${idx}`}>
                        Set {idx + 1}
                      </label>
                      <input
                        id={`set-fee-${activeTab}-${idx}`}
                        type="text"
                        className="input"
                        placeholder="e.g. 150"
                        value={slotBudgetsForActive?.[idx] ?? '£'}
                        onChange={(e) => onSlotBudgetChange?.(idx, formatPoundsInput(e.target.value))}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
        )}

        {FEATURES.ticketing && (
        <section className="add-gigs-book-new-section add-gigs-book-new-section--pay-tix-col add-gigs-book-new-section--ticketing" aria-labelledby={`bn-tix-${activeTab}`}>
          <h3 id={`bn-tix-${activeTab}`} className="add-gigs-book-new-section-label-upper add-gigs-book-new-section-label-upper--in-pay-tix-row">Ticketing</h3>
          <div className="add-gigs-book-new-fee-cards" role="radiogroup" aria-labelledby={`bn-tix-${activeTab}`}>
            <label
              className={`add-gigs-book-new-fee-card${currentGig.ticketingModel === 'venue' ? ' add-gigs-book-new-fee-card--selected' : ''}`}
            >
              <input
                type="radio"
                className="add-gigs-book-new-fee-card-input"
                name={`ticketing-${activeTab}`}
                checked={currentGig.ticketingModel === 'venue'}
                onChange={() => set({ ticketingModel: 'venue' })}
              />
              <span className="add-gigs-book-new-fee-card-radio" aria-hidden="true" />
              <span className="add-gigs-book-new-fee-card-copy">
                <span className="add-gigs-book-new-fee-card-title">Venue handles ticketing</span>
                <span className="add-gigs-book-new-fee-card-desc">You sell or manage tickets for this event</span>
              </span>
            </label>
            <label
              className={`add-gigs-book-new-fee-card${currentGig.ticketingModel === 'artist' ? ' add-gigs-book-new-fee-card--selected' : ''}`}
            >
              <input
                type="radio"
                className="add-gigs-book-new-fee-card-input"
                name={`ticketing-${activeTab}`}
                checked={currentGig.ticketingModel === 'artist'}
                onChange={() => set({ ticketingModel: 'artist' })}
              />
              <span className="add-gigs-book-new-fee-card-radio" aria-hidden="true" />
              <span className="add-gigs-book-new-fee-card-copy">
                <span className="add-gigs-book-new-fee-card-title">They handle ticketing</span>
                <span className="add-gigs-book-new-fee-card-desc">They sell or manage ticket sales</span>
              </span>
            </label>
            <label
              className={`add-gigs-book-new-fee-card${currentGig.ticketingModel === 'free_entry' ? ' add-gigs-book-new-fee-card--selected' : ''}`}
            >
              <input
                type="radio"
                className="add-gigs-book-new-fee-card-input"
                name={`ticketing-${activeTab}`}
                checked={currentGig.ticketingModel === 'free_entry'}
                onChange={() => set({ ticketingModel: 'free_entry' })}
              />
              <span className="add-gigs-book-new-fee-card-radio" aria-hidden="true" />
              <span className="add-gigs-book-new-fee-card-copy">
                <span className="add-gigs-book-new-fee-card-title">Not ticketed</span>
                <span className="add-gigs-book-new-fee-card-desc">Free entry or no ticket sales through Gigin</span>
              </span>
            </label>
          </div>
        </section>
        )}
      </div>
      )}

      {!isAddExisting && (
        <section className="add-gigs-book-new-section add-gigs-book-new-section--gig-desc" aria-labelledby={`bn-desc-${activeTab}`}>
          <h3 id={`bn-desc-${activeTab}`} className="add-gigs-book-new-section-label-upper">Gig description</h3>
          <textarea
            className="input add-gigs-book-new-gig-description-textarea add-gigs-book-new-gig-description-textarea--always"
            placeholder="(Optional) Describe the gig, the vibe, what you're looking for"
            value={currentGig.extraInformation ?? ''}
            onChange={(e) => set({ extraInformation: e.target.value })}
            maxLength={250}
            rows={3}
          />
        </section>
      )}

      {!isAddExisting && (
        <section className="add-gigs-book-new-section add-gigs-book-new-section--visibility" aria-labelledby={`bn-vis-${activeTab}`}>
          <h3 id={`bn-vis-${activeTab}`} className="add-gigs-book-new-section-label-upper">Visibility</h3>
          <div className="add-gigs-book-new-visibility-row">
            <div className="add-gigs-book-new-visibility-copy">
              <span className="add-gigs-book-new-visibility-title">Show on my venue profile</span>
              <span className="add-gigs-book-new-visibility-sub">Artists and promoters can find and apply to this gig</span>
            </div>
            <label className="gigs-toggle-switch add-gigs-book-new-visibility-toggle">
              <input
                type="checkbox"
                checked={!!currentGig.showOnVenueProfile}
                onChange={(e) => set({ showOnVenueProfile: e.target.checked })}
              />
              <span className="gigs-toggle-slider" />
            </label>
          </div>
          {!currentGig.showOnVenueProfile ? (
            <p className="add-gigs-book-new-visibility-private-note">
              Only people with the link can open this listing; it will not appear on your public venue profile.
            </p>
          ) : null}
        </section>
      )}

      {showBookNewListingChrome && (
        <div
          className="add-gigs-book-new-secondary-actions"
          role="group"
          aria-label="Listing preview"
        >
          <button
            type="button"
            className={`btn tertiary add-gigs-book-new-secondary-action-btn${listingPreviewOpen ? ' add-gigs-book-new-secondary-action-btn--active' : ''}`}
            onClick={() => onToggleListingPreview?.()}
            aria-pressed={listingPreviewOpen}
          >
            <NewTabIcon /> Preview gig listing
          </button>
        </div>
      )}

      <section className="add-gigs-book-new-section add-gigs-book-new-section--more" aria-labelledby={`bn-more-trigger-${activeTab}`}>
        <div className="add-gigs-more-details add-gigs-book-new-more-details">
          <button
            type="button"
            className="add-gigs-more-details-header add-gigs-book-new-more-toggle"
            onClick={() => set({ moreDetailsSectionOpen: !currentGig.moreDetailsSectionOpen })}
            aria-expanded={!!currentGig.moreDetailsSectionOpen}
            aria-controls={`bn-more-panel-${activeTab}`}
            id={`bn-more-trigger-${activeTab}`}
          >
            <span className="add-gigs-more-details-label add-gigs-book-new-more-details-trigger-label">More details</span>
            {currentGig.moreDetailsSectionOpen ? <UpChevronIcon /> : <DownChevronIcon />}
          </button>
          <div className="add-gigs-more-details-divider add-gigs-more-details-divider--below" />
          {currentGig.moreDetailsSectionOpen && (
            <div
              id={`bn-more-panel-${activeTab}`}
              role="region"
              aria-labelledby={`bn-more-trigger-${activeTab}`}
              className="add-gigs-book-new-more-expanded"
            >
              <div className="add-gigs-book-new-more-fields">
                {!isAddExisting && (
                  <div className="add-gigs-field add-gigs-field--full">
                    <label className="label add-gigs-more-details-field-label">Gig listing title</label>
                    <input
                      type="text"
                      className="input add-gigs-input-no-border"
                      placeholder="e.g. Friday Night Live"
                      value={currentGig.gigName ?? ''}
                      onChange={(e) => set({ gigName: e.target.value, _gigNameAutoFromVenue: false })}
                    />
                  </div>
                )}
                <div className="add-gigs-field">
                  <label className="label add-gigs-more-details-field-label" htmlFor={`bn-cap-${activeTab}`}>Capacity</label>
                  <input
                    id={`bn-cap-${activeTab}`}
                    type="text"
                    className="input add-gigs-input-no-border"
                    placeholder="e.g. 200"
                    value={
                      (currentGig.rentalCapacity != null && String(currentGig.rentalCapacity).trim() !== '')
                        ? currentGig.rentalCapacity
                        : (selectedVenue?.capacity ?? '')
                    }
                    onChange={(e) => set({ rentalCapacity: e.target.value, _rentalCapacityAutoFromVenue: false })}
                  />
                </div>
                {!isRentalFlow && (
                  <div className="add-gigs-field">
                    <label className="label add-gigs-more-details-field-label" htmlFor={`bn-kind-${activeTab}`}>
                      Event kind
                    </label>
                    <select
                      id={`bn-kind-${activeTab}`}
                      className="select add-gigs-filter-select add-gigs-select-no-border"
                      value={activeKindOption}
                      onChange={(e) => set({ kind: e.target.value })}
                    >
                      {KIND_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                )}
                {!isRentalFlow && (
                  <div className="add-gigs-field">
                    <label id={`bn-looking-for-label-${activeTab}`} className="label add-gigs-more-details-field-label">
                      Looking for
                    </label>
                    <div
                      className="add-gigs-book-new-looking-for-pills"
                      role="group"
                      aria-labelledby={`bn-looking-for-label-${activeTab}`}
                    >
                      {LOOKING_FOR_OPTIONS.map((opt) => {
                        const selected = parseLookingForSelection(currentGig.gigType);
                        const isOn = selected.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            className={`btn tertiary add-gigs-book-new-looking-for-pill${isOn ? ' add-gigs-book-new-looking-for-pill--selected' : ''}`}
                            aria-pressed={isOn}
                            onClick={() => {
                              set({
                                gigType: toggleLookingForOption(currentGig.gigType, opt),
                              });
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {showSlotControls && isAddExisting && (
                  <div className="add-gigs-field add-gigs-field--full">
                    <label className="label add-gigs-more-details-field-label" id={`bn-slots-label-${activeTab}`}>
                      How many sets?
                    </label>
                    {isEditMode ? (
                      <p className="add-gigs-helper">
                        Set count is locked in edit mode. Adjust timings and artist for each set below; fees are under Payment model when you pay artists.
                      </p>
                    ) : (
                      <>
                        <div
                          className="add-gigs-book-new-kind-pills add-gigs-book-new-kind-pills--slot-count"
                          role="tablist"
                          aria-labelledby={`bn-slots-label-${activeTab}`}
                        >
                          {[1, 2, 3].map((count) => {
                            const selected = slotCount === count;
                            return (
                              <button
                                key={count}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                className={`btn tertiary add-gigs-book-new-kind-pill${selected ? ' add-gigs-book-new-kind-pill--active' : ''}`}
                                onClick={() => {
                                  syncSlotZeroFromTimings();
                                  onSlotCountChange?.(count);
                                }}
                              >
                                {count}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            role="tab"
                            aria-selected={slotCount >= 4}
                            className={`btn tertiary add-gigs-book-new-kind-pill${slotCount >= 4 ? ' add-gigs-book-new-kind-pill--active' : ''}`}
                            onClick={() => {
                              syncSlotZeroFromTimings();
                              onSlotCountChange?.(Math.max(slotCount, 4));
                            }}
                          >
                            4+
                          </button>
                        </div>
                        <p className="add-gigs-helper">
                          Leave at 1 if you're booking a promoter or a single artist. Choose more to split the event into separate paid sets — timings in Sets, fees under Payment model when you pay artists.
                        </p>
                      </>
                    )}
                  </div>
                )}
                {FEATURES.payments && !isRentalFlow && !isAddExisting && !multiSlot && supportsMaxApplicants && (
                  <div className="add-gigs-field add-gigs-field--full">
                    <label
                      className="label add-gigs-more-details-field-label"
                      htmlFor={`bn-max-applicants-${activeTab}`}
                    >
                      How many artists can you accept?
                    </label>
                    <input
                      id={`bn-max-applicants-${activeTab}`}
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      className="input add-gigs-input-no-border add-gigs-book-new-max-applicants-input"
                      value={maxApplicantsValue}
                      onChange={(e) => {
                        const raw = String(e.target.value || '').trim();
                        if (raw === '') return set({ maxApplicants: 1 });
                        const parsed = parseInt(raw, 10);
                        if (!Number.isFinite(parsed)) return;
                        const clamped = Math.max(1, Math.min(10, parsed));
                        set({ maxApplicants: clamped });
                      }}
                    />
                    <p className="add-gigs-helper">
                      Defaults to 1 — the listing closes once you accept an artist. Increase it to keep the gig open and accept multiple artists for the same event (great for line-ups, support slots and open mics).
                    </p>
                  </div>
                )}
              </div>

              <div className="add-gigs-book-new-docs">
                <div className="label add-gigs-more-details-field-label add-gigs-book-new-docs-heading">Documents</div>
                <p className="add-gigs-helper">
                  View your gig documents. Anyone applying to your gig must accept your T&Cs and House Rules if you have added them.
                </p>
                {(currentGig.listingDocEntries || []).length === 0 && (
                  <p className="add-gigs-helper">No documents on your venue profile yet. Add files under venue settings, or continue without.</p>
                )}
                {(currentGig.listingDocEntries || []).map((doc, idx) => (
                  <div key={doc.key || idx} className="add-gigs-book-new-doc-block">
                    <div className="add-gigs-book-new-doc-head">
                      <label className="add-gigs-book-new-cb">
                        <input
                          type="checkbox"
                          className="add-gigs-book-new-checkbox-input"
                          checked={!!doc.included}
                          onChange={(e) => {
                            const next = [...(currentGig.listingDocEntries || [])];
                            next[idx] = { ...next[idx], included: e.target.checked };
                            set({ listingDocEntries: next });
                          }}
                        />
                        <span className="add-gigs-book-new-checkbox-mark" aria-hidden="true" />
                        <span>{doc.title}</span>
                      </label>
                      {doc.sourceUrl && (
                        <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="add-gigs-book-new-doc-link">
                          View
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
