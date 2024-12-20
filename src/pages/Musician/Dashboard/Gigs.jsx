import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ClockIcon, OptionsIcon, PreviousIcon, SortIcon, TickIcon } from '/components/ui/Extras/Icons';
import { CalendarIcon, MailboxEmptyIcon, NewTabIcon, RejectedIcon, SearchIcon } from '../../../components/ui/Extras/Icons';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { firestore } from '../../../firebase';
import { useGigs } from '../../../context/GigsContext';
import { GigHandbook } from '../../../components/musician-components/GigHandbook';

export const Gigs = ({ gigApplications, musicianId }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    const { gigs } = useGigs();

    const queryParams = new URLSearchParams(location.search);
    const selectedDate = queryParams.get('date') || '';
    const selectedStatus = queryParams.get('status') || 'all';
    const [sortOrder, setSortOrder] = useState('asc');
    const [gigDocuments, setGigDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [gigForHandbook, setGigForHandbook] = useState(null);
    const [usersConfirmedGigs, setUsersConfirmedGigs] = useState([]);

    useEffect(() => {
        const filterGigs = () => {
            setLoading(true);
            const filteredGigs = gigs.filter(gig => gigApplications.includes(gig.gigId));
            const confirmedGigs = filteredGigs.filter(gig =>
                gig.applicants.some(applicant => applicant.id === musicianId && applicant.status === 'confirmed')
            );
            setGigDocuments(filteredGigs);
            setUsersConfirmedGigs(confirmedGigs);
            setLoading(false);
        };
        if (gigApplications && gigApplications.length > 0) {
            filterGigs();
        } else {
            setGigDocuments([]);
            setLoading(false);
        }
    }, [gigApplications, gigs]);


    const getGigStatus = (gig) => {
        const now = new Date();
        const gigDate = gig.date.toDate();
        const [hours, minutes] = gig.startTime.split(':').map(Number);
        gigDate.setHours(hours, minutes, 0, 0);
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

    const updateUrlParams = (key, value) => {
        const params = new URLSearchParams(location.search);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        navigate(`?${params.toString()}`);
    };

    const handleDateChange = (e) => {
        updateUrlParams('date', e.target.value);
    };

    const handleStatusChange = (e) => {
        updateUrlParams('status', e.target.value);
    };

    const filteredGigs = gigDocuments.filter(gig => {
        const gigStatus = getGigStatus(gig).text.toLowerCase();
        const gigDate = format(gig.date.toDate(), 'yyyy-MM-dd');
    
        const matchesSearchQuery =
            searchQuery === '' ||
            gig.venue.venueName.toLowerCase().includes(searchQuery.toLowerCase());
    
        return (
            matchesSearchQuery &&
            (selectedDate === '' || gigDate === selectedDate) &&
            (selectedStatus === 'all' || gigStatus === selectedStatus)
        );
    });

    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

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

    const openGig = (e, gigId) => {
        e.stopPropagation();
        const url = `/gig/${gigId}`;
        window.open(url, '_blank');
    };

    const openGigHandbook = (gig) => {
        setShowGigHandbook(true);
        setGigForHandbook(gig);
    }

    return (
        <>
            <div className="head">
                <h1 className="title">Gigs</h1>
            </div>
            <div className="body gigs musician">
                <div className="filters">
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchQuery} 
                        onChange={handleSearchChange} 
                        className="search-bar"
                    />
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
                                            <tr className="filler-row">
                                                <td className="data" colSpan={6}>
                                                    <div className="flex center">
                                                        <h4>Previous Gigs</h4>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td>{gig.date.toDate().toLocaleDateString('en-GB')}</td>
                                            <td>{gig.startTime}</td>
                                            <td>{gig.venue.venueName}</td>
                                            <td className="centre">
                                                {gig.applicants.length > 0
                                                    ? gig.applicants.find(applicant => applicant.id === musicianId)?.fee || gig.budget
                                                    : gig.budget}
                                            </td>
                                            <td
                                                className={`status-box ${
                                                    gigStatus.text.toLowerCase() === 'waiting for venue payment' ? 'pending' : gigStatus.text.toLowerCase()
                                                }`}
                                            >
                                                <div
                                                    className={`status ${
                                                        gigStatus.text.toLowerCase() === 'waiting for venue payment' ? 'pending' : gigStatus.text.toLowerCase()
                                                    }`}
                                                >
                                                    {gigStatus.icon} {gigStatus.text}
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn text"
                                                    onClick={
                                                        gigStatus.text.toLowerCase() === 'confirmed'
                                                            ? () => openGigHandbook(gig)
                                                            : (e) => openGig(e, gig.gigId)
                                                    }
                                                >
                                                    See Gig Info
                                                </button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
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
            {showGigHandbook && (
                <GigHandbook 
                    setShowGigHandbook={setShowGigHandbook}
                    showGigHandbook={showGigHandbook}
                    setGigForHandbook={setGigForHandbook}
                    gigForHandbook={gigForHandbook}
                    usersConfirmedGigs={usersConfirmedGigs}
                    musicianId={musicianId}
                />
            )}
        </>
    );
};