import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeTechRider } from '@features/venue/builder/techRiderConfig';
import { useMapbox } from '@hooks/useMapbox';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { getGigInviteById } from '@services/client-side/gigs';
import { isGigClosedToNewApplicants } from '@services/utils/gigSlotCapacity';
import { GuestApplyWizard } from './GuestApplyWizard';
import { bookerLine, firstName, formatClock, formatGigDay, photoUrl, slotEnd, slotState } from './guestFormat';

function setMeta(property, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function GuestGigPage({
  gig,
  slots,
  venue,
  inviteId,
  coordinates,
  onCreateAccount,
}) {
  const { isMdUp } = useBreakpoint();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [applying, setApplying] = useState(false);
  const [invite, setInvite] = useState(null);
  const [notYou, setNotYou] = useState(false);
  const booker = bookerLine(venue, gig);
  const hero = photoUrl(venue);
  const closed = isGigClosedToNewApplicants(gig) || slots.every((slot) => slotState(slot) === 'booked');
  const past = slots.every((slot) => slotState(slot) === 'played') && slots.length > 0;
  const equipment = useMemo(() => normalizeTechRider(venue?.techRider).equipment || [], [venue]);
  const provided = equipment.filter((item) => item.available);
  const missingLabels = equipment.filter((item) => !item.available).slice(0, 3).map((item) => item.label);

  useEffect(() => {
    const title = `${String(gig.gigName || 'Gig').replace(/\s*\(Set\s+\d+\)\s*$/, '')} · ${venue?.name || 'Gigin'}`;
    const previous = document.title;
    document.title = title;
    const doors = formatClock(gig.timingAccessTime || gig.startTime);
    const description = `${formatGigDay(gig)}${doors ? ` · doors ${doors}` : ''} · ${venue?.address?.city || 'Cambridge'}. Apply in 2 minutes, no sign-up.`;
    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:image', hero);
    return () => { document.title = previous; };
  }, [gig, venue, hero]);

  useEffect(() => {
    if (!inviteId) return undefined;
    let cancelled = false;
    getGigInviteById(inviteId).then((doc) => { if (!cancelled) setInvite(doc); });
    return () => { cancelled = true; };
  }, [inviteId]);

  useMapbox({ containerRef: mapRef, coordinates, shouldInit: !!coordinates && !applying });

  const expired = useMemo(() => {
    if (!invite?.expiresAt) return false;
    const raw = invite.expiresAt;
    const date = raw.toDate ? raw.toDate() : new Date((raw.seconds || raw._seconds || 0) * 1000);
    return date.getTime() && date.getTime() < Date.now();
  }, [invite]);
  const claimed = !!(invite?.claimedByApplicationId);
  const showGreeting = invite && !expired && !claimed && !notYou && firstName(invite.artistName);
  const prefill = showGreeting ? {
    contactName: invite.artistName || '',
    actName: invite.actName || invite.artistName || '',
    email: invite.email || '',
    slotGigIds: invite.gigId ? [invite.gigId] : [],
  } : null;

  if (applying && !closed && !past) {
    return (
      <GuestApplyWizard
        gig={gig}
        slots={slots}
        venue={venue}
        invite={prefill ? { inviteId, prefill } : { inviteId: expired || claimed || notYou ? '' : inviteId }}
        onClose={() => setApplying(false)}
        onCreateAccount={onCreateAccount}
      />
    );
  }

  const title = String(gig.gigName || `Gig at ${venue?.name || 'the bar'}`).replace(/\s*\(Set\s+\d+\)\s*$/, '');
  const doors = formatClock(gig.timingAccessTime);
  const address = [venue?.address?.line1 || venue?.address?.addressLine1, venue?.address?.city, venue?.address?.postcode].filter(Boolean).join(', ') || (typeof venue?.address === 'string' ? venue.address : '') || '';
  const city = venue?.address?.city || (String(address).toLowerCase().includes('cambridge') ? 'Cambridge' : '');
  const mapsHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(typeof address === 'string' ? address : '')}` : '';

  return (
    <div className="ga-page">
      <header className="ga-top">
        <span className="ga-logo">gigin.</span>
        <span>{venue?.name || 'Venue'}</span>
      </header>
      <div className="ga-layout">
        <main>
          {past && <div className="ga-banner">This gig has already happened. <button type="button" onClick={() => navigate(`/venues/${venue?.venueId || gig.venueId || ''}`)}>See upcoming gigs at the bar</button></div>}
          {!past && closed && <div className="ga-banner is-closed">Applications have closed. <button type="button" onClick={() => navigate(`/venues/${venue?.venueId || gig.venueId || ''}`)}>Follow {venue?.name || 'the bar'}</button></div>}
          {!past && !closed && expired && <div className="ga-banner is-warn">This invite link has expired. The gig is still open, so you can apply as normal.</div>}
          {!past && !closed && (claimed || notYou) && invite?.artistName && (
            <div className="ga-banner">This invite was sent to {invite.artistName}. Not {firstName(invite.artistName)}? We won't fill in their details.</div>
          )}
          {showGreeting && (
            <div className="ga-hello">
              <span>{firstName(invite.artistName).slice(0, 1)}</span>
              <p><strong>Hi {firstName(invite.artistName)},</strong> {booker.name} invited you to apply for this gig at {venue?.name || 'the bar'}.</p>
              <button type="button" onClick={() => setNotYou(true)}>Not you?</button>
            </div>
          )}
          <div className="ga-hero" style={hero ? { backgroundImage: `url(${hero})` } : undefined} />
          <p className="ga-mono ga-date">{formatGigDay(gig)}{doors ? ` · DOORS ${doors}` : ''}</p>
          <h1>{title}</h1>
          <p className="ga-venue-line">{venue?.name}{city ? ` · ${city}` : ''}</p>
          <section>
            <h2>Sets</h2>
            <div className="ga-set-list">
              {slots.map((slot, index) => {
                const state = past ? 'played' : closed && slotState(slot) !== 'open' ? slotState(slot) : slotState(slot);
                return (
                  <div key={slot.gigId || index}>
                    <strong>Set {index + 1}</strong>
                    <span>
                      <em className="ga-mono">{formatClock(slot.startTime)}{slotEnd(slot) ? `–${slotEnd(slot)}` : ''}</em>
                      {slot.hint ? <small>{slot.hint}</small> : null}
                    </span>
                    <b className={state === 'open' && !closed ? 'is-open' : ''}>{state === 'played' || past ? 'Played' : state === 'booked' || closed ? 'Booked' : 'Open'}</b>
                  </div>
                );
              })}
            </div>
          </section>
          {gig.extraInformation && (
            <section>
              <h2>About the night</h2>
              <p className="ga-about">{gig.extraInformation}</p>
            </section>
          )}
          <section>
            <h2>What the bar provides</h2>
            <div className="ga-kit">
              {provided.map((item) => (
                <div key={item.key}>
                  <span>✓</span>
                  <strong>{item.label}</strong>
                  {item.quantity ? <em>{item.quantity}</em> : null}
                </div>
              ))}
            </div>
            {missingLabels.length > 0 && <p className="ga-quiet">The bar doesn't have {missingLabels.join(', ')}.</p>}
            {provided.length === 0 && <p className="ga-quiet">The bar hasn't listed its kit yet.</p>}
          </section>
          <section>
            <h2>Where</h2>
            <div className="ga-map" ref={mapRef} />
            {address && <p>{address}</p>}
            {venue?.arrivalNotes && <p className="ga-about">{venue.arrivalNotes}</p>}
            {mapsHref && <a className="ga-text" href={mapsHref} target="_blank" rel="noreferrer">Open in Maps</a>}
          </section>
          <p className="ga-booked-by">Booked by {booker.name}{booker.role ? `, ${booker.role}` : ''}.</p>
        </main>
        <aside className="ga-card">
          <p className="ga-mono">{formatGigDay(gig)}</p>
          <h2>{title}</h2>
          <p>{venue?.name}</p>
          <button type="button" className="ga-orange" disabled={closed || past} onClick={() => setApplying(true)}>
            {past ? 'This gig has happened' : closed ? 'Applications closed' : 'Apply to play'}
          </button>
          {!closed && !past && <small>About 2 minutes · no account needed</small>}
        </aside>
      </div>
      {!isMdUp && (
        <div className="ga-sticky">
          <button type="button" className="ga-orange" disabled={closed || past} onClick={() => setApplying(true)}>
            {past ? 'This gig has happened' : closed ? 'Applications closed' : 'Apply to play'}
          </button>
          {!closed && !past && <small>About 2 minutes · no account needed</small>}
        </div>
      )}
    </div>
  );
}
