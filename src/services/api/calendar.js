import { post } from '../http';

/**
 * Get or create a calendar feed URL for the given venue IDs.
 * Returns { feedUrl, token, venueIds } for use in "Subscribe to calendar" (iCal/ICS).
 */
export async function getCalendarFeedUrl({ venueIds }) {
  const data = await post('/calendar/feed-token', { body: { venueIds } });
  return data?.data ?? data;
}
