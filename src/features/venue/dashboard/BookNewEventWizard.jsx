import React, { useEffect, useRef, useState } from 'react';
import { DownChevronIcon, UpChevronIcon, SaveIcon, NewTabIcon } from '../../shared/ui/extras/Icons';

/** Order matches public gig page timeline (eventTimings). */
const TIMING_STEPS = [
  { timeKey: 'timingAccessTime', label: 'Access / load-in' },
  { timeKey: 'timingSoundcheckTime', label: 'Soundcheck' },
  { timeKey: 'timingMusicStartTime', label: 'Music start' },
  { timeKey: 'timingMusicStopTime', label: 'Music stop' },
  { timeKey: 'timingVacateTime', label: 'Must vacate' },
];

const MUSICIAN_TYPE_OPTIONS = ['Musician/Band', 'DJ'];

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

  const hasDescriptionText = String(currentGig?.extraInformation ?? '').trim().length > 0;
  const [userRevealedDescription, setUserRevealedDescription] = useState(false);
  const descriptionTextareaRef = useRef(null);

  useEffect(() => {
    setUserRevealedDescription(false);
  }, [activeTab]);

  const showDescriptionTextarea = hasDescriptionText || userRevealedDescription;

  useEffect(() => {
    if (userRevealedDescription && descriptionTextareaRef.current) {
      descriptionTextareaRef.current.focus();
    }
  }, [userRevealedDescription]);

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
  const visibleTimingSteps = multiSlot
    ? TIMING_STEPS.filter((s) => s.timeKey !== 'timingMusicStartTime' && s.timeKey !== 'timingMusicStopTime')
    : TIMING_STEPS;

  /**
   * When transitioning from single-slot to multi-slot, the wizard hides
   * timingMusicStartTime / timingMusicStopTime and drives timings from slot
   * 0's startTime + duration instead. Seed those slot-0 fields from the
   * top-level music inputs so the first set row isn't empty when the pills
   * are clicked.
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
      <section className="add-gigs-book-new-section" aria-labelledby={`bn-timings-${activeTab}`}>
        <h3 id={`bn-timings-${activeTab}`} className="label add-gigs-section-heading">Timings</h3>
        <p className="add-gigs-helper add-gigs-book-new-timings-intro">
          {multiSlot
            ? 'Add access / soundcheck / vacate timings that apply to the whole event. Per-set music start and end go in the Sets section below.'
            : 'Add any timings that apply to this gig. At least one start time and one end time are required.'}
        </p>
        <div className="add-gigs-book-new-timeline-wrap">
          <div className="add-gigs-book-new-timeline-cont">
            {visibleTimingSteps.map((step) => {
              const timeVal = currentGig[step.timeKey] ?? '';
              return (
                <div key={step.timeKey} className="add-gigs-book-new-timeline-event">
                  <div className="add-gigs-book-new-timeline-content">
                    <p className="add-gigs-book-new-timeline-label">{step.label}</p>
                    <input
                      type="time"
                      className="add-gigs-book-new-timeline-time"
                      value={timeVal}
                      onChange={(e) => {
                        onClearTimingError?.();
                        set({ [step.timeKey]: e.target.value });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {bookNewTimingError && (
          <p className="add-gigs-book-new-error" role="alert">{bookNewTimingError}</p>
        )}
        {showSlotControls && !isEditMode && (
          <div className="add-gigs-book-new-multi-slot-cta">
            {!multiSlot ? (
              <>
                <button
                  type="button"
                  className="btn tertiary add-gigs-book-new-multi-slot-btn"
                  onClick={() => {
                    syncSlotZeroFromTimings();
                    onSlotCountChange?.(2);
                  }}
                >
                  Multiple sets on this night
                </button>
                <p className="add-gigs-helper add-gigs-book-new-multi-slot-hint">
                  Split the night into separate listings (each with its own time and fee). Artists see and apply per set; payments are per gig listing.
                </p>
              </>
            ) : (
              <div className="add-gigs-book-new-multi-slot-active">
                <p className="add-gigs-helper">
                  This night uses multiple sets — set times in <strong>Sets</strong> and fees under <strong>Payment model</strong>.
                </p>
                <button
                  type="button"
                  className="btn tertiary add-gigs-book-new-multi-slot-collapse-btn"
                  onClick={() => onSlotCountChange?.(1)}
                >
                  Use a single set instead
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {multiSlot && (
        <section className="add-gigs-book-new-section" aria-labelledby={`bn-sets-${activeTab}`}>
          <h3 id={`bn-sets-${activeTab}`} className="label add-gigs-section-heading">Sets</h3>
          <p className="add-gigs-helper">
            {isAddExisting
              ? (currentGig.paymentModel === 'venue_pays_artist'
                  ? 'Each set is stored as its own gig on the date. Add the artist, start time and duration for each one — enter fees under Payment model.'
                  : 'Each set is stored as its own gig on the date. Add the artist, start time, duration and fee for each one.')
              : (currentGig.paymentModel === 'venue_pays_artist'
                  ? 'Each set becomes its own gig listing. Set the start time and duration for each one — enter fees under Payment model.'
                  : 'Each set becomes its own gig listing. Set the start time, duration and fee for each one.')}
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
                    <div className="add-gigs-field">
                      <label className="label">Start</label>
                      <input
                        type="time"
                        className="input add-gigs-book-new-timeline-time"
                        value={startVal}
                        onChange={(e) => {
                          onClearTimingError?.();
                          onSlotStartChange?.(index, e.target.value);
                        }}
                      />
                    </div>
                    <div className="add-gigs-field">
                      <label className="label">End</label>
                      <input
                        type="time"
                        className="input add-gigs-book-new-timeline-time"
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
        </section>
      )}

      {!isAddExisting && (
        <section className="add-gigs-book-new-section" aria-labelledby={`bn-desc-${activeTab}`}>
          <div className="add-gigs-book-new-gig-desc-area">
            <div className="add-gigs-book-new-desc-heading-row">
              <h3 id={`bn-desc-${activeTab}`} className="label add-gigs-section-heading add-gigs-book-new-section-heading--roomy">Gig description</h3>
              {showDescriptionTextarea && (
                <button
                  type="button"
                  className="add-gigs-book-new-remove-desc"
                  onClick={() => {
                    set({ extraInformation: '' });
                    setUserRevealedDescription(false);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            {!showDescriptionTextarea ? (
              <button
                type="button"
                className="btn tertiary add-gigs-book-new-add-description-pill"
                onClick={() => setUserRevealedDescription(true)}
              >
                + Add Description
              </button>
            ) : (
              <textarea
                ref={descriptionTextareaRef}
                className="input add-gigs-input-no-border add-gigs-book-new-gig-description-textarea"
                placeholder="Describe the event, vibe, requirements…"
                value={currentGig.extraInformation ?? ''}
                onChange={(e) => set({ extraInformation: e.target.value })}
                maxLength={250}
                rows={4}
              />
            )}
          </div>
        </section>
      )}

      <div className="add-gigs-book-new-pay-tix-row">
        <section
          className="add-gigs-book-new-section add-gigs-book-new-section--pay-tix-col"
          aria-labelledby={`bn-pay-${activeTab}`}
        >
          <h3 id={`bn-pay-${activeTab}`} className="label add-gigs-section-heading add-gigs-book-new-section-heading--roomy">Payment model</h3>
          <div className="add-gigs-book-new-payment-stack">
            <div className="add-gigs-book-new-radio-list">
              <label className="add-gigs-book-new-radio">
                <input
                  type="radio"
                  className="add-gigs-book-new-checkbox-input"
                  name={`payment-model-${activeTab}`}
                  checked={currentGig.paymentModel === 'venue_pays_artist'}
                  onChange={() => set({ paymentModel: 'venue_pays_artist' })}
                />
                <span className="add-gigs-book-new-checkbox-mark" aria-hidden="true" />
                <span>{multiSlot ? "I'll pay the artists" : "I'll pay the artist"}</span>
              </label>
              <label
                className={`add-gigs-book-new-radio${multiSlot ? ' add-gigs-book-new-radio--disabled' : ''}`}
                title={multiSlot ? 'Not available when listing multiple sets on one night' : undefined}
              >
                <input
                  type="radio"
                  className="add-gigs-book-new-checkbox-input"
                  name={`payment-model-${activeTab}`}
                  checked={currentGig.paymentModel === 'artist_pays_venue'}
                  disabled={multiSlot}
                  onChange={() => set({ paymentModel: 'artist_pays_venue' })}
                />
                <span className="add-gigs-book-new-checkbox-mark" aria-hidden="true" />
                <span>They pay to hire the space</span>
              </label>
              <label className="add-gigs-book-new-radio">
                <input
                  type="radio"
                  className="add-gigs-book-new-checkbox-input"
                  name={`payment-model-${activeTab}`}
                  checked={currentGig.paymentModel === 'no_fee'}
                  onChange={() => set({ paymentModel: 'no_fee' })}
                />
                <span className="add-gigs-book-new-checkbox-mark" aria-hidden="true" />
                <span>No fee</span>
              </label>
            </div>
            {(currentGig.paymentModel === 'venue_pays_artist' || currentGig.paymentModel === 'artist_pays_venue') && !multiSlot && (
              <div className="add-gigs-field add-gigs-book-new-fee-field">
                <label className="label" htmlFor={`unified-fee-${activeTab}`}>Amount</label>
                <input
                  id={`unified-fee-${activeTab}`}
                  type="text"
                  className="input"
                  placeholder="£"
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
                        placeholder="£"
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

        <section
          className="add-gigs-book-new-section add-gigs-book-new-section--pay-tix-col"
          aria-labelledby={`bn-tix-${activeTab}`}
        >
          <h3 id={`bn-tix-${activeTab}`} className="label add-gigs-section-heading add-gigs-book-new-section-heading--roomy">Ticketing</h3>
          <div className="add-gigs-book-new-radio-list">
            <label className="add-gigs-book-new-radio">
              <input
                type="radio"
                className="add-gigs-book-new-checkbox-input"
                name={`ticketing-${activeTab}`}
                checked={currentGig.ticketingModel === 'venue'}
                onChange={() => set({ ticketingModel: 'venue' })}
              />
              <span className="add-gigs-book-new-checkbox-mark" aria-hidden="true" />
              <span>Venue handles ticketing</span>
            </label>
            <label className="add-gigs-book-new-radio">
              <input
                type="radio"
                className="add-gigs-book-new-checkbox-input"
                name={`ticketing-${activeTab}`}
                checked={currentGig.ticketingModel === 'artist'}
                onChange={() => set({ ticketingModel: 'artist' })}
              />
              <span className="add-gigs-book-new-checkbox-mark" aria-hidden="true" />
              <span>Artist handles ticketing</span>
            </label>
            <label className="add-gigs-book-new-radio">
              <input
                type="radio"
                className="add-gigs-book-new-checkbox-input"
                name={`ticketing-${activeTab}`}
                checked={currentGig.ticketingModel === 'free_entry'}
                onChange={() => set({ ticketingModel: 'free_entry' })}
              />
              <span className="add-gigs-book-new-checkbox-mark" aria-hidden="true" />
              <span>Not ticketed</span>
            </label>
          </div>
        </section>
      </div>

      {!isAddExisting && (
        <section className="add-gigs-book-new-section" aria-labelledby={`bn-vis-${activeTab}`}>
          <h3 id={`bn-vis-${activeTab}`} className="label add-gigs-section-heading">Visibility</h3>
          <div className="add-gigs-invite-only-row add-gigs-book-new-visibility-row">
            <label className="gigs-toggle-switch">
              <input
                type="checkbox"
                checked={!!currentGig.showOnVenueProfile}
                onChange={(e) => set({ showOnVenueProfile: e.target.checked })}
              />
              <span className="gigs-toggle-slider" />
            </label>
            <span className="add-gigs-invite-only-label">
              {currentGig.showOnVenueProfile
                ? 'Showing gig as available on my venue profile'
                : 'Hiding this available gig from my venue profile'}
            </span>
          </div>
          {!currentGig.showOnVenueProfile ? (
            <p className="add-gigs-invite-only-text">
              Only people with the link can open this listing; it will not appear on your public venue profile.
            </p>
          ) : null}
        </section>
      )}

      {showBookNewListingChrome && (
        <div
          className="add-gigs-book-new-secondary-actions"
          role="group"
          aria-label="Template and listing preview"
        >
          <button
            type="button"
            className="btn tertiary add-gigs-book-new-secondary-action-btn"
            onClick={() => onOpenSaveTemplateModal?.()}
          >
            <SaveIcon /> Save as Template
          </button>
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
        <div className="add-gigs-more-details">
          <button
            type="button"
            className="add-gigs-more-details-header add-gigs-book-new-more-toggle"
            onClick={() => set({ moreDetailsSectionOpen: !currentGig.moreDetailsSectionOpen })}
            aria-expanded={!!currentGig.moreDetailsSectionOpen}
            aria-controls={`bn-more-panel-${activeTab}`}
            id={`bn-more-trigger-${activeTab}`}
          >
            <span className="add-gigs-more-details-label">More Options</span>
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
                    <label className="label add-gigs-more-details-field-label" htmlFor={`bn-musician-${activeTab}`}>
                      Type of Artist
                    </label>
                    <select
                      id={`bn-musician-${activeTab}`}
                      className="select add-gigs-filter-select add-gigs-select-no-border"
                      value={currentGig.gigType ?? 'Musician/Band'}
                      onChange={(e) => set({ gigType: e.target.value })}
                    >
                      {MUSICIAN_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
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
                {!isRentalFlow && !isAddExisting && !multiSlot && supportsMaxApplicants && (
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
                {!isRentalFlow && !isAddExisting && !multiSlot && !supportsMaxApplicants && (
                  <div className="add-gigs-field add-gigs-field--full">
                    <p className="add-gigs-helper">
                      Multiple artists per event is currently only available when you&apos;re not paying a fee through Gigin
                      (free Live Music, Open Mic, or Ticketed). Switch to &quot;No fee&quot; to accept more than one artist on the same listing.
                    </p>
                  </div>
                )}
              </div>

              <div className="add-gigs-book-new-docs">
                <h4 className="label add-gigs-section-heading add-gigs-book-new-docs-heading">Documents</h4>
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
