import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getArtistCRMEntries } from '@services/client-side/artistCRM';
import { AddContactModal } from '../dashboard/AddContactModal';
import { copyText } from '../home/publicLinks';
import { contactHasPromo, filterContacts, initials, promoKitSummary } from './venueDesk';
import './venue-desk.css';

const TABS = [
  ['all', 'All'],
  ['want', 'Want to book'],
  ['played', 'Played here'],
  ['booked', 'Booked'],
  ['applied', 'Applied'],
  ['promo', 'Missing promo'],
];

export function ContactsBoard({ user }) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [tab, setTab] = useState('all');
  const [kind, setKind] = useState('artists');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let live = true;
    const load = () => getArtistCRMEntries(user.uid).then((rows) => { if (live) setContacts(rows || []); }).catch(() => { if (live) setContacts([]); });
    load();
    return () => { live = false; };
  }, [user?.uid]);

  const shown = useMemo(() => filterContacts(contacts, { tab, query, kind }), [contacts, tab, query, kind]);
  const selected = shown.find((contact) => (contact.id || contact.name) === selectedId) || shown[0] || null;
  const kit = selected ? promoKitSummary(selected) : null;

  return (
    <div className="p-desk p-contacts">
      <header className="p-card__row">
        <h1>Contacts</h1>
        <span>
          <button type="button" className={`p-btn${kind === 'artists' ? ' p-btn--dark' : ''}`} onClick={() => setKind('artists')}>Artists</button>
          <button type="button" className={`p-btn${kind === 'crew' ? ' p-btn--dark' : ''}`} onClick={() => setKind('crew')}>Crew</button>
          <button type="button" className="p-btn p-btn--dark" onClick={() => setAdding(true)}>+ Add contact</button>
        </span>
      </header>
      <div className="p-tabs">
        {TABS.map(([id, label]) => (
          <button type="button" key={id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="p-contacts__grid">
        <section className="p-card">
          <input value={query} placeholder="Search by name or role" onChange={(event) => setQuery(event.target.value)} />
          <ul>
            {shown.map((contact) => {
              const id = contact.id || contact.name;
              return (
                <li key={id}>
                  <button type="button" className={selected && (selected.id || selected.name) === id ? 'is-on' : ''} onClick={() => setSelectedId(id)}>
                    <span className="p-avatar">{initials(contact.name)}</span>
                    <span>
                      <strong>{contact.name || 'Contact'}</strong>
                      <span>{contact.role || contact.city || ''}</span>
                    </span>
                    {contactHasPromo(contact) ? <span className="p-chip is-good">Promo</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {!shown.length ? <p className="p-empty">No contacts in this list.</p> : null}
        </section>
        {selected ? (
          <section className="p-card">
            <h2>{selected.name}</h2>
            <p className="p-muted">{selected.role || selected.city || ''}</p>
            {selected.email ? <p>{selected.email}</p> : null}
            {selected.phone ? <p>{selected.phone}</p> : null}
            <div className="p-inline">
              <button type="button" className="p-btn p-btn--dark" onClick={() => navigate('/venues/dashboard/gigs')}>Offer a gig</button>
              {selected.email ? <a className="p-btn" href={`mailto:${selected.email}`}>Email</a> : null}
            </div>
            {kit ? (
              <div className="p-kit">
                <header className="p-card__row">
                  <h2>Promo kit</h2>
                  <span>
                    {kit.bio ? <button type="button" className="p-btn" onClick={() => copyText(kit.bio)}>Copy bio</button> : null}
                    {selected.email ? <a className="p-btn" href={`mailto:${selected.email}?subject=Promo%20for%20your%20gig`}>Request update</a> : null}
                  </span>
                </header>
                {kit.bio ? <p>{kit.bio}</p> : null}
                {kit.photos.length ? (
                  <div className="p-kit__photos">
                    {kit.photos.map((photo, index) => {
                      const src = typeof photo === 'string' ? photo : photo.url;
                      return src ? <img key={src} src={src} alt={`Promo ${index + 1}`} /> : null;
                    })}
                  </div>
                ) : null}
                {kit.trackName || kit.trackUrl ? <p>{kit.trackName || 'Track'} {kit.trackUrl ? <a href={kit.trackUrl}>Listen</a> : null}</p> : null}
                {kit.videoUrl ? <p><a href={kit.videoUrl}>Video</a></p> : null}
              </div>
            ) : <p className="p-muted">No promo kit yet.</p>}
          </section>
        ) : null}
      </div>
      {adding && user?.uid ? (
        <AddContactModal
          userId={user.uid}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            getArtistCRMEntries(user.uid).then((rows) => setContacts(rows || [])).catch(() => {});
          }}
        />
      ) : null}
    </div>
  );
}
