import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import '@styles/artists/keep-profile.styles.css';
import { FEATURES } from '../../config/features';
import { FeatureRedirect } from '../../config/FeatureRedirect';
import { VenueFinder } from '../venue-discovery/VenueFinder';
import { useMapbox } from '@hooks/useMapbox';
import {
  claimVenue,
  getFinderVenue,
  getFinderVenues,
  getProfileSession,
  profileLink,
  requestArea,
  sendProfileRequest,
} from '@services/client-side/keepProfile';
import { CopyButton, GreyBars, Sheet } from './ui';

const CAMBRIDGE = [-0.1218, 52.2053];

function distanceMiles(location) {
  if (!location) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(location.lat - 52.2053);
  const dLng = toRad(location.lng - 0.1218);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(52.2053)) * Math.cos(toRad(location.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function monthYear(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function ContactBlock({ contact, venueName, onCreate }) {
  if (!contact || contact.state === 'open') {
    return (
      <div className="kp-contact-strip">
        <p className="kp-mono">CONTACT</p>
        <p>{contact?.bookerName}{contact?.role ? ` · ${contact.role}` : ''}</p>
        <p>{[contact?.email, contact?.phone].filter(Boolean).join(' · ')}</p>
      </div>
    );
  }
  if (contact.state === 'website') {
    return (
      <div className="kp-contact-strip">
        <p className="kp-mono">CONTACT</p>
        <p>{contact.email}</p>
        <p>{contact.note}</p>
      </div>
    );
  }
  const message = contact.state === 'nobody'
    ? `${venueName} takes bookings through Gigin only, so there's no email or phone here. Apply to one of their gigs or send your profile.`
    : contact.state === 'invited_only'
      ? `${venueName} only shares contact details with artists they've invited. Send your profile and they can offer you a gig.`
      : 'Create your profile to see how to contact this venue';
  return (
    <button type="button" className="kp-contact-lock" onClick={contact.carrot ? onCreate : undefined}>
      <span aria-hidden="true">🔒</span>
      <GreyBars />
      <p>{message}</p>
    </button>
  );
}

export function SendProfileSheet({ venue, profile, onClose, onSent }) {
  const slug = profile?.slug || '';
  const url = slug ? profileLink(slug) : '';
  const first = (profile?.contactName || profile?.name || '').split(' ')[0] || '';
  const clause = profile?.bio ? profile.bio.split(/[,.]/)[0] : '';
  const [message, setMessage] = useState(`Hi,\nI'm ${first} from ${profile?.name || ''}${clause ? `, ${clause}` : ''}. We'd love to play at ${venue.name}.\nOur music, band and tech needs are all here:\ngiginmusic.com/artist/${slug}\nThanks,\n${first}`);
  const [done, setDone] = useState(false);
  const promoters = /promoter/i.test(venue.howTheyBookRaw || venue.howTheyBook || '');
  const send = async () => {
    await sendProfileRequest(venue.id, profile?.id);
    setDone(true);
    onSent?.();
  };
  return (
    <Sheet title={venue.name} onClose={onClose}>
      {done ? (
        <p>Sent to {venue.name}. They now have your profile. If a night fits, they can offer it to you, and you'll hear by email. Sending your profile doesn't book a gig.</p>
      ) : venue.kind === 'gigin' ? (
        <>
          <p>{venue.name} books through Gigin.</p>
          <button type="button" className="kp-btn" onClick={send}>Request to be considered</button>
          <p>Sends your profile to {venue.name}. They see your public profile, not your email or phone.</p>
          <div className="kp-row"><span>Copy my profile link</span><CopyButton text={url} /></div>
        </>
      ) : (
        <>
          <p>{promoters ? 'They book through promoters, so send your link to the promoters who run nights there.' : `${venue.name} isn't on Gigin. They book by email, and their address is on their website.`}</p>
          <label className="kp-field">Write a message<textarea rows={8} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
          <a className="kp-btn" style={{ display: 'grid', placeItems: 'center' }} href={`mailto:?subject=${encodeURIComponent(`${profile?.name || 'Act'}: gigs at ${venue.name}`)}&body=${encodeURIComponent(message)}`}>Open in email</a>
          <CopyButton text={message} label="Copy" />
          <p>This opens in your own email app, so the venue replies to you directly. Edit anything you like first.</p>
          <div className="kp-row"><span>Copy my profile link</span><CopyButton text={url} /></div>
          {venue.websiteUrl && <a href={venue.websiteUrl} target="_blank" rel="noreferrer">Open their website ↗</a>}
        </>
      )}
    </Sheet>
  );
}

export function VenueFinderPage({ user, setAuthModal, setAuthType }) {
  const [venues, setVenues] = useState([]);
  const [profile, setProfile] = useState(null);
  const [kind, setKind] = useState('all');
  const [pa, setPa] = useState(false);
  const [originals, setOriginals] = useState(false);
  const [capacity, setCapacity] = useState('any');
  const [genre, setGenre] = useState('');
  const [active, setActive] = useState('');
  const [sheet, setSheet] = useState(null);
  const [sent, setSent] = useState({});
  const [area, setArea] = useState('Cambridge');
  const [town, setTown] = useState('');
  const [thanks, setThanks] = useState('');
  const [tell, setTell] = useState(false);
  const [missed, setMissed] = useState('');
  const mapRef = useRef(null);

  useEffect(() => {
    getFinderVenues().then((result) => setVenues(result.venues || [])).catch(() => setVenues([]));
    getProfileSession().then((data) => setProfile(data?.profile ? { ...data.profile, contactName: data.contact?.contactName, bio: data.profile.bio } : null)).catch(() => {});
  }, []);

  const genres = useMemo(() => [...new Set(venues.flatMap((venue) => venue.genres || []))], [venues]);
  const filtered = venues.filter((venue) => {
    if (kind === 'gigin' && venue.kind !== 'gigin') return false;
    if (kind === 'listed' && venue.kind !== 'listed') return false;
    if (pa && venue.hasPA !== true) return false;
    if (originals && venue.takesOriginals !== true) return false;
    const n = Number(venue.capacity);
    if (capacity === 'upto80' && !(n <= 80)) return false;
    if (capacity === '80to150' && !(n >= 80 && n <= 150)) return false;
    if (capacity === '150plus' && !(n >= 150)) return false;
    if (genre && !(venue.genres || []).includes(genre)) return false;
    return true;
  });
  const onGigin = venues.filter((venue) => venue.kind === 'gigin').length;
  const listed = venues.filter((venue) => venue.kind === 'listed').length;
  const markers = useMemo(() => filtered.filter((venue) => venue.location).map((venue) => ({
    id: venue.id,
    coordinates: [venue.location.lng, venue.location.lat],
    color: venue.kind === 'gigin' ? '#FF6C4B' : '#111317',
  })), [filtered]);

  useMapbox({
    containerRef: mapRef,
    coordinates: CAMBRIDGE,
    markers,
    activeMarkerId: active,
    addMarker: false,
    zoom: 12,
    onMarkerClick: setActive,
    reinitKey: markers.map((marker) => marker.id).join(','),
  });

  const createProfile = () => {
    setAuthType?.('signup');
    setAuthModal?.(true);
  };

  const emptyArea = area.trim() && !/cambridge/i.test(area);

  return (
    <div className="kp">
      <header className="kp-top"><span className="kp-logo">gigin.</span><span>{user ? '' : ''}</span></header>
      <div className="kp-finder-layout">
        <div className="kp-wrap" style={{ maxWidth: 480 }}>
          <h1>Find places to play</h1>
          <label className="kp-field">Area<input value={area} onChange={(event) => setArea(event.target.value)} /></label>
          <p>Venues that put on live music, what each one has and wants, and a quick way to send them your profile. Venues decide who they book, so this is a way to find places to play, not a promise of gigs.</p>
          {!emptyArea && (
            <>
              <div className="kp-seg">
                <button type="button" className={kind === 'all' ? 'is-on' : ''} onClick={() => setKind('all')}>All {venues.length}</button>
                <button type="button" className={kind === 'gigin' ? 'is-on' : ''} onClick={() => setKind('gigin')}>On Gigin {onGigin}</button>
                <button type="button" className={kind === 'listed' ? 'is-on' : ''} onClick={() => setKind('listed')}>Listed {listed}</button>
              </div>
              <div className="kp-filters">
                <button type="button" className={pa ? 'is-on' : ''} onClick={() => setPa((value) => !value)}>Has a PA</button>
                <button type="button" className={originals ? 'is-on' : ''} onClick={() => setOriginals((value) => !value)}>Takes originals</button>
                <select className={capacity !== 'any' ? 'is-on' : ''} value={capacity} onChange={(event) => setCapacity(event.target.value)} aria-label="Capacity">
                  <option value="any">Capacity</option>
                  <option value="upto80">Up to 80</option>
                  <option value="80to150">80 to 150</option>
                  <option value="150plus">150+</option>
                </select>
                <select className={genre ? 'is-on' : ''} value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Genre">
                  <option value="">Genre</option>
                  {genres.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <p>{filtered.length} venues in Cambridge so far. We're adding more.</p>
              {filtered.length === 0 && (
                <div className="kp-card">
                  <h2>No venues match these filters</h2>
                  <p>There are only a handful of venues in Cambridge so far, so a broad search works best.</p>
                  <button type="button" className="kp-btn" onClick={() => { setPa(false); setOriginals(false); setCapacity('any'); setGenre(''); setKind('all'); }}>Clear filters</button>
                </div>
              )}
              {filtered.map((venue) => (
                <article key={venue.id} className="kp-venue-card" onMouseEnter={() => setActive(venue.id)}>
                  <h2>{venue.name}</h2>
                  <p>{venue.area}{distanceMiles(venue.location) != null ? ` · ${distanceMiles(venue.location)} miles` : ''}</p>
                  <span className={venue.kind === 'gigin' ? 'kp-badge kp-badge-gigin' : 'kp-badge kp-badge-listed'}>{venue.kind === 'gigin' ? 'On Gigin' : 'Listed by Gigin'}</span>
                  <div className="kp-specs">
                    <div><span>SOUND</span><strong className={venue.hasPA ? 'kp-ok' : 'kp-no'}>{venue.hasPA ? '✓' : '✕'} {venue.soundSummary}</strong></div>
                    <div><span>CAPACITY</span><strong>{venue.capacity || '—'}</strong></div>
                    <div><span>DEAL</span><strong>{venue.dealLabel || '—'}</strong></div>
                    <div><span>HOW THEY BOOK</span><strong>{venue.howTheyBook || '—'}</strong></div>
                  </div>
                  <p>{(venue.genres || []).join(', ')}{venue.takesOriginals ? ' · originals welcome' : ''}</p>
                  {sent[venue.id] && <p>Profile sent. The venue will be in touch if a night fits.</p>}
                  <ContactBlock contact={venue.contact} venueName={venue.name} onCreate={createProfile} />
                  <button type="button" className="kp-btn" onClick={() => setSheet(venue)}>Send my profile</button>
                  <Link to={`/venues/${venue.id}`}>View venue</Link>
                  <p className="kp-muted">{venue.source === 'venue' ? 'Details from the venue' : `From public info · checked ${monthYear(venue.checkedAt)}`}</p>
                </article>
              ))}
              <div className="kp-card">
                <p><strong>On Gigin</strong> venues take applications here. <strong>Listed by Gigin</strong> venues are public listings we haven't checked with the venue.</p>
                <button type="button" className="kp-text" onClick={() => setTell(true)}>Know a venue we've missed? Tell us about it</button>
              </div>
            </>
          )}
          {emptyArea && (
            <div className="kp-card">
              <h2>No venues here yet.</h2>
              <p>Tell us where you'd like to play. We're starting in Cambridge and adding places where artists ask for them.</p>
              {thanks ? <p>Thanks. We'll email you when there are venues near {thanks}.</p> : (
                <form onSubmit={async (event) => {
                  event.preventDefault();
                  const result = await requestArea({ town, email: profile?.email || user?.email || '' });
                  setThanks(result.town || town);
                }}>
                  <label className="kp-field">Town<input value={town} onChange={(event) => setTown(event.target.value)} /></label>
                  <button type="submit" className="kp-btn">Tell us</button>
                </form>
              )}
              <button type="button" className="kp-text" onClick={() => setArea('Cambridge')}>See Cambridge venues (16 miles away)</button>
            </div>
          )}
        </div>
        <div className="kp-map"><div className="kp-map-el" ref={mapRef} /></div>
      </div>
      {sheet && (
        <SendProfileSheet venue={sheet} profile={profile} onClose={() => setSheet(null)} onSent={() => setSent((current) => ({ ...current, [sheet.id]: true }))} />
      )}
      {tell && (
        <Sheet title="Tell us about a venue" onClose={() => setTell(false)}>
          <label className="kp-field">Venue<input value={missed} onChange={(event) => setMissed(event.target.value)} /></label>
          <button type="button" className="kp-btn" onClick={async () => {
            await requestArea({ town: missed, email: user?.email || 'venues@giginmusic.com' });
            setTell(false);
          }}>Send</button>
        </Sheet>
      )}
    </div>
  );
}

export function ArtistVenuePage() {
  const { venueId: id } = useParams();
  const [venue, setVenue] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [claim, setClaim] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', email: '' });
  useEffect(() => {
    getFinderVenue(id).then(setVenue).catch(() => setVenue(null));
    getProfileSession().then((data) => setProfile(data?.profile || null)).catch(() => {});
  }, [id]);
  if (!venue) return <div className="kp"><div className="kp-wrap"><p>This venue isn't listed.</p></div></div>;
  return (
    <div className="kp">
      <header className="kp-top"><span className="kp-logo">gigin.</span></header>
      <div className="kp-wrap kp-public">
        <div className="kp-split">
          <div>
            {venue.heroPhoto ? <img className="kp-hero" alt="" src={venue.heroPhoto} style={{ height: 200 }} /> : <div className="kp-hero-fallback" style={{ height: 200 }} />}
            <span className={venue.kind === 'gigin' ? 'kp-badge kp-badge-gigin' : 'kp-badge kp-badge-listed'}>{venue.kind === 'gigin' ? 'On Gigin' : 'Listed by Gigin'}</span>
            <h1>{venue.name}</h1>
            <p>{venue.street}{venue.city ? `, ${venue.city}` : ''}{distanceMiles(venue.location) != null ? ` · ${distanceMiles(venue.location)} miles` : ''}</p>
            <button type="button" className="kp-btn" style={{ minHeight: 52 }} onClick={() => setSheet(true)}>Send my profile</button>
            <section className="kp-section">
              <h2>WHAT THEY HAVE AND WANT</h2>
              <div className="kp-specs">
                <div><span>SOUND</span><strong className={venue.hasPA ? 'kp-ok' : 'kp-no'}>{venue.hasPA ? '✓' : '✕'} {venue.soundSummary}</strong></div>
                <div><span>CAPACITY</span><strong>{venue.capacity || '—'}</strong></div>
                <div><span>DEAL</span><strong>{venue.dealLabel || venue.dealModel || '—'}</strong></div>
                <div><span>HOW THEY BOOK</span><strong>{venue.howTheyBook || '—'}</strong></div>
                <div><span>ORIGINALS</span><strong>{venue.takesOriginals ? 'Yes' : 'No'}</strong></div>
                <div><span>GENRES</span><strong>{(venue.genres || []).join(', ') || '—'}</strong></div>
              </div>
              <p className="kp-muted">{venue.kind === 'gigin' ? `Details from the venue · updated ${monthYear(venue.checkedAt)}` : `Listed by Gigin from public info · checked ${monthYear(venue.checkedAt)}`}</p>
            </section>
            {venue.kind === 'listed' && (
              <div className="kp-card">
                <strong>Is this your venue?</strong>
                <p>Claim it to correct these details, choose who sees your contact details, and take applications through Gigin.</p>
                <button type="button" className="kp-btn" onClick={() => setClaim(true)}>Claim this venue</button>
              </div>
            )}
            <p>Venues decide who they book. Sending your profile doesn't book a gig.</p>
          </div>
          <aside className="kp-aside">
            <div className="kp-card">
              <ContactBlock contact={venue.contact} venueName={venue.name} />
            </div>
            {venue.websiteUrl && <a className="kp-card" href={venue.websiteUrl} target="_blank" rel="noreferrer">Website · Open ↗</a>}
          </aside>
        </div>
      </div>
      {sheet && <SendProfileSheet venue={venue} profile={profile} onClose={() => setSheet(false)} />}
      {claim && (
        <Sheet title="Claim this venue" onClose={() => setClaim(false)}>
          {claimed ? <p>Thanks. We'll check and get back to you within 2 working days. Until then the listing stays as it is.</p> : (
            <form onSubmit={async (event) => {
              event.preventDefault();
              await claimVenue(venue.id, form);
              setClaimed(true);
            }}>
              <label className="kp-field">Your name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label className="kp-field">Your role at the venue<input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label>
              <label className="kp-field">Work email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <button type="submit" className="kp-btn">Send claim</button>
            </form>
          )}
        </Sheet>
      )}
    </div>
  );
}

const VISIBILITY = [
  ['signed_in', 'Artists with a Gigin profile', 'Default. Artists who aren\'t signed in see "Create your profile to see how to contact this venue".'],
  ['invited', "Only artists I've invited", 'Artists you have offered a gig to see your details. Everyone else is asked to send their profile instead.'],
  ['nobody', 'Nobody', 'No email or phone is shown. Artists apply to your gigs or send their profile through Gigin.'],
];

export function FinderListingSettings({ venueId }) {
  const [settings, setSettings] = useState(null);
  const [preview, setPreview] = useState('out');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!venueId) return;
    import('@services/client-side/keepProfile').then(({ getFinderSettings }) => getFinderSettings(venueId).then(setSettings));
  }, [venueId]);
  if (!settings) return <p>Loading finder listing…</p>;
  const listing = settings.finderListing || {};
  const contact = settings.finderContact || {};
  const setListing = (patch) => setSettings({ ...settings, finderListing: { ...listing, ...patch } });
  const showOpen = (preview === 'in' && settings.contactVisibility === 'signed_in') || (preview === 'invited' && settings.contactVisibility !== 'nobody');
  return (
    <div className="kp kp-settings" style={{ padding: 24 }}>
      <div>
        <h1>Finder listing</h1>
        <div className="kp-row">
          <strong>Show {settings.name} in the venue finder</strong>
          <button type="button" className={`kp-switch${listing.listed ? ' is-on' : ''}`} onClick={() => setListing({ listed: !listing.listed })} aria-label="Show in the venue finder"><span /></button>
        </div>
        <h2>What you have and want</h2>
        <label className="kp-field">Has a PA
          <select value={listing.hasPA ? 'yes' : 'no'} onChange={(event) => setListing({ hasPA: event.target.value === 'yes' })}><option value="yes">Yes</option><option value="no">No</option></select>
        </label>
        <label className="kp-field">Capacity<input value={listing.capacity || ''} onChange={(event) => setListing({ capacity: event.target.value })} /></label>
        <label className="kp-field">Sound summary<input value={listing.soundSummary || ''} onChange={(event) => setListing({ soundSummary: event.target.value })} /></label>
        <label className="kp-field">Deal
          <select value={listing.dealModel || 'agreed'} onChange={(event) => setListing({ dealModel: event.target.value })}>
            <option value="agreed">Agreed per gig</option>
            <option value="fee">Fixed fee</option>
            <option value="door">Bands keep the door</option>
            <option value="split">Door split</option>
            <option value="room_hire">Room hire</option>
          </select>
        </label>
        <label className="kp-field">How you book
          <select value={listing.howTheyBook || 'gigin'} onChange={(event) => setListing({ howTheyBook: event.target.value })}>
            <option value="gigin">Applications on Gigin</option>
            <option value="email">By email</option>
            <option value="seasonal">Seasonal sessions</option>
            <option value="promoters">Through promoters</option>
          </select>
        </label>
        <label className="kp-field">Takes originals
          <select value={listing.takesOriginals ? 'yes' : 'no'} onChange={(event) => setListing({ takesOriginals: event.target.value === 'yes' })}><option value="yes">Yes</option><option value="no">No</option></select>
        </label>
        <label className="kp-field">Website<input value={listing.websiteUrl || ''} onChange={(event) => setListing({ websiteUrl: event.target.value })} /></label>
        <label className="kp-field">Genres<input value={(listing.genres || []).join(', ')} onChange={(event) => setListing({ genres: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
        <h2>Contact details</h2>
        <label className="kp-field">Booker name<input value={contact.bookerName || ''} onChange={(event) => setSettings({ ...settings, finderContact: { ...contact, bookerName: event.target.value } })} /></label>
        <label className="kp-field">Role<input value={contact.role || ''} onChange={(event) => setSettings({ ...settings, finderContact: { ...contact, role: event.target.value } })} /></label>
        <label className="kp-field">Email<input value={contact.email || ''} onChange={(event) => setSettings({ ...settings, finderContact: { ...contact, email: event.target.value } })} /></label>
        <label className="kp-field">Phone (optional)<input value={contact.phone || ''} onChange={(event) => setSettings({ ...settings, finderContact: { ...contact, phone: event.target.value } })} /></label>
        <h2>Who can see my contact details</h2>
        {VISIBILITY.map(([value, title, body]) => (
          <button type="button" key={value} className={`kp-radio${settings.contactVisibility === value ? ' is-on' : ''}`} onClick={() => setSettings({ ...settings, contactVisibility: value })}>
            <strong>{title}</strong>
            <small>{body}</small>
          </button>
        ))}
        {saved && <p>Saved. The finder shows your changes now.</p>}
        <button type="button" className="kp-btn" onClick={async () => {
          const { saveFinderSettings } = await import('@services/client-side/keepProfile');
          await saveFinderSettings(venueId, settings);
          setSaved(true);
        }}>Save changes</button>
      </div>
      <aside className="kp-aside kp-card">
        <p className="kp-mono">WHAT ARTISTS SEE</p>
        <div className="kp-seg">
          <button type="button" className={preview === 'out' ? 'is-on' : ''} onClick={() => setPreview('out')}>Not signed in</button>
          <button type="button" className={preview === 'in' ? 'is-on' : ''} onClick={() => setPreview('in')}>Signed in</button>
          <button type="button" className={preview === 'invited' ? 'is-on' : ''} onClick={() => setPreview('invited')}>Invited by you</button>
        </div>
        {showOpen && preview !== 'out' ? (
          <div className="kp-contact-strip">
            <p>{contact.bookerName}</p>
            <p>{contact.email} · {contact.phone}</p>
          </div>
        ) : (
          <ContactBlock contact={{ state: settings.contactVisibility === 'nobody' ? 'nobody' : settings.contactVisibility === 'invited' && preview !== 'invited' ? 'invited_only' : 'placeholder', carrot: true }} venueName={settings.name} />
        )}
      </aside>
    </div>
  );
}

export function FindVenuesRoute(props) {
  const [mode, setMode] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    const decide = async () => {
      if (!FEATURES.venueFinder) {
        if (!cancelled) setMode(FEATURES.discovery ? 'legacy' : 'off');
        return;
      }
      if (FEATURES.discovery || props.user) {
        if (!cancelled) setMode('finder');
        return;
      }
      const session = await getProfileSession().catch(() => null);
      if (!cancelled) setMode(session?.profile ? 'finder' : 'off');
    };
    decide();
    return () => { cancelled = true; };
  }, [props.user]);
  if (mode === 'loading') return null;
  if (mode === 'finder') return <VenueFinderPage user={props.user} setAuthModal={props.setAuthModal} setAuthType={props.setAuthType} />;
  if (mode === 'legacy') {
    return <VenueFinder user={props.user} setAuthModal={props.setAuthModal} setAuthType={props.setAuthType} setNoProfileModal={props.setNoProfileModal} noProfileModal={props.noProfileModal} setNoProfileModalClosable={props.setNoProfileModalClosable} />;
  }
  return <FeatureRedirect user={props.user} setAuthModal={props.setAuthModal} setAuthType={props.setAuthType} setAuthClosable={props.setAuthClosable} />;
}
