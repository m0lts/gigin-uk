import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { 
    ClockIcon,
    DotIcon,
    PreviousIcon,
    SortIcon,
    TickIcon,
CloseIcon } from '@features/shared/ui/extras/Icons';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { CalendarIconSolid, CancelIcon, DeleteGigIcon, DeleteGigsIcon, DeleteIcon, DuplicateGigIcon, EditIcon, ErrorIcon, ExclamationIcon, ExclamationIconSolid, FilterIconEmpty, GigIcon, LinkIcon, MicrophoneIcon, MicrophoneIconSolid, NewTabIcon, OptionsIcon, SearchIcon, ShieldIcon, TemplateIcon } from '../../shared/ui/extras/Icons';
import { deleteGigsBatch } from '@services/client-side/gigs';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { openInNewTab } from '../../../services/utils/misc';
import { RequestCard } from '../components/RequestCard';
import { getVenueProfileById, removeVenueRequest } from '../../../services/client-side/venues';
import Portal from '../../shared/components/Portal';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { cancelGigAndRefund } from '@services/function-calls/tasks';
import { getOrCreateConversation } from '@services/function-calls/conversations';
import { postCancellationMessage } from '../../../services/function-calls/messages';
import { getMusicianProfileByMusicianId } from '../../../services/client-side/musicians';
import { toJsDate } from '../../../services/utils/dates';
import { getLocalGigDateTime } from '../../../services/utils/filtering';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { duplicateGig, handleCloseGig, handleOpenGig, logGigCancellation, saveGigTemplate, updateGigDocument, revertGigAfterCancellationVenue } from '../../../services/function-calls/gigs';
import { updateMusicianCancelledGig } from '../../../services/function-calls/musicians';


