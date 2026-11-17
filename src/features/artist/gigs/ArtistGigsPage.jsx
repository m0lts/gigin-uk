import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FEATURES } from '../../../config/features';
import { dayKey, diaryNote, monthGrid, splitGigs, toggleDayOff } from './artistGigs';
import { useArtistHome } from '../home/ArtistShell';
import '../../venue/desk/venue-desk.css';

const OFF_KEY = 'gigin.daysOff';
const NOTES_KEY = 'gigin.gigDiary';

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; }
}

export function ArtistGigsPage() {
  const data = useArtistHome();
  const [tab, setTab] = useState('upcoming');
  const [cursor, setCursor] = useState(() => new Date());
  const [daysOff, setDaysOff] = useState(() => read(OFF_KEY, []));
  const [notes, setNotes] = useState(() => read(NOTES_KEY, {}));
  const [openId, setOpenId] = useState('');
  const split = splitGigs(data?.gigs || []);
  const rows = tab === 'past' ? split.past : tab === 'applied' ? split.applied : split.upcoming;
  const days = monthGrid(cursor.getFullYear(), cursor.getMonth());

  const toggle = (date) => {
    const next = toggleDayOff(daysOff, dayKey(date));
    setDaysOff(next);
    localStorage.setItem(OFF_KEY, JSON.stringify(next));
  };

  const saveNote = (gigId, value) => {
    const next = { ...notes, [gigId]: value };
    setNotes(next);
    localStorage.setItem(NOTES_KEY, JSON.stringify(next));
  };

  return (
    <div className="p-desk">
      <h1>Gigs</h1>
      <div className="p-tabs">
        {['upcoming', 'applied', 'past'].map((id) => (
          <button type="button" key={id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{id[0].toUpperCase() + id.slice(1)}</button>
        ))}
      </div>
      <ul>
        {rows.map((gig) => {
          const id = gig.gigId || gig.id;
          return (
            <li key={id}>
              <button type="button" onClick={() => setOpenId(id)}>
                <strong>{gig.gigName || gig.name || 'Gig'}</strong>
                <span>{gig.venueName || ''}</span>
              </button>
              {FEATURES.venueJoin ? <Link to={`/venues/join?from=${encodeURIComponent(gig.gigName || gig.name || '')}&venue=${encodeURIComponent(gig.venueName || '')}`}>This is my venue</Link> : null}
              {openId === id ? (
                <label>Diary
                  <textarea value={diaryNote(notes, id)} onChange={(event) => saveNote(id, event.target.value)} />
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!rows.length ? <p className="p-empty">No gigs in this list.</p> : null}
      <section className="p-card">
        <header className="p-card__row">
          <h2>{cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
          <span>
            <button type="button" className="p-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Previous</button>
            <button type="button" className="p-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next</button>
          </span>
        </header>
        <p className="p-muted">Click a day to mark it as a day off.</p>
        <div className="p-month">
          {days.map((date) => {
            const key = dayKey(date);
            const inMonth = date.getMonth() === cursor.getMonth();
            return (
              <button type="button" key={key + date.getMonth()} className={`${inMonth ? '' : 'is-out'}${daysOff.includes(key) ? ' is-off' : ''}`} onClick={() => toggle(date)}>
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
