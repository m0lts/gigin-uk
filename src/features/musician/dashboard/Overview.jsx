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

export const Overview = ({ musicianProfile, gigApplications }) => {

    const navigate = useNavigate();
    const {gigs} = useGigs();
    const mapContainerRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [allGigDocuments, setAllGigDocuments] = useState([]);
    const [paidGigs, setPaidGigs] = useState([]);
    const [confirmedGigs, setConfirmedGigs] = useState([]);
    const [nextGig, setNextGig] = useState(null);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [showSocialsModal, setShowSocialsModal] = useState(false);

    useMapbox({
        containerRef: mapContainerRef,
        coordinates: confirmedGigs.length > 0 ? confirmedGigs[0].coordinates : null,
        zoom: 15,
        markers: confirmedGigs.length > 0 ? [confirmedGigs[0]] : [],
      });

    useEffect(() => {
        const filterGigs = () => {
            setLoading(true);
            if (!musicianProfile || !gigs || !Array.isArray(gigs)) {
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
                    const gigDateTime = new Date(`${gig.date.toDate().toISOString().split('T')[0]}T${gig.startTime}`);
                    return gigDateTime > new Date();
                })
                .sort((a, b) => {
                    const aDateTime = new Date(`${a.date.toDate().toISOString().split('T')[0]}T${a.startTime}`);
                    const bDateTime = new Date(`${b.date.toDate().toISOString().split('T')[0]}T${b.startTime}`);
                    return aDateTime - bDateTime;
                })[0];
            const sortedConfirmedGigs = confirmedGigs.sort((a, b) => a.date.toDate() - b.date.toDate());
            const sortedFilteredGigs = filteredGigs.sort((a, b) => a.date.toDate() - b.date.toDate());
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

    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

    return (
        <div className='overview-page'>
            {nextGig ? (
                <div className='grid-tile next-gig' onClick={() => setShowGigHandbook(true)}>
                    <div className='top'>
                        <div className='left'>
                            <div className='icon-and-title'>
                                <div className='icon-container'>
                                    <HouseIconLight />
                                </div>
                                <h1>Next Gig</h1>
                            </div>
                            <h2>{formatFeeDate(nextGig.date, 'long')}</h2>
                        </div>
                        <div className='right'>
                            <h2>{formatDurationSpan(nextGig.startTime, nextGig.duration)}</h2>
                            <button className='primary btn' onClick={(e) => {e.stopPropagation(); setShowSocialsModal(true);}}>
                                <PeopleGroupIcon /> Promote
                            </button>
                        </div>
                    </div>
                    <div className='bottom'>
                        <div className='left'>
                            <div className='name-and-address'>
                                <h2>{nextGig.venue.venueName}</h2>
                                <h6>{getCityFromAddress(nextGig.venue.address)}</h6>
                            </div>
                            <div ref={mapContainerRef} className='map-container' style={{ height: '80%', width: '100%' }} />
                        </div>
                        <div className='right'>
                            <h1>{nextGig.agreedFee}</h1>
                        </div>
                    </div>
                </div>
            ) : (
                <div className='grid-tile'>
                    <h2>Next Gig</h2>
                    <div className='no-pending-fees'>
                        <FaceFrownIcon />
                        <h4>You have no upcoming gigs.</h4>
                    </div>
                </div>
            )}
            <div className={`grid-tile`}>
                <h2>Your Gig Fees</h2>
                <table>
                    <thead>
                        <tr>
                            <th id='date'>
                                Date
                                <button className='sort btn text' onClick={toggleSortOrder}>
                                    <SortIcon />
                                </button>
                            </th>
                            <th>Amount</th>
                            <th className='centre'>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {confirmedGigs.length > 0 ? (
                            confirmedGigs.map((gig, index) => {
                                const applicant = gig.applicants.find(
                                    (applicant) =>
                                      applicant.id === musicianProfile.musicianId ||
                                      musicianProfile.bands?.includes(applicant.id)
                                  );
                                let status = 'unknown';
                                if (gig.disputeLogged) {
                                    status = 'in dispute';
                                } else if (applicant) {
                                    status = applicant.status === 'confirmed' ? 'pending' : applicant.status;
                                }
                                const appliedProfile = musicianProfile.gigApplications?.find(app => app.gigId === gig.id);
                                return (
                                    <tr key={index} onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}>
                                        {musicianProfile.bands && appliedProfile && (
                                            <td className="applied-profile-name">
                                                {appliedProfile.name}
                                            </td>
                                        )}
                                        <td>{formatFeeDate(gig.date, 'short')}</td>
                                        <td>£{(parseFloat(gig.agreedFee.replace('£', '')) * 0.95).toFixed(2)}</td>
                                        <td className={`status-box ${status === 'pending' ? 'pending' : status === 'awaiting payment' ? 'awaiting-payment' : status.toLowerCase() === 'paid' ? 'confirmed' : status === 'in dispute' ? 'declined' : ''}`}>
                                            <div className={`status ${status === 'pending' ? 'pending' : status === 'awaiting payment' ? 'awaiting-payment' : status.toLowerCase() === 'paid' ? 'confirmed' : status === 'in dispute' ? 'declined' : ''}`}>
                                                {status === 'pending' ? 'payout pending' : status}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr className='no-fees'>
                                <td className='data' colSpan={6}>
                                    <div className='flex'>
                                        <FaceFrownIcon />
                                        <h4>You have no pending fees.</h4>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className='grid-tile'>
                <h2>Gig Applications</h2>
                <table>
                    <thead>
                        <tr>
                            {musicianProfile.bands && (
                                <th id="profile">
                                    Profile
                                </th>
                            )}
                            <th id='date'>
                                Date
                                <button className='sort btn text' onClick={toggleSortOrder}>
                                    <SortIcon />
                                </button>
                            </th>
                            <th>Amount</th>
                            <th className='centre'>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allGigDocuments.length > 0 ? (
                            allGigDocuments.map((gig, index) => {
                                const applicant = gig.applicants.find(
                                    (applicant) =>
                                      applicant.id === musicianProfile.musicianId ||
                                      musicianProfile.bands?.includes(applicant.id)
                                  );
                                let status = 'unknown';
                                if (gig.disputeLogged) {
                                    status = 'in dispute';
                                } else if (applicant) {
                                    status = applicant.status === 'confirmed' ? 'pending' : applicant.status;
                                }
                                const appliedProfile = musicianProfile.gigApplications?.find(app => app.gigId === gig.id);
                                return (
                                    <tr key={index} onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}>
                                        {musicianProfile.bands && appliedProfile && (
                                            <td className="applied-profile-name">
                                                {appliedProfile.name}
                                            </td>
                                        )}
                                        <td>{formatFeeDate(gig.date, 'short')}</td>
                                        <td>{gig.agreedFee ? gig.agreedFee : gig.budget}</td>
                                        <td className={`status-box ${status === 'pending' ? 'pending' : status === 'accepted' || status === 'in dispute' ? 'declined' : status === 'pending' ? 'pending' : status.toLowerCase() === 'paid' ? 'confirmed' : ''}`}>
                                            <div className={`status ${status === 'pending' ? 'pending' : status === 'accepted' || status === 'in dispute' ? 'declined' : status === 'pending' ? 'pending' : status.toLowerCase() === 'paid' ? 'confirmed' : ''}`}>
                                                {status === 'accepted' ? 'awaiting venue payment' : status === 'pending' ? 'pending' : status}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr className='no-fees'>
                                <td className='data' colSpan={6}>
                                    <div className='flex'>
                                        <FaceFrownIcon />
                                        <h4>You have no upcoming gigs.</h4>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* <div className={`grid-tile `}>
                <h2>Messages</h2>
            </div> */}
            <div className='grid-tile find-gig hoverable' onClick={() => navigate('/find-a-gig')}>
                <TelescopeIcon />
                <h2>Find a Gig</h2>
            </div>
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
    );
};