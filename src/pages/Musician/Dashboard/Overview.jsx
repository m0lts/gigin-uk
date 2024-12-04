import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import {CardForm} from '../../../components/common/CardDetails'
import { LoadingThreeDots } from "/components/ui/loading/Loading";
import { PlusIcon } from "/components/ui/Extras/Icons";
import { FaceFrownIcon, TelescopeIcon, SortIcon, HouseIcon, PeopleGroupIcon } from '../../../components/ui/Extras/Icons';
import { useGigs } from '../../../context/GigsContext';
import mapboxgl from 'mapbox-gl';
import { GigHandbook } from '../../../components/musician-components/GigHandbook';
import { PromoteModal } from '../../../components/common/PromoteModal';


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

    useEffect(() => {
        const filterGigs = () => {
            setLoading(true);
            if (!musicianProfile || !gigs || !Array.isArray(gigs)) {
                console.warn('Musician profile or gigs data is missing.');
                setLoading(false);
                return;
            }
            const clearedFeeGigIds = musicianProfile.clearedFees?.map((fee) => fee.gigId) || [];
            const filteredGigs = gigs.filter(gig => gigApplications?.includes(gig.gigId) || false);
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

    useEffect(() => {
        if (mapContainerRef.current && confirmedGigs.length > 0) {
            mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
                center: [confirmedGigs[0].coordinates[0], confirmedGigs[0].coordinates[1]],
                zoom: 15
            });

            new mapboxgl.Marker()
                .setLngLat([confirmedGigs[0].coordinates[0], confirmedGigs[0].coordinates[1]])
                .addTo(map);

            return () => map.remove();
        }
    }, [confirmedGigs]);

    const formatFeeDate = (timestamp) => {
        if (!timestamp) {
            console.error('Invalid or undefined timestamp passed to formatFeeDate');
            return 'Invalid date';
        }
    
        // Convert Firestore Timestamp to JavaScript Date
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    
        if (isNaN(date.getTime())) {
            console.error('Timestamp could not be converted to a valid date:', timestamp);
            return 'Invalid date'; // Handle invalid timestamps
        }
    
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
        const month = date.toLocaleDateString('en-GB', { month: 'short' });
    
        // Add ordinal suffix to the day
        const getOrdinalSuffix = (day) => {
            if (day > 3 && day < 21) return 'th';
            switch (day % 10) {
                case 1:
                    return 'st';
                case 2:
                    return 'nd';
                case 3:
                    return 'rd';
                default:
                    return 'th';
            }
        };
    
        return `${weekday}, ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const formatFeeDateLong = (timestamp) => {
        if (!timestamp) {
            console.error('Invalid or undefined timestamp passed to formatFeeDate');
            return 'Invalid date';
        }
    
        // Convert Firestore Timestamp to JavaScript Date
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    
        if (isNaN(date.getTime())) {
            console.error('Timestamp could not be converted to a valid date:', timestamp);
            return 'Invalid date'; // Handle invalid timestamps
        }
    
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
    
        // Add ordinal suffix to the day
        const getOrdinalSuffix = (day) => {
            if (day > 3 && day < 21) return 'th';
            switch (day % 10) {
                case 1:
                    return 'st';
                case 2:
                    return 'nd';
                case 3:
                    return 'rd';
                default:
                    return 'th';
            }
        };
    
        return `${weekday}, ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const openGigUrl = (gigId) => {
        const url = `/gig/${gigId}`;
        window.open(url, '_blank');
    };

    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

    const formatDurationSpan = (startTime, duration) => {
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(startHours, startMinutes, 0, 0);
    
        const endDate = new Date(startDate.getTime() + duration * 60000);
    
        const formatTime = (date) => {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        };
    
        return `${formatTime(startDate)} - ${formatTime(endDate)}`;
    };

    const getCityFromAddress = (address) => {
        const parts = address.split(',');
        return parts.length >= 3 ? parts[parts.length - 3].trim() : address;
    };

    return (
        <div className="overview-page">
            {nextGig ? (
                <div className="grid-tile next-gig" onClick={() => setShowGigHandbook(true)}>
                    <div className="top">
                        <div className="left">
                            <div className="icon-and-title">
                                <div className="icon-container">
                                    <HouseIcon />
                                </div>
                                <h1>Next Gig</h1>
                            </div>
                            <h2>{formatFeeDateLong(nextGig.date)}</h2>
                        </div>
                        <div className="right">
                            <h2>{formatDurationSpan(nextGig.startTime, nextGig.duration)}</h2>
                            <button className="primary btn" onClick={(e) => {e.stopPropagation(); setShowSocialsModal(true);}}>
                                <PeopleGroupIcon /> Promote
                            </button>
                        </div>
                    </div>
                    <div className="bottom">
                        <div className="left">
                            <div className='name-and-address'>
                                <h2>{nextGig.venue.venueName}</h2>
                                <h6>{getCityFromAddress(nextGig.venue.address)}</h6>
                            </div>
                            <div ref={mapContainerRef} className="map-container" style={{ height: '80%', width: '100%' }} />
                        </div>
                        <div className="right">
                            <h1>{nextGig.agreedFee}</h1>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid-tile">
                    <h2>Next Gig</h2>
                    <div className="no-pending-fees">
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
                            <th id="date">
                                Date
                                <button className="sort btn text" onClick={toggleSortOrder}>
                                    <SortIcon />
                                </button>
                            </th>
                            <th>Amount</th>
                            <th className="centre">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {confirmedGigs.length > 0 ? (
                            confirmedGigs.map((gig, index) => {
                                const applicant = gig.applicants.find((applicant) => applicant.id === musicianProfile.musicianId);
                                let status = 'unknown';
                                if (gig.disputeLogged) {
                                    status = 'in dispute';
                                } else if (applicant) {
                                    status = applicant.status === 'confirmed' ? 'pending' : applicant.status;
                                }
                                return (
                                    <tr key={index} onClick={() => openGigUrl(gig.gigId)}>
                                        <td>{formatFeeDate(gig.date)}</td>
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
                            <tr className="no-fees">
                                <td className="data" colSpan={6}>
                                    <div className="flex">
                                        <FaceFrownIcon />
                                        <h4>You have no pending fees.</h4>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="grid-tile">
                <h2>Gig Applications</h2>
                <table>
                    <thead>
                        <tr>
                            <th id="date">
                                Date
                                <button className="sort btn text" onClick={toggleSortOrder}>
                                    <SortIcon />
                                </button>
                            </th>
                            <th>Amount</th>
                            <th className="centre">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allGigDocuments.length > 0 ? (
                            allGigDocuments.map((gig, index) => {
                                const applicant = gig.applicants.find((applicant) => applicant.id === musicianProfile.musicianId);
                                let status = 'unknown';
                                if (gig.disputeLogged) {
                                    status = 'in dispute';
                                } else if (applicant) {
                                    status = applicant.status === 'confirmed' ? 'pending' : applicant.status;
                                }
                                return (
                                    <tr key={index} onClick={() => openGigUrl(gig.gigId)}>
                                        <td>{formatFeeDate(gig.date)}</td>
                                        <td>{gig.agreedFee ? gig.agreedFee : gig.budget}</td>
                                        <td className={`status-box ${status === 'pending' ? 'pending' : status === 'accepted' || status === 'in dispute' ? 'declined' : status === 'pending' ? 'pending' : status.toLowerCase() === 'paid' ? 'confirmed' : ''}`}>
                                            <div className={`status ${status === 'pending' ? 'pending' : status === 'accepted' || status === 'in dispute' ? 'declined' : status === 'pending' ? 'pending' : status.toLowerCase() === 'paid' ? 'confirmed' : ''}`}>
                                                {status === 'accepted' ? 'awaiting venue payment' : status === 'pending' ? 'payout pending' : status}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr className="no-fees">
                                <td className="data" colSpan={6}>
                                    <div className="flex">
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
            <div className="grid-tile find-gig hoverable" onClick={() => navigate('/find-a-gig')}>
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