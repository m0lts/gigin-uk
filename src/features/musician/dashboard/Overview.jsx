import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaceFrownIcon,
    TelescopeIcon,
    SortIcon,
    HouseIconLight,
    PeopleGroupIcon } from '@features/shared/ui/extras/Icons';
import { GigHandbook } from '@features/musician/components/GigHandbook';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { AllGigsIcon, CoinsIconSolid, ExclamationIcon, LocationPinIcon, NextGigIcon, StarEmptyIcon, StarIcon } from '../../shared/ui/extras/Icons';
import { getVenueProfileById } from '../../../services/venues';
import { LoadingThreeDots } from '../../shared/ui/loading/Loading';
import { FeedbackSection } from '../../venue/dashboard/FeedbackSection';
import { toast } from 'sonner';
import { submitReview } from '../../../services/reviews';

export const Overview = ({ user, musicianProfile, gigApplications, gigs, gigsToReview, setGigsToReview, bandProfiles, unseenInvites }) => {

    const navigate = useNavigate();

    const [nextGig, setNextGig] = useState(null);
    const [venuesToReview, setVenuesToReview] = useState(null);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [showSocialsModal, setShowSocialsModal] = useState(false);
    const [justReviewed, setJustReviewed] = useState(false);
    const [ratings, setRatings] = useState({});
    const [reviewTexts, setReviewTexts] = useState({});
    const [submittingReviews, setSubmittingReviews] = useState({});

    useEffect(() => {
        const filterGigs = () => {
            if (!musicianProfile || !gigs) {
                console.warn('Musician profile or gigs data is missing.');
                return;
            }
            const confirmedGigs = gigs.filter(gig => musicianProfile.confirmedGigs?.includes(gig.gigId) || false);
            const nextGig = confirmedGigs
                .filter((gig) => {
                    const gigDateTime = new Date(gig.startDateTime);
                    return gigDateTime > new Date();
                })
                .sort((a, b) => {
                    const aDateTime = new Date(a.startDateTime);
                    const bDateTime = new Date(b.startDateTime);
                    return aDateTime - bDateTime;
                })[0];
            setNextGig(nextGig);
        };

        if (gigApplications && gigApplications.length > 0) {
            filterGigs();
        }
    }, [gigApplications, gigs]);


    useEffect(() => {
        const fetchVenuesToReview = async () => {
            if (!gigsToReview || gigsToReview.length < 1) return;
            try {
              const updatedGigs = await Promise.all(
                gigsToReview.map(async (gig) => {
                  const confirmedApplicant = gig.applicants.find((app) => app.status === 'confirmed');
                  if (!confirmedApplicant) return null;
                  const venueProfile = await getVenueProfileById(gig.venueId);
                  return {
                    ...gig,
                    venueProfile,
                  };
                })
              );
              const filteredGigs = updatedGigs.filter(Boolean);
              setVenuesToReview(filteredGigs);
            } catch (error) {
              console.error('Error fetching venue profiles for gigs:', error);
            }
          };
          if (nextGig) fetchVenueProfile();
          if (gigsToReview?.length > 0) fetchVenuesToReview();
      }, [nextGig, gigsToReview, justReviewed]);

    const formatName = (name) => {
        return name.split(' ')[0];
    };

    const handleRatingChange = (musicianId, star) => {
        setRatings(prev => ({ ...prev, [musicianId]: star }));
    };
      
      const handleReviewTextChange = (musicianId, text) => {
        setReviewTexts(prev => ({ ...prev, [musicianId]: text }));
    };

    const handleSubmitReview = async (venueId, gigData) => {
        setSubmittingReviews(prev => ({ ...prev, [venueId]: true }));
        try {
            const ratingValue = ratings[venueId];
            const reviewTextValue = reviewTexts[venueId];
            if (!ratingValue) {
                toast.info('Please add a star rating.');
                return;
            };
            let resolvedMusicianId = gigData.applicants?.find(app => app.id === musicianProfile.id)?.id;
            if (!resolvedMusicianId && Array.isArray(bandProfiles)) {
                for (const bandProfileId of bandProfiles) {
                    const match = gigData.applicants?.find(app => app.id === bandProfileId);
                    if (match) {
                        resolvedMusicianId = match.id;
                        break;
                    }
                }
            }
            if (!resolvedMusicianId) {
                throw new Error('Unable to resolve musician ID from gig applicants.');
            }
            await submitReview({
                reviewer: 'musician',
                venueId: venueId,
                musicianId: resolvedMusicianId,
                gigId: gigData.gigId,
                rating: ratingValue,
                reviewText: reviewTextValue,
                profile: gigData.musicianProfile,
            });
            toast.success('Review submitted. Thank you!');
            setGigsToReview((prev) => prev.filter(g => g.gigId !== gigData.gigId));
            setRatings((prev) => ({ ...prev, [venueId]: 0 }));
            setReviewTexts((prev) => ({ ...prev, [venueId]: '' }));
            setJustReviewed(true);
        } catch (error) {
            console.error('Error submitting review:', error);
            toast.error('Review submission failed. Please try again.');
        } finally {
            setSubmittingReviews(prev => ({ ...prev, [venueId]: false }));
        }
    };

    const howToSteps = [
        {
          title: 'Create Your Musician Profile',
          text: "Put your performing personality and media into a profile to show off to venues."
        },
        {
          title: 'Find Gigs',
          text: "Forget about waiting for venues to contact you. Browse the map for gig posts and apply yourself!"
        },
        {
          title: 'Play!',
          text: "When venues accept your gig application, they'll pay the gig fee. We hold this until 48 hours after you've performed the gig."
        },
        {
          title: 'Get Paid',
          text: "After the 48 hour dispute period, the funds are released to your gigin account. Withdraw them in the finances section."
        }
    ];

    return (
        <>
            <div className="head">
                <h1 className='title'>Musician Dashboard</h1>
            </div>
            <div className='body overview'>
                <div className="welcome">
                    <h2>Hi {formatName(user.name)}!</h2>
                    <h4>Ready to tear up the music scene?</h4>
                </div>
                {unseenInvites.length > 0 && (
                    <div className="new-applications" onClick={() => navigate('/dashboard/gigs')}>
                        <ExclamationIcon />
                        <h4>You have {unseenInvites.length || 0} unseen gig invites.</h4>
                    </div>
                )}
                <div className="quick-buttons">
                    <div className="quick-button" onClick={() => navigate('/find-a-gig')}>
                        <TelescopeIcon />
                        <span className='quick-button-text'>Find a Gig</span>
                    </div>
                    {musicianProfile.withdrawableEarnings && (
                        <div className="quick-button" onClick={() => navigate('/dashboard/finances')}>
                            <CoinsIconSolid />
                            <h3>£{musicianProfile.withdrawableEarnings}</h3>
                            <span className="quick-button-text">Withdraw Funds</span>
                        </div>
                    )}
                    {nextGig && (
                        <div className="quick-button" onClick={() => setShowGigHandbook(true)}>
                            <NextGigIcon />
                            <span className='quick-button-text'>Next Gig</span>
                        </div>
                    )}
                    <div className="quick-button" onClick={() => navigate('/dashboard/gigs')}>
                        <AllGigsIcon />
                        <span className='quick-button-text'>Gig Applications</span>
                    </div>
                </div>

                {venuesToReview?.length > 0 ? (
                    <div className="review-musicians">
                        <h3>Previous Venues</h3>
                        <div className="musicians-to-review">
                            {venuesToReview.map((venue) => {
                                const id = venue.venueProfile.venueId;
                                
                                const currentRating = ratings[id] || 0;
                                const currentText = reviewTexts[id] || '';

                                return (
                                    <div className="musician-to-review" key={id}>
                                        <div className="musician-info">
                                            <figure className="musician-img-cont">
                                                <img className="musician-img" src={venue.venueProfile.photos[0]} alt={venue.venueProfile.name} />
                                            </figure>
                                            <div className="musician-name">
                                                <h3>{venue.venueProfile.name}</h3>
                                                <p>{venue.venueProfile.venueType}</p>
                                            </div>
                                        </div>
                                        <div className="review-section">
                                            <div className='star-rating'>
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <span
                                                    key={star}
                                                    className='star'
                                                    onClick={() => handleRatingChange(id, star)}
                                                    >
                                                    {currentRating >= star ? <StarIcon /> : <StarEmptyIcon />}
                                                    </span>
                                                ))}
                                            </div>
                                            <textarea
                                                value={currentText}
                                                onChange={(e) => handleReviewTextChange(id, e.target.value)}
                                                placeholder='Write your review (optional)...'
                                                disabled={!currentRating}
                                                className='textarea'
                                            />
                                        </div>
                                        {submittingReviews[id] ? (
                                            <LoadingThreeDots />
                                        ) : (
                                            <button
                                                className='btn primary'
                                                onClick={() => handleSubmitReview(id, venue)}
                                                disabled={submittingReviews[id]}
                                            >
                                                Submit Review
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="how-gigin-works-cont">
                        <h3>How Gigin Works</h3>
                        <div className="how-gigin-works">
                            {howToSteps.map((step, index) => (
                                <div key={index} className="how-to-step">
                                <div className="step-number">{index + 1}</div>
                                <h3>{step.title}</h3>
                                <p>{step.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <FeedbackSection user={user} />
                {showGigHandbook && (
                    <GigHandbook
                        setShowGigHandbook={setShowGigHandbook}
                        showGigHandbook={showGigHandbook}
                        gigForHandbook={nextGig}
                        musicianId={musicianProfile.musicianId}
                    />
                )}
                {showSocialsModal && (
                    <PromoteModal
                        socialLinks={musicianProfile.socialMedia}
                        setShowSocialsModal={setShowSocialsModal}
                    />
                )}
            </div>
        </>
    );
};