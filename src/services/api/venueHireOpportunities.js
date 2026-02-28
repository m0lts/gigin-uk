import { post } from '../http';

/**
 * Venue hire opportunities – all writes go through the API (not client Firestore).
 * Base path: /api/venueHireOpportunities
 */

export function createVenueHireOpportunitiesBatch({ venueId, items }) {
  return post('/venueHireOpportunities/createBatch', { body: { venueId, items } });
}

export function updateVenueHireOpportunity(id, updates) {
  return post('/venueHireOpportunities/update', { body: { id, updates } });
}

export function deleteVenueHireOpportunity(id) {
  return post('/venueHireOpportunities/delete', { body: { id } });
}
