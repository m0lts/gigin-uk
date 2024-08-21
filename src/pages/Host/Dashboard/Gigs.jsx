import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ClockIcon, OptionsIcon, PreviousIcon, SortIcon, TickIcon } from '/components/ui/Extras/Icons';
import { SearchIcon } from '../../../components/ui/Extras/Icons';

export const Gigs = ({ gigs, venues }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const queryParams = new URLSearchParams(location.search);

    const selectedVenue = queryParams.get('venue') || '';
    const selectedDate = queryParams.get('date') || '';
    const selectedStatus = queryParams.get('status') || 'all';

    const [sortOrder, setSortOrder] = useState('desc');

    // Function to get the status of the gig
    const getGigStatus = (gig) => {
        const now = new Date();
        const gigDate = new Date(gig.date);

        if (gigDate > now) {
            const acceptedApplicant = gig.applicants.some(applicant => applicant.status === 'Accepted');
            if (acceptedApplicant) {
                return { icon: <TickIcon />, text: 'Confirmed' };
            }
            return { icon: <ClockIcon />, text: 'Upcoming' };
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
    const handleVenueChange = (e) => {
        updateUrlParams('venue', e.target.value);
    };

    const handleDateChange = (e) => {
        updateUrlParams('date', e.target.value);
    };

    const handleStatusChange = (e) => {
        updateUrlParams('status', e.target.value);
    };

    // Filter gigs based on URL parameters
    const filteredGigs = gigs.filter(gig => {
        const gigStatus = getGigStatus(gig).text.toLowerCase();
        const gigDate = format(new Date(gig.date), 'yyyy-MM-dd');
        return (
            (selectedVenue === '' || gig.venueId === selectedVenue) &&
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
            ? new Date(b.date) - new Date(a.date)
            : new Date(a.date) - new Date(b.date);
    });

    return (
        <>
            <div className="head">
                <h1 className="title">Gigs</h1>
            </div>
            <div className="body gigs">
                <div className="filters">
                    <div className="search-bar">
                        <SearchIcon />
                        <p>Search</p>
                    </div>
                    <input type="date" name="dateSelect" id="dateSelect" value={selectedDate} onChange={handleDateChange} />
                    <select name="venueSelect" id="venueSelect" value={selectedVenue} onChange={handleVenueChange}>
                        <option value="">Venue</option>
                        {venues.map((venue, index) => (
                            <option value={venue.venueId} key={index}>{venue.name}</option>
                        ))}
                    </select>
                    <select name="statusSelect" id="statusSelect" value={selectedStatus} onChange={handleStatusChange}>
                        <option value="all">Status</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="previous">Previous</option>
                    </select>
                </div>

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
                            <th className='centre'>Budget</th>
                            <th className='centre'>Status</th>
                            <th className='centre'>Applications</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedGigs.length > 0 ? (
                            sortedGigs.map((gig, index) => {
                                const gigStatus = getGigStatus(gig);
                                return (
                                    <tr key={index} onClick={() => navigate('/host/dashboard/gig-applications', { state: { gig } })}>
                                        <td>{new Date(gig.date).toLocaleDateString('en-GB')}</td>
                                        <td>{gig.startTime}</td>
                                        <td>{gig.venue.venueName}</td>
                                        <td className='centre'>{gig.budget}</td>
                                        <td className={`status-box ${gigStatus.text.toLowerCase()}`}>
                                            <div className={`status ${gigStatus.text.toLowerCase()}`}>
                                                {gigStatus.icon} {gigStatus.text}
                                            </div>
                                        </td>
                                        <td className='centre'>{gig.applicants.length}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td>No gigs to show.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};




