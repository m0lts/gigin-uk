import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getArtistHome, getProfileSession } from '@services/client-side/keepProfile';
import { daysUntil } from './artistJoin';
import { copyText } from '../../venue/home/publicLinks';
import '../../venue/desk/venue-desk.css';

export function useArtistHome() {
  const [data, setData] = useState(null);
  useEffect(() => {
    Promise.all([getArtistHome().catch(() => null), getProfileSession().catch(() => null)]).then(([home, session]) => {
      setData({
        profile: home?.profile || session?.profile || null,
        gigs: home?.gigs || [],
        applications: home?.applications || [],
      });
    });
  }, []);
  return data;
}

export function ArtistShell() {
  return (
    <div className="p-artist">
      <header className="p-artist__top">
        <NavLink to="/home" className="p-word">gigin<span>.</span></NavLink>
        <nav>
          <NavLink to="/home" end>Dashboard</NavLink>
          <NavLink to="/home/map">Map</NavLink>
        </nav>
      </header>
      <div className="p-artist__body">
        <aside>
          {[
            ['/home', 'Home'],
            ['/home/gigs', 'Gigs'],
            ['/home/invoices', 'Invoices'],
            ['/home/profile', 'Profile'],
            ['/home/pitches', 'Pitches'],
            ['/home/contacts', 'Contacts'],
          ].map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/home'}>{label}</NavLink>
          ))}
        </aside>
        <Outlet />
      </div>
    </div>
  );
}

export function ArtistDashboard() {
  const data = useArtistHome();
  const navigate = useNavigate();
  const profile = data?.profile;
  const next = (data?.gigs || [])[0];
  const days = daysUntil(next?.date?.toDate?.() || next?.date);
  const first = String(profile?.name || 'there').split(' ')[0];
  const link = profile?.slug ? `https://giginmusic.com/artist/${profile.slug}` : '';
  return (
    <div className="p-desk">
      <header className="p-card__row">
        <div>
          <h1>Hi {first}</h1>
          <p className="p-muted">{days != null && days >= 0 ? `Your next gig is in ${days} days.` : 'Your gigs and enquiries show up here.'}</p>
        </div>
        <button type="button" className="p-btn p-btn--dark" onClick={() => navigate('/home/pitches')}>Pitch a venue</button>
      </header>
      {next ? (
        <section className="p-card">
          <p className="p-muted">Next gig</p>
          <h2>{next.gigName || next.name || 'Gig'}</h2>
          <p>{next.venueName || ''}</p>
        </section>
      ) : null}
      <section className="p-card">
        <h2>Your profile</h2>
        <p>{profile?.name || 'Your page is not live yet.'}</p>
        {link ? <button type="button" className="p-btn" onClick={() => copyText(link)}>Copy link</button> : <button type="button" className="p-btn" onClick={() => navigate('/artists/join')}>Create your page</button>}
      </section>
    </div>
  );
}

export function ArtistSection({ title, children }) {
  return (
    <div className="p-desk">
      <h1>{title}</h1>
      {children || <p className="p-muted">Nothing here yet.</p>}
    </div>
  );
}
