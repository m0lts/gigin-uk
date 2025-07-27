import { Timestamp } from 'firebase/firestore';

export const getLocalGigDateTime = (gig) => {
  const dateObj = gig.date.toDate(); // Firestore Timestamp
  const [hours, minutes] = gig.startTime.split(':').map(Number);
  dateObj.setHours(hours);
  dateObj.setMinutes(minutes);
  dateObj.setSeconds(0);
  dateObj.setMilliseconds(0);
  return dateObj;
};

/**
 * Filters a list of gigs to only include gigs with a future date.
 *
 * @param {Array<Object>} gigs - Array of gig objects, each with a `date` field (Firestore Timestamp).
 * @returns {Array<Object>} - Filtered array of gigs with dates in the future.
 */
export const filterFutureGigs = (gigs) => {
  const now = Date.now();

  return gigs
    .filter(gig => getLocalGigDateTime(gig) > now)
    .sort((a, b) => getLocalGigDateTime(a) - getLocalGigDateTime(b));
};

/**
 * Filters gigs to only include future gigs the musician has NOT applied to.
 *
 * @param {Array<Object>} gigs - Array of gig objects.
 * @param {string} musicianId - The musician's ID.
 * @returns {Array<Object>} - Gigs in the future the musician hasn't applied to.
 */
export const filterFutureUnappliedGigsForMusician = (gigs, musicianId) => {
    return filterFutureGigs(gigs).filter(gig =>
      !gig.applicants?.some(applicant => applicant.id === musicianId)
    );
  };

/**
 * Filters gigs to only include those the musician has applied to, regardless of application status.
 *
 * @param {Array<Object>} gigs - Array of gig objects.
 * @param {string} musicianId - ID of the musician to check applications for.
 * @returns {Array<Object>} - Array of gigs the musician has applied to.
 */
export const filterAppliedGigsForMusician = (gigs, musicianId) => {
    return gigs.filter(gig =>
      gig.applicants?.some(applicant => applicant.id === musicianId)
    );
};

/**
 * Filters gigs to those in the future that the musician hasn't already applied to (unless declined).
 *
 * @param {Array<Object>} gigs - Array of gig objects.
 * @param {string} musicianId - The musician's ID.
 * @returns {Array<Object>} - Array of gigs that are in the future and available to apply.
 */
export const filterInvitableGigsForMusician = (gigs, musicianId) => {
    return filterFutureGigs(gigs).filter(gig => 
      !gig.applicants?.some(applicant =>
        applicant.id === musicianId && applicant.status !== 'Declined'
      )
    );
};


export const getPendingGigsToReview = (gigs) => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return gigs.filter((gig) => {
    const date = getLocalGigDateTime(gig);
    return (
      date > weekAgo &&
      date <= now &&
      !localStorage.getItem(`reviewedGig-${gig.gigId}`) &&
      !gig.venueHasReviewed &&
      gig.applicants?.some((a) => a.status === 'confirmed')
    );
  });
};

export const getUnreviewedPastGigs = (gigs) => {
  const now = new Date();
  return gigs.filter((gig) => {
    const date = getLocalGigDateTime(gig);
    return (
      date <= now
      &&
      !gig.venueHasReviewed &&
      gig.applicants?.some((a) => a.status === 'confirmed')
    );
  });
};

export const mergeAndSortConversations = (prevConversations, newUpdates) => {
  const merged = [...prevConversations];

  newUpdates.forEach((newConv) => {
    const index = merged.findIndex(c => c.id === newConv.id);
    if (index !== -1) {
      merged[index] = newConv;
    } else {
      merged.push(newConv);
    }
  });

  return merged.sort((a, b) => {
    const aTime = a.lastMessageTimestamp?.seconds || 0;
    const bTime = b.lastMessageTimestamp?.seconds || 0;
    return bTime - aTime;
  });
};