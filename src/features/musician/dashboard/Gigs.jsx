import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { 
    ClockIcon,
    PreviousIcon,
    SortIcon,
    TickIcon,
    CalendarIconSolid,
    RejectedIcon } from '@features/shared/ui/extras/Icons';
import { useGigs } from '@context/GigsContext';
import { GigHandbook } from '@features/musician/components/GigHandbook';
import { openInNewTab } from '../../../services/utils/misc';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { FilterIconEmpty, SearchIcon } from '../../shared/ui/extras/Icons';


export const Gigs = ({ gigApplications, musicianId, musicianProfile, gigs, bandProfiles }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchParams] = useSearchParams();
    const [sortOrder, setSortOrder] = useState('asc');
    const [gigDocuments, setGigDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [gigForHandbook, setGigForHandbook] = useState(null);
    const [usersConfirmedGigs, setUsersConfirmedGigs] = useState([]);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [allProfiles, setAllProfiles] = useState([
        ...(bandProfiles || []),
        ...(musicianProfile ? [musicianProfile] : [])
      ]);
    const selectedProfile = searchParams.get('profile') || '';
    const selectedDate = searchParams.get('date') || '';
    const selectedStatus = searchParams.get('status') || 'all';

    useResizeEffect((width) => setWindowWidth(width));

    useEffect(() => {
        const filterGigs = () => {
            setLoading(true);
            const confirmedGigs = filteredGigs.filter(gig =>
                gig.applicants.some(applicant => applicant.id === musicianId && applicant.status === 'confirmed')
            );
            setGigDocuments(gigs);
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
        const applicant = gig.applicants.find(
            (applicant) =>
              applicant.id === musicianId ||
              musicianProfile.bands?.includes(applicant.id)
          );
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

    const now = useMemo(() => new Date(), []);
  
    const normalizedGigs = useMemo(() => {
      return gigs.map(gig => {
        const dateObj = gig.date.toDate();
        const [hours, minutes] = gig.startTime.split(':').map(Number);
        dateObj.setHours(hours);
        dateObj.setMinutes(minutes);
        dateObj.setSeconds(0);
        dateObj.setMilliseconds(0);
        const gigDateTime = new Date(dateObj); // local datetime
    
        const isoDate = gigDateTime.toISOString().split('T')[0];
    
        const acceptedApplicant = gig.applicants?.some(app => app.status === 'confirmed');
        let status = 'previous';
    
        if (gigDateTime > now) {
          if (acceptedApplicant) status = 'confirmed';
          else if (gig.status === 'open') status = 'upcoming';
          else status = 'closed';
        }
    
        return {
          ...gig,
          dateObj: gigDateTime,
          dateIso: isoDate,
          dateTime: gigDateTime,
          status,
        };
      });
    }, [gigs, now]);

    const handleSearchChange = (e) => setSearchQuery(e.target.value);
  
    const updateUrlParams = (key, value) => {
      const params = new URLSearchParams(location.search);
      value ? params.set(key, value) : params.delete(key);
      navigate(`?${params.toString()}`);
    };
  
    const filteredGigs = useMemo(() => {
      return normalizedGigs.filter(gig => {
        const matchesSearch = searchQuery === '' || gig.gigName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProfile = selectedProfile === '' || gig.venueId === selectedProfile;
        const matchesDate = selectedDate === '' || gig.dateIso === selectedDate;
        const matchesStatus = selectedStatus === 'all' || gig.status === selectedStatus;
  
        return matchesSearch && matchesProfile && matchesDate && matchesStatus;
      });
    }, [normalizedGigs, searchQuery, selectedProfile, selectedDate, selectedStatus]);
  
    const sortedGigs = useMemo(() => {
      return filteredGigs.slice().sort((a, b) => {
        if (a.dateTime > now && b.dateTime > now) {
          return sortOrder === 'desc' ? b.dateTime - a.dateTime : a.dateTime - b.dateTime;
        }
        if (a.dateTime < now && b.dateTime < now) {
          return sortOrder === 'desc' ? b.dateTime - a.dateTime : a.dateTime - b.dateTime;
        }
        return a.dateTime < now ? 1 : -1;
      });
    }, [filteredGigs, sortOrder, now]);


    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

    const openGigHandbook = (gig) => {
        setShowGigHandbook(true);
        setGigForHandbook(gig);
    }

    const formatFee = (fee) => {
        return fee === '£' ? 'No Fee' : fee;
      };

    return (
        <>
            <div className='head gigs'>
                <h1 className='title'>Gigs</h1>
                <div className='filters'>
                    <div className="status-buttons">
                        <button className={`btn ${selectedStatus === 'all' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'all')}>
                            All
                        </button>
                        <button className={`btn ${selectedStatus === 'confirmed' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'confirmed')}>
                            Confirmed
                        </button>
                        <button className={`btn ${selectedStatus === 'upcoming' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'upcoming')}>
                            Upcoming
                        </button>
                        <button className={`btn ${selectedStatus === 'previous' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'previous')}>
                            Previous
                        </button>
                    </div>
                    {windowWidth >= 1400 ? (
                        <>
                        <span className="separator"></span>
                        <div className="search-bar-container">
                            <SearchIcon />
                            <input
                            type='text'
                            placeholder='Search By Name...'
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className='search-bar'
                            aria-label='Search gigs'
                            />
                        </div>
                        <span className="separator"></span>
                        <input
                            type='date'
                            id='dateSelect'
                            value={selectedDate}
                            onChange={(e) => updateUrlParams('date', e.target.value)}
                            className='date-select'
                        />
                        <span className="separator"></span>
                        <select
                            id='venueSelect'
                            value={selectedProfile}
                            onChange={(e) => updateUrlParams('profile', e.target.value)}
                        >
                            <option value=''>Filter by Profile</option>
                            {allProfiles.map((profile) => (
                            <option value={profile.musicianId} key={profile.musicianId}>{profile.name}</option>
                            ))}
                        </select>
                        <div className="spacer" />
                        <button className='btn primary' onClick={() => setGigPostModal(true)}>New Gig</button>
                        </>
                    ) : (
                        <>
                        <div className="spacer" />
                        <button className={`btn tertiary ${showMobileFilters ? 'open' : ''}`} onClick={() => setShowMobileFilters(prev => !prev)}>
                            <FilterIconEmpty />
                            Filters
                        </button>
                        <button className='btn primary' onClick={() => setGigPostModal(true)}>New Gig</button>
                        </>
                    )}
                </div>

                {windowWidth < 1400 && showMobileFilters && (
                    <div className="filters ext">
                        <input
                            type='date'
                            id='dateSelect'
                            value={selectedDate}
                            onChange={(e) => updateUrlParams('date', e.target.value)}
                            className='date-select'
                        />
                        <select
                            id='venueSelect'
                            value={selectedProfile}
                            onChange={(e) => updateUrlParams('profile', e.target.value)}
                        >
                            <option value=''>Filter by Profile</option>
                            {allProfiles.map((profile) => (
                            <option value={profile.musicianId} key={profile.musicianId}>{profile.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
            <div className='body gigs musician'>
                {loading ? (
                    <p>Loading gigs...</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                {musicianProfile.bands && (
                                    <th id="profile">
                                        Profile
                                    </th>
                                )}
                                <th id='date'>
                                    Date and Time
                                    <button className='sort btn text' onClick={toggleSortOrder}>
                                        <SortIcon />
                                    </button>
                                </th>
                                <th>Venue</th>
                                <th>Type</th>
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
                                const appliedProfile = musicianProfile.gigApplications?.find(app => app.gigId === gig.id);
                                return (
                                    <React.Fragment key={gig.id}>
                                        {isFirstPreviousGig && (
                                            <tr className='filler-row'>
                                                <td className='data' colSpan={7}>
                                                    <div className='flex center'>
                                                        <h4>Previous Gigs</h4>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        <tr>
                                            {musicianProfile.bands && appliedProfile && (
                                                <td className="applied-profile-name">
                                                    {appliedProfile.name}
                                                </td>
                                            )}
                                            <td>{gig.startDateTime.toDate().toLocaleDateString('en-GB')}</td>
                                            <td>{gig.venue.venueName}</td>
                                            <td>{gig.kind}</td>
                                            <td className='centre'>
                                                {gig.applicants.length > 0
                                                    ? formatFee(gig.applicants.find(applicant => applicant.id === musicianId)?.fee || gig.budget)
                                                    : formatFee(gig.budget)}
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
                                                    className='btn text'
                                                    onClick={
                                                        gigStatus.text.toLowerCase() === 'confirmed'
                                                            ? () => openGigHandbook(gig)
                                                            : (e) => openInNewTab(`/gig/${gig.gigId}`, e)
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
                                <td className='data' colSpan={7}>
                                    <div className='flex'>
                                        <CalendarIconSolid />
                                        <h4>No gigs to show.</h4>
                                        <button className='btn secondary' onClick={() => navigate('/find-a-gig')}>
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