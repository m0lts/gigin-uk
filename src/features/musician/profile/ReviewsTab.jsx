import { useState, useEffect, useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';
import { NewTabIcon, StarIcon } from '@features/shared/ui/extras/Icons';
import { fetchMusicianTestimonials, fetchProfileReviews } from '@services/reviews';
import { formatDate } from '@services/utils/dates';
import { openInNewTab } from '@services/utils/misc';
import { EmptyIcon } from '../../shared/ui/extras/Icons';
import { useNavigate } from 'react-router-dom';
import { getGigsByIds } from '../../../services/gigs';
import { getReviewsByMusicianId } from '../../../services/reviews';
import { LoadingThreeDots } from '../../shared/ui/loading/Loading';

export const ReviewsTab = ({ profile, viewingOwnProfile, setShowPreview, bandAdmin }) => {
    const [reviews, setReviews] = useState([]);
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [previousGigs, setPreviousGigs] = useState([]);
    const [prevGigsLoading, setPrevGigsLoading] = useState(false);
    const [prevGigsError, setPrevGigsError] = useState(null);
    const navigate = useNavigate()

    const enrichedPreviousGigs = useMemo(() => {
        if (!previousGigs?.length) return [];
      
        // normalise a date-like field
        const toDateAny = (v) => {
          if (!v) return null;
          if (v instanceof Date) return v;
          if (typeof v?.toDate === 'function') return v.toDate(); // Firestore Timestamp
          if (typeof v === 'number') return new Date(v);
          return new Date(v);
        };
      
        // keep only venue-written reviews, pick the latest per gigId
        const latestVenueReviewByGigId = (reviews || [])
          .filter(r => r?.reviewWrittenBy === 'venue' && r?.gigId)
          .reduce((acc, r) => {
            const id = r.gigId;
            const curr = acc[id];
            const rDate = toDateAny(r.createdAt) ?? new Date(0);
            const cDate = curr ? (toDateAny(curr.createdAt) ?? new Date(0)) : new Date(0);
            if (!curr || rDate > cDate) acc[id] = r;
            return acc;
          }, {});
      
        return previousGigs.map(gig => {
          const gid = gig.gigId ?? gig.id; // support either field name
          return {
            ...gig,
            venueReview: latestVenueReviewByGigId[gid] || null, // single review (or null)
          };
        });
      }, [previousGigs, reviews]);

    const toDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value?.toDate === 'function') return value.toDate();
        if (typeof value === 'number') return new Date(value);
        return new Date(value);
      };
      
      useEffect(() => {
        if (!profile) return;
      
        const loadReviewsAndTestimonials = async () => {
          try {
            const fetchedReviews = await getReviewsByMusicianId(profile.musicianId);
            const fetchedTestimonials = await fetchMusicianTestimonials(profile.musicianId);
            setReviews(fetchedReviews);
            setTestimonials(fetchedTestimonials);
          } catch (error) {
            console.error('Error loading reviews or testimonials:', error);
          } finally {
            setLoading(false);
          }
        };
      
        const fetchPreviousGigs = async () => {
          if (!profile.confirmedGigs || profile.confirmedGigs.length === 0) {
            setPreviousGigs([]);
            return;
          }
          setPrevGigsLoading(true);
          setPrevGigsError(null);
          const ids = profile.confirmedGigs
          let cancelled = false;
          try {
            const gigs = await getGigsByIds(ids);
            const now = new Date();
            const pastGigs = (gigs || [])
              .filter(g => {
                const d = toDate(g?.startDateTime);
                return d && d < now;
              })
              .sort((a, b) => {
                const da = toDate(a.startDateTime)?.getTime() ?? 0;
                const db = toDate(b.startDateTime)?.getTime() ?? 0;
                return db - da;
              });
            if (!cancelled) setPreviousGigs(pastGigs);
          } catch (err) {
            console.error('Failed to fetch previous gigs:', err);
            if (!cancelled) setPrevGigsError('Failed to load previous gigs');
          } finally {
            if (!cancelled) setPrevGigsLoading(false);
          }
      
          return () => { cancelled = true; };
        };
      
        loadReviewsAndTestimonials();
        fetchPreviousGigs();
      }, [profile]);

    if (prevGigsLoading) {
        return (
            <LoadingThreeDots />
        )
    }

    if (previousGigs.length < 1) {
        return (
            <div className="nothing-to-display">
                <EmptyIcon />
                {viewingOwnProfile ? (
                    <>
                        <h4>More information will show here when you play some gigs.</h4>
                        <button className="btn primary" onClick={() => navigate('/find-a-gig')}>
                            Find Gigs
                        </button>
                    </>
                ) : (
                    <>
                        <h4>No more information to show.</h4>
                    </>
                )}
            </div>
          )
    }

    return (
        <div className="musician-profile-previous-gigs">
            {prevGigsLoading && <p>Loading previous gigs…</p>}
            {prevGigsError && <p className="error">{prevGigsError}</p>}
            {!prevGigsLoading && enrichedPreviousGigs.length === 0 && <p>No previous gigs yet</p>}

            {enrichedPreviousGigs.length > 0 && (
                <ul className="previous-gigs">
                    {enrichedPreviousGigs.map(g => {
                        const d = toDate(g.startDateTime);
                        const day = d?.toLocaleDateString('en-GB', { day: '2-digit' }) ?? '';
                        const month = d?.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() ?? '';
                        const hasVenueReview = !!g.venueReview;

                        return (
                            <li key={g.id || g.gigId} className="prev-gig-item" onClick={(e) => openInNewTab(`/gig/${g.gigId}`, e)}>
                                <div className="left">
                                    <div className="date-box">
                                        <h4 className="month">{month.toUpperCase()}</h4>
                                        <h2 className="day">{day}</h2>
                                    </div>

                                    <button className="btn tertiary venue-info" onClick={(e) => {openInNewTab(`/venues/${g.venueId}`, e)}}>
                                        <img src={g.venue.photo} alt={g.venue.venueName} className="venue-img" />
                                        <h4 className="venue-name">{g.venue.venueName}</h4>
                                    </button>
                                </div>

                                <div className={`right ${hasVenueReview ? 'review' : 'no-review'}`}>
                                    {hasVenueReview ? (
                                        <>
                                            <div className="rating">
                                                {[...Array(g.venueReview.rating)].map((_, i) => (
                                                    <StarIcon key={i} />
                                                ))}
                                            </div>
                                            <div className="review-text">
                                                <p>{g.venueReview.reviewText}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="badge no-review">No Venue Review</span>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
                )}
        </div>
    )


    // if (profile.reviews && profile.reviews.length > 0) {
    //     return (
    //         <ul className='musician-profile-reviews'>
    //             {loading ? (
    //                 Array(Math.min(3, profile.reviews.length))
    //                 .fill(0)
    //                 .map((_, index) => (
    //                     <li key={`skeleton-${index}`}>
    //                         <Skeleton width={'100%'} height={100} />
    //                     </li>
    //                 ))
    //             ) : (
    //                 reviews.map((review) => (
    //                     <li key={review.id} className='review-cont'>
    //                         <div className='reviewer'>
    //                             <div className='left'>
    //                                 <figure className='reviewer-img-cont'>
    //                                     <img src={review.venue.photos[0]} alt={review.venue.name} className='reviewer-img' />
    //                                 </figure>
    //                                 <div className='reviewer-name-and-stars'>
    //                                     <h2>{review.venue.name}</h2>
    //                                     <div className='stars'>
    //                                         {Array.from({ length: review.rating }).map((_, index) => (
    //                                             <StarIcon key={index} />
    //                                         ))}
    //                                     </div>
    //                                 </div>
    //                             </div>
    //                             <div className='right'>
    //                                 <button className='btn secondary' onClick={(e) => openInNewTab(`/gig/${review.gigId}`, e)}>
    //                                     View Gig <NewTabIcon />
    //                                 </button>
    //                                 <h4>{formatDate(review.timestamp)}</h4>
    //                             </div>
    //                         </div>
    //                         {review.reviewText && (
    //                             <p className='review-text'>
    //                                 {review.reviewText}
    //                             </p>
    //                         )}
    //                     </li>
    //                 ))
    //             )}
    //         </ul>
    //     );
    // } else if (testimonials && testimonials.length > 0) {
    //     return (
    //         <ul className='reviews'>
    //             {testimonials.map((testimonial, index) => (
    //                 <li key={index} className='testimonial-cont'>
    //                     <h6>Testimonial</h6>
    //                     <div className='heading'>
    //                         <h3>{testimonial.testimonial.title}</h3>
    //                         <h6>{formatDate(testimonial.testimonial.submittedAt)}</h6>
    //                     </div>
    //                     <p className='testimonial-text'>
    //                         {testimonial.testimonial.message}
    //                     </p>
    //                 </li>
    //             ))}
    //         </ul>
    //     );
    // } else {
    //     return (
    //         <div className='no-reviews'>
    //             <h4>No reviews or testimonials to show.</h4>
    //         </div>
    //     );
    // }
};