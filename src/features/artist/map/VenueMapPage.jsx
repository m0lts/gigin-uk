import { useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { firestore } from '@lib/firebase';
import { useMapbox } from '@hooks/useMapbox';
import extraVenues from '../../../data/extraVenues.json';
import { combineVenues, filterMapVenues, mapVenue } from './venueMap';
import '../../venue/desk/venue-desk.css';
import './artist-map.css';

export function VenueMapPage() {
  const [venues, setVenues] = useState(() => extraVenues.map((venue) => mapVenue(venue, 'list')));
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [selected, setSelected] = useState('');
  const mapRef = useRef(null);
  useEffect(() => {
    getDocs(query(collection(firestore, 'venueProfiles'), where('approvalStatus', '==', 'approved'), limit(80)))
      .then((snap) => {
        const gigin = snap.docs.map((item) => mapVenue({ venueId: item.id, ...item.data() }, 'gigin'));
        setVenues(combineVenues(gigin, extraVenues.map((venue) => mapVenue(venue, 'list'))));
      })
      .catch((error) => console.error(error));
  }, []);
  const shown = filterMapVenues(venues, { query: search, source });
  const markers = shown.filter((venue) => venue.coordinates).map((venue) => ({
    id: venue.id,
    coordinates: venue.coordinates,
    color: venue.source === 'gigin' ? '#111317' : '#FF6C4B',
  }));
  const active = shown.find((venue) => venue.id === selected) || shown[0];
  useMapbox({
    containerRef: mapRef,
    coordinates: active?.coordinates || null,
    markers,
    activeMarkerId: active?.id,
    onMarkerClick: setSelected,
    shouldInit: markers.length > 0 || Boolean(active?.coordinates),
    reinitKey: `${source}:${search}:${markers.length}`,
  });
  return (
    <div className="p-desk">
      <h1>Map</h1>
      <p className="p-muted">Venues on Gigin, plus the list you edit. Nothing is scraped.</p>
      <div className="amap">
        <div className="amap__canvas" ref={mapRef} />
        <aside className="amap__side">
          <input value={search} placeholder="Search by name or city" onChange={(event) => setSearch(event.target.value)} />
          <div className="amap__filters">
            {[['all', 'All'], ['gigin', 'On Gigin'], ['list', 'List']].map(([id, label]) => (
              <button type="button" key={id} className={`p-btn${source === id ? ' p-btn--dark' : ''}`} onClick={() => setSource(id)}>{label}</button>
            ))}
          </div>
          {active ? (
            <article className="amap__card">
              <p className="p-kicker">{active.source === 'gigin' ? 'On Gigin' : 'List'}</p>
              <h2>{active.name}</h2>
              <p>{active.city || active.address}</p>
              {active.note ? <p>{active.note}</p> : null}
              {active.source === 'gigin' ? <a href={`/venues/${active.id}`}>View page</a> : null}
            </article>
          ) : null}
          <ul>
            {shown.map((venue) => (
              <li key={`${venue.source}-${venue.id}`}>
                <button type="button" onClick={() => setSelected(venue.id)}>
                  <strong>{venue.name}</strong>
                  <span>{venue.city || venue.address}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
