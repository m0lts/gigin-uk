import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMapbox } from '@hooks/useMapbox';
import { copyText, displayUrl, venuePageUrl } from '../home/publicLinks';
import { openGigRows, techLines } from './venuePublic';
import './public-venue.css';

function mapPoint(venue) {
  if (Array.isArray(venue?.coordinates) && venue.coordinates.length === 2) return venue.coordinates;
  const point = venue?.geopoint;
  const lat = point?._lat || point?.latitude;
  const lng = point?._long || point?.longitude;
  if (typeof lat === 'number' && typeof lng === 'number') return [lng, lat];
  return null;
}

export function PublicVenueView({ venue, gigs, onLogin }) {
  const rows = openGigRows(gigs);
  const photo = venue?.photos?.[0];
  const lines = techLines(venue);
  const point = useMemo(() => mapPoint(venue), [venue]);
  const mapRef = useRef(null);
  const [copied, setCopied] = useState(false);
  useMapbox({ containerRef: mapRef, coordinates: point, shouldInit: Boolean(point) });
  const share = async () => {
    const ok = await copyText(venuePageUrl(venue?.id || venue?.venueId));
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="vp">
      <header className="vp__bar vp__wrap">
        <Link to="/" className="vp__word">gigin<i>.</i></Link>
        <button type="button" className="vp__btn" onClick={onLogin}>Log in</button>
      </header>
      <div className="vp__wrap">
        <div className="vp__hero" style={photo ? { backgroundImage: `url(${photo})` } : undefined} />
        <p className="vp__muted">{[venue?.city, venue?.tagline].filter(Boolean).join(' · ')}</p>
        <div className="vp__title">
          <h1>{venue?.name || 'Venue'}</h1>
          <span>
            <button type="button" className="vp__btn" onClick={share}>{copied ? 'Copied' : 'Share'}</button>
            <a className="vp__btn vp__btn--dark" href="#open-gigs">See open gigs</a>
          </span>
        </div>
        <div className="vp__grid">
          <div>
            <section className="vp__card" id="open-gigs">
              <h2>Open for applications</h2>
              <p className="vp__muted">{rows.length} {rows.length === 1 ? 'night' : 'nights'}. Apply in two minutes, no account needed.</p>
              {rows.map((row) => (
                <div className="vp__row" key={row.id}>
                  <strong>{row.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong>
                  <span><strong>{row.name}</strong><br /><span className="vp__muted">{[row.time, row.fee].filter(Boolean).join(' · ')}</span></span>
                  <Link className="vp__btn vp__btn--dark" to={`/gig/${row.id}`}>Apply</Link>
                </div>
              ))}
              {!rows.length ? <p className="vp__muted">Nothing is open right now.</p> : null}
            </section>
            {venue?.description || venue?.actsShouldKnow?.about ? (
              <section className="vp__card"><h2>About</h2><p>{venue.description || venue.actsShouldKnow.about}</p></section>
            ) : null}
          </div>
          <aside>
            {lines.length ? (
              <section className="vp__card"><h2>What acts should know</h2>{lines.map((line) => <p key={line}>{line}</p>)}</section>
            ) : null}
            <section className="vp__card">
              <h2>Address</h2>
              <p>{venue?.address || venue?.city || ''}</p>
              <div className="vp__map" ref={mapRef} />
            </section>
            {venue?.website ? <p><a href={venue.website}>{displayUrl(venue.website)}</a></p> : null}
          </aside>
        </div>
        <p className="vp__muted">This page is run by {venue?.name || 'the venue'} on gigin.</p>
      </div>
    </div>
  );
}
