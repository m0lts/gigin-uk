import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { pressKitUnlocked, publicProfile, publicTracks } from './artistPage';
import './public-artist.css';

export function PublicArtistPage({ profile, user }) {
  const page = publicProfile(profile) || { name: '', city: '', bio: '', genres: [], link: '' };
  const tracks = publicTracks(profile);
  const photos = profile.photos || profile.gigPhotos || [];
  const hero = profile.photoUrl || profile.photoURL || photos[0]?.url || photos[0] || '';
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState('');
  const [copied, setCopied] = useState(false);
  const venueIds = (user?.venueProfiles || []).map((venue) => venue.venueId || venue.id);
  const unlocked = pressKitUnlocked({
    viewerId: user?.uid,
    ownerId: profile.userId,
    bookedVenueIds: profile.confirmedVenueIds || [],
    viewerVenueIds: venueIds,
  });
  const play = async (track) => {
    const audio = audioRef.current;
    if (!audio || !track.audioUrl) return;
    if (playing === track.id) {
      audio.pause();
      setPlaying('');
      return;
    }
    audio.src = track.audioUrl;
    try {
      await audio.play();
      setPlaying(track.id);
    } catch (error) {
      console.error(error);
      setPlaying('');
    }
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch { /* leave the address in the bar */ }
  };
  return (
    <div className="ap">
      <audio ref={audioRef} onEnded={() => setPlaying('')} />
      <header className="ap__bar">
        <Link to="/" className="ap__word">gigin<i>.</i></Link>
        <button type="button" className="ap__btn" onClick={share}>{copied ? 'Copied' : 'Share'}</button>
      </header>
      <div className="ap__wrap">
        <div className="ap__hero" style={hero ? { backgroundImage: `url(${hero})` } : undefined} />
        <div className="ap__head">
          <div>
            <p className="ap__kicker">{[page.genres[0], page.city].filter(Boolean).join(' · ')}</p>
            <h1>{page.name || 'Artist'}</h1>
            {page.bio ? <p>{page.bio.split('\n')[0]}</p> : null}
          </div>
            {tracks[0]?.audioUrl ? (
            <button type="button" className="ap__btn" onClick={() => play(tracks[0])}>{playing === tracks[0].id ? 'Playing' : 'Play'} {tracks[0].title}</button>
          ) : null}
        </div>
        <div className="ap__actions">
          <Link className="ap__btn ap__btn--dark" to={`/artist/${profile.id || profile.profileId}/enquire`}>Book {page.name.split(' ')[0] || 'them'}</Link>
          {unlocked ? <button type="button" className="ap__btn" onClick={() => window.print()}>Booking pack</button> : <p className="ap__locked">Booking pack stays locked until a venue has booked you.</p>}
        </div>
        {page.bio ? <section className="ap__bio"><h2>In {page.name.split(' ')[0] || 'their'} words</h2><p>{page.bio}</p></section> : null}
        {tracks.length ? (
          <section className="ap__listen">
            <h2>Listen</h2>
            {tracks.map((track) => (
              <div className="ap__track" key={track.id}>
                <button type="button" className="ap__btn" onClick={() => play(track)} disabled={!track.audioUrl}>{playing === track.id ? 'Playing' : 'Play'} {track.title}</button>
                <span className="ap__muted">{track.length}</span>
              </div>
            ))}
          </section>
        ) : null}
        {photos.length ? (
          <section>
            <h2>Live</h2>
            <div className="ap__live">
              {photos.slice(0, 2).map((photo, index) => {
                const src = photo.url || photo;
                return <div className="ap__shot" key={src || index} style={{ backgroundImage: `url(${src})` }} />;
              })}
            </div>
          </section>
        ) : null}
        <section className="ap__book">
          <div>
            <p className="ap__kicker">For bookers</p>
            <h2>Book {page.name.split(' ')[0] || 'them'} for your night</h2>
            <p>Send a booking enquiry. They reply from their own email.</p>
          </div>
          <div>
            {page.city ? <p>Based in {page.city}</p> : null}
            {page.genres.length ? <p>{page.genres.join(', ')}</p> : null}
            {page.link ? <p><a href={page.link}>Music link</a></p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
