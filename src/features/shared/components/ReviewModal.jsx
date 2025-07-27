import React, { useState, useEffect } from 'react';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { StarEmptyIcon, StarIcon } from '@features/shared/ui/extras/Icons';
import Skeleton from 'react-loading-skeleton';
import '@styles/shared/review-modal.styles.css';
import { getMusicianProfileByMusicianId, updateMusicianProfile } from '@services/musicians';
import { getVenueProfileById } from '@services/venues';
import { logDispute } from '@services/reviews';
import { updateGigDocument } from '@services/gigs';
import { sendDisputeMessage } from '@services/messages';
import { sendEmail } from '@services/emails';
import { cancelTask } from '@services/functions';
import { submitReview } from '../../../services/reviews';
import { toast } from 'sonner';

export const ReviewModal = ({ gigData, inheritedProfile = null, onClose, reviewer, setGigData }) => {
    const [loading, setLoading] = useState(!inheritedProfile);
    const [musicianProfile, setMusicianProfile] = useState(inheritedProfile);
    const [venueProfile, setVenueProfile] = useState(null);
    const [showDisputeForm, setShowDisputeForm] = useState(false);
    const [disputeText, setDisputeText] = useState('');
    const [disputeReason, setDisputeReason] = useState('');
    const [disputeSubmitted, setDisputeSubmitted] = useState(false);
    const [disputeAllowed, setDisputeAllowed] = useState(true);
    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [reviewingAfterDispute, setReviewingAfterDispute] = useState(false);

    useEffect(() => {
        if (!gigData || inheritedProfile) return;
        if (gigData.disputeClearingTime && new Date(gigData.disputeClearingTime.toDate()) > new Date() && reviewer === 'venue') {
            setDisputeAllowed(true);
        } else {
            setDisputeAllowed(false);
        }
        const fetchProfiles = async () => {
            setLoading(true);
            const confirmedApplicant = gigData.applicants.find(applicant => applicant.status === 'confirmed' || applicant.status === 'paid');
            if (confirmedApplicant) {
                try {
                    setMusicianProfile(await getMusicianProfileByMusicianId(confirmedApplicant.id));
                    setVenueProfile(await getVenueProfileById(gigData.venueId));
                } catch (error) {
                    console.error('Error fetching venue profile:', error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchProfiles();
    }, [gigData, inheritedProfile]);

    const handleDisputeSubmit = async () => {
        if (!disputeReason) return;
        if (!disputeAllowed) return;
        try {
            setLoading(true);
            const success = await cancelTask(gigData.clearPendingFeeTaskName);
            if (!success) {
                console.error('Failed to cancel task');
                setLoading(false);
            }
            if (success) {
                await logDispute({
                    musicianId: musicianProfile.musicianId,
                    gigId: gigData.gigId,
                    venueId: gigData.venueId,
                    reason: disputeReason,
                    details: disputeText || null,
                    timestamp: Date.now(),
                });
                await updateGigDocument(gigData.gigId, {
                    disputeLogged: true,
                    disputeClearingTime: null,
                    musicianFeeStatus: 'in dispute',
                    venueHasReviewed: false,
                });
                const updatedPendingFees = musicianProfile.pendingFees.map(fee =>
                    fee.gigId === gigData.gigId
                      ? { ...fee, disputeLogged: true, status: 'in dispute', disputeClearingTime: null, disputeReason }
                      : fee
                );
                await updateMusicianProfile(musicianProfile.musicianId, updatedPendingFees)
                const conversationId = await getOrCreateConversation(musicianProfile, gigData, venueProfile, 'dispute');
                await sendDisputeMessage(conversationId, gigData.venue.venueName);
                await sendEmail({
                    to: 'hq.gigin@gmail.com',
                    subject: 'Dispute Logged',
                    text: `A dispute has been logged for the gig on ${formatDate(gigData.date)}.`,
                    html: `<p>A dispute has been logged for the gig on ${formatDate(gigData.date)}.</p>`,
                })
                await sendEmail({
                    to: musicianProfile.email,
                    subject: 'Dispute Logged',
                    text: `The venue ${gigData.venue.venueName} has reported your performance at the gig on ${formatDate(gigData.date)}. We have withheld the gig fee until the dispute is resolved. We will be in touch shortly.`,
                    html: `<p>The venue ${gigData.venue.venueName} has reported your performance at the gig on ${formatDate(gigData.date)}. <br /> We have withheld the gig fee until the dispute is resolved. <br /> We will be in touch shortly.</p>`,
                });
                setLoading(false);
                setShowDisputeForm(false);
                setDisputeSubmitted(true);
                toast.success('Dispute submitted.')
            }
        } catch (error) {
            console.error('Error logging dispute:', error);
            toast.error('An error occurred while logging the dispute. Please try again.');
        }
    };

    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    const formatDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const handleSubmitReview = async () => {
        try {
            await submitReview({
                reviewer,
                musicianId: musicianProfile.musicianId,
                venueId: gigData.venueId,
                gigId: gigData.gigId,
                rating,
                reviewText,
                profile: musicianProfile,
            });
            setGigData((prevGigData) => ({
                ...prevGigData,
                musicianHasReviewed: reviewer === 'musician',
                venueHasReviewed: reviewer === 'venue',
            }));
            toast.success('Review submitted!');
            setRating(0);
            setReviewText('');
            onClose(true);
        } catch (error) {
            console.error('Error submitting review:', error);
            toast.error('An error occurred while submitting the review. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className='modal'>
                <div className='modal-content review'>
                    <LoadingThreeDots />
                </div>
            </div>
        );
    }

    return (
        <div className='modal'>
            <div className='modal-content review'>
                {(showDisputeForm && disputeAllowed) ? (
                    <div className='leave-review'>
                        {reviewer === 'venue' ? (
                            <div className='review-head'>
                                <figure className='musician-img-cont'>
                                    <img src={musicianProfile.picture} alt={musicianProfile.name} className='musician-img' />
                                </figure>
                                <div className='name-and-reviews'>
                                    <h2>{musicianProfile?.name || 'the musician'}</h2>
                                    {musicianProfile.avgReviews ? (
                                        <h3><StarIcon />  {musicianProfile.avgReviews.avgRating} ({musicianProfile.avgReviews.totalReviews}) </h3>
                                    ) : (
                                        <h6>No Reviews</h6>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className='review-head'>
                                <figure className='musician-img-cont'>
                                    <img src={gigData.venue.photo} alt={gigData.venue.venueName} className='musician-img' />
                                </figure>
                                <div className='name-and-reviews'>
                                    <h2>{gigData.venue.venueName || 'the venue'}</h2>
                                    {venueProfile.avgReviews ? (
                                        <h3><StarIcon />  {venueProfile.avgReviews.avgRating} ({venueProfile.avgReviews.totalReviews}) </h3>
                                    ) : (
                                        <h6>No Reviews</h6>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className='review-body dispute'>
                            <div className='dispute-reason'>
                                <label htmlFor='dispute-reason'>Reason For Report:</label>
                                <select
                                    id='dispute-reason'
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                >
                                    <option value=''>Select a reason</option>
                                    <option value='no-show'>Musician didn’t show up</option>
                                    <option value='profile-mismatch'>Musician wasn’t what the profile showed</option>
                                    <option value='late'>Musician was too late</option>
                                    <option value='unprofessional'>Musician was unprofessional</option>
                                    <option value='other'>Other</option>
                                </select>
                            </div>
                            <textarea
                                value={disputeText}
                                onChange={(e) => setDisputeText(e.target.value)}
                                placeholder='Add additional details (optional)...'
                                rows='4'
                            />
                            <div className='two-buttons'>
                                <button className='btn primary' onClick={handleDisputeSubmit} disabled={!disputeReason}>
                                    Submit Report
                                </button>
                                <button className='btn secondary' onClick={() => setShowDisputeForm(false)}>
                                    Go Back
                                </button>
                            </div>
                        </div>
                    </div>
                ) : disputeSubmitted && !reviewingAfterDispute ? (
                    <div className='dispute-logged'>
                        <h2>Report Logged</h2>
                        <p>We will look into your report and email you with our decision.</p>
                        <div className='two-buttons'>
                            <button className='btn primary' onClick={() => setReviewingAfterDispute(true)}>
                                Leave a Review
                            </button>
                            <button className='btn secondary' onClick={() => onClose(true)}>
                                Close
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className='leave-review'>
                        <h2 style={{ textAlign: 'center'}}>How was the gig?</h2>
                        <h4 style={{ marginBottom: '1rem', textAlign: 'center' }}>{formatDate(gigData.date)}</h4>
                        {reviewer === 'venue' ? (
                            <>
                            <div className='review-head'>
                                {musicianProfile?.picture && (
                                    <figure className='musician-img-cont'>
                                        <img src={musicianProfile.picture} alt={musicianProfile.name} className='musician-img' />
                                    </figure>
                                    
                                )}
                                <div className='name-and-reviews'>
                                    <h2>{musicianProfile?.name || 'the musician'}</h2>
                                    {musicianProfile?.avgReviews ? (
                                        <h3><StarIcon />  {musicianProfile.avgReviews.avgRating} ({musicianProfile.avgReviews.totalReviews}) </h3>
                                    ) : (
                                        <h6>No Reviews</h6>
                                    )}
                                </div>
                            </div>
                            <div className='review-body'>
                                <div className='star-rating'>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className='star'
                                            onClick={() => setRating(star)}
                                        >
                                            {rating >= star ? <StarIcon /> : <StarEmptyIcon />}
                                        </span>
                                    ))}
                                </div>
                                <textarea
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    placeholder='Write your review (optional)...'
                                    disabled={!rating}
                                />
                                {disputeAllowed && !reviewingAfterDispute ? (
                                    <div className='two-buttons'>
                                        <button
                                            className='btn primary'
                                            onClick={handleSubmitReview}
                                            disabled={!rating}
                                        >
                                            Submit Review
                                        </button>
                                        <button className='btn danger' onClick={() => setShowDisputeForm(true)}>
                                            Report Issue
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className='btn primary'
                                        onClick={handleSubmitReview}
                                        disabled={!rating}
                                    >
                                        Submit Review
                                    </button>
                                )}
                            </div>
                            </>
                        ) : reviewer === 'musician' && venueProfile ? (
                            <>
                            <div className='review-head'>
                                <figure className='musician-img-cont'>
                                    <img src={venueProfile.photos[0]} alt={venueProfile.name} className='musician-img' />
                                </figure>
                                <div className='name-and-reviews'>
                                    <h2>{venueProfile?.name || 'the musician'}</h2>
                                    {venueProfile.avgReviews ? (
                                        <h3><StarIcon />  {venueProfile.avgReviews.avgRating} ({venueProfile.avgReviews.totalReviews}) </h3>
                                    ) : (
                                        <h6>No Reviews</h6>
                                    )}
                                </div>
                            </div>
                            <div className='review-body'>
                                <div className='star-rating'>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className='star'
                                            onClick={() => setRating(star)}
                                        >
                                            {rating >= star ? <StarIcon /> : <StarEmptyIcon />}
                                        </span>
                                    ))}
                                </div>
                                <textarea
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    placeholder='Write your review (optional)...'
                                    disabled={!rating}
                                />
                                <button
                                    className='btn primary'
                                    onClick={handleSubmitReview}
                                    disabled={!rating}
                                >
                                    Submit Review
                                </button>
                            </div>
                            </>
                        ) : (
                            <Skeleton height={100} width={300} />
                        )}
                    </div>
                )}
                <button className='btn tertiary close' onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
};

