import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { AddContactModal } from '../dashboard/AddContactModal';
import { readLastNewGigRoute } from '../dashboard/new-gig/useNewGigDraft';
import {
  attentionNights,
  applicationsChip,
  compactDate,
  dateParts,
  greetingFor,
  groupUpcomingNights,
  isSlotBooked,
  longDate,
  mediumDate,
  relativeTime,
  selectUpcomingNights,
} from './nights';
import { copyText, displayUrl, gigApplyUrl, venuePageUrl } from './publicLinks';
import { useShareLink } from './shareLinkContext';
import { BellIcon, ContactsIcon, LinkIcon, PlusIcon, QrCodeIcon } from './icons';
import './venue-home.css';

const STEPS = [
  { n: '01', title: 'Create a night', body: 'Add the date, times and how many sets you need.' },
  { n: '02', title: 'Share the link', body: 'Each night gets an application link. Send it on WhatsApp or put the QR code on a poster.' },
  { n: '03', title: 'Review applications', body: 'New applications show up here and in your email. Accept, decline or pick a set.' },
];

function SetBars({ night }) {
  const slots = night.slots.length ? night.slots : [night.primary].filter(Boolean);
  return (
    <span className="venue-home__bars" aria-hidden="true">
      {slots.map((slot, index) => (
        <span key={slot.gigId || index} className={`venue-home__bar${isSlotBooked(slot) ? ' is-booked' : ''}`} />
      ))}
    </span>
  );
}

