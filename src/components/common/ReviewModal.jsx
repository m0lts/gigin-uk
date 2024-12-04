import React, { useState, useEffect } from 'react';
import { firestore, functions } from '../../firebase';
import { getDoc, collection, doc, updateDoc, addDoc, Timestamp, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { LoadingThreeDots } from '../ui/loading/Loading';
import { httpsCallable } from 'firebase/functions';
import Skeleton from 'react-loading-skeleton';
import { StarEmptyIcon, StarIcon } from '../ui/Extras/Icons';
import '../../assets/styles/common/review-modal.styles.css';

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
            const confirmedApplicant = gigData.applicants.find(applicant => applicant.status === "confirmed" || applicant.status === "paid");
            if (confirmedApplicant) {
                try {
                    console.log('fetching profiles...');
                    const musicianRef = doc(firestore, 'musicianProfiles', confirmedApplicant.id);
                    const musicianSnapshot = await getDoc(musicianRef);
                    if (musicianSnapshot.exists()) {
                        setMusicianProfile(musicianSnapshot.data());
                    }
                    const venueRef = doc(firestore, 'venueProfiles', gigData.venueId);
                    const venueSnapshot = await getDoc(venueRef);
                    if (venueSnapshot.exists()) {
                        setVenueProfile(venueSnapshot.data());
                    }
                } catch (error) {
                    console.error("Error fetching venue profile:", error);
                }
            setLoading(false);
            }
            setLoading(false);
        };
        fetchProfiles();
    }, [gigData, inheritedProfile]);

    const handleDisputeSubmit = async () => {
        if (!disputeReason) return;
        if (!disputeAllowed) return;
        try {
            setLoading(true);
            const cancelCloudTask = httpsCallable(functions, 'cancelCloudTask');
            const taskName = gigData.clearPendingFeeTaskName;
            const result = await cancelCloudTask({taskName});
            if (result.data.success) {
                const disputeRef = collection(firestore, 'disputes');
                const disputeDetails = {
                    musicianId: musicianProfile.musicianId,
                    gigId: gigData.gigId,
                    venueId: gigData.venueId,
                    reason: disputeReason,
                    details: disputeText || null,
                    timestamp: Timestamp.now(),
                };
                await addDoc(disputeRef, disputeDetails);
                const gigRef = doc(firestore, 'gigs', gigData.gigId);
                await updateDoc(gigRef, {
                    disputeLogged: true,
                    disputeClearingTime: null,
                    musicianFeeStatus: 'in dispute',
                    venueHasReviewed: false,
                });
                const musicianRef = doc(firestore, 'musicianProfiles', musicianProfile.musicianId);
                const updatedPendingFees = musicianProfile.pendingFees.map((fee) => {
                    if (fee.gigId === gigData.gigId) {
                        return {
                            ...fee,
                            disputeClearingTime: null,
                            disputeLogged: true,
                            status: 'in dispute',
                            disputeReason: disputeReason,
                        };
                    }
                    return fee;
                });
                await updateDoc(musicianRef, { pendingFees: updatedPendingFees });
                const conversationsRef = collection(firestore, 'conversations');
                const conversationQuery = query(
                    conversationsRef,
                    where('participants', 'array-contains', musicianProfile.musicianId),
                    where('gigId', '==', gigData.gigId)
                );
                const conversationSnapshot = await getDocs(conversationQuery);
                const conversationId = conversationSnapshot.docs[0].id;
                const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                await addDoc(messagesRef, {
                    senderId: "system",
                    text: `${gigData.venue.venueName} has reported this gig. We have withheld the gig fee until the dispute is resolved. We will be in touch shortly.`,
                    type: "announcement",
                    status: 'dispute',
                    timestamp: Timestamp.now(),
                });
                const mailRef = collection(firestore, 'mail');
                const mailData = {
                    to: 'hq.gigin@gmail.com',
                    message: {
                        subject: 'Dispute Logged',
                        text: `A dispute has been logged for the gig on ${formatDate(gigData.date)}.`,
                        html: `<p>A dispute has been logged for the gig on ${formatDate(gigData.date)}.</p>`,
                    }
                };
                const musicianMailData = {
                    to: musicianProfile.email,
                    message: {
                        subject: 'Dispute Logged',
                        text: `The venue ${gigData.venue.venueName} has reported your performance at the gig on ${formatDate(gigData.date)}. We have withheld the gig fee until the dispute is resolved. We will be in touch shortly.`,
                        html: `<p>The venue ${gigData.venue.venueName} has reported your performance at the gig on ${formatDate(gigData.date)}. <br /> We have withheld the gig fee until the dispute is resolved. <br /> We will be in touch shortly.</p>`,
                    }
                };
                await addDoc(mailRef, musicianMailData);
                await addDoc(mailRef, mailData);
                setLoading(false);
                setShowDisputeForm(false);
                setDisputeSubmitted(true);
            } else {
                console.error('Failed to cancel task:', result.data.message);
                alert('Failed to log dispute.');
                setLoading(false);
            }
        } catch (error) {
            console.error('Error logging dispute:', error);
            alert('An error occurred while logging the dispute.');
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

    const submitReview = async () => {
        try {
            const reviewData = {
                musicianId: musicianProfile.musicianId,
                gigId: gigData.gigId,
                venueId: gigData.venueId,
                reviewWrittenBy: reviewer,
                rating,
                reviewText: reviewText.trim() || null,
                timestamp: Timestamp.now(),
            };
            const reviewRef = await addDoc(collection(firestore, 'reviews'), reviewData);
            const reviewDocId = reviewRef.id;
            if (reviewer === 'venue') {
                const musicianRef = doc(firestore, 'musicianProfiles', musicianProfile.musicianId);
                await updateDoc(musicianRef, {
                    reviews: arrayUnion(reviewDocId),
                    avgReviews: incrementRating(musicianProfile.avgReviews || { totalReviews: 0, avgRating: 0 }, rating),
                });
                const gigRef = doc(firestore, 'gigs', gigData.gigId);
                await updateDoc(gigRef, {
                    venueHasReviewed: true,
                });
            } else {
                const venueRef = doc(firestore, 'venueProfiles', gigData.venueId);
                await updateDoc(venueRef, {
                    reviews: arrayUnion(reviewDocId),
                    avgReviews: incrementRating(venueProfile.avgReviews || { totalReviews: 0, avgRating: 0 }, rating),
                });
                const gigRef = doc(firestore, 'gigs', gigData.gigId);
                await updateDoc(gigRef, {
                    musicianHasReviewed: true,
                });
            }
            setGigData((prevGigData) => ({
                ...prevGigData,
                musicianHasReviewed: reviewer === 'musician',
                venueHasReviewed: reviewer === 'venue',
            }));
            alert('Review submitted successfully!');
            setRating(0);
            setReviewText('');
            onClose(true);
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('An error occurred while submitting the review.');
        }
    };

    const incrementRating = (currentAvg, newRating) => {
        const totalReviews = currentAvg.totalReviews + 1;
        const avgRating = ((currentAvg.avgRating * currentAvg.totalReviews) + newRating) / totalReviews;
        return { totalReviews, avgRating };
    };

    if (loading) {
        return (
            <div className="modal">
                <div className="modal-content review">
                    <LoadingThreeDots />
                </div>
            </div>
        );
    }

    return (
        <div className="modal">
            <div className="modal-content review">
                {(showDisputeForm && disputeAllowed) ? (
                    <div className="leave-review">
                        {reviewer === 'venue' ? (
                            <div className="review-head">
                                <figure className="musician-img-cont">
                                    <img src={musicianProfile.picture} alt={musicianProfile.name} className="musician-img" />
                                </figure>
                                <div className="name-and-reviews">
                                    <h2>{musicianProfile?.name || "the musician"}</h2>
                                    {musicianProfile.avgReviews ? (
                                        <h3><StarIcon />  {musicianProfile.avgReviews.avgRating} ({musicianProfile.avgReviews.totalReviews}) </h3>
                                    ) : (
                                        <h6>No Reviews</h6>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="review-head">
                                <figure className="musician-img-cont">
                                    <img src={gigData.venue.photo} alt={gigData.venue.venueName} className="musician-img" />
                                </figure>
                                <div className="name-and-reviews">
                                    <h2>{gigData.venue.venueName || "the venue"}</h2>
                                    {venueProfile.avgReviews ? (
                                        <h3><StarIcon />  {venueProfile.avgReviews.avgRating} ({venueProfile.avgReviews.totalReviews}) </h3>
                                    ) : (
                                        <h6>No Reviews</h6>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="review-body dispute">
                            <div className="dispute-reason">
                                <label htmlFor="dispute-reason">Reason For Report:</label>
                                <select
                                    id="dispute-reason"
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                >
                                    <option value="">Select a reason</option>
                                    <option value="no-show">Musician didn’t show up</option>
                                    <option value="profile-mismatch">Musician wasn’t what the profile showed</option>
                                    <option value="late">Musician was too late</option>
                                    <option value="unprofessional">Musician was unprofessional</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <textarea
                                value={disputeText}
                                onChange={(e) => setDisputeText(e.target.value)}
                                placeholder="Add additional details (optional)..."
                                rows="4"
                            />
                            <div className="two-buttons">
                                <button className="btn primary" onClick={handleDisputeSubmit} disabled={!disputeReason}>
                                    Submit Report
                                </button>
                                <button className="btn secondary" onClick={() => setShowDisputeForm(false)}>
                                    Go Back
                                </button>
                            </div>
                        </div>
                    </div>
                ) : disputeSubmitted && !reviewingAfterDispute ? (
                    <div className="dispute-logged">
                        <h2>Report Logged</h2>
                        <p>We will look into your report and email you with our decision.</p>
                        <div className="two-buttons">
                            <button className="btn primary" onClick={() => setReviewingAfterDispute(true)}>
                                Leave a Review
                            </button>
                            <button className="btn secondary" onClick={() => onClose(true)}>
                                Close
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="leave-review">
                        <h2 style={{ textAlign: 'center'}}>How was the gig?</h2>
                        <h4 style={{ marginBottom: '1rem', textAlign: 'center' }}>{formatDate(gigData.date)}</h4>
                        {reviewer === 'venue' ? (
                            <>
                            <div className="review-head">
                                {musicianProfile?.picture && (
                                    <figure className="musician-img-cont">
                                        <img src={musicianProfile.picture} alt={musicianProfile.name} className="musician-img" />
                                    </figure>
                                    
                                )}
                                <div className="name-and-reviews">
                                    <h2>{musicianProfile?.name || "the musician"}</h2>
                                    {musicianProfile?.avgReviews ? (
                                        <h3><StarIcon />  {musicianProfile.avgReviews.avgRating} ({musicianProfile.avgReviews.totalReviews}) </h3>
                                    ) : (
                                        <h6>No Reviews</h6>
                                    )}
                                </div>
                            </div>
                            <div className="review-body">
                                <div className="star-rating">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className="star"
                                            onClick={() => setRating(star)}
                                        >
                                            {rating >= star ? <StarIcon /> : <StarEmptyIcon />}
                                        </span>
                                    ))}
                                </div>
                                <textarea
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    placeholder="Write your review (optional)..."
                                    disabled={!rating}
                                />
                                {disputeAllowed && !reviewingAfterDispute ? (
                                    <div className="two-buttons">
                                        <button
                                            className="btn primary"
                                            onClick={submitReview}
                                            disabled={!rating}
                                        >
                                            Submit Review
                                        </button>
                                        <button className="btn danger" onClick={() => setShowDisputeForm(true)}>
                                            Report Issue
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="btn primary"
                                        onClick={submitReview}
                                        disabled={!rating}
                                    >
                                        Submit Review
                                    </button>
                                )}
                            </div>
                            </>
                        ) : reviewer === 'musician' && venueProfile ? (
                            <>
                            <div className="review-head">
                                <figure className="musician-img-cont">
                                    <img src={venueProfile.photos[0]} alt={venueProfile.name} className="musician-img" />
                                </figure>
                                <div className="name-and-reviews">
                                    <h2>{venueProfile?.name || "the musician"}</h2>
                                    {venueProfile.avgReviews ? (
                                        <h3><StarIcon />  {venueProfile.avgReviews.avgRating} ({venueProfile.avgReviews.totalReviews}) </h3>
                                    ) : (
                                        <h6>No Reviews</h6>
                                    )}
                                </div>
                            </div>
                            <div className="review-body">
                                <div className="star-rating">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className="star"
                                            onClick={() => setRating(star)}
                                        >
                                            {rating >= star ? <StarIcon /> : <StarEmptyIcon />}
                                        </span>
                                    ))}
                                </div>
                                <textarea
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    placeholder="Write your review (optional)..."
                                    disabled={!rating}
                                />
                                <button
                                    className="btn primary"
                                    onClick={submitReview}
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
                <button className="btn tertiary close" onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
};

