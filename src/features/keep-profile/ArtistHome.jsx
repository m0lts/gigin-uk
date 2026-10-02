import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '@styles/artists/keep-profile.styles.css';
import { FEATURES } from '../../config/features';
import { getArtistHome, getProfileSession, profileLink, updateOwnProfile } from '@services/client-side/keepProfile';
import { CopyButton } from './ui';

function first(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

function pill(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'confirmed' || value === 'accepted' || value === 'paid') return ['Confirmed', 'kp-pill-ok'];
  if (value === 'declined') return ['Not this time', 'kp-pill-muted'];
  if (value === 'withdrawn') return ['Withdrawn', 'kp-pill-muted'];
  return ['Sent · waiting', 'kp-pill-wait'];
}

export function ArtistHome({ user, logout }) {
  const [data, setData] = useState(null);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    Promise.all([getArtistHome().catch(() => null), getProfileSession().catch(() => null)]).then(([home, session]) => {
      const profile = home?.profile || session?.profile;
      if (!profile) {
        setData({ profile: null, gigs: [], applications: [] });
        return;
      }
      setData({
        profile,
        gigs: home?.gigs || [],
        applications: home?.applications || [],
        contactName: session?.contact?.contactName || profile.name,
      });
      const oldAccount = profile.userId && profile.source !== 'guest_keep' && !profile.homeWelcomeDismissedAt;
      setWelcome(Boolean(oldAccount));
    });
  }, [user]);
  if (!data) return <div className="kp"><div className="kp-wrap"><p>Loading…</p></div></div>;
  if (!data.profile) {
    return (
      <div className="kp">
        <div className="kp-wrap">
          <h1>Hi</h1>
          <p>Sign in, or open the link from your confirm email, to see your gigs and profile.</p>
        </div>
      </div>
    );
  }
  const url = data.profile.slug ? profileLink(data.profile.slug) : '';
  return (
    <div className="kp">
      <header className="kp-top">
        <span className="kp-logo">gigin.</span>
        <span>{data.profile.name} · <button type="button" className="kp-text" onClick={logout}>Sign out</button></span>
      </header>
      <div className="kp-wrap kp-public">
        <div className="kp-split">
          <div>
            <h1>Hi {first(data.contactName || data.profile.name)}</h1>
            <p>{data.profile.name}</p>
            {welcome && (
              <p className="kp-card"><strong>Welcome to the new Gigin.</strong> Your profile, applications and gigs from the old app are all here.</p>
            )}
            {welcome && <button type="button" className="kp-text" onClick={() => { setWelcome(false); updateOwnProfile({ homeWelcomeDismissed: true }).catch(() => {}); }}>Dismiss</button>}
            <h2>MY CONFIRMED GIGS</h2>
            {data.gigs.length === 0 && <p>No confirmed gigs yet. When a venue confirms you, the gig shows here.</p>}
            {data.gigs.map((gig) => (
              <article className="kp-home-gig" key={gig.gigId}>
                <p className="kp-mono">{gig.date || ''}</p>
                <strong>{gig.name}</strong>
                <p>{gig.venue}{gig.city ? `, ${gig.city}` : ''}</p>
                <span className="kp-pill kp-pill-ok">Confirmed</span>
                {gig.gigId && <Link to={`/gig/${gig.gigId}`}>Details</Link>}
              </article>
            ))}
            <h2>MY APPLICATIONS</h2>
            {data.applications.map((application) => {
              const [label, tone] = pill(application.status);
              return (
                <Link className="kp-app-row" key={application.id} to={application.gigId ? `/gig/${application.gigId}` : '/home'}>
                  <span><strong>{application.gigName || 'Gig'}</strong><br />{application.venueName} · {application.dateLabel}</span>
                  <span className={`kp-pill ${tone}`}>{label}</span>
                </Link>
              );
            })}
          </div>
          <aside className="kp-aside kp-card">
            <p className="kp-mono">MY PROFILE</p>
            <strong>{data.profile.name}</strong>
            {url && <p className="kp-mono">{url.replace('https://', '')}</p>}
            <div className="kp-links">
              {data.profile.slug && <Link to={`/artist/${data.profile.slug}`}>View</Link>}
              <Link to="/profile/edit">Edit</Link>
              {url && <CopyButton text={url} />}
            </div>
            {FEATURES.pressKit && (
              <div className="kp-row">
                <div>
                  <strong>Press kit</strong>
                  <small>Not set up yet</small>
                </div>
                <Link to="/profile/press-kit">Set up</Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
