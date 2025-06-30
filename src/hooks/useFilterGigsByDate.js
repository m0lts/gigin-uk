import { useMemo } from 'react';

/**
 * Filters gigs by one or more selected dates.
 * @param {Array} upcomingGigs - List of upcoming gig objects.
 * @param {Date|Date[]} selectedDates - A single date or array of dates to match gigs against.
 * @returns {Array} Filtered gigs that occur on selected date(s).
 */
export const useFilterGigsByDate = (upcomingGigs, selectedDates) => {
  return useMemo(() => {
    if (!upcomingGigs || upcomingGigs.length === 0) return [];

    const isMatch = (gigDate, targetDate) =>
      gigDate.toDateString?.() === targetDate.toDateString?.();

    const filtered = Array.isArray(selectedDates) && selectedDates.length > 0
      ? upcomingGigs.filter(gig => {
          const gigDate = gig.date.toDate?.();
          return selectedDates.some(date => isMatch(gigDate, date));
        })
      : selectedDates instanceof Date
        ? upcomingGigs.filter(gig => isMatch(gig.date.toDate?.(), selectedDates))
        : upcomingGigs;


    return filtered.filter(gig => gig.privateApplications !== true);
  }, [upcomingGigs, selectedDates]);
};