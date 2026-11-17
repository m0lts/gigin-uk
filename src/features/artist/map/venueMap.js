export function mapVenue(venue, source) {
  return {
    id: venue.venueId || venue.id || venue.name,
    name: venue.name || 'Venue',
    city: venue.city || venue.addressCity || '',
    address: venue.address || venue.formattedAddress || '',
    source,
  };
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
