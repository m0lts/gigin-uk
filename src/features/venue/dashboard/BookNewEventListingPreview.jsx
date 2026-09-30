import { Fragment, useMemo } from 'react';
import '@styles/artists/gig-page.styles.css';
import { formatDate } from '@services/utils/dates';
import { FacebookIcon, InstagramIcon, TwitterIcon, VenueIconSolid } from '@features/shared/ui/extras/Icons';
import { buildBookNewListingPreview } from './bookNewListingPreviewModel';

function CompactListingPreview({ gig, venue, dateIso, kind, artistName }) {
  const photos = venue?.photos || [];
  const photo = photos[0];
  const title = String(gig?.gigName || '').trim() || (venue?.name ? `Gig at ${venue.name}` : 'Gig at your venue');
  const titleEmpty = !String(gig?.gigName || '').trim();
  const start = gig?.timingMusicStartTime || gig?.startTime || '—';
  const end = gig?.timingMusicStopTime || '—';
  const description = String(gig?.extraInformation || '').trim();
  const looking = String(gig?.gigType || '').split(',').map((part) => part.trim()).filter(Boolean);
  const tickets = gig?.ticketingModel === 'venue' ? 'Venue sells tickets' : gig?.ticketingModel === 'artist' ? 'Artist sells tickets' : 'Not ticketed';
  const sets = [
    { start: gig?.startTime, duration: gig?.duration, fee: gig?.slotBudgets?.[0] || gig?.unifiedFeeAmount },
    ...(gig?.extraSlots || []).map((slot, index) => ({ start: slot.startTime, duration: slot.duration, fee: gig?.slotBudgets?.[index + 1] })),
  ];
  if (kind === 'booked') {
    const who = artistName || 'the artist';
    return (
      <div className="ng-preview">
        <div className="ng-kicker">What the artist will get</div>
        <article className="ng-listing">
          <p className="ng-mono ng-listing__when">{dateIso || 'Date'} · {start}–{end}</p>
          <h3>{title}</h3>
          <p className="ng-listing__desc">You’re confirmed to play at {venue?.name || 'the venue'}. We’ll send {who} the date, times{sets[0]?.fee && sets[0].fee !== '£' ? ` and the agreed fee of ${sets[0].fee}` : ''}.</p>
        </article>
      </div>
    );
  }

  return (
    <div className="ng-preview">
      <div className="ng-kicker">What artists will see</div>
      <article className="ng-listing">
        <div className="ng-listing__photo" style={photo ? { backgroundImage: `url(${typeof photo === 'string' ? photo : photo.url || photo.src || ''})` } : undefined} />
        <p className="ng-mono ng-listing__when">{dateIso || 'Date'} · {start}–{end}</p>
        <h3 className={titleEmpty ? 'is-placeholder' : ''}>{title}</h3>
        <p className="ng-listing__venue">{venue?.name || 'Venue'}{venue?.capacity ? ` · ${venue.capacity} cap` : ''}</p>
        <div className="ng-listing__sets">
          {sets.map((set, index) => (
            <div key={index}>
              <span>Set {index + 1} · {set.start || '—'}</span>
              <span>{set.fee && set.fee !== '£' ? set.fee : 'No fee'}</span>
            </div>
          ))}
        </div>
        <div className="ng-tags">
          {looking.map((tag) => <span key={tag}>{tag}</span>)}
          <span>{tickets}</span>
        </div>
        <p className={`ng-listing__desc${description ? '' : ' is-placeholder'}`}>{description || 'Description shows here.'}</p>
        <button type="button" className="ng-apply" disabled>Apply</button>
      </article>
    </div>
  );
}

function getGigCapacityDisplay(slot, venue) {
  const raw = slot?.rentalCapacity ?? slot?.capacity ?? venue?.capacity;
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  return s || null;
}

function formatTime(timeString) {
  if (!timeString || !String(timeString).trim()) return '—';
  const [hours, minutes] = String(timeString).split(':').map(Number);
  if (!Number.isFinite(hours)) return timeString;
  return `${hours.toString().padStart(2, '0')}:${(Number.isFinite(minutes) ? minutes : 0).toString().padStart(2, '0')}`;
}

function formatTicketingResponsibility(v) {
  if (v === 'venue') return 'Venue handles ticketing';
  if (v === 'artist') return 'They handle ticketing';
  if (v === 'free_entry') return 'Not ticketed';
  return '';
}

function getBaseGigName(gigName) {
  if (!gigName) return '';
  return String(gigName).replace(/\s*\(Set\s+\d+\)\s*$/, '');
}

