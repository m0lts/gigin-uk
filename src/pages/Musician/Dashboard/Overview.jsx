import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import {CardForm} from '../../../components/common/CardDetails'
import { LoadingThreeDots } from "/components/ui/loading/Loading";
import { PlusIcon } from "/components/ui/Extras/Icons";
import { FaceFrownIcon, TelescopeIcon, SortIcon, HouseIcon } from '../../../components/ui/Extras/Icons';
import { useGigs } from '../../../context/GigsContext';
import mapboxgl from 'mapbox-gl';


export const Overview = ({ musicianProfile, gigApplications }) => {

    const navigate = useNavigate();
    const {gigs} = useGigs();
    const mapContainerRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [allGigDocuments, setAllGigDocuments] = useState([]);
    const [paidGigs, setPaidGigs] = useState([]);
    const [confirmedGigs, setConfirmedGigs] = useState([]);

    useEffect(() => {
        const filterGigs = () => {
            setLoading(true);
            const clearedFeeGigIds = musicianProfile.clearedFees.map((fee) => fee.gigId);
            const filteredGigs = gigs.filter(gig => gigApplications.includes(gig.gigId));
            const paidGigs = gigs.filter(gig => clearedFeeGigIds.includes(gig.gigId));
            const confirmedGigs = gigs.filter(gig => musicianProfile.confirmedGigs.includes(gig.gigId));
            const sortedConfirmedGigs = confirmedGigs.sort((a, b) => a.date.toDate() - b.date.toDate());
            const sortedFilteredGigs = filteredGigs.sort((a, b) => a.date.toDate() - b.date.toDate())
            setAllGigDocuments(sortedFilteredGigs);
            setConfirmedGigs(sortedConfirmedGigs);
            setPaidGigs(paidGigs);
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
        if (confirmedGigs.length > 0) {
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
                {confirmedGigs.length > 0 ? (
                <div className="grid-tile next-gig">
                    <div className="top">
                        <div className="left">
                            <div className="icon-and-title">
                                <div className="icon-container">
                                    <HouseIcon />
                                </div>
                                <h1>Next Gig</h1>
                            </div>
                                
                                <h2>{formatFeeDateLong(confirmedGigs[0].date)}</h2>
                        </div>
                        <div className="right">
                            <h2>{formatDurationSpan(confirmedGigs[0].startTime, confirmedGigs[0].duration)}</h2>
                        </div>
                    </div>
                    <div className="bottom">
                        <div className="left">
                            <div className='name-and-address'>
                                <h2>{confirmedGigs[0].venue.venueName}</h2>
                                <h6>{getCityFromAddress(confirmedGigs[0].venue.address)}</h6>
                            </div>
                            <div ref={mapContainerRef} className="map-container" style={{ height: '80%', width: '100%' }} />
                        </div>
                        <div className="right">
                            <h1>{confirmedGigs[0].agreedFee}</h1>
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
                <h2>Your Payments</h2>
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
                                const status = applicant ? applicant.status : 'unknown';
                                return (
                                    <tr key={index} onClick={() => openGigUrl(gig.gigId)}>
                                        <td>{formatFeeDate(gig.date)}</td>
                                        <td>{gig.agreedFee}</td>
                                        <td className={`status-box ${status === 'confirmed' ? 'succeeded' : status === 'awaiting payment' ? 'awaiting-payment' : ''}`}>
                                            <div className={`status ${status === 'confirmed' ? 'succeeded' : status === 'awaiting payment' ? 'awaiting-payment' : ''}`}>
                                                {status}
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
                                const status = applicant ? applicant.status : 'unknown';
                                return (
                                    <tr key={index} onClick={() => openGigUrl(gig.gigId)}>
                                        <td>{formatFeeDate(gig.date)}</td>
                                        <td>{gig.agreedFee ? gig.agreedFee : gig.budget}</td>
                                        <td className={`status-box ${status === 'confirmed' ? 'succeeded' : status === 'awaiting payment' ? 'awaiting-payment': status === 'pending' ? 'pending' : ''}`}>
                                            <div className={`status ${status === 'confirmed' ? 'succeeded' : status === 'awaiting payment' ? 'awaiting-payment': status === 'pending' ? 'pending' : ''}`}>
                                                {status}
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
        </div>
    );
};