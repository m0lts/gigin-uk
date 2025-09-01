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
import { CalendarIconSolid, DeleteGigIcon, DeleteGigsIcon, DeleteIcon, DuplicateGigIcon, EditIcon, ErrorIcon, FilterIconEmpty, LinkIcon, MicrophoneIcon, MicrophoneIconSolid, NewTabIcon, OptionsIcon, SearchIcon, ShieldIcon, TemplateIcon } from '../../shared/ui/extras/Icons';
import { deleteGigsBatch, duplicateGig, saveGigTemplate, updateGigDocument } from '@services/gigs';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { openInNewTab } from '../../../services/utils/misc';
import { RequestCard } from '../components/RequestCard';
import { removeVenueRequest } from '../../../services/venues';
import Portal from '../../shared/components/Portal';


export const Gigs = ({ gigs, venues, setGigPostModal, setEditGigData, requests, setRequests }) => {
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
        const dateObj = gig.date.toDate();
        const [hours, minutes] = gig.startTime.split(':').map(Number);
        dateObj.setHours(hours);
        dateObj.setMinutes(minutes);
        dateObj.setSeconds(0);
        dateObj.setMilliseconds(0);
        const gigDateTime = new Date(dateObj); // local datetime
    
        const isoDate = gigDateTime.toISOString().split('T')[0];
    
        const acceptedApplicant = gig.applicants?.some(app => app.status === 'confirmed');
        let status = 'past';
    
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
          await deleteGigsBatch(selectedGigs);
          toast.success('Gig Deleted.');
          setConfirmModal(false);
          setSelectedGigs([]);
        } catch (error) {
          console.error('Failed to delete selected gig:', error);
          toast.error('Failed to delete selected gig. Please try again.');
          setConfirmModal(false);
        } finally {
          setTimeout(() => {
            setConfirmType(null);
            setConfirmMessage(null);
          }, 2500);
        }
      };
      
      const handleDuplicateSelected = async () => {
        if (selectedGigs.length === 0) return;      
        try {
          const newGigIds = [];
          for (const gigId of selectedGigs) {
            const newId = await duplicateGig(gigId);
            newGigIds.push(newId);
          }
          toast.success('Gigs Duplicated');
          setConfirmModal(false);
          setSelectedGigs([]);
        } catch (error) {
          console.error('Failed to duplicate gigs:', error);
          toast.error('Failed to duplicate gigs. Please try again.');
          setConfirmModal(false);
        } finally {
            setTimeout(() => {
              setConfirmType(null);
              setConfirmMessage(null);
            }, 2500);
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
          skipTemplate:true,
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
                      confirmed: <TickIcon />,
                      closed: <CloseIcon />,
                      past: <PreviousIcon />
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
                          <td>{gig.startTime} {gig.dateObj.toLocaleDateString('en-GB')}</td>
                          <td className='truncate'>{gig.venue.venueName}</td>
                          {windowWidth > 880 && (
                            <td className='centre'>
                              {gig.kind === 'Open Mic' ? (
                                'Open Mic'
                              ) : gig.kind === 'Ticketed Gig' ? (
                                'Ticketed'
                              ) : (
                                gig.budget
                              )}
                            </td>
                          )}
                          <td className={`status-box ${gig.status}`}>
                            <div className={`status ${gig.status}`}>
                              {StatusIcon} {gig.status.charAt(0).toUpperCase() + gig.status.slice(1)}
                            </div>
                          </td>
                          {windowWidth > 1268 && (
                            <td className={`centre ${gig.applicants.some(app => !app.viewed && app.invited !== true) ? 'has-new-applications' : ''}`}>
                              {gig.kind === 'Open Mic' && !gig.openMicApplications ? (
                                '-'
                              ) : (
                                <>
                                  {gig.applicants.some(app => !app.viewed && app.invited !== true)
                                    ? `${gig.applicants.filter(app => !app.viewed && app.invited !== true).length} Unseen`
                                    : gig.applicants.length}
                                </>
                              )}
                            </td>
                          )}
                          <td className="options-cell" onClick={(e) => e.stopPropagation()}>
                              <button className={`btn icon ${openOptionsGigId === gig.gigId ? 'active' : ''}`} onClick={() => toggleOptionsMenu(gig.gigId)}>
                                  <OptionsIcon />
                              </button>
                              {openOptionsGigId === gig.gigId && (
                                  <div className="options-dropdown">
                                  <button onClick={() => { closeOptionsMenu(); navigate('/venues/dashboard/gigs/gig-applications', { state: { gig } }) }}>View Details <NewTabIcon /> </button>
                                  {(gig.dateTime > now && (gig.status === 'open' || gig.status === 'upcoming') && !gig?.applicants.some(applicant => applicant.status === 'accepted' || applicant.status === 'confirmed')) && (
                                      <button onClick={() => { closeOptionsMenu(); openGigPostModal(gig) }}>Edit <EditIcon /></button>
                                  )}
                                  {gig.dateTime > now && (
                                      <button 
                                          onClick={() => {
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
                                  {(gig.dateTime > now && gig.status !== 'confirmed' && gig.kind !== 'Open Mic') ? (
                                      <button
                                      onClick={async () => {
                                          closeOptionsMenu();
                                          const newStatus = (gig.status === 'open' || gig.status === 'upcoming') ? 'closed' : 'open';
                                          try {
                                              await updateGigDocument(gig.gigId, { status: newStatus });
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
                                  ) : (gig.dateTime > now && gig.status !== 'confirmed' && gig.kind === 'Open Mic') && (
                                    <button
                                      onClick={async () => {
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
                                  <button onClick={() => { closeOptionsMenu(); handleCloneAsTemplate(gig); }}>
                                      Make Gig a Template <TemplateIcon />
                                  </button>
                                  {gig.privateApplications && (
                                    <button onClick={() => { closeOptionsMenu(); copyToClipboard(gig.privateApplicationsLink); }}>
                                        Copy Private Link <LinkIcon />
                                    </button>
                                  )}
                                  {gig.dateTime > now && gig.status !== 'confirmed' && (
                                      <button 
                                          onClick={() => {
                                              closeOptionsMenu();
                                              setSelectedGigs([gig.gigId]);
                                              setConfirmType('delete');
                                              setConfirmModal(true);
                                              setConfirmMessage('Are you sure you want to delete this gig? This action cannot be undone.'); 
                                          }}>
                                              Delete
                                              <DeleteGigIcon />
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
                <div className="modal confirm" onClick={() => setConfirmModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>
                            {confirmMessage}
                        </h3>
                        <div className='two-buttons'>
                            <button className="btn tertiary" onClick={() => setConfirmModal(false)}>Cancel</button>
                            {confirmType === 'delete' ? (
                                <button className="btn danger" onClick={handleDeleteSelected}>Delete</button>
                            ) : (
                                <button className="btn primary" onClick={handleDuplicateSelected}>Duplicate</button>
                            )}
                        </div>
                    </div>
                </div>
              </Portal>
            )}
        </div>
      </>
    );
  };