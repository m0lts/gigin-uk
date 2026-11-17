export function mapCoordinates(venue) {
  if (Array.isArray(venue?.coordinates) && venue.coordinates.length === 2) {
    const [lng, lat] = venue.coordinates;
    if (typeof lng === 'number' && typeof lat === 'number') return [lng, lat];
  }
  if (typeof venue?.lng === 'number' && typeof venue?.lat === 'number') return [venue.lng, venue.lat];
  const point = venue?.geopoint;
  const lat = point?._lat ?? point?.latitude;
  const lng = point?._long ?? point?.longitude;
  if (typeof lat === 'number' && typeof lng === 'number') return [lng, lat];
  return null;
}

export function mapVenue(venue, source) {
  return {
    id: venue.venueId || venue.id || venue.name,
    name: venue.name || 'Venue',
    city: venue.city || venue.addressCity || '',
    address: venue.address || venue.formattedAddress || '',
    note: venue.note || '',
    source,
    coordinates: mapCoordinates(venue),
  };
}

export function filterMapVenues(venues, { query = '', source = 'all' } = {}) {
  return filterVenues(venues, query).filter((venue) => source === 'all' || venue.source === source);
}

export function combineVenues(giginVenues, extraVenues) {
  const seen = new Set();
  const rows = [];
  for (const venue of [...(giginVenues || []), ...(extraVenues || [])]) {
    const key = String(venue.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(venue);
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function filterVenues(venues, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return venues || [];
  return (venues || []).filter((venue) => `${venue.name} ${venue.city} ${venue.address}`.toLowerCase().includes(needle));
}
