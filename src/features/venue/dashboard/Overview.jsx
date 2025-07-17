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
import { getMusicianProfileByMusicianId } from '@services/musicians';
import { getReviewsByVenueIds } from '@services/reviews';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { AllGigsIcon, CalendarIconSolid, ExclamationIcon, GigIcon, MailboxFullIcon, NextGigIcon } from '../../shared/ui/extras/Icons';
import { NextGig } from '../components/NextGig';
import { FeedbackSection } from './FeedbackSection';

export const Overview = ({ gigs, loadingGigs, venues, setGigPostModal, user, gigsToReview }) => {

    const navigate = useNavigate();
    const [showSocialsModal, setShowSocialsModal] = useState(false);
    const [nextGigModal, setNextGigModal] = useState(false);
    const [nextGigMusician, setNextGigMusician] = useState(null);
    const [nextGig, setNextGig] = useState([]);
    const [newApplicationsGigs, setNewApplicationsGigs] = useState([]);
    const [confirmedGigs, setConfirmedGigs] = useState([]);
    const [nonConfirmedGigs, setNonConfirmedGigs] = useState([]);
    const [pendingGigs, setPendingGigs] = useState([]);
    const [socialsId, setSocialsId] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useResizeEffect((width) => {
        setWindowWidth(width);
      });

    useEffect(() => {
        if (gigs?.length > 0) {
            const now = new Date();
            setNewApplicationsGigs(gigs.filter(gig => gig.applicants.some(applicant => applicant.viewed === false || applicant.viewed === undefined)));
            const confirmedGigsLocal = gigs.filter(gig => gig.applicants.some(applicant => applicant.status === 'confirmed'));
            setConfirmedGigs(confirmedGigsLocal);
            const nonConfirmedGigsLocal = gigs.filter(gig => gig.status === 'open');
            setNonConfirmedGigs(nonConfirmedGigsLocal);
            setPendingGigs(nonConfirmedGigsLocal.filter((gig) => {
                const gigDateTime = new Date(`${gig.date.toDate().toISOString().split('T')[0]}T${gig.startTime}`);
                return gigDateTime > new Date();
            }));
            setNextGig(confirmedGigsLocal.filter((gig) => {
                const gigDateTime = new Date(`${gig.date.toDate().toISOString().split('T')[0]}T${gig.startTime}`);
                return gigDateTime > new Date();
            }));
        }
    }, [gigs]);


    useEffect(() => {
        const fetchMusicianProfile = async () => {
            if (!nextGig.length || !nextGig[0].applicants) return;
                const confirmedApplicant = nextGig[0].applicants.find(applicant => applicant.status === 'confirmed');
            if (!confirmedApplicant) return;
            try {
                setNextGigMusician(await getMusicianProfileByMusicianId(confirmedApplicant.id))
            } catch (error) {
                console.error('Error fetching musician profile:', error);
            }
        };
        const fetchVenueReviews = async () => {
            if (!venues || !venues.length) return;
            try {
                const venueIds = venues.map(v => v.venueId);
                const allReviews = await getReviewsByVenueIds(venueIds);
                const musicianReviews = allReviews.filter(
                    review => review.reviewWrittenBy === 'musician'
                );
                const enrichedReviews = musicianReviews.map(review => {
                    const matchedVenue = venues.find(v => v.venueId === review.venueId);
                    return {
                    ...review,
                    venueName: matchedVenue?.name || 'Unknown Venue',
                    venuePhoto: matchedVenue?.photos?.[0] || null,
                    };
                });
                enrichedReviews.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
                setReviews(reviews);
                setLoadingReviews(false);
            } catch (error) {
                console.error('Error fetching venue reviews:', error);
            }
        };
        fetchMusicianProfile();
        fetchVenueReviews();
    }, [nextGig, venues]);

    
    const formatName = (name) => {
        return name.split(' ')[0];
    };

    console.log(gigsToReview)

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

                <div className="recent-musicians">
                    <h2>Rate Previous Musicians</h2>

                </div>

                <FeedbackSection user={user} />

                {nextGigModal && (
                    <NextGig nextGig={nextGig[0]} musicianProfile={nextGigMusician} setNextGigModal={setNextGigModal} />
                )}
            </div>
        </>
    );
};