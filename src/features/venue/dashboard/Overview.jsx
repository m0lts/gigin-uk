import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { 
    DotIcon,
    PeopleGroupIcon,
    StarIcon } from '@features/shared/ui/extras/Icons';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { getMusicianProfileByMusicianId } from '@services/musicians';
import { getReviewsByVenueIds } from '@services/reviews';
import { getConversationsByParticipantAndGigId } from '@services/conversations';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { formatDurationSpan } from '@services/utils/misc';
import { openInNewTab } from '@services/utils/misc';
import { formatFeeDate } from '@services/utils/dates';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const Overview = ({ savedCards, loadingStripeDetails, receipts, gigs, loadingGigs, venues, setGigPostModal }) => {

    const navigate = useNavigate();
    const [showSocialsModal, setShowSocialsModal] = useState(false);
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

    const earningsData = receipts.reduce((acc, receipt) => {
        const receiptDate = new Date(receipt.metadata.date).toLocaleDateString('en-GB', {
            month: 'short',
            year: 'numeric',
        });
        acc[receiptDate] = (acc[receiptDate] || 0) + receipt.amount / 100;
        return acc;
      }, {});
    
    
      const chartData = {
          labels: Object.keys(earningsData), // Dates (month/year)
          datasets: [
              {
                  label: 'Total Expenditure (£)',
                  data: Object.values(earningsData), // Earnings corresponding to the labels
                  backgroundColor: 'rgba(255, 233, 228, 0.5)',
                  borderColor: 'rgba(255, 108, 75, 1)',
                  borderWidth: 1,
              },
          ],
      };
    
      // Chart configuration options
      const chartOptions = {
          responsive: true,
          plugins: {
              legend: {
                  display: false,
              },
              title: {
                  display: true,
                  text: 'Expenditure Over Time',
                  font: {
                      size: 18,
                      family: 'DM Sans',
                      weight: 'bold',
                  },
                  color: '#333',
              },
              tooltip: {
                  enabled: true,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)', // Tooltip background
                  titleColor: '#fff', // Title font color
                  bodyColor: '#fff', // Body font color
                  borderColor: '#ddd', // Tooltip border
                  borderWidth: 1, // Tooltip border width
              },
          },
          scales: {
              x: {
                  grid: {
                      display: false,
                  },
                  ticks: {
                      color: '#333',
                      font: {
                          size: 12,
                          family: 'DM Sans',
                      },
                  },
              },
              y: {
                  grid: {
                      color: '#e0e0e0',
                      borderDash: [4, 4],
                  },
                  ticks: {
                      color: '#333',
                      font: {
                          size: 12,
                          family: 'DM Sans',
                      },
                  },
                  beginAtZero: true,
              },
          },
      };

    const formatReceiptCharge = (amount) => {
        return (amount / 100).toFixed(2);
    };

    const formatReceiptDate = (timestamp) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const openMessages = async (gigId, musicianId) => {
        try {
          const conversations = await getConversationsByParticipantAndGigId(gigId, musicianId);
          if (conversations.length > 0) {
            navigate(`/messages?conversationId=${conversations[0].id}`);
          }
        } catch (error) {
          console.error('Error finding conversation:', error);
        }
      };

    return (
        <div className='overview'>
            {!loadingGigs ? (
                nextGig.length > 0 ? (
                    <div className='grid-tile next-gig'>
                        <div className='top'>
                            <div className='left'>
                                <div className='next-gig-img-container'>
                                    <img src={nextGig[0].venue.photo} alt={nextGig[0].venue.venueName} />
                                </div>
                                <div className='details'>
                                    <h2>Next Gig</h2>
                                    <h3>{formatFeeDate(nextGig[0].date)}</h3>
                                    <h3>{formatDurationSpan(nextGig[0].startTime, nextGig[0].duration)}</h3>
                                </div>
                            </div>
                            <div className='right'>
                                <button className='primary-alt btn' onClick={(e) => {e.stopPropagation(); setShowSocialsModal(true); setSocialsId(nextGig[0].venueId)}}>
                                    <PeopleGroupIcon /> Promote
                                </button>
                            </div>
                        </div>
                        {nextGigMusician ? (
                            <div className='bottom'>
                                <div className='musician-name-and-photo'>
                                    <div className='musician-img'>
                                        <img src={nextGigMusician.picture} alt={nextGigMusician.name} width={100} height={100} />
                                    </div>
                                    <div className='musician-name-and-reviews'>
                                        <h1>{nextGigMusician.name}</h1>
                                        {nextGigMusician.avgReviews?.avgRating && nextGigMusician.avgReviews?.totalReviews && (
                                            <h6><StarIcon /> {nextGigMusician.avgReviews.avgRating} ({nextGigMusician.avgReviews.totalReviews})</h6>
                                        )}
                                    </div>
                                </div>
                                <div className='two-buttons'>
                                    <button className='btn primary' onClick={() => openMessages(nextGig[0].gigId, nextGig[0].applicants.find((applicant) => applicant.status === 'confirmed').id)}>
                                        Message Musician
                                    </button>
                                    <button className='btn secondary' onClick={() => navigate('/venues/dashboard/gig-applications', { state: { gig: nextGig[0] } })}>
                                        View Gig
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className='bottom'>
                                <Skeleton width={'100%'} height={'100%'} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className='grid-tile no-applications'>
                        <h2>No confirmed gigs.</h2>
                        <button className='btn primary' onClick={() => setGigPostModal(true)}>
                            Create a Gig
                        </button>
                    </div>
                )
            ) : (
                <div className='grid-tile loading'>
                    <Skeleton width={'100%'} height={'100%'} />
                </div>
            )}
            {!loadingGigs ? (
                <div className='grid-tile'>
                    <h2>New Gig Applications</h2>
                    {newApplicationsGigs.length > 0 ? (
                        <ul className='new-applicants-list'>
                        {newApplicationsGigs.flatMap((gig) => 
                            gig.applicants
                                .filter(applicant => applicant.viewed === false || applicant.viewed === undefined)
                                .map((applicant) => (
                                    <div key={`${gig.gigId}-${applicant.id}`} className='new-applicant' onClick={() => navigate('/venues/dashboard/gig-applications', { state: { gig } })}>
                                        <div className='name-and-date'>
                                            <h4>{gig.venue.venueName || 'Unknown Venue'}</h4>
                                            <h6>{gig.date.toDate().toLocaleDateString('en-GB')}</h6>
                                        </div>
                                        <div className='fee-and-notification'>
                                            <h4>View</h4>
                                            <DotIcon />
                                        </div>
                                    </div>
                                ))
                            )
                        }
                        </ul>
                    ) : (
                        <div className='no-applications'>
                            <h4>You have no unseen applications.</h4>
                            <button className='btn primary' onClick={() => navigate('/venues/dashboard/musicians/find')}>
                                Find a Musician
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className='grid-tile loading'>
                    <Skeleton width={'100%'} height={'100%'} />
                </div>
            )}
            {loadingStripeDetails ? (
                <div className={`grid-tile ${loadingStripeDetails ? 'loading' : ''}`}>
                    <Skeleton width={'100%'} height={'100%'} />
                </div>
            ) : (
                <div className={`grid-tile`}>
                        <h2>Your Payments</h2>
                        {receipts.length > 0 ? (
                            <ul className='receipt-list'>
                                {receipts.map((receipt) => (
                                    <li className='receipt-item' key={receipt.id} onClick={(e) => openInNewTab(receipt.receipt_url, e)}>
                                        <div className='receipt-left'>
                                            <h4>£{formatReceiptCharge(receipt.amount)}</h4>
                                            <h6>{formatReceiptDate(receipt.created)}</h6>
                                        </div>
                                        <div className='receipt-right'>
                                            <span className={`status ${receipt.paid === true ? 'paid' : 'due'}`}>
                                                {receipt.paid === true ? (
                                                    'Paid'
                                                ) : (
                                                    'Due'
                                                )}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <h4>You have no payment records.</h4>
                        )}
                </div>
            )}
            {windowWidth > 1268 && (
                <>
                    {!loadingGigs ? (
                        <div className='grid-tile'>
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    ) : (
                        <div className='grid-tile loading'>
                            <Skeleton width={'100%'} height={'100%'} />
                        </div>
                    )}
                    {!loadingReviews ? (
                        reviews.length > 0 ? (
                            <div className='grid-tile reviews'>
                                <h2>Recent Reviews</h2>
                                <ul className='venue-reviews'>
                                    {reviews.map((review, index) => (
                                        <li key={index} className='venue-review'>
                                                <div className='reviewed-venue'>
                                                    <figure className='reviewed-venue-img'>
                                                        <img src={review.venuePhoto} alt={review.venueName} />
                                                    </figure>
                                                    <h4>{review.venueName}</h4>
                                                </div>
                                                <div className='review-rating'>
                                                    <StarIcon />
                                                    <h4>{review.rating}</h4>
                                                </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className='grid-tile reviews'>
                                <h2>Recent Reviews</h2>
                                <h4>No reviews yet.</h4>
                            </div>
                        )
                    ) : (
                        <div className='grid-tile loading'>
                            <Skeleton width={'100%'} height={'100%'} />
                        </div>
                    )}
                </>
            )}
            {showSocialsModal && (
                <PromoteModal setShowSocialsModal={setShowSocialsModal} socialLinks={null} venueId={socialsId} musicianId={null} />
            )}
        </div>
    );
};