function formatDurationMinutes(duration) {
  if (duration == null || !Number.isFinite(duration)) return '—';
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const hourStr = hours === 1 ? 'hr' : 'hrs';
  const minuteStr = minutes === 1 ? 'min' : 'mins';
  if (minutes === 0) return `${hours} ${hourStr}`;
  if (hours === 0) return `${minutes} ${minuteStr}`;
  return `${hours} ${hourStr} and ${minutes} ${minuteStr}`;
}

function calculateTime(time, offset) {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + offset;
  const newHours = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
  const newMinutes = ((totalMinutes % 60) + 60) % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

export function BookNewEventListingPreview({ gig, venue, dateIso, onClose, compact = false, kind = 'find', artistName = '' }) {
  const built = useMemo(() => {
    if (!gig || !dateIso) return null;
    return buildBookNewListingPreview({ gig, venue, dateIso });
  }, [gig, venue, dateIso]);

  const gigData = built?.gigData;
  const currentSlot = gigData;
  const endTime = useMemo(() => {
    if (!currentSlot?.startTime || currentSlot?.duration == null) return '00:00';
    return calculateTime(currentSlot.startTime, currentSlot.duration);
  }, [currentSlot?.startTime, currentSlot?.duration]);

  if (compact) {
    return <CompactListingPreview gig={gig} venue={venue} dateIso={dateIso} kind={kind} artistName={artistName} />;
  }

  if (!built || !gigData) return null;

  const { venueProfile } = built;
  const eventTimings = currentSlot?.eventTimings;

  const photos = venueProfile?.photos || [];
  const mainPhoto = photos[0];

  return (
    <aside className="book-new-listing-preview-panel" aria-label="Listing preview (not published)">
      <div className="book-new-listing-preview-panel-header">
        <span className="book-new-listing-preview-badge">Preview</span>
        <p className="book-new-listing-preview-hint">How artists will see this listing once published. Nothing is saved.</p>
        <button
          type="button"
          className="btn tertiary book-new-listing-preview-close book-new-listing-preview__close"
          onClick={onClose}
        >
          Close preview
        </button>
      </div>
      <div className="book-new-listing-preview-scroll gig-page">
        <section className="gig-page-body book-new-listing-preview-gig-body">
          <div className="head">
            <div className="title">
              <h1>{getBaseGigName(gigData.gigName)}</h1>
            </div>
          </div>

          <div className="images-and-location">
            <div className="main-image">
              <figure className="img">
                {mainPhoto ? (
                  <>
                    <img src={mainPhoto} alt={`${venueProfile?.name || 'Venue'} photo`} />
                    {photos.length > 1 && (
                      <div className="more-overlay">
                        <h2>+{photos.length - 1}</h2>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    className="book-new-listing-preview-photo-placeholder"
                    aria-hidden="true"
                  />
                )}
              </figure>
            </div>
            <div className="location book-new-listing-preview-map-placeholder">
              <div className="map-container" />
              <span className="book-new-listing-preview-map-hint">Map on live listing</span>
            </div>
          </div>

          <div className="main">
            <div className="gig-info">
              <div className="important-info">
                <div className="date-and-time">
                  <h2>{gigData?.venue?.venueName ?? venueProfile?.name ?? 'Venue'}</h2>
                </div>
                <div className="address">
                  <h4>{gigData?.venue?.address ?? venueProfile?.address ?? ''}</h4>
                </div>
              </div>
              <div className="gig-host">
                <h5>Gig Posted By: {gigData.accountName}</h5>
                <p>A trusted Gigin member</p>
              </div>

              {formatTicketingResponsibility(gigData?.ticketingResponsibility) && (
                <div className="equipment">
                  <h4 className="subtitle">Ticketing</h4>
                  <p className="detail-text">{formatTicketingResponsibility(gigData.ticketingResponsibility)}</p>
                </div>
              )}

              {gigData?.technicalInformation && String(gigData.technicalInformation).trim() !== '' && (
                <div className="equipment">
                  <h4 className="subtitle">Gig Description</h4>
                  <p className="detail-text">{gigData.technicalInformation}</p>
                </div>
              )}

              {Array.isArray(gigData?.listingDocuments) && gigData.listingDocuments.length > 0 && (
                <div className="equipment">
                  <h4 className="subtitle">Documents</h4>
                  {gigData.listingDocuments.map((doc, i) => (
                    <div key={doc.key || `doc-${i}`} className="gig-listing-doc-block">
                      <h5 className="subtitle">{doc.title || 'Document'}</h5>
                      {doc.sourceUrl && (
                        <p className="detail-text">
                          <span className="book-new-listing-preview-fake-link">{doc.sourceUrl}</span>
                        </p>
                      )}
                      {doc.body && String(doc.body).trim() && (
                        <p className="detail-text">{doc.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="timeline">
                <h4 className="subtitle">Timings</h4>
                {(currentSlot?.startTime || (eventTimings && typeof eventTimings === 'object' && Object.keys(eventTimings).length > 0)) && (
                  <div className="timeline-cont">
                    {eventTimings && typeof eventTimings === 'object' && Object.keys(eventTimings).length > 0 ? (
                      (() => {
                        const order = [
                          ['accessFrom', 'Access from / load-in'],
                          ['soundcheck', 'Soundcheck'],
                          ['musicStart', 'Music start'],
                          ['musicStop', 'Music stop'],
                          ['mustVacate', 'Must vacate by'],
                        ];
                        const items = order.filter(([k]) => eventTimings[k]);
                        return items.map(([k, label], idx) => (
                          <Fragment key={k}>
                            <div className="timeline-event">
                              <div className="timeline-content">
                                <p>{label}</p>
                                <div className={`timeline-time ${idx >= 2 ? 'orange' : ''}`}>{formatTime(eventTimings[k])}</div>
                              </div>
                              {idx < items.length - 1 && <div className="timeline-line" />}
                            </div>
                          </Fragment>
                        ));
                      })()
                    ) : currentSlot?.itemType === 'venue_hire' ? (
                      <>
                        <div className="timeline-event">
                          <div className="timeline-content">
                            <p>Access from</p>
                            <div className="timeline-time orange">{formatTime(currentSlot.startTime)}</div>
                          </div>
                          <div className="timeline-line" />
                        </div>
                        <div className="timeline-event">
                          <div className="timeline-content">
                            <p>Music stop by</p>
                            <div className="timeline-time orange">
                              {currentSlot?.endTime && String(currentSlot.endTime).trim() ? formatTime(currentSlot.endTime) : 'TBC'}
                            </div>
                          </div>
                          <div className="timeline-line" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="timeline-event">
                          <div className="timeline-content">
                            <p>Load In</p>
                            <div className="timeline-time">
                              {currentSlot?.loadInTime && currentSlot.loadInTime !== '' ? formatTime(currentSlot.loadInTime) : 'TBC'}
                            </div>
                          </div>
                          <div className="timeline-line" />
                        </div>
                        <div className="timeline-event">
                          <div className="timeline-content">
                            <p>Sound Check</p>
                            <div className="timeline-time">
                              {currentSlot?.soundCheckTime && currentSlot.soundCheckTime !== '' ? formatTime(currentSlot.soundCheckTime) : 'TBC'}
                            </div>
                          </div>
                          <div className="timeline-line" />
                        </div>
                        <div className="timeline-event">
                          <div className="timeline-content">
                            <p>Set Starts</p>
                            <div className="timeline-time orange">{formatTime(currentSlot.startTime)}</div>
                          </div>
                          <div className="timeline-line" />
                        </div>
                        <div className="timeline-event">
                          <div className="timeline-content">
                            <p>Set Ends</p>
                            <div className="timeline-time orange">{endTime !== '00:00' ? formatTime(endTime) : '00:00'}</div>
                          </div>
                          <div className="timeline-line" />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {venueProfile?.techRider ? (
                <div className="equipment gig-page-tech-spec-tile">
                  <h4>{venueProfile.name}&apos;s Tech Spec</h4>
                  <p className="gig-page-tech-spec-empty">Equipment details match your venue profile on the live listing.</p>
                </div>
              ) : (
                <div className="equipment gig-page-tech-spec-tile">
                  <h4>{venueProfile?.name ?? 'Venue'}&apos;s Tech Spec</h4>
                  <p className="gig-page-tech-spec-empty">The venue has not listed any tech spec information.</p>
                </div>
              )}

              {(venueProfile?.name ?? gigData?.venue?.venueName) && (
                <div className="description">
                  <h4>About {venueProfile?.name ?? gigData?.venue?.venueName ?? 'Venue'}</h4>
                  <button type="button" className="btn secondary" disabled>
                    <VenueIconSolid /> Venue profile (on live listing)
                  </button>
                  {venueProfile?.description && <p>{venueProfile.description}</p>}
                </div>
              )}

              <div className="extra-info">
                <h4 className="subtitle">Additional Technical Information</h4>
                {venueProfile?.extraInformation && (
                  <div className="info">
                    <div className="text">
                      <p>{venueProfile.extraInformation}</p>
                    </div>
                  </div>
                )}
                {venueProfile?.website && (
                  <div className="info">
                    <h6>Venue Website</h6>
                    <div className="text">
                      <span className="book-new-listing-preview-fake-link">{venueProfile.website}</span>
                    </div>
                  </div>
                )}
              </div>

              {venueProfile?.socialMedia && (
                <div className="socials">
                  <h4 className="subtitle">Socials</h4>
                  <div className="links">
                    {venueProfile.socialMedia.facebook && (
                      <span className="book-new-listing-preview-social-pill" aria-hidden="true">
                        <FacebookIcon />
                      </span>
                    )}
                    {venueProfile.socialMedia.instagram && (
                      <span className="book-new-listing-preview-social-pill" aria-hidden="true">
                        <InstagramIcon />
                      </span>
                    )}
                    {venueProfile.socialMedia.twitter && (
                      <span className="book-new-listing-preview-social-pill" aria-hidden="true">
                        <TwitterIcon />
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky-right">
              <div className="action-box">
                <div className="action-box-content">
                  <div className="action-box-info">
                    <div className="action-box-budget">
                      {currentSlot?.kind === 'Open Mic' || currentSlot?.kind === 'Ticketed Gig' ? (
                        <h2 className="gig-kind">{currentSlot.kind}</h2>
                      ) : (
                        <>
                          {currentSlot?.itemType === 'venue_hire' ? (
                            <div className="action-box-budget-venue-hire">
                              <div className="action-box-budget-venue-hire-row">
                                <h1>
                                  {currentSlot?.budget === '£' || currentSlot?.budget === '£0' || currentSlot?.budget === 'Free'
                                    ? 'Free to hire'
                                    : currentSlot?.budget}
                                </h1>
                                {currentSlot?.budget !== '£' && currentSlot?.budget !== '£0' && currentSlot?.budget !== 'Free' && (
                                  <p className="action-box-venue-hire-label">Hire Price</p>
                                )}
                              </div>
                              {currentSlot?.depositAmount && (
                                <div className="action-box-budget-venue-hire-row">
                                  <h1>{currentSlot.depositAmount}</h1>
                                  <p className="action-box-venue-hire-label">deposit</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <h1>
                                {currentSlot?.budget === '£' || currentSlot?.budget === '£0' || currentSlot?.budget === 'Free'
                                  ? 'No Fee'
                                  : currentSlot?.budget}
                              </h1>
                              {currentSlot?.budget !== '£' && currentSlot?.budget !== '£0' && currentSlot?.budget !== 'Free' && (
                                <p>gig fee</p>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {currentSlot?.itemType !== 'venue_hire' && (() => {
                      const capacityDisplay = getGigCapacityDisplay(currentSlot, venueProfile);
                      return (
                        <div className="action-box-side-meta">
                          <div className="action-box-duration">
                            <h4>{formatDurationMinutes(currentSlot?.duration)}</h4>
                          </div>
                          {capacityDisplay ? (
                            <div className="action-box-capacity">
                              <h4>{capacityDisplay}</h4>
                              <p>capacity</p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="action-box-date-and-time">
                    <div className="action-box-date">
                      {currentSlot?.itemType === 'venue_hire' ? (
                        <>
                          <h3>{currentSlot?.startDateTime ? formatDate(currentSlot.startDateTime) : '—'}</h3>
                          {currentSlot?.startTime && (currentSlot?.endTime && String(currentSlot.endTime).trim() ? (
                            <h4>{formatTime(currentSlot.startTime)} – {formatTime(currentSlot.endTime)}</h4>
                          ) : (
                            <h4>{formatTime(currentSlot.startTime)}</h4>
                          ))}
                        </>
                      ) : (
                        <h3>
                          {currentSlot?.startDateTime
                            ? formatDate(currentSlot.startDateTime, 'withTime')
                            : '—'}
                        </h3>
                      )}
                    </div>
                  </div>
                </div>
                <div className="action-box-buttons">
                  <button type="button" className="btn artist-profile disabled" disabled>
                    {currentSlot?.itemType === 'venue_hire' ? 'Apply to Hire' : 'Apply To Gig'}
                  </button>
                  <p className="book-new-listing-preview-cta-note">Actions appear on the published listing.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
