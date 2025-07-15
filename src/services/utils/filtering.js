import { Timestamp } from 'firebase/firestore';

/**
 * Filters a list of gigs to only include gigs with a future date.
 *
 * @param {Array<Object>} gigs - Array of gig objects, each with a `date` field (Firestore Timestamp).
 * @returns {Array<Object>} - Filtered array of gigs with dates in the future.
 */
export const filterFutureGigs = (gigs) => {
  const now = Timestamp.now();
  return gigs.filter(gig => gig.date > now);
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
    const date = new Date(`${gig.date.toDate().toISOString().split('T')[0]}T${gig.startTime}`);
    return (
      date > weekAgo &&
      date <= now &&
      !localStorage.getItem(`reviewedGig-${gig.gigId}`) &&
      !gig.venueHasReviewed &&
      gig.applicants?.some((a) => a.status === 'confirmed')
    );
  });
};