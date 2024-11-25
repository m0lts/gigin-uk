import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ClockIcon, OptionsIcon, PreviousIcon, SortIcon, TickIcon } from '/components/ui/Extras/Icons';
import { CalendarIcon, MailboxEmptyIcon, NewTabIcon, RejectedIcon, SearchIcon } from '../../../components/ui/Extras/Icons';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { firestore } from '../../../firebase';
import { useGigs } from '../../../context/GigsContext';

export const Gigs = ({ gigApplications, musicianId }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const { gigs } = useGigs();

    const queryParams = new URLSearchParams(location.search);
    const selectedDate = queryParams.get('date') || '';
    const selectedStatus = queryParams.get('status') || 'all';
    const [sortOrder, setSortOrder] = useState('desc');
    const [gigDocuments, setGigDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const filterGigs = () => {
            setLoading(true);

            // Filter the gigs based on gigApplications
            const filteredGigs = gigs.filter(gig => gigApplications.includes(gig.gigId));

            // Set the filtered gigs to state
            setGigDocuments(filteredGigs);
            setLoading(false);
        };

        if (gigApplications && gigApplications.length > 0) {
            filterGigs();
        } else {
            setGigDocuments([]);
            setLoading(false);
        }
    }, [gigApplications, gigs]);


    // Function to get the status of the gig
    const getGigStatus = (gig) => {
        const now = new Date();
        const gigDate = gig.date.toDate();

        const applicant = gig.applicants.find(applicant => applicant.id === musicianId);

        if (!applicant) {
            return { icon: <ClockIcon />, text: 'Not Applied' };
        }

        if (gigDate > now) {
            if (applicant.status === 'confirmed') {
                return { icon: <TickIcon />, text: 'Confirmed' };
            }
            if (applicant.status === 'accepted') {
                return { icon: <ClockIcon />, text: 'Waiting for Venue Payment' };
            }
            if (applicant.status === 'pending') {
                return { icon: <ClockIcon />, text: 'Pending' };
            }
            if (applicant.status === 'declined') {
                return { icon: <RejectedIcon />, text: 'Declined' };
            }
        }

        return { icon: <PreviousIcon />, text: 'Previous' };
    };

    // Update URL parameters when filter changes
    const updateUrlParams = (key, value) => {
        const params = new URLSearchParams(location.search);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        navigate(`?${params.toString()}`);
    };

    // Event handlers for filter changes
    const handleDateChange = (e) => {
        updateUrlParams('date', e.target.value);
    };

    const handleStatusChange = (e) => {
        updateUrlParams('status', e.target.value);
    };

    // Filter gigs based on URL parameters
    const filteredGigs = gigDocuments.filter(gig => {
        const gigStatus = getGigStatus(gig).text.toLowerCase();
        const gigDate = format(gig.date.toDate(), 'yyyy-MM-dd');
        return (
            (selectedDate === '' || gigDate === selectedDate) &&
            (selectedStatus === 'all' || gigStatus === selectedStatus)
        );
    });

    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

    // Sort gigs based on the current sort order
    const sortedGigs = filteredGigs.slice().sort((a, b) => {
        return sortOrder === 'desc'
            ? b.date.toDate() - a.date.toDate()
            : a.date.toDate() - b.date.toDate();
    });

    return (
        <>
            <div className="head">
                <h1 className="title">Gigs</h1>
            </div>
            <div className="body gigs musician">
                <div className="filters">
                    <div className="search-bar">
                        <SearchIcon />
                        <p>Search</p>
                    </div>
                    <input type="date" name="dateSelect" id="dateSelect" value={selectedDate} onChange={handleDateChange} />
                    <select name="statusSelect" id="statusSelect" value={selectedStatus} onChange={handleStatusChange}>
                        <option value="all">Status</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="previous">Previous</option>
                        <option value="pending">Waiting For Venue Payment</option>
                    </select>
                </div>

                {loading ? (
                    <p>Loading gigs...</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th id='date'>
                                    Date
                                    <button className="sort btn text" onClick={toggleSortOrder}>
                                        <SortIcon />
                                    </button>
                                </th>
                                <th>Time</th>
                                <th>Venue</th>
                                <th className='centre'>Fee</th>
                                <th className='centre'>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedGigs.length > 0 ? (
                                sortedGigs.map((gig, index) => {
                                    const gigStatus = getGigStatus(gig);
                                    return (
                                        <tr key={gig.id}>
                                            <td>{gig.date.toDate().toLocaleDateString('en-GB')}</td>
                                            <td>{gig.startTime}</td>
                                            <td>{gig.venue.venueName}</td>
                                            <td className='centre'>
                                                {
                                                    gig.applicants.length > 0 
                                                    ? gig.applicants.find(applicant => applicant.id === musicianId)?.fee || gig.budget
                                                    : gig.budget
                                                }
                                            </td>
                                            <td className={`status-box ${gigStatus.text.toLowerCase() === 'waiting for venue payment' ? 'pending' : gigStatus.text.toLowerCase()}`}>
                                                <div className={`status ${gigStatus.text.toLowerCase() === 'waiting for venue payment' ? 'pending' : gigStatus.text.toLowerCase()}`}>
                                                    {gigStatus.icon} {gigStatus.text}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr className='no-gigs'>
                                <td className='data' colSpan={6}>
                                    <div className="flex">
                                        <CalendarIcon />
                                        <h4>No gigs to show.</h4>
                                        <button className="btn secondary" onClick={() => navigate('/find-a-gig')}>
                                            Find Gigs
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
};