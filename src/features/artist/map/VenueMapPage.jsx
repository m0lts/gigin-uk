import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { firestore } from '@lib/firebase';
import extraVenues from '../../../data/extraVenues.json';
import { combineVenues, filterVenues, mapVenue } from './venueMap';
import '../../venue/desk/venue-desk.css';

export function VenueMapPage() {
  const [venues, setVenues] = useState(() => extraVenues.map((venue) => mapVenue(venue, 'list')));
  const [search, setSearch] = useState('');
  useEffect(() => {
    getDocs(query(collection(firestore, 'venueProfiles'), where('approvalStatus', '==', 'approved'), limit(80)))
      .then((snap) => {
        const gigin = snap.docs.map((item) => mapVenue({ venueId: item.id, ...item.data() }, 'gigin'));
        setVenues(combineVenues(gigin, extraVenues.map((venue) => mapVenue(venue, 'list'))));
      })
      .catch((error) => console.error(error));
  }, []);
  const shown = filterVenues(venues, search);
  return (
    <div className="p-desk">
      <h1>Map</h1>
      <p className="p-muted">Venues on Gigin, plus the list in src/data/extraVenues.json. Nothing is scraped.</p>
      <input value={search} placeholder="Search by name or city" onChange={(event) => setSearch(event.target.value)} />
      <ul>
        {shown.map((venue) => (
          <li key={`${venue.source}-${venue.id}`}>
            <strong>{venue.name}</strong>
            <span>{venue.city || venue.address}</span>
            <span className="p-chip">{venue.source === 'gigin' ? 'On Gigin' : 'List'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
