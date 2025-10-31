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
import { GigHandbook } from '@features/musician/components/GigHandbook';
import { openInNewTab } from '../../../services/utils/misc';
import { CancelIcon, CloseIcon, DuplicateGigIcon, EditIcon, ExclamationIcon, FilterIconEmpty, MailboxFullIcon, MicrophoneIconSolid, NewTabIcon, OptionsIcon, SaveIcon, SavedIcon, SearchIcon, ShieldIcon } from '../../shared/ui/extras/Icons';
import { getOrCreateConversation } from '@services/function-calls/conversations';
import { getVenueProfileById } from '../../../services/client-side/venues';
import { getMusicianProfileByMusicianId, withdrawMusicianApplication } from '../../../services/client-side/musicians';
import { toast } from 'sonner';
import { markInviteAsViewed } from '../../../services/function-calls/musicians';
import { useBreakpoint } from '../../../hooks/useBreakpoint';


export const Gigs = ({ gigApplications, musicianId, musicianProfile, gigs, bandProfiles, setGigs, setGigApplications, savedGigs, setSavedGigs }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const {isMdUp, isLgUp, isXlUp, isSmUp} = useBreakpoint();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchParams] = useSearchParams();
    const [sortOrder, setSortOrder] = useState('asc');
    const [gigDocuments, setGigDocuments] = useState([]);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [gigForHandbook, setGigForHandbook] = useState(null);
    const [usersConfirmedGigs, setUsersConfirmedGigs] = useState([]);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [openOptionsGigId, setOpenOptionsGigId] = useState(null);
    const [userCancelling, setUserCancelling] = useState(false);
    const [fromOptionsMenu, setFromOptionsMenu] = useState(false);
    const [showSavedGigs, setShowSavedGigs] = useState(false);
    const selectedProfile = searchParams.get('profile') || '';
    const selectedDate = searchParams.get('date') || '';
    const selectedStatus = searchParams.get('status') || 'all';

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
              musicianProfile?.bands?.includes(applicant.id)
        );
        if (!applicant) {
            return { icon: <ExclamationIcon />, text: 'Not Applied' };
        }
        if (gig.disputeLogged) {
            return { icon: <ExclamationIcon />, text: 'Dispute Logged' };
        }
        if (gigDate > now) {
            const status = applicant?.status; // safe because applicant exists
            if (status === 'confirmed') return { icon: <TickIcon />, text: 'Confirmed' };
            if (status === 'accepted' || status === 'payment processing') {
              return { icon: <ClockIcon />, text: 'Awaiting Venue Payment' };
            }
            if (status === 'pending' && applicant?.invited) {
              return { icon: <ClockIcon />, text: 'Awaiting Your Response' };
            }
            if (status === 'pending') {
              return { icon: <ClockIcon />, text: 'Awaiting Venue Response' };
            }
            if (status === 'declined') {
              return { icon: <RejectedIcon />, text: 'Declined' };
            }
            if (status === 'withdrawn') {
                return { icon: <RejectedIcon />, text: 'Withdrawn' };
            }
        }
        return { icon: <PreviousIcon />, text: 'Past' };

    };

    const now = new Date();

    const allProfiles = useMemo(() => [
        ...(bandProfiles || []),
        ...(musicianProfile ? [musicianProfile] : [])
    ], [musicianProfile, bandProfiles])

    const baseGigs = useMemo(
        () => (showSavedGigs ? savedGigs : gigs),
        [showSavedGigs, savedGigs, gigs]
    );
  
    const normalizedGigs = useMemo(() => {
        return baseGigs.map(gig => {
          const dateObj = gig.date.toDate();
          const [hours, minutes] = gig.startTime.split(':').map(Number);
          dateObj.setHours(hours, minutes, 0, 0);
          const gigDateTime = new Date(dateObj);
          const isoDate = gigDateTime.toISOString().split('T')[0];
          const profileId = selectedProfile || musicianId;
          const applicant = gig.applicants?.find(app => app.id === profileId);
          const appStatus = applicant?.status;
          let status = 'past';
          if (gigDateTime > now) {
            if (appStatus === 'confirmed') status = 'confirmed';
            else if (appStatus === 'accepted' || appStatus === 'pending') status = 'pending';
            else if (!appStatus && gig.status === 'open') status = 'upcoming';
            else if (!applicant) status = 'not applied';
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

    const handleWithdrawApplication = async (gigId, profileToWithdraw) => {
        try {
            const musicianProfile = await getMusicianProfileByMusicianId(profileToWithdraw.profileId)
            await withdrawMusicianApplication(gigId, musicianProfile);
            toast.success('Application withdrawn.');
          } catch (e) {
            console.error(e);
            toast.error('Failed to withdraw application.');
          }
    }

    return (
        <>
            <div className='head gigs'>
                <div className='title-container'>
                    <h1 className='title'>Gigs</h1>
                </div>
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
                        <button className={`btn ${selectedStatus === 'past' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'past')}>
                            Past
                        </button>
                    </div>
                    {isXlUp ? (
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
                        {(musicianProfile.bands && !showSavedGigs) && (
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
                        )}
                        </>
                    ) : (
                        <>
                        <div className="spacer" />
                        <button className={`btn tertiary ${showMobileFilters ? 'open' : ''}`} onClick={() => setShowMobileFilters(prev => !prev)}>
                            <FilterIconEmpty />
                            {isMdUp && 'Filters'}
                        </button>
                        </>
                    )}
                </div>

                {!isXlUp && showMobileFilters && (
                    <div className="filters ext">
                        <input
                            type='date'
                            id='dateSelect'
                            value={selectedDate}
                            onChange={(e) => updateUrlParams('date', e.target.value)}
                            className='date-select'
                        />
                        {(musicianProfile.bands && !showSavedGigs) && (
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
                        )}
                    </div>
                )}
            </div>
            <div className='body gigs musician'>
                    <table>
                        <thead>
                            <tr>
                                {isSmUp && (
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
                                {isMdUp && (
                                    <>
                                        <th>Venue</th>
                                        <th>Type</th>
                                    </>
                                )}
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
                                const foundApp = gigApplications?.find(app => app.gigId === gig.gigId);
                                const appliedProfile = foundApp || null;
                                const applicant = gig.applicants.find(
                                    (a) =>
                                      a.id === musicianId ||
                                      musicianProfile.bands?.includes(a.id)
                                );
                                const thisGigIsSaved = savedGigs.some(g => g.gigId === gig.gigId);
                                return (
                                    <React.Fragment key={index}>
                                        {isFirstPreviousGig && (
                                            <tr className='filler-row'>
                                                <td className='data' colSpan={7}>
                                                    <div className='flex center'>
                                                        <h4>Past Gigs</h4>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        <tr 
                                            onClick={(e) => {
                                                if (gigStatus?.text.toLowerCase() === 'confirmed') {
                                                    openGigHandbook(gig)
                                                } else if (gig.privateApplications) {
                                                    openInNewTab(`${gig.privateApplicationsLink}`, e)
                                                } else {
                                                    openInNewTab(`/gig/${gig.gigId}?appliedAs=${appliedProfile ? appliedProfile.profileId : null}`, e)
                                                };
                                                if (isSmUp) {
                                                    markInviteAsViewed(gig.gigId, applicant.id);
                                                }
                                            }}
                                            onMouseEnter={() => {
                                                if (applicant?.invited && (!applicant?.viewed || applicant?.viewed == undefined)) {
                                                    markInviteAsViewed(gig.gigId, applicant.id);
                                                }
                                            }}
                                        >
                                            {isSmUp && (
                                                <td className="applied-profile-name">
                                                    {applicant?.invited && !applicant?.viewed && (
                                                        <div className="new-invite">
                                                            <p>NEW INVITE</p>
                                                        </div>
                                                    )}
                                                    {appliedProfile?.profileName || musicianProfile.name}
                                                </td>
                                            )}
                                            <td>
                                                {!isSmUp && applicant?.invited && !applicant?.viewed && (
                                                    <span className="notification-dot"></span>
                                                )}
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
                                            {isMdUp && (
                                                <>
                                                    <td>{gig.venue.venueName}</td>
                                                    <td>{gig.kind}</td>
                                                </>
                                            )}
                                            <td className='centre'>
                                                {gig.applicants.length > 0
                                                    ? formatFee(gig.applicants.find(applicant => applicant.id === musicianId)?.fee || gig.budget)
                                                    : formatFee(gig.budget)}
                                            </td>
                                            <td
                                                className={`status-box ${
                                                    gigStatus?.text.toLowerCase() === 'waiting for payment confirmation' || gigStatus?.text.toLowerCase() === 'awaiting your response' || gigStatus?.text.toLowerCase() === 'awaiting venue response' || gigStatus?.text.toLowerCase() === 'awaiting venue payment' ? 'pending' : gigStatus?.text.toLowerCase() === 'not applied' ? 'past' : gigStatus?.text.toLowerCase() === 'withdrawn' || gigStatus?.text.toLowerCase() === 'dispute logged' ? 'declined' : gigStatus?.text.toLowerCase() 
                                                }`}
                                            >
                                                <div
                                                    className={`status ${
                                                        gigStatus?.text.toLowerCase() === 'waiting for payment confirmation' || gigStatus?.text.toLowerCase() === 'awaiting your response' || gigStatus?.text.toLowerCase() === 'awaiting venue response' || gigStatus?.text.toLowerCase() === 'awaiting venue payment' ? 'pending' : gigStatus?.text.toLowerCase() === 'not applied' ? 'past' : gigStatus?.text.toLowerCase() === 'withdrawn' || gigStatus?.text.toLowerCase() === 'dispute logged' ? 'declined' : gigStatus?.text.toLowerCase()
                                                    }`}
                                                >
                                                    {gigStatus.icon} {gigStatus?.text}
                                                </div>
                                            </td>
                                            <td className="options-cell" onClick={(e) => e.stopPropagation()}>
                                                <button className={`btn icon ${openOptionsGigId === gig.gigId ? 'active' : ''}`} onClick={() => toggleOptionsMenu(gig.gigId)}>
                                                    <OptionsIcon />
                                                </button>
                                                {openOptionsGigId === gig.gigId && (
                                                    <div className="options-dropdown">
                                                        {/* {thisGigIsSaved ? (
                                                            <button onClick={() => handleUnSaveGig(gig)}>Unsave Gig <SavedIcon /></button>
                                                        ) : (
                                                            <button onClick={() => handleSaveGig(gig)}>Save Gig <SaveIcon /></button>
                                                        )} */}
                                                        <button onClick={(e) => { closeOptionsMenu(); openInNewTab(`/venues/${gig.venueId}?musicianId=${musicianId}`, e) }}>View Venue Page <NewTabIcon /></button>
                                                        <button onClick={() => {
                                                            closeOptionsMenu();
                                                            handleContactVenue(appliedProfile, gig, gig.venueId);
                                                        }}>
                                                            Contact Venue <MailboxFullIcon />
                                                        </button>
                                                        {(gigStatus.text === 'Confirmed' && gig.startDateTime.toDate() > now) ? (
                                                            <button onClick={() => { closeOptionsMenu(); setUserCancelling(true); setGigForHandbook(gig); setShowGigHandbook(true); setFromOptionsMenu(true) }} className='danger'>Cancel Gig <CancelIcon /></button>
                                                        ) : gigStatus.text !== 'Withdrawn' && (
                                                            <button onClick={() => { closeOptionsMenu(); handleWithdrawApplication(gig.gigId, appliedProfile) }} className='danger'>Withdraw Application <CancelIcon /></button>
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
                />
            )}
        </>
    );
};