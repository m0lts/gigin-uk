import test from 'node:test';
import assert from 'node:assert/strict';
import { combineVenues, filterVenues, mapVenue } from './venueMap.js';

test('the map keeps Gigin venues and an edited list, without duplicating a name', () => {
  const rows = combineVenues(
    [mapVenue({ venueId: '1', name: 'Hot Numbers', city: 'Cambridge' }, 'gigin')],
    [mapVenue({ name: 'Hot Numbers', city: 'Cambridge' }, 'list'), mapVenue({ name: 'The Portland Arms', city: 'Cambridge' }, 'list')],
  );
  assert.deepEqual(rows.map((venue) => venue.name), ['Hot Numbers', 'The Portland Arms']);
  assert.equal(rows[0].source, 'gigin');
  assert.equal(filterVenues(rows, 'port')[0].name, 'The Portland Arms');
});
