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
import { CancelIcon, CloseIcon, DuplicateGigIcon, EditIcon, FilterIconEmpty, MailboxFullIcon, MicrophoneIconSolid, NewTabIcon, OptionsIcon, SearchIcon, ShieldIcon } from '../../shared/ui/extras/Icons';
import { getOrCreateConversation } from '../../../services/conversations';
import { getVenueProfileById } from '../../../services/venues';
import { markInviteAsViewed, updateMusicianCancelledGig } from '../../../services/musicians';
import { revertGigApplication } from '../../../services/gigs';
import { toast } from 'sonner';


export const Gigs = ({ gigApplications, musicianId, musicianProfile, gigs, bandProfiles, setGigs, setGigApplications }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchParams] = useSearchParams();
    const [sortOrder, setSortOrder] = useState('asc');
    const [gigDocuments, setGigDocuments] = useState([]);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [gigForHandbook, setGigForHandbook] = useState(null);
    const [usersConfirmedGigs, setUsersConfirmedGigs] = useState([]);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [openOptionsGigId, setOpenOptionsGigId] = useState(null);
    const [userCancelling, setUserCancelling] = useState(false);
    const [fromOptionsMenu, setFromOptionsMenu] = useState(false);
    const selectedProfile = searchParams.get('profile') || '';
    const selectedDate = searchParams.get('date') || '';
    const selectedStatus = searchParams.get('status') || 'all';

    useResizeEffect((width) => setWindowWidth(width));

    useEffect(() => {
        const filterGigs = () => {
            const confirmedGigs = gigs.filter(gig =>
                gig.applicants.some(applicant => applicant.id === musicianId && applicant.status === 'confirmed')
            );
            setGigDocuments(gigs);
            setUsersConfirmedGigs(confirmedGigs);
        };
        if (gigApplications && gigApplications.length > 0) {
            filterGigs();
        }
    }, [gigApplications, gigs]);

    useEffect(() => {
        const handleClickOutside = (e) => {
          if (!e.target.closest('.options-cell')) {
            setOpenOptionsGigId(null);
          }
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);


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
                return { icon: <ClockIcon />, text: 'Waiting for Payment Confirmation' };
            }
            if (applicant.status === 'pending') {
                return { icon: <ClockIcon />, text: 'Pending' };
            }
            if (applicant.status === 'declined') {
                return { icon: <RejectedIcon />, text: 'Declined' };
            }
        } else {
            return { icon: <PreviousIcon />, text: 'Previous' };
        }
    };

    const now = new Date();

    const allProfiles = useMemo(() => [
        ...(bandProfiles || []),
        ...(musicianProfile ? [musicianProfile] : [])
    ], [musicianProfile, bandProfiles])
  
    const normalizedGigs = useMemo(() => {
        return gigs.map(gig => {
          const dateObj = gig.date.toDate();
          const [hours, minutes] = gig.startTime.split(':').map(Number);
          dateObj.setHours(hours, minutes, 0, 0);
          const gigDateTime = new Date(dateObj);
          const isoDate = gigDateTime.toISOString().split('T')[0];
      
          const profileId = selectedProfile || musicianId;
      
          const applicant = gig.applicants?.find(app => app.id === profileId);
          const appStatus = applicant?.status;
      
          let status = 'previous';
          if (gigDateTime > now) {
            if (appStatus === 'confirmed') status = 'confirmed';
            else if (appStatus === 'accepted' || appStatus === 'pending') status = 'pending'; // Grouped
            else if (!appStatus && gig.status === 'open') status = 'upcoming';
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
      }, [gigs, now, selectedProfile, musicianId]);

    const handleSearchChange = (e) => setSearchQuery(e.target.value);
  
    const updateUrlParams = (key, value) => {
      const params = new URLSearchParams(location.search);
      value ? params.set(key, value) : params.delete(key);
      navigate(`?${params.toString()}`);
    };
  
    const filteredGigs = useMemo(() => {
      return normalizedGigs.filter(gig => {
        const matchesSearch = searchQuery === '' || gig.gigName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProfile =
        selectedProfile === '' ||
        gig.applicants?.some(app => app.id === selectedProfile);
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

    const toggleOptionsMenu = (gigId) => {
        setOpenOptionsGigId(prev => (prev === gigId ? null : gigId));
    };

    const closeOptionsMenu = () => {
        setOpenOptionsGigId(null);
    };

    const handleContactVenue = async (musicianProfile, gigData, venueId) => {
        try {
          const venueProfile = await getVenueProfileById(venueId);
          const fullMusicianProfile = allProfiles.find(
            (prof) => prof.id === musicianProfile.profileId
          );
      
          if (!fullMusicianProfile) {
            throw new Error('Full musician profile not found.');
          }
      
          const conversationId = await getOrCreateConversation(
            fullMusicianProfile,
            gigData,
            venueProfile
          );
      
          navigate(`/messages?conversationId=${conversationId}`);
        } catch (error) {
          console.error('Failed to contact venue:', error);
        }
    };

    const handleCancelGigApplication = async (musicianId, gigData) => {
        try {
          await updateMusicianCancelledGig(musicianId, gigData.gigId);
          await revertGigApplication(gigData, musicianId);
      
          setGigs(prev => prev.filter(g => g.gigId !== gigData.gigId));
          setGigApplications(prev => prev.filter(app => app.gigId !== gigData.gigId));
      
          toast.success('Gig application removed.');
        } catch (error) {
          console.error(error);
          toast.error('Failed to cancel application. Please try again.');
        }
      };

    return (
        <>
            <div className='head gigs'>
                <h1 className='title'>Gig Applications</h1>
                <div className='filters'>
                    <div className="status-buttons">
                        <button className={`btn ${selectedStatus === 'all' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'all')}>
                            All
                        </button>
                        <button className={`btn ${selectedStatus === 'confirmed' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'confirmed')}>
                            Confirmed
                        </button>
                        <button className={`btn ${selectedStatus === 'pending' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'pending')}>
                            Pending
                        </button>
                        <button className={`btn ${selectedStatus === 'previous' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'previous')}>
                            Previous
                        </button>
                    </div>
                    {windowWidth >= 1400 ? (
                        <>
                        {/* <span className="separator"></span>
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
                        </div> */}
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
                            id='profileSelect'
                            value={selectedProfile}
                            onChange={(e) => updateUrlParams('profile', e.target.value)}
                        >
                            <option value=''>Filter by Profile</option>
                            {allProfiles.map((profile) => (
                                <option value={profile.musicianId} key={profile.musicianId}>{profile.name}</option>
                            ))}
                        </select>
                        </>
                    ) : (
                        <>
                        <div className="spacer" />
                        <button className={`btn tertiary ${showMobileFilters ? 'open' : ''}`} onClick={() => setShowMobileFilters(prev => !prev)}>
                            <FilterIconEmpty />
                            Filters
                        </button>
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
                    <table>
                        <thead>
                            <tr>
                                {musicianProfile.bands && (
                                    <th id="profile">
                                        Profile
                                    </th>
                                )}
                                <th id='date'>
                                    Time and Date
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
                                // console.log(`${gig.gigName},`, gig)
                                const gigDateTime = new Date(`${gig.date.toDate().toISOString().split('T')[0]}T${gig.startTime}`);
                                const isFirstPreviousGig = index > 0 && gigDateTime < new Date() && 
                                    new Date(`${sortedGigs[index - 1].date.toDate().toISOString().split('T')[0]}T${sortedGigs[index - 1].startTime}`) >= new Date();
                                const gigStatus = getGigStatus(gig);
                                const appliedProfile = gigApplications?.find(app => app.gigId === gig.id);
                                const applicant = gig.applicants.find(
                                    (a) =>
                                      a.id === musicianId ||
                                      musicianProfile.bands?.includes(a.id)
                                  );
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
                                        <tr onClick={
                                            gigStatus.text.toLowerCase() === 'confirmed'
                                                ? () => openGigHandbook(gig)
                                                : (e) => openInNewTab(`/gig/${gig.gigId}?appliedAs=${appliedProfile.profileId}`, e)
                                        }
                                            onMouseEnter={() => {
                                                if (applicant.invited && !applicant.viewed) {
                                                    markInviteAsViewed(gig.gigId, applicant.id);
                                                }
                                            }}
                                        >
                                            {musicianProfile.bands && (
                                                <td className="applied-profile-name">
                                                    {applicant.invited && !applicant.viewed && (
                                                        <div className="new-invite">
                                                            <p>NEW INVITE</p>
                                                        </div>
                                                    )}
                                                    {appliedProfile?.name}
                                                </td>
                                            )}
                                            <td>
                                            {gig.startDateTime.toDate().toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false,
                                            })}{' - '}
                                            {gig.startDateTime.toDate().toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                            })}
                                            </td>
                                            <td>{gig.venue.venueName}</td>
                                            <td>{gig.kind}</td>
                                            <td className='centre'>
                                                {gig.applicants.length > 0
                                                    ? formatFee(gig.applicants.find(applicant => applicant.id === musicianId)?.fee || gig.budget)
                                                    : formatFee(gig.budget)}
                                            </td>
                                            <td
                                                className={`status-box ${
                                                    gigStatus.text.toLowerCase() === 'waiting for payment confirmation' ? 'pending' : gigStatus.text.toLowerCase()
                                                }`}
                                            >
                                                <div
                                                    className={`status ${
                                                        gigStatus.text.toLowerCase() === 'waiting for payment confirmation' ? 'pending' : gigStatus.text.toLowerCase()
                                                    }`}
                                                >
                                                    {gigStatus.icon} {gigStatus.text}
                                                </div>
                                            </td>
                                            <td className="options-cell" onClick={(e) => e.stopPropagation()}>
                                                <button className={`btn icon ${openOptionsGigId === gig.gigId ? 'active' : ''}`} onClick={() => toggleOptionsMenu(gig.gigId)}>
                                                    <OptionsIcon />
                                                </button>
                                                {openOptionsGigId === gig.gigId && (
                                                    <div className="options-dropdown">
                                                    <button onClick={() => { closeOptionsMenu(); navigate(`/venues/${gig.venueId}`) }}>View Venue Page <NewTabIcon /> </button>
                                                    <button onClick={() => {
                                                        closeOptionsMenu();
                                                        handleContactVenue(appliedProfile, gig, gig.venueId);
                                                    }}>
                                                        Contact Venue <MailboxFullIcon />
                                                    </button>
                                                    {(gigStatus.text === 'Confirmed' && gig.startDateTime.toDate() > now) ? (
                                                        <button onClick={() => { closeOptionsMenu(); setUserCancelling(true); setGigForHandbook(gig); setShowGigHandbook(true); setFromOptionsMenu(true) }} className='danger'>Cancel Gig <CancelIcon /></button>
                                                    ) : ((gigStatus.text === 'Pending' || gigStatus.text === 'Waiting for Payment Confirmation') && gig.startDateTime.toDate() > now) && (
                                                        <button onClick={() => { closeOptionsMenu(); handleCancelGigApplication(appliedProfile.profileId, gig) }} className='danger'>Remove Application <CancelIcon /></button>
                                                    )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <tr className='no-gigs'>
                                <td className='data' colSpan={7}>
                                    <div className='flex' style={{ margin: '1rem 0'}}>
                                        <h4>No Gigs to Show</h4>
                                    </div>
                                </td>
                            </tr>
                            )}
                        </tbody>
                    </table>
            </div>
            {showGigHandbook && (
                <GigHandbook 
                    setShowGigHandbook={setShowGigHandbook}
                    gigForHandbook={gigForHandbook}
                    musicianId={musicianId}
                    showConfirmation={userCancelling}
                    setShowConfirmation={setUserCancelling}
                    fromOptionsMenu={fromOptionsMenu}
                    setFromOptionsMenu={setFromOptionsMenu}
                />
            )}
        </>
    );
};