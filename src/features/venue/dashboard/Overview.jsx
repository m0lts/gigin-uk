import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { getMusicianProfileByMusicianId } from '@services/client-side/musicians';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { AllGigsIcon, CalendarIconSolid, ExclamationIcon, GigIcon, MailboxFullIcon, NextGigIcon, StarEmptyIcon, StarIcon } from '../../shared/ui/extras/Icons';
import { NextGig } from '../components/NextGig';
import { FeedbackSection } from './FeedbackSection';
import { toast } from 'sonner';
import { LoadingSpinner, LoadingThreeDots } from '../../shared/ui/loading/Loading';
import { getLocalGigDateTime } from '../../../services/utils/filtering';
import { submitReview } from '../../../services/function-calls/reviews';

export const Overview = ({ gigs, loadingGigs, venues, setGigPostModal, user, gigsToReview, setGigsToReview, requests }) => {

    const navigate = useNavigate();
    const [showSocialsModal, setShowSocialsModal] = useState(false);
    const [nextGigModal, setNextGigModal] = useState(false);
    const [nextGigMusician, setNextGigMusician] = useState(null);
    const [nextGig, setNextGig] = useState(null);
    const [newApplicationsGigs, setNewApplicationsGigs] = useState([]);
    const [musiciansToReview, setMusiciansToReview] = useState([]);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [ratings, setRatings] = useState({});
    const [reviewTexts, setReviewTexts] = useState({});
    const [submittingReviews, setSubmittingReviews] = useState({});
    const [musicianRequests, setMusicianRequests] = useState([]);
    const [justReviewed, setJustReviewed] = useState(false);

    useResizeEffect((width) => {
        setWindowWidth(width);
      });

    useEffect(() => {
        if (!gigs?.length) return;
        const now = new Date();
        const newApplications = gigs.filter(gig =>
            gig.applicants.some(applicant =>
              (applicant.viewed === false || applicant.viewed === undefined) &&
              applicant.invited !== true
            )
        );
        const confirmedGigsLocal = gigs.filter(gig =>
            gig.applicants.some(applicant => applicant.status === 'confirmed')
        );
        const upcomingConfirmed = confirmedGigsLocal
            .filter(gig => getLocalGigDateTime(gig) > now)
            .sort((a, b) => getLocalGigDateTime(a) - getLocalGigDateTime(b));
        setNewApplicationsGigs(newApplications);
        setNextGig(upcomingConfirmed[0] || null);
    }, [gigs]);

    useEffect(() => {
        if (!requests?.length) return;
      
        const unseenRequests = requests.filter(
          (request) => request?.viewed === false || request?.viewed === undefined
        );
      
        setMusicianRequests(unseenRequests);
      }, [requests]);


    useEffect(() => {
        const fetchMusicianProfile = async () => {
            if (!nextGig?.applicants) return;
            const confirmedApplicant = nextGig.applicants.find(applicant => applicant.status === 'confirmed');
            if (!confirmedApplicant) return;
            try {
                const profile = await getMusicianProfileByMusicianId(confirmedApplicant.id);
                setNextGigMusician(profile);
            } catch (error) {
                console.error('Error fetching musician profile:', error);
            }
        };
        const fetchMusiciansToReview = async () => {
            if (!gigsToReview || gigsToReview.length < 1) return;
            try {
              const updatedGigs = await Promise.all(
                gigsToReview.map(async (gig) => {
                  const confirmedApplicant = gig.applicants.find((app) => app.status === 'confirmed');
                  if (!confirmedApplicant) return null;
                  const musicianProfile = await getMusicianProfileByMusicianId(confirmedApplicant.id);
                  return {
                    ...gig,
                    musicianProfile,
                  };
                })
              );
              const filteredGigs = updatedGigs.filter(Boolean);
              setMusiciansToReview(filteredGigs);
            } catch (error) {
              console.error('Error fetching musician profiles for gigs:', error);
            }
          };
          if (nextGig) fetchMusicianProfile();
          if (gigsToReview.length > 0) fetchMusiciansToReview();
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

    const handleSubmitReview = async (musicianId, gigData) => {
        setSubmittingReviews(prev => ({ ...prev, [musicianId]: true }));
        try {
            const ratingValue = ratings[musicianId];
            const reviewTextValue = reviewTexts[musicianId];
            if (!ratingValue) {
                toast.info('Please add a star rating.');
                return;
            };
            await submitReview({
                reviewer: 'venue',
                musicianId: musicianId,
                venueId: gigData.venueId,
                gigId: gigData.gigId,
                rating: ratingValue,
                reviewText: reviewTextValue,
                profile: gigData.musicianProfile,
            });
            toast.success('Review submitted. Thank you!');
            setGigsToReview((prev) => prev.filter(g => g.gigId !== gigData.gigId));
            setRatings((prev) => ({ ...prev, [musicianId]: 0 }));
            setReviewTexts((prev) => ({ ...prev, [musicianId]: '' }));
            setJustReviewed(true);
        } catch (error) {
            console.error('Error submitting review:', error);
            toast.error('Review submission failed. Please try again.');
        } finally {
            setSubmittingReviews(prev => ({ ...prev, [musicianId]: false }));
        }
    };

    const howToSteps = [
        {
          title: 'Add your venues',
          text: "Add venues (like you already have) that you manage to your account by building them in the 'My Venues' section."
        },
        {
          title: 'Post Gigs for musicians to apply to',
          text: "With Gigin, the musicians do the work. Click the 'Post a Gig' button to post a new gig opportunity for musicians to apply to."
        },
        {
          title: 'Review gig applications',
          text: "When musicians apply to your gig post, they'll appear in your messages and your gigs section on the dashboard."
        },
        {
          title: 'Confirm gig',
          text: "Accept or deny musician applications. When you accept an application, the gig is booked and confirmed."
        }
      ];


    return (
        <>
            <div className="head">
                <h1 className='title'>Venue Dashboard</h1>
            </div>
            <div className='body overview'>
                <div className="welcome">
                    <h2>Hi {formatName(user.name)}!</h2>
                    <h4>What talent will you find today?</h4>
                </div>
                {newApplicationsGigs.length > 0 && (
                    <div className="new-applications" onClick={() => navigate('/venues/dashboard/gigs')}>
                        <ExclamationIcon />
                        <h4>You have {newApplicationsGigs.length || 3} new gig applications.</h4>
                    </div>
                )}
                {musicianRequests.length > 0 && (
                    <div className="new-applications" onClick={() => navigate('/venues/dashboard/gigs?showRequests=true')}>
                        <ExclamationIcon />
                        <h4>You have {musicianRequests.length || 3} new musician requests.</h4>
                    </div>
                )}
                <div className="quick-buttons">
                    <div className="quick-button" onClick={() => setGigPostModal(true)}>
                        <GigIcon />
                        <span className='quick-button-text'>Post a Gig</span>
                    </div>
                    {nextGigMusician && (
                        <div className="quick-button" onClick={() => setNextGigModal(true)}>
                            <NextGigIcon />
                            <span className='quick-button-text'>Next Gig</span>
                        </div>
                    )}
                    <div className="quick-button" onClick={() => navigate('/venues/dashboard/gigs')}>
                        <AllGigsIcon />
                        <span className='quick-button-text'>All Gigs</span>
                    </div>
                </div>

                {musiciansToReview.length > 0 ? (
                    <div className="review-musicians">
                        <h3>Previous Performers</h3>
                        <div className="musicians-to-review">
                            {musiciansToReview.map((musician) => {
                                const id = musician.musicianProfile.musicianId;
                                const currentRating = ratings[id] || 0;
                                const currentText = reviewTexts[id] || '';

                                return (
                                    <div className="musician-to-review" key={id}>
                                        <div className="musician-info">
                                            <figure className="musician-img-cont">
                                                <img className="musician-img" src={musician.musicianProfile.picture} alt={musician.musicianProfile.name} />
                                            </figure>
                                            <div className="musician-name">
                                                <h3>{musician.musicianProfile.name}</h3>
                                                <p>{musician.musicianProfile.musicianType}</p>
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
                                        <button
                                            className='btn primary'
                                            onClick={() => handleSubmitReview(id, musician)}
                                            disabled={submittingReviews[id]}
                                        >
                                            {submittingReviews[id] ? <LoadingSpinner /> : 'Submit Review'}
                                        </button>
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

                {nextGigModal && (
                    <NextGig nextGig={nextGig} musicianProfile={nextGigMusician} setNextGigModal={setNextGigModal} />
                )}
            </div>
        </>
    );
};