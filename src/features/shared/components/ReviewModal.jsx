import React, { useState, useEffect } from 'react';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { StarEmptyIcon, StarIcon } from '@features/shared/ui/extras/Icons';
import Skeleton from 'react-loading-skeleton';
import '@styles/shared/review-modal.styles.css';
import { getMusicianProfileByMusicianId } from '@services/client-side/musicians';
import { getVenueProfileById } from '@services/client-side/venues';
import { sendDisputeMessage } from '@services/function-calls/messages';
import { sendEmail } from '@services/client-side/emails';
import { cancelTask } from '@services/function-calls/tasks';
import { toast } from 'sonner';
import { sendDisputeLoggedEmail, sendVenueDisputeLoggedEmail } from '../../../services/client-side/emails';
import Portal from './Portal';
import { getOrCreateConversation } from '@services/api/conversations';
import { LoadingSpinner } from '../ui/loading/Loading';
import { LoadingModal } from '../ui/loading/LoadingModal';
import { PermissionsIcon, ThumbsDownIcon, ThumbsUpIcon } from '../ui/extras/Icons';
import { logDispute, submitReview } from '../../../services/function-calls/reviews';
import { findPendingFeeByGigId, markPendingFeeInDispute } from '../../../services/function-calls/musicians';
import { updateGigDocument } from '../../../services/function-calls/gigs';
import { useVenueDashboard } from '../../../context/VenueDashboardContext';
import { hasVenuePerm } from '../../../services/utils/permissions';

