import { useState, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton';
import { NewTabIcon, StarIcon } from '@features/shared/ui/extras/Icons';
import { fetchMusicianTestimonials, fetchProfileReviews } from '@services/reviews';
import { formatDate } from '@services/utils/dates';
import { openInNewTab } from '@services/utils/misc';
import { EmptyIcon } from '../../shared/ui/extras/Icons';

export const ReviewsTab = ({ profile, viewingOwnProfile, setShowPreview }) => {
    const [reviews, setReviews] = useState([]);
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        const loadReviewsAndTestimonials = async () => {
          try {
            const [fetchedReviews, fetchedTestimonials] = await Promise.all([
              fetchProfileReviews({
                profileId: profile.musicianId,
                profileType: 'musician',
                writtenBy: 'venue'
              }),
              fetchMusicianTestimonials(profile.musicianId)
            ]);
            setReviews(fetchedReviews);
            setTestimonials(fetchedTestimonials);
          } catch (error) {
            console.error('Error loading reviews or testimonials:', error);
          } finally {
            setLoading(false);
          }
        };
        loadReviewsAndTestimonials();
      }, [profile]);

    if (reviews.length < 1 && testimonials.length < 1) {
        return (
            <div className="nothing-to-display">
                <EmptyIcon />
                {viewingOwnProfile ? (
                    <>
                        <h4>More information will show here when you complete your profile.</h4>
                        <button className="btn primary" onClick={() => setShowPreview(false)}>
                            Finish Profile
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


    if (profile.reviews && profile.reviews.length > 0) {
        return (
            <ul className='musician-profile-reviews'>
                {loading ? (
                    Array(Math.min(3, profile.reviews.length))
                    .fill(0)
                    .map((_, index) => (
                        <li key={`skeleton-${index}`}>
                            <Skeleton width={'100%'} height={100} />
                        </li>
                    ))
                ) : (
                    reviews.map((review) => (
                        <li key={review.id} className='review-cont'>
                            <div className='reviewer'>
                                <div className='left'>
                                    <figure className='reviewer-img-cont'>
                                        <img src={review.venue.photos[0]} alt={review.venue.name} className='reviewer-img' />
                                    </figure>
                                    <div className='reviewer-name-and-stars'>
                                        <h2>{review.venue.name}</h2>
                                        <div className='stars'>
                                            {Array.from({ length: review.rating }).map((_, index) => (
                                                <StarIcon key={index} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className='right'>
                                    <button className='btn secondary' onClick={(e) => openInNewTab(`/gig/${review.gigId}`, e)}>
                                        View Gig <NewTabIcon />
                                    </button>
                                    <h4>{formatDate(review.timestamp)}</h4>
                                </div>
                            </div>
                            {review.reviewText && (
                                <p className='review-text'>
                                    {review.reviewText}
                                </p>
                            )}
                        </li>
                    ))
                )}
            </ul>
        );
    } else if (testimonials && testimonials.length > 0) {
        return (
            <ul className='reviews'>
                {testimonials.map((testimonial, index) => (
                    <li key={index} className='testimonial-cont'>
                        <h6>Testimonial</h6>
                        <div className='heading'>
                            <h3>{testimonial.testimonial.title}</h3>
                            <h6>{formatDate(testimonial.testimonial.submittedAt)}</h6>
                        </div>
                        <p className='testimonial-text'>
                            {testimonial.testimonial.message}
                        </p>
                    </li>
                ))}
            </ul>
        );
    } else {
        return (
            <div className='no-reviews'>
                <h4>No reviews or testimonials to show.</h4>
            </div>
        );
    }
};