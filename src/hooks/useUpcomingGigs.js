import { useEffect, useState } from 'react';

/**
 * Filters and sorts upcoming gigs from a list.
 * @param {Object[]} gigs - The full list of gigs.
 * @returns {Object[]} upcomingGigs
 */
export const useUpcomingGigs = (gigs) => {
  const [upcomingGigs, setUpcomingGigs] = useState([]);

  useEffect(() => {
    if (!gigs) return;
    const now = new Date();

    const filtered = gigs
      .filter(gig => {
        const gigDate = gig.date.toDate();
        const [h, m] = gig.startTime.split(':').map(Number);
        gigDate.setHours(h, m, 0, 0);
        return gigDate > now && gig.status !== 'closed' && gig.complete;
      })
      .sort((a, b) => {
        const aDate = a.date.toDate();
        const bDate = b.date.toDate();
        aDate.setHours(...a.startTime.split(':').map(Number));
        bDate.setHours(...b.startTime.split(':').map(Number));
        return aDate - bDate;
      });

    setUpcomingGigs(filtered);
  }, [gigs]);

  return upcomingGigs;
};