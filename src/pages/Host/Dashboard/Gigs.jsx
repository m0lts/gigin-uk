import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClockIcon, OptionsIcon, PreviousIcon, SortIcon, TickIcon } from '/components/ui/Extras/Icons';

export const Gigs = ({ gigs, venues, setGigPostModal, setEditGigData }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const queryParams = new URLSearchParams(location.search);

    const selectedVenue = queryParams.get('venue') || '';
    const selectedDate = queryParams.get('date') || '';
    const selectedStatus = queryParams.get('status') || 'all';

    const [sortOrder, setSortOrder] = useState('desc');
    const [editGigOptions, setEditGigOptions] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [gigToDelete, setGigToDelete] = useState(null);

    // Function to get the status of the gig
    const getGigStatus = (gig) => {
        const now = new Date();
        const gigDate = new Date(gig.date);

        if (gigDate > now) {
            const acceptedApplicant = gig.applicants.some(applicant => applicant.status === 'accepted');
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
        const gigDate = new Date(gig.date).toISOString().split('T')[0]; // Convert to YYYY-MM-DD format

        return (
            (selectedVenue === '' || gig.venue.venueId === selectedVenue) &&
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

    const handleEditGig = (gig) => {
        setEditGigOptions(false);
        setEditGigData(gig);
        setGigPostModal(true);
    }

    const handleDeleteGig = (gig) => {
        setGigToDelete(gig);
        setShowDeleteModal(true);
        setEditGigOptions(false);
    };

    const confirmDeleteGig = async () => {
        if (!gigToDelete) return;

        try {
            const response = await fetch('/api/gigs/deleteGig', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ gigId: gigToDelete.gigId, venueId: gigToDelete.venue.venueId }),
            });

            if (response.ok) {
                navigate(0);
            } else {
                console.error('Failed to delete gig');
            }
        } catch (error) {
            console.error('An error occurred while deleting the gig:', error);
        } finally {
            setShowDeleteModal(false);
            setGigToDelete(null);
        }
    };

    return (
        <>
            <div className="head">
                <h1 className="title">Gigs</h1>
                <button className="btn secondary" onClick={() => setGigPostModal(true)}>
                    Post a Gig
                </button>
            </div>
            <div className="body gigs">
                <div className="filter-bar">
                    <p className='subtitle'>Filters</p>
                    <div className="filters">
                        <select name="venueSelect" id="venueSelect" value={selectedVenue} onChange={handleVenueChange}>
                            <option value="">All venues</option>
                            {venues.map((venue, index) => (
                                <option value={venue.venueId} key={index}>{venue.name}</option>
                            ))}
                        </select>
                        <input type="date" name="dateSelect" id="dateSelect" value={selectedDate} onChange={handleDateChange} />
                        <select name="statusSelect" id="statusSelect" value={selectedStatus} onChange={handleStatusChange}>
                            <option value="all">All gigs</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="previous">Previous</option>
                        </select>
                        <button className="sort btn secondary" onClick={toggleSortOrder}>
                            Date {sortOrder}ending
                            <SortIcon />
                        </button>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Venue</th>
                            <th className='centre'>Budget</th>
                            <th className='centre'>Status</th>
                            <th className='centre'>Applications</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedGigs.map((gig, index) => {
                            const gigStatus = getGigStatus(gig);
                            return (
                                <tr key={index}>
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
                                    <td className='options-btn'>
                                        <button className={`btn icon ${editGigOptions === gig.gigId ? 'active' : ''}`} onClick={() => setEditGigOptions(gig.gigId === editGigOptions ? null : gig.gigId)}>
                                            <OptionsIcon />
                                        </button>
                                        {editGigOptions === gig.gigId && (
                                            <div className="gig-options">
                                                <button className="btn secondary" onClick={() => handleEditGig(gig)}>
                                                    Edit
                                                </button>
                                                <button className="btn danger" onClick={() => handleDeleteGig(gig)}>
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {showDeleteModal && (
                    <div className="modal">
                        <div className="modal-content">
                            <h2>Confirm Gig Deletion</h2>
                            <p>Are you sure you want to delete this gig?</p>
                            <div className="two-buttons">
                                <button className="btn secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                                <button className="btn danger" onClick={confirmDeleteGig}>Delete</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};