export const Gigs = ({ gigs, venues, setGigPostModal, setEditGigData, requests, setRequests, user, refreshGigs }) => {
    const location = useLocation();
    const navigate = useNavigate();
  
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [selectedGigs, setSelectedGigs] = useState([]);
    const [confirmModal, setConfirmModal] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmType, setConfirmType] = useState('');
    const [openOptionsGigId, setOpenOptionsGigId] = useState(null);
    const [showMusicianRequests, setShowMusicianRequests] = useState(false);
    const [cancellationReason, setCancellationReason] = useState({
      reason: '',
      extraDetails: '',
    });
    const [loading, setLoading] = useState(false);

    const visibleRequests = useMemo(() => {
      return requests.filter(request => !request.removed);
    }, [requests]);

    const toggleOptionsMenu = (gigId) => {
        setOpenOptionsGigId(prev => (prev === gigId ? null : gigId));
    };

    const closeOptionsMenu = () => {
        setOpenOptionsGigId(null);
    };

    const isSelected = (id) => selectedGigs.includes(id);

    const toggleGigSelection = (id) => {
        setSelectedGigs((prev) =>
            prev.includes(id) ? prev.filter((gigId) => gigId !== id) : [...prev, id]
        );
    };

    const clearSelection = () => setSelectedGigs([]);
  
    useResizeEffect((width) => setWindowWidth(width));

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (!e.target.closest('.options-cell')) {
          setOpenOptionsGigId(null);
        }
      };
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }, []);
  
    const [searchParams] = useSearchParams();
    const selectedVenue = searchParams.get('venue') || '';
    const selectedDate = searchParams.get('date') || '';
    const selectedStatus = searchParams.get('status') || 'all';
    const showRequests = searchParams.get('showRequests') === 'true';

    useEffect(() => {
      if (showRequests) setShowMusicianRequests(true);
    }, [showRequests])
  
    const now = useMemo(() => new Date(), []);
  
    const normalizedGigs = useMemo(() => {
      return gigs.map(gig => {
        const dt = getLocalGigDateTime(gig); // <- the only way we derive time now
        const isoDate = dt ? dt.toISOString().split('T')[0] : null;
    
        const confirmedApplicant = gig.applicants?.some(a => a.status === 'confirmed');
        const acceptedApplicant = gig.applicants?.some(a => a.status === 'accepted');
    
        let status = 'past';
        if (dt && dt > now) {
          if (confirmedApplicant) status = 'confirmed';
          else if (acceptedApplicant && (gig.kind !== 'Ticketed Gig' && gig.kind !== 'Open Mic')) status = 'awaiting payment';
          else if (gig.status === 'open') status = 'upcoming';
          else status = 'closed';
        }
    
        return {
          ...gig,
          dateObj: dt,
          dateIso: isoDate,
          dateTime: dt,
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
        const matchesVenue = selectedVenue === '' || gig.venueId === selectedVenue;
        const matchesDate = selectedDate === '' || gig.dateIso === selectedDate;
        const matchesStatus = selectedStatus === 'all' || gig.status === selectedStatus;
  
        return matchesSearch && matchesVenue && matchesDate && matchesStatus;
      });
    }, [normalizedGigs, searchQuery, selectedVenue, selectedDate, selectedStatus]);
  
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
      setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
    };

    const openGigPostModal = (gig) => {
        const convertedGig = {
            ...gig,
            date: gig.date ? gig.date.toDate() : null,
        };
        setEditGigData(convertedGig);
        setGigPostModal(true);
    }

    const handleDeleteSelected = async () => {
        if (selectedGigs.length === 0) return;
        try {
          setLoading(true);
          await deleteGigsBatch(selectedGigs);
          toast.success('Gig Deleted.');
          setConfirmModal(false);
          setSelectedGigs([]);
          refreshGigs();
          setConfirmType(null);
          setConfirmMessage(null);
        } catch (error) {
          console.error('Failed to delete selected gig:', error);
          toast.error('Failed to delete selected gig. Please try again.');
          setConfirmModal(false);
        } finally {
          setLoading(false);
        }
      };
      
      const handleDuplicateSelected = async () => {
        if (selectedGigs.length === 0) return;      
        try {
          setLoading(true);
          const newGigIds = [];
          for (const gigId of selectedGigs) {
            const newId = await duplicateGig(gigId);
            newGigIds.push(newId);
          }
          toast.success('Gigs Duplicated');
          setConfirmModal(false);
          setSelectedGigs([]);
          setConfirmType(null);
          setConfirmMessage(null);
        } catch (error) {
          console.error('Failed to duplicate gigs:', error);
          toast.error('Failed to duplicate gigs. Please try again.');
          setConfirmModal(false);
        } finally {
          setLoading(false);
          }
      };

      const formatCancellationReason = (reason) => {
        if (reason === 'fee') {
            return "they're not happy with the fee";
        } else if (reason === 'availability') {
            return 'of availability';
        } else if (reason === 'double-booking') {
            return 'of a double booking';
        } else if (reason === 'personal-reasons') {
            return 'of personal reasons';
        } else if (reason === 'illness') {
            return 'of illness';
        } else if (reason === 'information') {
            return 'of not enough information';
        } else {
            return 'of other reasons';
        }
    }

      const handleCancelSelected = async () => {
        if (selectedGigs.length === 0) return;
        setLoading(true);
        try {
            const nextGig = gigs.filter(g => g.gigId === selectedGigs[0])[0];
            const gigId = nextGig.gigId;
            const venueProfile = await getVenueProfileById(nextGig.venueId);
            const isOpenMic = nextGig.kind === 'Open Mic';
            const isTicketed = nextGig.kind === 'Ticketed Gig';
            if (!isOpenMic && !isTicketed) {
              const taskNames = [
                nextGig.clearPendingFeeTaskName,
                nextGig.automaticMessageTaskName,
              ];
              await cancelGigAndRefund({
                taskNames,
                transactionId: nextGig.paymentIntentId,
              });
            }
            const handleMusicianCancellation = async (musician) => {
              const conversationId = await getOrCreateConversation(musician, nextGig, venueProfile, 'cancellation');
              await postCancellationMessage(
                conversationId,
                user.uid,
                `${nextGig.venue.venueName} has unfortunately had to cancel because ${formatCancellationReason(
                  cancellationReason
                )}. We apologise for any inconvenience caused.`,
                'venue'
              );
              await revertGigAfterCancellationVenue(nextGig, musician.musicianId, cancellationReason);
              await updateMusicianCancelledGig(musician.musicianId, gigId);
              const cancellingParty = 'venue';
              await logGigCancellation(gigId, musician.musicianId, cancellationReason, cancellingParty, venueProfile.venueId);
            };
        
            if (isOpenMic) {
              const bandOrMusicianProfiles = await Promise.all(
                nextGig.applicants
                  .filter(app => app.status === 'confirmed')
                  .map(app => getMusicianProfileByMusicianId(app.id))
              );
              for (const musician of bandOrMusicianProfiles.filter(Boolean)) {
                await handleMusicianCancellation(musician);
              }
            } else {
              const confirmedApplicant = nextGig.applicants.find(app => app.status === 'confirmed');
              if (!confirmedApplicant) {
                console.error("No confirmed applicant found");
                return;
              }
              const musicianProfile = await getMusicianProfileByMusicianId(confirmedApplicant.id);
              await handleMusicianCancellation(musicianProfile);
            }
            setLoading(false);
            toast.success('Gig cancellation successful.')
            setConfirmModal(false);
            setSelectedGigs([]);
            setCancellationReason({
              reason: '',
              extraDetails: '',
            })
            setConfirmType(null);
            setConfirmMessage(null)
        } catch (error) {
            console.error('Error cancelling task:', error.message);
            setLoading(false);
            toast.error('Failed to cancel gig.')
        }
    };

      const handleCloneAsTemplate = async (gig) => {
        const templateId = uuidv4();
        const templateData = {
          ...gig,
          gigId: null,
          date: null,
          templateName: gig.gigName,
          templateId: templateId,
        };
      
        try {
          await saveGigTemplate(templateData);
          toast.success('Template Saved');
        } catch (error) {
          console.error('Failed to save template:', error);
          toast.error('Failed to save template');
        }
      };

      const handleRemoveRequest = async (requestId) => {
        try {
          await removeVenueRequest(requestId);
          setRequests(prev => 
            prev.map(req => req.id === requestId ? { ...req, removed: true } : req)
          );
          toast.success('Request removed.');
        } catch (err) {
          console.error('Error removing request:', err);
          toast.error('Failed to remove request');
        }
      };
      
      const openBuildGigModal = (request) => {
        navigate('/venues/dashboard/gigs?showRequests=true', { state: {
          musicianData: {
              id: request.musicianId,
              type: request.musicianType || '',
              plays: request.musicianPlays || '',
              genres: request.musicianGenres || [],
              name: request.musicianName,
              venueId: request.venueId,
          },
          buildingForMusician: true,
          showGigPostModal: true,
          skipTemplate: true,
          requestId: request.id,
      }})
    };

    const copyToClipboard = (link) => {
      navigator.clipboard.writeText(`${link}`).then(() => {
          toast.success(`Copied Venue Link: ${link}`);
      }).catch((err) => {
          toast.error('Failed to copy link. Please try again.')
          console.error('Failed to copy link: ', err);
      });
    };
  
    return (
      <>
        <div className='head gigs'>
          <div className="title requests">
            <h1 className='title'>Gigs{showMusicianRequests ? ' - Musician Requests' : ''}</h1>
            <button
              className="btn secondary"
              onClick={() => {
                const next = !showMusicianRequests;
                setShowMusicianRequests(next);
                updateUrlParams('showRequests', next ? 'true' : '');
              }}
            >
              {showMusicianRequests ? 'Hide' : 'Show'} Musician Requests
            </button>
          </div>
          {!showMusicianRequests && (
            <>
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
                  <button className={`btn ${selectedStatus === 'past' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'past')}>
                      Past
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
                      value={selectedVenue}
                      onChange={(e) => updateUrlParams('venue', e.target.value)}
                  >
                      <option value=''>Filter by Venue</option>
                      {venues.map((venue) => (
                      <option value={venue.venueId} key={venue.venueId}>{venue.name}</option>
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
                  value={selectedVenue}
                  onChange={(e) => updateUrlParams('venue', e.target.value)}
                  >
                  <option value=''>Venue</option>
                  {venues.map((venue) => (
                      <option value={venue.venueId} key={venue.venueId}>{venue.name}</option>
                  ))}
                  </select>
              </div>
              )}  
              </>
              )}
          </div>
        <div className='body gigs'>
            {/* {selectedGigs.length > 0 && (
                <div className="gig-action-bar">
                    <p>{selectedGigs.length} Gig{selectedGigs.length > 1 ? 's' : ''} Selected</p>
                    <span className="separator"></span>
                    <div className="tooltip-wrapper" data-tooltip="Delete">
                        <button
                            className="btn icon"
                            onClick={() => {
                            setConfirmType('delete');
                            setConfirmModal(true);
                            setConfirmMessage(
                                selectedGigs.length > 1
                                ? 'Are you sure you want to delete these gigs? This action cannot be undone.'
                                : 'Are you sure you want to delete this gig? This action cannot be undone.'
                            );
                            }}
                        >
                            {selectedGigs.length > 1 ? <DeleteGigsIcon /> : <DeleteGigIcon />}
                        </button>
                    </div>

                    <div className="tooltip-wrapper" data-tooltip="Duplicate">
                        <button
                            className="btn icon"
                            onClick={() => {
                            setConfirmType('duplicate');
                            setConfirmModal(true);
                            setConfirmMessage(
                                selectedGigs.length > 1
                                ? 'Duplicate these gigs? The new gigs will have no applicants.'
                                : 'Duplicate this gig? The new gig will have no applicants.'
                            );
                            }}
                        >
                            <DuplicateGigIcon />
                        </button>
                    </div>
                    <button className="btn icon" onClick={clearSelection}><ErrorIcon /></button>
                </div>
            )} */}
          {!showMusicianRequests ? (
            <table>
              <thead>
                <tr>
                  {/* <th>
                      <input
                          type="checkbox"
                          checked={selectedGigs.length === sortedGigs.length && sortedGigs.length > 0}
                          onChange={(e) => {
                          if (e.target.checked) {
                              setSelectedGigs(sortedGigs.map((gig) => gig.gigId));
                          } else {
                              clearSelection();
                          }
                          }}
                      />
                  </th> */}
                  <th id='name'>Name</th>
                  <th id='date'>
                    Time and Date
                    <button className='sort btn text' onClick={toggleSortOrder}>
                      <SortIcon />
                    </button>
                  </th>
                  <th>Venue</th>
                  {windowWidth > 880 && <th className='centre'>Budget</th>}
                  <th className='centre'>Status</th>
                  {windowWidth > 1268 && <th className='centre'>Applications</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedGigs.length > 0 ? (
                  sortedGigs.map((gig, index) => {
                    const isFirstPreviousGig =
                      index > 0 &&
                      gig.dateTime < now &&
                      sortedGigs[index - 1].dateTime >= now;
    
                    const StatusIcon = {
                      upcoming: <ClockIcon />,
                      'awaiting payment': <ExclamationIconSolid />,
                      confirmed: <TickIcon />,
                      closed: <ErrorIcon />,
                      past: <PreviousIcon />,
                    }[gig.status];
                    return (
                      <React.Fragment key={gig.gigId}>
                        {isFirstPreviousGig && (
                          <tr className='filler-row'>
                            <td className='data' colSpan={8}>
                              <div className='flex center'>
                                <h4>Past Gigs</h4>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr onClick={(e) => {
                            if (gig.kind === 'Open Mic' && !gig.openMicApplications) {
                              openInNewTab(`/gig/${gig.gigId}`, e)
                            } else {
                              navigate('/venues/dashboard/gigs/gig-applications', { state: { gig } })
                            }
                          }}>
                          {/* {gig.dateTime > now ? (
                              <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected(gig.gigId)}
                                onChange={() => toggleGigSelection(gig.gigId)}
                              />
                            </td>
                          ) : (
                              <td></td>
                          )} */}
                          <td>{gig.gigName}</td>
                          <td>
                            {gig.dateObj
                              ? `${gig.dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${gig.dateObj.toLocaleDateString('en-GB')}`
                              : '—'}
                          </td>
                          <td className='truncate'>{gig.venue.venueName}</td>
                          {windowWidth > 880 && (
                            <td className='centre'>
                              {gig.kind === 'Open Mic' ? (
                                'Open Mic'
                              ) : gig.kind === 'Ticketed Gig' ? (
                                'Ticketed'
                              ) : gig?.agreedFee && (gig.agreedFee !== gig.budget) ? (
                                gig.agreedFee
                              ) : gig.budget === '£' || gig.budget === '£0' ? (
                                'No Fee'
                              ) : (
                                gig.budget
                              )}
                            </td>
                          )}
                          <td className={`status-box ${gig.status === 'awaiting payment' ? 'closed' : gig.status}`}>
                            <div className={`status ${gig.status === 'awaiting payment' ? 'closed' : gig.status}`}>
                              {StatusIcon} {gig.status}
                            </div>
                          </td>
                          {windowWidth > 1268 && (
                            gig?.applicants && gig?.applicants?.length ? (
                              <td className={`centre ${gig?.applicants.some(app => !app.viewed && app.invited !== true) ? 'has-new-applications' : ''}`}>
                                {gig.kind === 'Open Mic' && !gig.openMicApplications ? (
                                  '-'
                                ) : (
                                  <>
                                    {gig?.applicants.some(app => !app.viewed && app.invited !== true)
                                      ? `${gig?.applicants.filter(app => !app.viewed && app.invited !== true).length} Unseen`
                                      : gig?.applicants.length}
                                  </>
                                )}
                              </td>
                            ) : (
                              <td className={`centre`}>
                                {gig.kind === 'Open Mic' && !gig.openMicApplications ? (
                                  '-'
                                ) : (
                                  '0'
                                )}
                            </td>
                            )
                          )}
                          <td className="options-cell" onClick={(e) => e.stopPropagation()}>
                              <button className={`btn icon ${openOptionsGigId === gig.gigId ? 'active' : ''}`} onClick={() => toggleOptionsMenu(gig.gigId)}>
                                  <OptionsIcon />
                              </button>
                              {openOptionsGigId === gig.gigId && (
                                  <div className="options-dropdown">
                                  <button onClick={() => { closeOptionsMenu(); navigate('/venues/dashboard/gigs/gig-applications', { state: { gig } }) }}>View Details <GigIcon /></button>
                                  {(gig.dateTime > now && (gig.status === 'open' || gig.status === 'upcoming') && !gig?.applicants.some(applicant => applicant.status === 'accepted' || applicant.status === 'confirmed')) && hasVenuePerm(venues, gig.venueId, 'gigs.update') && (
                                      <button onClick={() => { 
                                        if (!hasVenuePerm(venues, gig.venueId, 'gigs.create')) {
                                          toast.error('You do not have permission to duplicate this gig.');
                                        };
                                        closeOptionsMenu();
                                        openGigPostModal(gig);
                                    }}>Edit <EditIcon /></button>
                                  )}
                                  {gig.dateTime > now && hasVenuePerm(venues, gig.venueId, 'gigs.create')&& (
                                      <button 
                                          onClick={() => {
                                              if (!hasVenuePerm(venues, gig.venueId, 'gigs.create')) {
                                                toast.error('You do not have permission to duplicate this gig.');
                                              }
                                              closeOptionsMenu();
                                              setSelectedGigs([gig.gigId]);
                                              setConfirmType('duplicate');
                                              setConfirmModal(true);
                                              setConfirmMessage('Duplicate this gig? The new gig will have no applicants.');
                                          }}
                                      >
                                          Duplicate
                                          <DuplicateGigIcon />
                                      </button>
                                  )}
                                  {(gig.dateTime > now && gig.status !== 'confirmed' && gig.status !== 'accepted' && gig.status !== 'awaiting payment' && gig.kind !== 'Open Mic') && hasVenuePerm(venues, gig.venueId, 'gigs.update') ? (
                                      <button
                                      onClick={async () => {
                                          if (!hasVenuePerm(venues, gig.venueId, 'gigs.update')) {
                                            toast.error('You do not have permission to edit this gig.');
                                          }
                                          closeOptionsMenu();
                                          const newStatus = (gig.status === 'open' || gig.status === 'upcoming') ? 'closed' : 'open';
                                          try {
                                            if (newStatus === 'closed') {
                                              await handleCloseGig(gig.gigId);
                                            } else {
                                              await handleOpenGig(gig.gigId);
                                            }
                                              toast.success(`Gig ${(newStatus === 'open' || newStatus === 'upcoming') ? 'Opened for Applications' : 'Closed from Applications'}`);
                                          } catch (error) {
                                              console.error('Error updating status:', error);
                                              toast.error('Failed to update gig status.');
                                          }
                                      }}
                                      >
                                          {(gig.status === "open" || gig.status === 'upcoming') ? 'Close Gig' : 'Reopen Gig'}
                                          {(gig.status === "open" || gig.status === 'upcoming') ? (
                                              <CloseIcon />
                                              ) : (
                                              <TickIcon />
                                          )}
                                      </button>
                                  ) : (gig.dateTime > now && gig.status !== 'confirmed' && gig.kind === 'Open Mic') && hasVenuePerm(venues, gig.venueId, 'gigs.update') && (
                                    <button
                                      onClick={async () => {
                                          if (!hasVenuePerm(venues, gig.venueId, 'gigs.update')) {
                                            toast.error('You do not have permission to edit this gig.');
                                          }
                                          closeOptionsMenu();
                                          const newStatus = gig.openMicApplications ? false : true;
                                          try {
                                              await updateGigDocument(gig.gigId, { openMicApplications: newStatus, limitApplications: false });
                                              toast.success(`Open mic night ${(newStatus) ? 'opened for applications.' : 'changed to turn up and play.'}`);
                                          } catch (error) {
                                              console.error('Error updating status:', error);
                                              toast.error('Failed to update open mic applications.');
                                          }
                                      }}
                                      >
                                          {gig.openMicApplications ? 'Change to Turn Up and Play' : 'Change to Applications Required'}
                                          {gig.openMicApplications ? (
                                              <MicrophoneIconSolid />
                                              ) : (
                                              <ShieldIcon />
                                          )}
                                      </button>
                                  )}
                                  {hasVenuePerm(venues, gig.venueId, 'gigs.create') && (
                                    <button onClick={() => {
                                      if (!hasVenuePerm(venues, gig.venueId, 'gigs.create')) {
                                        toast.error('You do not have permission to perform this action.');
                                      };
                                      closeOptionsMenu();
                                      handleCloneAsTemplate(gig);
                                    }}>
                                        Make Gig a Template <TemplateIcon />
                                    </button>
                                  )}
                                  {gig.privateApplications && hasVenuePerm(venues, gig.venueId, 'gigs.invite') && (
                                    <button onClick={() => {
                                      if (!hasVenuePerm(venues, gig.venueId, 'gigs.invite')) {
                                        toast.error('You do not have permission to perform this action.');
                                      };
                                      closeOptionsMenu();
                                      copyToClipboard(gig.privateApplicationsLink);
                                      }}>
                                        Copy Private Link <LinkIcon />
                                    </button>
                                  )}
                                  {gig.dateTime > now && gig.status !== 'confirmed' && gig.status !== 'accepted' && gig.status !== 'awaiting payment' && hasVenuePerm(venues, gig.venueId, 'gigs.update') ? (
                                      <button 
                                          onClick={() => {
                                              if (!hasVenuePerm(venues, gig.venueId, 'gigs.update')) {
                                                toast.error('You do not have permission to delete this gig.');
                                              }
                                              closeOptionsMenu();
                                              setSelectedGigs([gig.gigId]);
                                              setConfirmType('delete');
                                              setConfirmModal(true);
                                              setConfirmMessage('Are you sure you want to delete this gig? This action cannot be undone.'); 
                                          }}>
                                              Delete
                                              <DeleteGigIcon />
                                      </button>
                                  ) : gig.dateTime > now && gig.status === 'confirmed' && hasVenuePerm(venues, gig.venueId, 'gigs.update') && (
                                        <button 
                                          onClick={() => {
                                              if (!hasVenuePerm(venues, gig.venueId, 'gigs.update')) {
                                                toast.error('You do not have permission to delete this gig.');
                                              }
                                              closeOptionsMenu();
                                              setSelectedGigs([gig.gigId]);
                                              setConfirmType('cancel');
                                              setConfirmModal(true);
                                              setConfirmMessage(`Are you sure you want to cancel this gig?`); 
                                          }}>
                                              Cancel
                                              <CancelIcon />
                                      </button>
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
                    <td className='data' colSpan={8} style={{ padding: '0'}}>
                      <div className='flex' style={{ padding: '2rem 0', backgroundColor: 'var(--gn-grey-300)'}}>
                        <h4>No Gigs Available</h4>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            visibleRequests.length > 0 ? (
              <div className="musician-requests">
                {visibleRequests.map((request) => (
                  <RequestCard key={request.id} request={request} handleRemoveRequest={handleRemoveRequest} openBuildGigModal={openBuildGigModal} venues={venues} />
                ))}
              </div>
            ) : (
              <div className="musician-requests">
                <h4 style={{ textAlign: 'center', marginTop: '5rem'}}>No Requests</h4>
            </div>
            )
          )}
            {confirmModal && (
              <Portal>
                {!loading ? (
                <div className="modal cancel-gig" onClick={() => setConfirmModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>{confirmMessage}</h3>
                        {confirmType === 'cancel' && (
                          <div className="modal-body">
                            <div className="text">
                                <h4>What's your reason for cancelling?</h4>
                            </div>
                            <div className="input-container">
                                <select className='select' id='cancellation-reason' value={cancellationReason.reason} onChange={(e) => setCancellationReason((prev) => ({
                                        ...prev,
                                        reason: e.target.value,
                                    }))}>
                                    <option value=''>Please select a reason</option>
                                    <option value='fee'>Fee Dispute</option>
                                    <option value='availability'>Availability</option>
                                    <option value='double-booking'>Double Booking</option>
                                    <option value='personal-reasons'>Personal Reasons</option>
                                    <option value='illness'>Illness</option>
                                    <option value='information'>Not Enough Information</option>
                                    <option value='other'>Other</option>
                                </select>
                            </div>
                            <div className="input-container">
                                <label htmlFor="extraDetails" className='label'>Add any extra details below:</label>
                                <textarea name="extra-details" value={cancellationReason.extraDetails} id="extraDetails" className='input' onChange={(e) => setCancellationReason((prev) => ({
                                        ...prev,
                                        extraDetails: e.target.value,
                                    }))}></textarea>
                            </div>
                          </div>
                        )}
                        <div className='two-buttons' style={{ marginTop: '1rem'}}>
                            <button className="btn tertiary" onClick={() => setConfirmModal(false)}>Close</button>
                            {confirmType === 'delete' ? (
                                <button className="btn danger" onClick={handleDeleteSelected}>Delete</button>
                            ) : confirmType === 'cancel' ? (
                                <button className="btn danger" onClick={handleCancelSelected}>Cancel</button>
                            ) : (
                              <button className="btn primary" onClick={handleDuplicateSelected}>Duplicate</button>
                            )}
                        </div>
                    </div>
                </div>
                ) : (
                  <LoadingModal />
                )}
              </Portal>
            )}
        </div>
      </>
    );
  };