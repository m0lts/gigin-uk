import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
    ClockIcon,
    DotIcon,
    PreviousIcon,
    SortIcon,
    TickIcon,
    CalendarIcon } from '@features/shared/ui/extras/Icons';
import { useResizeEffect } from '@hooks/useResizeEffect';

export const Gigs = ({ gigs, venues }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const queryParams = new URLSearchParams(location.search);

    const selectedVenue = queryParams.get('venue') || '';
    const selectedDate = queryParams.get('date') || '';
    const selectedStatus = queryParams.get('status') || 'all';

    const [sortOrder, setSortOrder] = useState('asc');
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useResizeEffect((width) => {
        setWindowWidth(width);
      });

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    // Function to get the status of the gig
    const getGigStatus = (gig) => {
        const now = new Date();
        const gigDate = gig.date.toDate();
        const [hours, minutes] = gig.startTime.split(':').map(Number); // Parse startTime (e.g., '14:30')

        // Combine gigDate and startTime into a single Date object
        gigDate.setHours(hours, minutes, 0, 0);

        if (gigDate > now) {
            const acceptedApplicant = gig.applicants.some(applicant => applicant.status === 'confirmed');
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
        const gigDate = format(gig.date.toDate(), 'yyyy-MM-dd');
    
        // Check if the search query matches the gig's name or description
        const matchesSearchQuery =
            searchQuery === '' ||
            gig.venue.venueName.toLowerCase().includes(searchQuery.toLowerCase());
    
        return (
            matchesSearchQuery &&
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
        const now = new Date();
    
        const aDateTime = new Date(`${a.date.toDate().toISOString().split('T')[0]}T${a.startTime}`);
        const bDateTime = new Date(`${b.date.toDate().toISOString().split('T')[0]}T${b.startTime}`);
    
        // If both gigs are in the future or both are in the past, sort by date
        if (aDateTime > now && bDateTime > now) {
            return sortOrder === 'desc' ? bDateTime - aDateTime : aDateTime - bDateTime;
        }
    
        if (aDateTime < now && bDateTime < now) {
            return sortOrder === 'desc' ? bDateTime - aDateTime : aDateTime - bDateTime;
        }
    
        // Move past gigs to the bottom
        return aDateTime < now ? 1 : -1;
    });

    return (
        <>
            <div className='head'>
                <h1 className='title'>Gigs</h1>
            </div>
            <div className='body gigs'>
                <div className='filters'>
                    <input 
                        type='text' 
                        placeholder='Search...' 
                        value={searchQuery} 
                        onChange={handleSearchChange} 
                        className='search-bar'
                    />
                    <input type='date' name='dateSelect' id='dateSelect' value={selectedDate} onChange={handleDateChange} />
                    <select name='venueSelect' id='venueSelect' value={selectedVenue} onChange={handleVenueChange}>
                        <option value=''>Venue</option>
                        {venues.map((venue, index) => (
                            <option value={venue.venueId} key={index}>{venue.name}</option>
                        ))}
                    </select>
                    <select name='statusSelect' id='statusSelect' value={selectedStatus} onChange={handleStatusChange}>
                        <option value='all'>Status</option>
                        <option value='upcoming'>Upcoming</option>
                        <option value='confirmed'>Confirmed</option>
                        <option value='previous'>Previous</option>
                    </select>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th id='date'>
                                Date
                                <button className='sort btn text' onClick={toggleSortOrder}>
                                    <SortIcon />
                                </button>
                            </th>
                            <th>Time</th>
                            <th>Venue</th>
                            {windowWidth > 880 && (
                                <th className='centre'>Budget</th>
                            )}
                            <th className='centre'>Status</th>
                            {windowWidth > 1268 && (
                                <th className='centre'>Applications</th>
                            )}
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedGigs.length > 0 ? (
                            sortedGigs.map((gig, index) => {
                                const gigDateTime = new Date(`${gig.date.toDate().toISOString().split('T')[0]}T${gig.startTime}`);
                                const isFirstPreviousGig = index > 0 && gigDateTime < new Date() && 
                                    new Date(`${sortedGigs[index - 1].date.toDate().toISOString().split('T')[0]}T${sortedGigs[index - 1].startTime}`) >= new Date();
                                const gigStatus = getGigStatus(gig);
                                return (
                                    <React.Fragment key={gig.id}>
                                        {isFirstPreviousGig && (
                                            <tr className='filler-row'>
                                                <td className='data' colSpan={8}>
                                                    <div className='flex center'>
                                                        <h4>Previous Gigs</h4>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td>{gig.date.toDate().toLocaleDateString('en-GB')}</td>
                                            <td>{gig.startTime}</td>
                                            <td style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>{gig.venue.venueName}</td>
                                            {windowWidth > 880 && (
                                                <td className='centre'>{gig.budget}</td>
                                            )}
                                            <td className={`status-box ${gigStatus.text.toLowerCase()}`}>
                                                <div className={`status ${gigStatus.text.toLowerCase()}`}>
                                                    {gigStatus.icon} {gigStatus.text}
                                                </div>
                                            </td>
                                            {windowWidth > 1268 && (
                                                <td className='centre'>
                                                    {gig.applicants.length}
                                                </td>
                                            )}
                                            <td className='action-data'>
                                                <button
                                                    className='btn text'
                                                    onClick={() => navigate('/venues/dashboard/gig-applications', { state: { gig } })}
                                                >
                                                    Gig Details
                                                </button>
                                            </td>
                                            {gig.applicants.some(applicant => !applicant.viewed) ? (
                                                <td className='notification'>
                                                    <DotIcon />
                                                </td>
                                            ) : (
                                                <td></td>
                                            )}
                                        </tr>
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <tr className='no-gigs'>
                                <td className='data' colSpan={6}>
                                    <div className='flex'>
                                        <CalendarIcon />
                                        <h4>No gigs to show.</h4>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};




