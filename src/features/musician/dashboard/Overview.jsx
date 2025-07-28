import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaceFrownIcon,
    TelescopeIcon,
    SortIcon,
    HouseIconLight,
    PeopleGroupIcon } from '@features/shared/ui/extras/Icons';
import { useGigs } from '@context/GigsContext';
import { formatDurationSpan, getCityFromAddress } from '@services/utils/misc';
import { GigHandbook } from '@features/musician/components/GigHandbook';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { useMapbox } from '@hooks/useMapbox';
import { openInNewTab } from '@services/utils/misc';
import { formatFeeDate } from '@services/utils/dates';
import { AllGigsIcon, CoinsIconSolid, LocationPinIcon, NextGigIcon } from '../../shared/ui/extras/Icons';
import { getVenueProfileById } from '../../../services/venues';

export const Overview = ({ user, musicianProfile, gigApplications, gigs, gigsToReview, setGigsToReview }) => {

    const navigate = useNavigate();
    const mapContainerRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [allGigDocuments, setAllGigDocuments] = useState([]);
    const [paidGigs, setPaidGigs] = useState([]);
    const [confirmedGigs, setConfirmedGigs] = useState([]);
    const [nextGig, setNextGig] = useState(null);
    const [nextGigVenue, setNextGigVenue] = useState(null);
    const [venuesToReview, setVenuesToReview] = useState(null);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [showSocialsModal, setShowSocialsModal] = useState(false);
    const [justReviewed, setJustReviewed] = useState(false);

    useEffect(() => {
        const filterGigs = () => {
            setLoading(true);
            if (!musicianProfile || !gigs) {
                console.warn('Musician profile or gigs data is missing.');
                setLoading(false);
                return;
            }
            const clearedFeeGigIds = musicianProfile.clearedFees?.map((fee) => fee.gigId) || [];
            const filteredGigs = gigs.filter(gig =>
                gigApplications?.some(app => app.gigId === gig.gigId) || false
              );
            const paidGigs = gigs.filter(gig => clearedFeeGigIds.includes(gig.gigId));
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
            const sortedConfirmedGigs = confirmedGigs.sort((a, b) => a.startDateTime.toDate() - b.startDateTime.toDate());
            const sortedFilteredGigs = filteredGigs.sort((a, b) => a.startDateTime.toDate() - b.startDateTime.toDate());
            setAllGigDocuments(sortedFilteredGigs);
            setConfirmedGigs(sortedConfirmedGigs);
            setPaidGigs(paidGigs);
            setNextGig(nextGig);
            setLoading(false);
        };

        if (gigApplications && gigApplications.length > 0) {
            filterGigs();
        } else {
            setAllGigDocuments([]);
            setConfirmedGigs([]);
            setPaidGigs([]);
            setLoading(false);
        }
    }, [gigApplications, gigs]);

    useEffect(() => {
        const fetchVenueProfile = async () => {
            if (!nextGig?.applicants) return;
            const confirmedApplicant = nextGig.applicants.find(applicant => applicant.status === 'confirmed');
            if (!confirmedApplicant) return;
            try {
                const profile = await getVenueProfileById(nextGig.venueId);
                setNextGigVenue(profile);
            } catch (error) {
                console.error('Error fetching musician profile:', error);
            }
        };
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

    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

    const formatName = (name) => {
        return name.split(' ')[0];
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

    console.log(venuesToReview)

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
                {/* {newApplicationsGigs.length > 0 && (
                    <div className="new-applications" onClick={() => navigate('/venues/dashboard/gigs')}>
                        <ExclamationIcon />
                        <h4>You have {newApplicationsGigs.length || 3} new gig applications.</h4>
                    </div>
                )} */}
                {/* {musicianRequests.length > 0 && (
                    <div className="new-applications" onClick={() => navigate('/venues/dashboard/gigs?showRequests=true')}>
                        <ExclamationIcon />
                        <h4>You have {musicianRequests.length || 3} new musician requests.</h4>
                    </div>
                )} */}
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
                        <span className='quick-button-text'>All Gigs</span>
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
                                                <img className="musician-img" src={venue.venueProfile.picture} alt={venue.venueProfile.name} />
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
                                        <button
                                            className='btn primary'
                                            onClick={() => handleSubmitReview(id, venue)}
                                            disabled={submittingReviews[id]}
                                        >
                                            {submittingReviews[id] ? <LoadingThreeDots /> : 'Submit Review'}
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