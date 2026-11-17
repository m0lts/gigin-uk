import { useState } from 'react';
import { cyclePitchStatus, pitchMailto } from './pitches';
import { useArtistHome } from '../home/ArtistShell';
import '../../venue/desk/venue-desk.css';

const KEY = 'gigin.pitches';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function PitchesPage() {
  const data = useArtistHome();
  const [pitches, setPitches] = useState(read);
  const [draft, setDraft] = useState({ venueName: '', email: '', note: '' });
  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  const profile = data?.profile;
  const save = (list) => {
    setPitches(list);
    localStorage.setItem(KEY, JSON.stringify(list));
  };
  const open = () => {
    const pitch = { id: `${Date.now()}`, venueName: draft.venueName, email: draft.email, status: 'sent', note: draft.note };
    save([pitch, ...pitches]);
    window.location.href = pitchMailto({
      email: pitch.email,
      venueName: pitch.venueName,
      artistName: profile?.name,
      bio: pitch.note || profile?.bio,
      link: profile?.slug ? `https://giginmusic.com/artist/${profile.slug}` : '',
    });
  };
  return (
    <div className="p-desk">
      <h1>Pitches</h1>
      <p className="p-muted">Opens in your email app. Gigin does not send it.</p>
      <section className="p-card">
        <label>Venue<input value={draft.venueName} onChange={set('venueName')} /></label>
        <label>Email<input value={draft.email} onChange={set('email')} /></label>
        <label>Note<textarea value={draft.note} onChange={set('note')} /></label>
        <button type="button" className="p-btn p-btn--dark" onClick={open}>Open pitch</button>
      </section>
      <ul>
        {pitches.map((pitch) => (
          <li key={pitch.id}>
            <strong>{pitch.venueName}</strong>
            <button type="button" className="p-btn" onClick={() => save(pitches.map((item) => item.id === pitch.id ? { ...item, status: cyclePitchStatus(item.status) } : item))}>{pitch.status}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ArtistContactsPage() {
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gigin.artistContacts') || '[]'); } catch { return []; }
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const add = () => {
    const next = [{ name, email }, ...contacts];
    setContacts(next);
    localStorage.setItem('gigin.artistContacts', JSON.stringify(next));
    setName('');
    setEmail('');
  };
  return (
    <div className="p-desk">
      <h1>Contacts</h1>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <button type="button" className="p-btn p-btn--dark" onClick={add}>Add</button>
      <ul>{contacts.map((contact) => <li key={contact.email}><strong>{contact.name}</strong><span>{contact.email}</span></li>)}</ul>
    </div>
  );
}
