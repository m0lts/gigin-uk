import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { firestore } from '../../../../firebase';
import Skeleton from 'react-loading-skeleton';
import { NewTabIcon, StarIcon } from '../../../../components/ui/Extras/Icons';

export const ReviewsTab = ({ profile }) => {
    const [reviews, setReviews] = useState([]);
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReviews = async () => {
            if (!profile) return;
            try {
                const reviewsRef = collection(firestore, 'reviews');
                const q = query(
                    reviewsRef,
                    where('musicianId', '==', profile.musicianId),
                    where('reviewWrittenBy', '==', 'venue')
                );
                const querySnapshot = await getDocs(q);
                const fetchedReviews = await Promise.all(
                    querySnapshot.docs.map(async (reviewDoc) => {
                        const reviewData = { id: reviewDoc.id, ...reviewDoc.data() };
                        if (reviewData.venueId) {
                            const venueRef = doc(firestore, 'venueProfiles', reviewData.venueId);
                            const venueSnapshot = await getDoc(venueRef);
                            if (venueSnapshot.exists()) {
                                reviewData.venue = { id: venueSnapshot.id, ...venueSnapshot.data() };
                            } else {
                                console.warn(`Venue not found for venueId: ${reviewData.venueId}`);
                            }
                        }
    
                        return reviewData;
                    })
                );
                const testimonialsRef = collection(firestore, 'testimonials');
                const testimonialsQuery = query(
                    testimonialsRef,
                    where('musicianId', '==', profile.musicianId)
                );
                const testimonialsSnapshot = await getDocs(testimonialsQuery);
                setTestimonials(testimonialsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
                setReviews(fetchedReviews);
            } catch (error) {
                console.error('Error fetching reviews:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, [profile]);

    const formatDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        const getOrdinalSuffix = (day) => {
            if (day > 3 && day < 21) return 'th';
            switch (day % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        };
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    }

    const openGig = (gigId) => {
        const url = `/gig/${gigId}`;
        window.open(url, '_blank');
    };

    if (profile.reviews && profile.reviews.length > 0) {
        return (
            <ul className="reviews">
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
                            <div className="reviewer">
                                <div className="left">
                                    <figure className="reviewer-img-cont">
                                        <img src={review.venue.photos[0]} alt={review.venue.name} className="reviewer-img" />
                                    </figure>
                                    <div className="reviewer-name-and-stars">
                                        <h2>{review.venue.name}</h2>
                                        <div className="stars">
                                            {Array.from({ length: review.rating }).map((_, index) => (
                                                <StarIcon key={index} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="right">
                                    <button className="btn secondary" onClick={() => openGig(review.gigId)}>
                                        View Gig <NewTabIcon />
                                    </button>
                                    <h4>{formatDate(review.timestamp)}</h4>
                                </div>
                            </div>
                            {review.reviewText && (
                                <p className="review-text">
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
            <ul className="reviews">
                {testimonials.map((testimonial, index) => (
                    <li key={index} className='testimonial-cont'>
                        <h6>Testimonial</h6>
                        <div className="heading">
                            <h3>{testimonial.testimonial.title}</h3>
                            <h6>{formatDate(testimonial.testimonial.submittedAt)}</h6>
                        </div>
                        <p className="testimonial-text">
                            {testimonial.testimonial.message}
                        </p>
                    </li>
                ))}
            </ul>
        );
    } else {
        return (
            <div className="no-reviews">
                <h4>No reviews or testimonials to show.</h4>
            </div>
        );
    }
};