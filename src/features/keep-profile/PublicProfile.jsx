import { useEffect, useState } from 'react';
import '@styles/artists/keep-profile.styles.css';
import { FEATURES } from '../../config/features';
import { contactArtist, getArtistContact, getOwnProfile, getProfileSession, profileLink } from '@services/client-side/keepProfile';
import { CopyButton, LinkChips, Sheet } from './ui';
import { DownloadPressKit } from './PressKit';

function youtubeId(url) {
  const match = String(url || '').match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return match ? match[1] : '';
}

function setMeta(attr, key, content) {
  if (!content) return;
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function PublicArtistProfile({ profile, user, venueId }) {
  const [share, setShare] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', venue: '', message: '' });
  const [venueContact, setVenueContact] = useState(null);
  const [ownContact, setOwnContact] = useState(null);
  const [session, setSession] = useState(null);
  const [videoOn, setVideoOn] = useState(false);
  const url = profileLink(profile.slug);
  const initials = String(profile.name || 'A').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const members = profile.members || [];
  const instruments = [...new Set(members.flatMap((member) => member.instruments || []))].join(', ');
  const kind = members.length === 3 ? 'Trio' : members.length ? `${members.length}-piece` : '';
  const signedInVenue = user?.venueProfiles?.[0] || null;
  const resolvedVenueId = venueId || signedInVenue?.venueId || signedInVenue?.id || '';
  const venueLabel = signedInVenue?.name || signedInVenue?.venueName || 'your venue';
  const isOwner = session?.profile?.id === profile.id || (user?.uid && profile.userId && profile.userId === user.uid);
  const video = youtubeId(profile.youtubeUrl);

  useEffect(() => {
    document.title = `${profile.name} · Gigin`;
    const description = profile.bio
      ? `${String(profile.bio).split(/(?<=[.!?])\s/)[0].slice(0, 120)}. Music, band and tech rider in one place.`
      : 'Artist profile on Gigin.';
    setMeta('property', 'og:title', `${profile.name} · Gigin`);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', profile.heroMedia?.url || `${url.replace(`/artist/${profile.slug}`, '')}/api/profiles/public/${profile.slug}/og.png`);
    setMeta('name', 'twitter:card', 'summary_large_image');
  }, [profile, url]);

  useEffect(() => {
    getProfileSession().then(setSession).catch(() => {});
  }, []);

  useEffect(() => {
    if (!resolvedVenueId || !user) return undefined;
    getArtistContact(profile.id, resolvedVenueId).then(setVenueContact).catch(() => setVenueContact(null));
    return undefined;
  }, [resolvedVenueId, user, profile.id]);

  useEffect(() => {
    if (!isOwner) return undefined;
    getOwnProfile().then((data) => setOwnContact(data.contact || null)).catch(() => {});
    return undefined;
  }, [isOwner]);

  const sparse = !profile.bio && !profile.heroMedia && !(profile.spotifyUrl || profile.youtubeUrl) && !members.length;
  const tech = profile.techRider || {};
  const needs = tech.guestNeeds || tech.needs || [];
  const bring = tech.bringOwn || [];

  return (
    <div className="kp">
      <header className="kp-top"><span className="kp-logo">gigin.</span></header>
      <div className="kp-wrap kp-public">
        <div className="kp-split">
          <div>
            {profile.heroMedia?.url ? <img className="kp-hero" src={profile.heroMedia.url} alt="" /> : (
              <div className="kp-hero-fallback"><span>{initials}</span></div>
            )}
            <h1>{profile.name}</h1>
            {kind && <p>{kind}{instruments ? ` · ${instruments}` : ''}</p>}
            <div className="kp-chips"><LinkChips links={profile} /></div>
            <div className="kp-actions">
              {!isOwner && !venueContact && <button type="button" className="kp-btn" onClick={() => setContactOpen(true)}>Contact the act</button>}
              <button type="button" className="kp-ghost" onClick={() => { if (shareProfileFallback(url)) setShare(true); }}>Share</button>
            </div>
            {signedInVenue && <p className="kp-mono">SIGNED IN AS {venueLabel}</p>}
            {isOwner && ownContact && (
              <div className="kp-card">
                <div className="kp-row"><span>Email</span><strong>{ownContact.email}</strong><CopyButton text={ownContact.email || ''} /></div>
                <div className="kp-row"><span>Phone</span><strong>{ownContact.phone}{ownContact.whatsapp ? ' · WhatsApp ok' : ''}</strong><CopyButton text={ownContact.phone || ''} /></div>
              </div>
            )}
            {venueContact && (
              <div className="kp-card">
                <div className="kp-row"><span>Email</span><strong>{venueContact.email}</strong><CopyButton text={venueContact.email || ''} /></div>
                <div className="kp-row"><span>Phone</span><strong>{venueContact.phone}{venueContact.whatsapp ? ' · WhatsApp ok' : ''}</strong><CopyButton text={venueContact.phone || ''} /></div>
                <p>{venueContact.reason === 'booked' ? `Shown because you've booked ${profile.name}${venueContact.bookedDate ? ` for ${venueContact.bookedDate}` : ''}.` : `Shown because ${profile.name} applied to ${venueLabel}.`}</p>
              </div>
            )}
            {!venueContact && !isOwner && signedInVenue && <p>Their email and phone show here if they apply to {venueLabel} or you book them. Until then, messages go to them by email.</p>}
            {!venueContact && !isOwner && !signedInVenue && <p>Messages go to the artist by email. Their contact details stay private.</p>}
            {FEATURES.pressKit && <DownloadPressKit profileId={profile.id} actName={profile.name} venueId={resolvedVenueId} booked={venueContact?.reason === 'booked'} />}
            {profile.bio && <section className="kp-section"><h2>ABOUT</h2><p>{profile.bio}</p></section>}
            {sparse && <p>{profile.name} is new on Gigin. Get in touch to hear more.</p>}
            {(profile.spotifyUrl || profile.youtubeUrl) && (
              <section className="kp-section">
                <h2>MUSIC AND VIDEO</h2>
                {profile.spotifyUrl && <a className="kp-card" href={profile.spotifyUrl} target="_blank" rel="noreferrer">Spotify</a>}
                {video && !videoOn && <button type="button" className="kp-card" onClick={() => setVideoOn(true)}>Play video</button>}
                {video && videoOn && <iframe title="Video" src={`https://www.youtube.com/embed/${video}`} style={{ width: '100%', aspectRatio: '16/9', border: 0 }} allow="autoplay" />}
              </section>
            )}
            {members.length > 0 && (
              <section className="kp-section">
                <h2>BAND</h2>
                {members.map((member) => <p key={member.name}><strong>{member.name}</strong> {(member.instruments || []).join(', ')}</p>)}
              </section>
            )}
          </div>
          <aside className="kp-aside">
            {(needs.length > 0 || bring.length > 0) && (
              <section className="kp-card">
                <h2>TECH RIDER</h2>
                {needs.length > 0 && <p>Needs from the venue</p>}
                <div className="kp-chips">{needs.map((item) => <span className="kp-chip" key={item}>{item}</span>)}</div>
                {bring.length > 0 && <p>Brings their own</p>}
                <div className="kp-chips">{bring.map((item) => <span className="kp-chip-dark" key={item}>{item}</span>)}</div>
              </section>
            )}
            {(profile.playedAt || []).length > 0 && (
              <section className="kp-card">
                <h2>PLAYED AT</h2>
                {profile.playedAt.map((row) => (
                  <p key={`${row.venueId}-${row.gigId}`}>{row.venueName}{row.city ? `, ${row.city}` : ''} · {row.date || ''} · confirmed by the venue</p>
                ))}
              </section>
            )}
          </aside>
        </div>
        <footer>
          <p>Artist profile on gigin.</p>
          <a href="mailto:toby@giginmusic.com?subject=Report%20a%20profile">Report this profile</a>
        </footer>
      </div>
      {contactOpen && (
        <Sheet title="Contact the act" onClose={() => setContactOpen(false)}>
          {sent ? <p>Sent. {profile.name} will reply to your email.</p> : (
            <form onSubmit={async (event) => {
              event.preventDefault();
              await contactArtist(profile.slug, form);
              setSent(true);
            }}>
              <p>We'll send this to the artist by email with your email address, so they can reply to you. Their contact details stay private.</p>
              <label className="kp-field">Your name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label className="kp-field">Your email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label className="kp-field">Venue or event (optional)<input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></label>
              <label className="kp-field">Message<textarea required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
              <button type="submit" className="kp-btn">Send</button>
            </form>
          )}
        </Sheet>
      )}
      {share && (
        <Sheet title="Share" onClose={() => setShare(false)}>
          <a href={`https://wa.me/?text=${encodeURIComponent(url)}`}>WhatsApp</a>
          <p>For Instagram we copy the link so you can paste it into your bio or a DM.</p>
          <CopyButton text={url} label="Copy link" />
        </Sheet>
      )}
    </div>
  );
}

function shareProfileFallback(url) {
  if (navigator.share) {
    navigator.share({ url }).catch(() => {});
    return false;
  }
  return true;
}

export function ProfileUnavailable() {
  return (
    <div className="kp">
      <div className="kp-wrap">
        <h1>This profile isn't available</h1>
      </div>
    </div>
  );
}