export const ReviewModal = ({ gigData, inheritedProfile = null, onClose, reviewer, setGigData, venueProfiles }) => {

    const [loading, setLoading] = useState(!inheritedProfile);
    const [musicianProfile, setMusicianProfile] = useState(inheritedProfile);
    const [venueProfile, setVenueProfile] = useState(null);
    const [showDisputeForm, setShowDisputeForm] = useState(false);
    const [disputeText, setDisputeText] = useState('');
    const [disputeReason, setDisputeReason] = useState('');
    const [disputeSubmitted, setDisputeSubmitted] = useState(false);
    const [disputeAllowed, setDisputeAllowed] = useState(true);
    const [rating, setRating] = useState(null);
    const [reviewText, setReviewText] = useState('');
    const [reviewingAfterDispute, setReviewingAfterDispute] = useState(false);
    const canCreateReview = reviewer !== 'venue' || hasVenuePerm(venueProfiles, gigData?.venueId, 'reviews.create');

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
        if (reviewer === 'venue' && !canCreateReview) {
            toast.error("You don't have permission to file a report for this venue.");
            return;
        }
        if (!disputeReason) return;
        if (!disputeAllowed) return;
        try {
            setLoading(true);
            const success = await cancelTask(gigData.clearPendingFeeTaskName, gigData.gigId, gigData.venueId);
            const success2 = await cancelTask(gigData.automaticMessageTaskName, gigData.gigId, gigData.venueId);
            if (!success || !success2) {
                console.error('Failed to cancel task');
                toast.error('Failed to submit dispute. Please try again.');
                setLoading(false);
                return;
            }
            if (success && success2) {
                await logDispute({
                    musicianId: musicianProfile.musicianId,
                    gigId: gigData.gigId,
                    venueId: gigData.venueId,
                    reason: disputeReason,
                    details: disputeText || null,
                    timestamp: Date.now(),
                });
                const match = await findPendingFeeByGigId(musicianProfile.musicianId, gigData.gigId);
                if (match) {
                    await markPendingFeeInDispute({
                        musicianId: musicianProfile.musicianId,
                        docId: match.docId,
                        gigId: gigData.gigId,
                        disputeLogged: true,
                        status: 'in dispute',
                        reason: disputeReason,
                        disputeDetails: disputeText || null,
                        venueId: gigData.venueId,
                    });
                } else {
                    console.warn('No pending fee doc found for this gig to mark as disputed.');
                }
                const conversationId = await getOrCreateConversation(musicianProfile, gigData, venueProfile, 'dispute');
                await sendDisputeMessage(conversationId, gigData.venue.venueName);
                await sendEmail({
                    to: 'hq.gigin@gmail.com',
                    subject: 'Dispute Logged',
                    text: `A dispute has been logged for the gig on ${formatDate(gigData.date)}.`,
                    html: `<p>A dispute has been logged for the gig on ${formatDate(gigData.date)}.</p>`,
                })
                await sendDisputeLoggedEmail({
                    musicianProfile: musicianProfile,
                    gigData: gigData,
                });
                await sendVenueDisputeLoggedEmail({
                    venueProfile: venueProfile,
                    musicianProfile: musicianProfile,
                    gigData: gigData,
                })
                await updateGigDocument(gigData.gigId, 'reviews.create', {
                    disputeLogged: true,
                    disputeClearingTime: null,
                    musicianFeeStatus: 'in dispute',
                    venueHasReviewed: false,
                });
                setDisputeSubmitted(true);
                onClose(false);
                toast.success('Dispute submitted. A member of the team will be in touch shortly via email.')
            }
        } catch (error) {
            console.error('Error logging dispute:', error);
            toast.error('An error occurred while logging the dispute. Please try again.');
        } finally {
            setLoading(false);
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
        if (reviewer === 'venue' && !canCreateReview) {
            toast.error("You don't have permission to submit a review for this venue.");
            return;
        }
        try {
            setLoading(true);
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
            setRating(null);
            setReviewText('');
            onClose(true);
        } catch (error) {
            console.error('Error submitting review:', error);
            toast.error('An error occurred while submitting the review. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <LoadingModal />
        );
    }

    return (
        <div className='modal' onClick={() => onClose(false)}>
            <div className='modal-content review' onClick={(e) => e.stopPropagation()}>
                {(showDisputeForm && disputeAllowed) ? (
                    <div className='leave-review'>
                        {reviewer === 'venue' ? (
                            <div className='review-head'>
                                {musicianProfile?.picture && (
                                    <figure className='musician-img-cont'>
                                        <img src={musicianProfile.picture} alt={musicianProfile.name} className='musician-img' />
                                    </figure>
                                )}
                                <div className='name-and-reviews'>
                                    <h2>{musicianProfile?.name || 'the musician'}</h2>
                                    {musicianProfile.avgReviews ? (
                                        <h4>{musicianProfile.avgReviews.totalReviews} Review(s)</h4>
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
                                        <h4>{venueProfile.avgReviews.totalReviews} Review(s)</h4>
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
                                <button className='btn secondary' onClick={() => setShowDisputeForm(false)}>
                                    Go Back
                                </button>
                                <button className='btn primary' onClick={handleDisputeSubmit} disabled={!disputeReason}>
                                    Submit Report
                                </button>
                            </div>
                        </div>
                    </div>
                ) : disputeSubmitted && !reviewingAfterDispute ? (
                    <div className='dispute-logged'>
                        <h2>Report Logged</h2>
                        <p>We will look into your report and email you with our decision.</p>
                        <div className='two-buttons'>
                            <button className='btn secondary' onClick={() => onClose(true)}>
                                Close
                            </button>
                            <button className='btn primary' onClick={() => setReviewingAfterDispute(true)}>
                                Leave a Review
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className='leave-review'>
                        <h2 style={{ textAlign: 'center'}}>How was the gig?</h2>
                        <h4 style={{ marginBottom: '1rem', textAlign: 'center' }}>{formatDate(gigData.date)}</h4>
                        {reviewer === 'venue' ? (
                            !canCreateReview ? (
                                <div className='review-body permissions'>
                                    <PermissionsIcon />
                                    <h4 className="perm-hint">You don’t have permission to review gigs for this venue.</h4>
                                </div>
                            ) : (
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
                                                <h4>{musicianProfile.avgReviews.totalReviews} Review(s)</h4>
                                            ) : (
                                                <h6>No Reviews</h6>
                                            )}
                                        </div>
                                    </div>
                                    <div className='review-body'>
                                        <div className="review-buttons">
                                            <button disabled={!canCreateReview} className={`btn secondary ${rating === 'negative' ? 'selected' : ''}`} onClick={() => setRating('negative')}>Negative <ThumbsDownIcon /></button>
                                            <button disabled={!canCreateReview} className={`btn secondary ${rating === 'positive' ? 'selected' : ''}`} onClick={() => setRating('positive')}>Positive <ThumbsUpIcon /></button>
                                        </div>
                                        {rating && (
                                            <textarea
                                                value={reviewText}
                                                onChange={(e) => setReviewText(e.target.value)}
                                                placeholder='Write your review (optional)...'
                                                disabled={!rating || !canCreateReview}
                                            />
                                        )}
                                        {disputeAllowed && !reviewingAfterDispute ? (
                                            <div className='two-buttons' style={{ width: '100%'}}>
                                                <button className='btn danger' onClick={() => setShowDisputeForm(true)} disabled={!canCreateReview}>
                                                    Report Issue
                                                </button>
                                                <button
                                                    className='btn primary'
                                                    onClick={handleSubmitReview}
                                                    disabled={!rating || !canCreateReview}
                                                >
                                                    Submit Review
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                className='btn primary'
                                                style={{ width: '100%', margin: '0 auto' }}
                                                onClick={handleSubmitReview}
                                                disabled={!rating || !canCreateReview}
                                            >
                                                Submit Review
                                            </button>
                                        )}
                                    </div>
                                </>
                            )
                        ) : reviewer === 'musician' && venueProfile ? (
                            <>
                            <div className='review-head'>
                                <figure className='musician-img-cont'>
                                    <img src={venueProfile.photos[0]} alt={venueProfile.name} className='musician-img' />
                                </figure>
                                <div className='name-and-reviews'>
                                    <h2>{venueProfile?.name || 'the musician'}</h2>
                                    {venueProfile.avgReviews ? (
                                        <h4>{venueProfile.avgReviews.totalReviews} Review(s)</h4>
                                    ) : (
                                        <h6>No Reviews</h6>
                                    )}
                                </div>
                            </div>
                            <div className='review-body'>
                                <div className="review-buttons">
                                    <button className={`btn secondary ${rating === 'negative' ? 'selected' : ''}`} onClick={() => setRating('negative')}>Negative <ThumbsDownIcon /></button>
                                    <button className={`btn secondary ${rating === 'positive' ? 'selected' : ''}`} onClick={() => setRating('positive')}>Positive <ThumbsUpIcon /></button>
                                </div>
                                {rating && (
                                    <textarea
                                        value={reviewText}
                                        onChange={(e) => setReviewText(e.target.value)}
                                        placeholder='Write your review (optional)...'
                                        disabled={!rating}
                                    />
                                )}
                                <button
                                    className='btn primary'
                                    onClick={handleSubmitReview}
                                    disabled={!rating}
                                    style={{ width: '100%', margin: '0 auto' }}
                                >
                                    Submit Review
                                </button>
                            </div>
                            </>
                        ) : (
                            <LoadingSpinner marginTop={'1rem'} />
                        )}
                    </div>
                )}
                <button className='btn tertiary close' onClick={() => onClose(false)}>
                    Close
                </button>
            </div>
        </div>
    );
};

