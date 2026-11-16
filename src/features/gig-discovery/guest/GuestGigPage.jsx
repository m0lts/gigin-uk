import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeTechRider } from '@features/venue/builder/techRiderConfig';
import { Pill } from '@features/shared/ui/foundation';
import { useMapbox } from '@hooks/useMapbox';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { getGigInviteById } from '@services/client-side/gigs';
import { getGuestApplication } from '@services/client-side/guestApplications';
import { GuestApplyWizard } from './GuestApplyWizard';
import { GuestBrandHeader } from './GuestBrandHeader';
import { atThePlace, bookerLine, firstName, forgetApplication, formatClock, formatGigDay, formatGuestDesktopDate, formatGuestPhoneDate, formatSetLine, formatShortDay, guestFeeLabel, keepRememberedApplication, openSetsSummary, photoUrl, providedKitPhrase, rememberedApplication, slotDate, slotState, slotTaken } from './guestFormat';

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
  onLogin,
  returnToken = '',
  anotherAct = false,
}) {
  const { isMdUp } = useBreakpoint();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [applying, setApplying] = useState(Boolean(returnToken || anotherAct));
  const [invite, setInvite] = useState(null);
  const [notYou, setNotYou] = useState(false);
  const booker = bookerLine(venue, gig);
  const hero = photoUrl(venue);
  const applicationsClosed = slots.every((slot) => slot.applicationsOpen === false) || gig.applicationsOpen === false;
  const allTaken = slots.length > 0 && slots.every((slot) => slotTaken(slot));
  const cancelled = gig.status === 'cancelled' || gig.status === 'closed' || (slots.length > 0 && slots.every((slot) => slot.status === 'cancelled' || slot.status === 'closed'));
  const openCount = slots.filter((slot) => !slotTaken(slot) && slot.applicationsOpen !== false).length;
  const past = !cancelled && slots.every((slot) => slotState(slot) === 'played') && slots.length > 0;
  const closed = cancelled || applicationsClosed || allTaken;
  const storedApplication = rememberedApplication(slots.map((slot) => slot.gigId || slot.id).concat(gig.gigId));
  const storedKey = storedApplication ? `${storedApplication.gigId}:${storedApplication.token}` : '';
  const [hiddenKey, setHiddenKey] = useState('');
  const remembered = storedApplication && hiddenKey !== storedKey ? storedApplication : null;

  useEffect(() => {
    if (!storedKey) return undefined;
    const splitAt = storedKey.indexOf(':');
    const gigId = storedKey.slice(0, splitAt);
    const token = storedKey.slice(splitAt + 1);
    let cancelled = false;
    getGuestApplication(gigId, token)
      .then((application) => {
        if (cancelled) return;
        if (keepRememberedApplication({ status: application?.status })) return;
        forgetApplication(gigId, token);
        setHiddenKey(storedKey);
      })
      .catch((error) => {
        if (cancelled) return;
        if (keepRememberedApplication({ httpStatus: error?.status })) return;
        forgetApplication(gigId, token);
        setHiddenKey(storedKey);
      });
    return () => { cancelled = true; };
  }, [storedKey]);
  const venuePath = `/venues/${venue?.venueId || gig.venueId || ''}`;
  const equipment = useMemo(() => normalizeTechRider(venue?.techRider).equipment || [], [venue]);
  const providedPhrase = providedKitPhrase(equipment);

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

  useMapbox({ containerRef: mapRef, coordinates, shouldInit: !!coordinates && !applying && isMdUp });

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
        onLogin={onLogin}
        returnToken={returnToken}
        anotherAct={anotherAct}
        onReturnConsumed={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('return');
          url.searchParams.delete('anotherAct');
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        }}
      />
    );
  }

  const place = atThePlace(venue);
  const venueName = venue?.name || place;
  const title = String(gig.gigName || `Gig at ${venueName}`).replace(/\s*\(Set\s+\d+\)\s*$/, '');
  const doors = formatClock(gig.timingAccessTime);
  const address = [venue?.address?.line1 || venue?.address?.addressLine1, venue?.address?.city, venue?.address?.postcode].filter(Boolean).join(', ') || (typeof venue?.address === 'string' ? venue.address : '') || '';
  const placeLine = [venue?.name, address].filter(Boolean).join(', ');
  const mapsHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(typeof address === 'string' ? address : '')}` : '';
  const fee = guestFeeLabel(gig, slots);
  const setsOpen = openSetsSummary({ openCount, total: slots.length, cancelled, past, allTaken, applicationsClosed });
  const applyLabel = past ? 'This gig has happened' : remembered ? 'View my application' : allTaken ? 'All sets filled' : applicationsClosed ? 'Applications closed' : 'Apply';
  const apply = () => (remembered ? navigate(`/gig/${remembered.gigId}/application/${remembered.token}`) : setApplying(true));

  return (
    <div className="ga-page ga-gig">
      <GuestBrandHeader venue={venue} />
      <div className="ga-layout">
        <main>
          {past && <div className="ga-banner">This gig has already happened. <button type="button" onClick={() => navigate(venuePath)}>See upcoming gigs at {venueName}</button></div>}
          {cancelled && (
            <div className="ga-banner is-cancel">
              <strong>This night has been cancelled</strong>
              <p>{venue?.name || 'The venue'} has cancelled {title} on {formatGigDay(gig)}. If you&apos;d applied, your application is closed and there&apos;s nothing you need to do.</p>
              <button type="button" onClick={() => navigate(venuePath)}>See upcoming gigs at {venueName}</button>
            </div>
          )}
          {!past && !cancelled && allTaken && (
            <div className="ga-banner is-closed">
              <strong>All sets are filled</strong>
              <p>{booker.name} has booked every set for {formatShortDay(gig)}, so this gig isn&apos;t taking applications any more. Follow {venueName} on Gigin to hear about future nights.</p>
              <button type="button" onClick={() => navigate(venuePath)}>Follow {venueName}</button>
            </div>
          )}
          {!past && !cancelled && !allTaken && applicationsClosed && (
            <div className="ga-banner is-closed">
              <strong>Applications have closed</strong>
              <p>{booker.name} has stopped taking applications for {(() => {
                const date = slotDate(gig);
                return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : 'this night';
              })()}. Follow {venueName} on Gigin to hear about future nights.</p>
              <button type="button" onClick={() => navigate(venuePath)}>Follow {venueName}</button>
            </div>
          )}
          {!past && !closed && remembered && (
            <div className="ga-banner is-applied">
              <strong>You've applied to this gig</strong>
              <p>You applied from this device. {booker.name} hasn't decided yet. You can change or withdraw your application from your private link.</p>
              <button type="button" className="ga-dark" onClick={() => navigate(`/gig/${remembered.gigId}/application/${remembered.token}`)}>View my application</button>
            </div>
          )}
          {!past && !closed && expired && <div className="ga-banner is-warn">This invite link has expired. The gig is still open, so you can apply as normal.</div>}
          {!past && !closed && (claimed || notYou) && invite?.artistName && (
            <div className="ga-banner">This invite was sent to {invite.artistName}. Not {firstName(invite.artistName)}? We won't fill in their details.</div>
          )}
          {showGreeting && (
            <div className="ga-hello">
              <span>{firstName(invite.artistName).slice(0, 1)}</span>
              <p><strong>Hi {firstName(invite.artistName)},</strong> {booker.name} invited you to apply for this gig at {venueName}.</p>
              <button type="button" onClick={() => setNotYou(true)}>Not you?</button>
            </div>
          )}
          <div className="ga-mast">
            <div className={`ga-hero${cancelled ? ' is-cancelled' : ''}`} style={hero ? { backgroundImage: `url(${hero})` } : undefined} />
            <p className="ga-date ga-phone-only">{formatGuestPhoneDate(gig, slots)}</p>
            <p className="ga-date ga-desktop-only">{formatGuestDesktopDate(gig, slots, placeLine)}</p>
            <h1 className={cancelled ? 'is-cancelled' : ''}>{title}</h1>
            {placeLine ? <p className="ga-venue-line">{placeLine}</p> : null}
            {!past && !closed && openCount > 0 && (
              <Pill className="ga-open-pill ga-phone-only" dot>{openCount} slot{openCount === 1 ? '' : 's'} open</Pill>
            )}
          </div>
          <div className="ga-stack">
            <section className="ga-panel ga-night ga-desktop-only">
              <h2>The night</h2>
              <ul>
                {slots.map((slot, index) => {
                  const taken = slotTaken(slot);
                  const state = cancelled ? 'cancelled' : past ? 'played' : taken ? 'taken' : (applicationsClosed ? 'closed' : 'open');
                  const label = state === 'played' ? 'Played' : state === 'cancelled' ? 'Cancelled' : state === 'taken' ? 'Taken' : state === 'closed' ? 'Closed' : 'Open';
                  return (
                    <li key={slot.gigId || index}>
                      <span>{formatSetLine(slot, index)}{slot.hint ? ` · ${slot.hint}` : ''}</span>
                      <Pill className={state === 'open' ? 'ga-open-pill' : ''} dot={state === 'open'}>{label}</Pill>
                    </li>
                  );
                })}
                {fee ? <li className="ga-fee"><span>Fee</span><span>{fee}</span></li> : null}
              </ul>
            </section>
            {gig.extraInformation && (
              <section className="ga-panel">
                <h2>What we&apos;re after</h2>
                <p className="ga-about">{gig.extraInformation}</p>
              </section>
            )}
            <section className="ga-panel ga-phone-only">
              <table className="ga-facts">
                <tbody>
                  {slots[0]?.duration ? <tr><td>Your set</td><td>{slots[0].duration} minutes</td></tr> : null}
                  {fee ? <tr><td>Fee</td><td>{fee}</td></tr> : null}
                  <tr><td>Sound</td><td>{providedPhrase || 'Ask the venue about sound and kit'}</td></tr>
                  {doors ? <tr><td>Arrive by</td><td>{doors}</td></tr> : null}
                </tbody>
              </table>
            </section>
            <section className="ga-panel ga-desktop-only">
              <h2>What&apos;s provided</h2>
              <p className="ga-about">{providedPhrase || 'Ask the venue about sound and kit'}</p>
            </section>
            {venue?.description ? (
              <section className="ga-panel">
                <h2>About {venue.name}</h2>
                <p className="ga-about">{venue.description}</p>
                <button type="button" className="ga-venue-link" onClick={() => navigate(venuePath)}>See the venue page</button>
              </section>
            ) : (
              <button type="button" className="ga-venue-link" onClick={() => navigate(venuePath)}>See the venue page</button>
            )}
            <section className="ga-desktop-only">
              <h2>Where</h2>
              <div className="ga-map" ref={mapRef} />
              {address && <p>{address}</p>}
              {venue?.arrivalNotes && <p className="ga-about">{venue.arrivalNotes}</p>}
              {mapsHref && <a className="ga-venue-link" href={mapsHref} target="_blank" rel="noreferrer">Open in Maps</a>}
            </section>
            <p className="ga-booked-by ga-desktop-only">Booked by {booker.name}{booker.role ? `, ${booker.role}` : ''}.</p>
          </div>
        </main>
        <aside className="ga-card">
          <h2>{title}</h2>
          <p>{venue?.name || 'Venue'}</p>
          <Pill className={openCount > 0 && !past && !closed ? 'ga-open-pill' : ''} dot={openCount > 0 && !past && !closed}>{setsOpen}</Pill>
          {!cancelled && (
            <button
              type="button"
              className="ga-dark"
              disabled={(closed || past) && !remembered}
              onClick={apply}
            >
              {applyLabel}
            </button>
          )}
          {!cancelled && !closed && !past && !remembered && <small>No account needed</small>}
        </aside>
      </div>
      {!isMdUp && !cancelled && (
        <div className="ga-sticky">
          <button
            type="button"
            className="ga-dark"
            disabled={(closed || past) && !remembered}
            onClick={apply}
          >
            {applyLabel}
          </button>
          {!closed && !past && !remembered && <small>No account needed</small>}
        </div>
      )}
    </div>
  );
}
