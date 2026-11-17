import test from 'node:test';
import assert from 'node:assert/strict';
import { combineVenues, filterMapVenues, filterVenues, mapVenue } from './venueMap.js';

test('the map keeps Gigin venues and an edited list, without duplicating a name', () => {
  const rows = combineVenues(
    [mapVenue({ venueId: '1', name: 'Hot Numbers', city: 'Cambridge' }, 'gigin')],
    [mapVenue({ name: 'Hot Numbers', city: 'Cambridge' }, 'list'), mapVenue({ name: 'The Portland Arms', city: 'Cambridge' }, 'list')],
  );
  assert.deepEqual(rows.map((venue) => venue.name), ['Hot Numbers', 'The Portland Arms']);
  assert.equal(rows[0].source, 'gigin');
  assert.equal(filterVenues(rows, 'port')[0].name, 'The Portland Arms');
  const pinned = mapVenue({ name: 'The Portland Arms', lng: 0.14, lat: 52.21 }, 'list');
  assert.deepEqual(pinned.coordinates, [0.14, 52.21]);
  assert.equal(filterMapVenues([pinned, rows[0]], { source: 'list' }).length, 1);
});
