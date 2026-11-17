import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FEATURES } from '../../../config/features';
import { greetingFor, dateParts, longDate, selectUpcomingNights, groupUpcomingNights } from './nights';
import { copyText } from './publicLinks';
import { homeNeeds, legworkBanner, legworkProgress, nightHomeChips, nightMeta, venuePublicUrl } from './legwork';
import { readLegwork } from './legworkStorage';
import './legwork.css';

function pluralSets(count) {
  return count === 1 ? '1 set' : `${count} sets`;
}

export function VenueHomeLaunch({ user, gigs, venues, onNewGig }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const selectedVenueId = searchParams.get('venue') || '';
  const displayedVenue = (venues || []).find((venue) => venue.venueId === selectedVenueId)
    || ((venues || []).length === 1 ? venues[0] : null);
  const scoped = useMemo(() => {
    const list = gigs || [];
    const venueId = displayedVenue?.venueId;
    return venueId ? list.filter((gig) => gig.venueId === venueId) : list;
  }, [gigs, displayedVenue]);
  const nights = useMemo(() => groupUpcomingNights(scoped), [scoped]);
  const upcoming = useMemo(() => selectUpcomingNights(nights).nights.slice(0, 4), [nights]);
  const needs = useMemo(() => homeNeeds(nights.filter((night) => night.date)), [nights]);
  const progress = legworkProgress(readLegwork(displayedVenue?.venueId));
  const banner = legworkBanner(progress);
  const { phrase } = greetingFor(user?.name);
  const pageUrl = venuePublicUrl(displayedVenue);
  const venueQuery = displayedVenue?.venueId ? `?venue=${encodeURIComponent(displayedVenue.venueId)}` : '';

  const openNight = (gigId, applicantId) => {
    const params = new URLSearchParams();
    if (displayedVenue?.venueId) params.set('venue', displayedVenue.venueId);
    if (applicantId) params.set('applicant', applicantId);
    navigate({
      pathname: '/venues/dashboard/gigs/gig-applications',
      search: params.toString() ? `?${params}` : '',
      state: { gig: { gigId } },
    });
  };

  const copyPage = async () => {
    const ok = await copyText(pageUrl);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="p-home">
      <header className="p-home__head">
        <div>
          <p className="p-home__date">{longDate(new Date())}</p>
          <h1>{phrase}</h1>
        </div>
        <button type="button" className="p-btn p-btn--dark" onClick={onNewGig}>+ New gig</button>
      </header>

      {banner ? (
        <button type="button" className="p-banner" onClick={() => navigate(`/venues/dashboard/guide${venueQuery}`)}>
          <span>
            <strong>{banner.title}</strong>
            <span>{banner.body}</span>
          </span>
          <span className="p-btn p-btn--dark">Show me</span>
        </button>
      ) : null}

      {needs.length ? (
        <section className="p-card">
          <h2>Needs you</h2>
          <ul>
            {needs.map((item) => (
              <li key={`${item.kind}-${item.gigId}-${item.applicantId || 'all'}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <button type="button" className="p-btn" onClick={() => openNight(item.gigId, item.applicantId)}>{item.action}</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="p-card">
        <header className="p-card__row">
          <h2>Upcoming nights</h2>
          <button type="button" className="p-text" onClick={() => navigate(`/venues/dashboard/gigs${venueQuery}`)}>All gigs</button>
        </header>
        {upcoming.length ? (
          <ul>
            {upcoming.map((night) => {
              const parts = dateParts(night.date);
              return (
                <li key={night.gigId}>
                  <button type="button" className="p-night" onClick={() => openNight(night.gigId)}>
                    <span className="p-night__date"><span>{parts.dow}</span><strong>{parts.day}</strong></span>
                    <span className="p-night__copy">
                      <strong>{night.name}</strong>
                      <span>{nightMeta({ ...night, range: night.range, setCount: night.setCount }) || pluralSets(night.setCount)}</span>
                    </span>
                    <span className="p-chips">
                      {nightHomeChips(night).map((chip) => (
                        <span key={chip.label} className={`p-chip is-${chip.tone}`}>{chip.label}</span>
                      ))}
                    </span>
                  </button>
                  {FEATURES.venueDesk ? <Link className="p-text" to={`/venues/dashboard/gigs/${night.gigId}/edit${venueQuery}`}>Edit</Link> : null}
                  {FEATURES.gigPhotos ? <Link className="p-text" to={`/venues/dashboard/gigs/${night.gigId}/photos${venueQuery}`}>Photos</Link> : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="p-empty">No upcoming nights yet.</p>}
      </section>

      {pageUrl ? (
        <section className="p-share">
          <div>
            <h2>Share your venue page</h2>
            <p>Acts see every open night and apply in two minutes, no account needed. Put it in your bio, send it, or print the QR poster.</p>
          </div>
          <button type="button" className="p-btn p-btn--dark" onClick={copyPage}>{copied ? 'Copied' : 'Copy link'}</button>
        </section>
      ) : null}
    </div>
  );
}