function plural(count, singular, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

export function VenueHome({ user, gigs, venues, onNewGig }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isMdUp } = useBreakpoint();
  const { openShare } = useShareLink();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [activeRow, setActiveRow] = useState(0);
  const menuRef = useRef(null);
  const copyButtonRef = useRef(null);
  const liveRef = useRef(null);

  const selectedVenueId = searchParams.get('venue') || '';
  const selectedVenue = (venues || []).find((venue) => venue.venueId === selectedVenueId) || null;
  const displayedVenue = selectedVenue || ((venues || []).length === 1 ? venues[0] : null);
  const venueLabel = displayedVenue?.name || 'All venues';
  const scopedGigs = useMemo(() => {
    const list = gigs || [];
    if (selectedVenueId) return list.filter((gig) => gig.venueId === selectedVenueId);
    if ((venues || []).length === 1) return list.filter((gig) => gig.venueId === venues[0].venueId);
    return list;
  }, [gigs, selectedVenueId, venues]);

  const nights = useMemo(() => groupUpcomingNights(scopedGigs), [scopedGigs]);
  const hasAnyGigs = (scopedGigs || []).some((gig) => gig?.gigId && gig.itemType !== 'venue_hire');
  const attention = useMemo(() => attentionNights(nights), [nights]);
  const upcoming = useMemo(() => selectUpcomingNights(nights), [nights]);
  const freshTotal = attention.reduce((sum, night) => sum + night.fresh, 0);
  const { phrase, first } = greetingFor(user?.name);
  const today = longDate(new Date());

  const linkRows = useMemo(() => {
    const rows = [];
    const venueIds = displayedVenue
      ? [displayedVenue.venueId]
      : [...new Set(nights.filter((night) => night.open).map((night) => night.venueId))];
    const venuesById = new Map((venues || []).map((venue) => [venue.venueId, venue]));
    venueIds.filter(Boolean).forEach((venueId) => {
      const venue = venuesById.get(venueId);
      const openNights = nights.filter((night) => night.venueId === venueId && night.open && night.date);
      if (!openNights.length && !displayedVenue) return;
      rows.push({
        key: `venue-${venueId}`,
        title: venueIds.length > 1 ? `All open nights · ${venue?.name || 'Venue'}` : 'All open nights',
        url: venuePageUrl(venueId),
      });
    });
    nights
      .filter((night) => night.open && night.date)
      .sort((a, b) => a.date - b.date)
      .forEach((night) => {
        rows.push({
          key: night.gigId,
          title: `${mediumDate(night.date)} · ${night.name}`,
          url: gigApplyUrl(night.gigId),
        });
      });
    return rows;
  }, [displayedVenue, nights, venues]);

  useEffect(() => {
    if (location.state?.scrollTo !== 'needs-attention') return undefined;
    const node = document.getElementById('needs-attention');
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return undefined;
  }, [location.state]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && !copyButtonRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        copyButtonRef.current?.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveRow((index) => Math.min(linkRows.length - 1, index + 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveRow((index) => Math.max(0, index - 1));
      } else if (event.key === 'Enter' && linkRows[activeRow]) {
        event.preventDefault();
        copyRow(linkRows[activeRow]);
      }
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, linkRows, activeRow]);

  const copyRow = async (row) => {
    const ok = await copyText(row.url);
    if (!ok) return;
    setCopiedKey(row.key);
    if (liveRef.current) liveRef.current.textContent = 'Copied';
    window.setTimeout(() => {
      setCopiedKey('');
      setMenuOpen(false);
    }, 1200);
  };

  const openNight = (night, { review = false } = {}) => {
    const search = new URLSearchParams();
    if (night.gigId) search.set('gigId', night.gigId);
    if (selectedVenueId) search.set('venue', selectedVenueId);
    if (review) search.set('filter', 'new');
    navigate({
      pathname: '/venues/dashboard/gigs/gig-applications',
      search: search.toString() ? `?${search}` : '',
    }, {
      state: {
        gig: night.primary,
        ...(night.gigIds.length > 1 ? { linkedGigIds: night.gigIds } : {}),
      },
    });
  };

  const openCopy = () => {
    if (!hasAnyGigs) return;
    setActiveRow(0);
    setMenuOpen((open) => !open);
  };

  const venueQuery = selectedVenueId ? `?venue=${encodeURIComponent(selectedVenueId)}` : '';

  const menuRows = (
    <>
        <p className="venue-home__menu-label">WHICH LINK?</p>
        {linkRows.length === 0 && <p className="venue-home__menu-label">No nights are open for applications.</p>}
        {linkRows.map((row, index) => (
          <button
            key={row.key}
            type="button"
            role="menuitem"
            className={`venue-home__menu-row${index === activeRow ? ' is-active' : ''}`}
            onMouseEnter={() => setActiveRow(index)}
            onClick={() => copyRow(row)}
          >
            <span className="venue-home__menu-copy">
              <span className="venue-home__menu-title">{row.title}</span>
              <span className="venue-home__menu-url">{displayUrl(row.url)}</span>
            </span>
            <span className={`venue-home__menu-action${copiedKey === row.key ? ' is-done' : ''}`}>
              {copiedKey === row.key ? 'Copied ✓' : 'Copy'}
            </span>
          </button>
        ))}
    </>
  );

  const menu = !menuOpen ? null : isMdUp ? (
    <div className="venue-home__menu" ref={menuRef} role="menu" aria-label="Which link?">
      {menuRows}
    </div>
  ) : (
    <div className="venue-home__sheet" role="presentation" onClick={() => setMenuOpen(false)}>
      <div className="venue-home__sheet-panel" ref={menuRef} role="menu" aria-label="Which link?" onClick={(event) => event.stopPropagation()}>
        {menuRows}
      </div>
    </div>
  );

  return (
    <div className="venue-home">
      <div className="venue-home__live" aria-live="polite" ref={liveRef} />
      <header className="venue-home__header">
        <div>
          <h1 className="venue-home__hello">{hasAnyGigs ? phrase : `Welcome to Gigin, ${first}`}</h1>
          <p className="venue-home__sub">
            {hasAnyGigs ? `${today} · ${venueLabel}` : `${venueLabel} is set up. Here's how booking works.`}
          </p>
        </div>
        <div className="venue-home__actions">
          <div className="venue-home__copy-wrap">
            <button
              ref={copyButtonRef}
              type="button"
              className="venue-home__btn"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-disabled={!hasAnyGigs || undefined}
              title={hasAnyGigs ? undefined : 'Create a gig first to get an application link'}
              onClick={openCopy}
            >
              <LinkIcon />
              Copy application link
            </button>
            {isMdUp && menu}
          </div>
          <button type="button" className="venue-home__btn" onClick={() => navigate(`/venues/dashboard/artists${venueQuery}`)}>
            <ContactsIcon />
            Contacts
          </button>
          <button type="button" className="venue-home__btn is-dark" onClick={() => onNewGig?.(readLastNewGigRoute() || 'full')}>
            <PlusIcon />
            New gig
          </button>
        </div>
      </header>

      <div className="venue-home__mobile-actions">
        <button type="button" className="venue-home__tile is-dark" onClick={() => onNewGig?.(readLastNewGigRoute() || 'full')}>
          <PlusIcon />
          New gig
        </button>
        <button
          type="button"
          className="venue-home__tile"
          aria-disabled={!hasAnyGigs || undefined}
          title={hasAnyGigs ? undefined : 'Create a gig first to get an application link'}
          onClick={openCopy}
        >
          <LinkIcon />
          Copy link
        </button>
        <button type="button" className="venue-home__tile" onClick={() => navigate(`/venues/dashboard/artists${venueQuery}`)}>
          <ContactsIcon />
          Contacts
        </button>
      </div>
      {!isMdUp && menu}

      {!hasAnyGigs ? (
        <section className="venue-home__card venue-home__welcome">
          <h2>Post your first gig</h2>
          <p>Create a night, then share its link so acts can apply. New applications show up here and in your email.</p>
          <div className="venue-home__steps">
            {STEPS.map((step) => (
              <div key={step.n} className="venue-home__step">
                <b>{step.n}</b>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </div>
            ))}
          </div>
          <div className="venue-home__welcome-actions">
            <button type="button" className="venue-home__btn is-orange" onClick={() => onNewGig?.(readLastNewGigRoute() || 'full')}>
              <PlusIcon />
              New gig
            </button>
            <button type="button" className="venue-home__btn" onClick={() => setShowAddContact(true)}>
              Add contacts
            </button>
          </div>
          <p className="venue-home__note">Copy link works once you have created a gig.</p>
        </section>
      ) : null}

      {hasAnyGigs && attention.length > 0 && (
        <section className="venue-home__card is-attention" id="needs-attention">
          <div className="venue-home__card-head">
            <span className="venue-home__bell"><BellIcon /></span>
            <h2 className="venue-home__card-title">Needs your attention</h2>
            <span className="venue-home__kicker">{freshTotal} NEW APPLICATION{freshTotal === 1 ? '' : 'S'}</span>
          </div>
          {attention.map((night) => {
            const parts = dateParts(night.date);
            const latestName = night.latestNew?.name || night.latestNew?.artistName || night.latestNew?.actName || 'New act';
            const latestWhen = relativeTime(night.latestNew ? (night.latestNew.appliedAt || night.latestNew.createdAt || night.latestNew.timestamp) : null);
            return (
              <div key={night.gigId} className="venue-home__attention-row">
                <div className="venue-home__attention-main">
                  <div className="venue-home__dateblock">
                    <span>{parts.dow}</span>
                    <b>{parts.day}</b>
                    <span>{parts.mon}</span>
                  </div>
                  <div>
                    <div className="venue-home__night-name">
                      <em>{night.name}</em>
                      <span className="venue-home__new">{night.fresh} new</span>
                    </div>
                    <p className="venue-home__latest">Latest: {latestName}{latestWhen ? ` · ${latestWhen}` : ''}</p>
                    <div className="venue-home__meta">
                      <SetBars night={night} />
                      <span>
                        {isMdUp
                          ? `${night.bookedCount} of ${night.setCount} sets booked · ${plural(night.totalApps, 'application')}`
                          : `${night.bookedCount}/${night.setCount} sets · ${plural(night.totalApps, 'application')}`}
                      </span>
                    </div>
                  </div>
                </div>
                <button type="button" className="venue-home__review" onClick={() => openNight(night, { review: true })}>
                  {isMdUp ? `Review ${night.fresh}` : `Review ${night.fresh} new application${night.fresh === 1 ? '' : 's'}`}
                </button>
              </div>
            );
          })}
        </section>
      )}

      {hasAnyGigs && (
      <section className="venue-home__card">
        <div className="venue-home__card-head">
          <h2 className="venue-home__card-title">Upcoming nights</h2>
          <span className="venue-home__kicker">{upcoming.fallback ? 'NEXT 5 NIGHTS' : 'NEXT 3 WEEKS'}</span>
        </div>
        {upcoming.nights.length > 0 && isMdUp && (
          <div className="venue-home__cols">
            <span>Date</span>
            <span>Night</span>
            <span>Sets</span>
            <span>Applications</span>
            <span>Received</span>
            <span />
          </div>
        )}
        {upcoming.nights.length === 0 && (
          <p className="venue-home__empty-copy">No upcoming nights. Nights you create will be listed here.</p>
        )}
        {upcoming.nights.map((night) => {
          const chip = applicationsChip(night);
          const parts = dateParts(night.date);
          return (
            <div
              key={night.gigId}
              className="venue-home__upcoming-row"
              role="link"
              tabIndex={0}
              onClick={() => openNight(night)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') openNight(night);
              }}
            >
              <span className="venue-home__when">
                {isMdUp ? compactDate(night.date) : (
                  <>
                    {parts.dow}
                    <b>{parts.day}</b>
                  </>
                )}
              </span>
              <span className="venue-home__gig">
                <em>{night.name}</em>
                {night.fresh > 0 && !isMdUp && <span className="venue-home__new">{night.fresh} new</span>}
                {night.setCount > 1 && isMdUp && <span className="venue-home__sets-tag">{night.setCount} sets</span>}
              </span>
              <span className="venue-home__ratio">
                <SetBars night={night} />
                <span>{night.bookedCount}/{night.setCount}</span>
              </span>
              <span className={`venue-home__chip is-${chip.tone}`}>
                <i />
                {chip.label}
              </span>
              <span className="venue-home__received">
                {night.totalApps}
                {night.fresh > 0 && <span className="venue-home__new">{night.fresh} new</span>}
              </span>
              <span className="venue-home__mobile-meta">
                <span className={`venue-home__chip is-${chip.tone}`} style={{ display: 'inline-flex' }}>
                  <i />
                  {chip.label}
                </span>
                <SetBars night={night} />
                <span>{night.bookedCount}/{night.setCount}</span>
              </span>
              <button
                type="button"
                className="venue-home__qr"
                aria-label={`Share application link for ${mediumDate(night.date)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  openShare({ slots: night.slots, venueName: night.venueName || venueLabel });
                }}
              >
                <QrCodeIcon />
              </button>
            </div>
          );
        })}
        <a className="venue-home__footer" href={`/venues/dashboard/gigs${venueQuery}`} onClick={(event) => {
          event.preventDefault();
          navigate(`/venues/dashboard/gigs${venueQuery}`);
        }}>
          View all gigs ›
        </a>
      </section>
      )}

      {showAddContact && (
        <AddContactModal userId={user?.uid} onClose={() => setShowAddContact(false)} onCreated={() => setShowAddContact(false)} />
      )}
    </div>
  );
}
