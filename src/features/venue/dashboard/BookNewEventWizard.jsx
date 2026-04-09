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

function formatPoundsInput(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  return `£${digits}`;
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

  if (!activeTab || !currentGig) return null;

  return (
    <div className="add-gigs-book-new-flow">
      {isAddExisting && (
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
          Add any timings that apply to this gig. At least one start time and one end time are required.
        </p>
        <div className="add-gigs-book-new-timeline-wrap">
          <div className="add-gigs-book-new-timeline-cont">
            {TIMING_STEPS.map((step) => {
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
      </section>

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
                <span>I&apos;ll pay the artist</span>
              </label>
              <label className="add-gigs-book-new-radio">
                <input
                  type="radio"
                  className="add-gigs-book-new-checkbox-input"
                  name={`payment-model-${activeTab}`}
                  checked={currentGig.paymentModel === 'artist_pays_venue'}
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
            {(currentGig.paymentModel === 'venue_pays_artist' || currentGig.paymentModel === 'artist_pays_venue') && (
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
              <span>Free entry</span>
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
            <span className="add-gigs-more-details-label">More details (optional)</span>
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
                      onChange={(e) => set({ gigName: e.target.value })}
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
                    onChange={(e) => set({ rentalCapacity: e.target.value })}
                  />
                </div>
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
