import { useState, useEffect, useMemo } from 'react'
import { MapOutput } from './MapView';
import { ListView } from './ListView';
import { Header as MusicianHeader } from '@features/artist/components/Header';
import { Header as CommonHeader } from '@features/shared/components/Header';
import '@styles/artists/gig-finder.styles.css';
import { useLocation, useSearchParams } from 'react-router-dom';
import { WelcomeModal } from '@features/artist/components/WelcomeModal';
import { useUpcomingGigs } from '@hooks/useUpcomingGigs';
import { useUserLocation } from '@hooks/useUserLocation';
import { fetchNearbyGigs } from '../../services/client-side/gigs';
import { FilterPanel } from './FilterPanel';
import Portal from '../shared/components/Portal';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { CloseIcon, FilterIconEmpty, FilterIconFull } from '../shared/ui/extras/Icons';
import { toJsDate } from '../../services/utils/dates';

export const GigFinder = ({ user, setAuthModal, setAuthType, setNoProfileModal, noProfileModal, setNoProfileModalClosable }) => {

    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isMdUp } = useBreakpoint();

    const filters = useMemo(() => ({
        genres: searchParams.getAll('genre'),
        kind: searchParams.get('kind') || '',
        musicianType: searchParams.get('musicianType') || '',
        minBudget: searchParams.get('minBudget') ? parseInt(searchParams.get('minBudget')) : null,
        maxBudget: searchParams.get('maxBudget') ? parseInt(searchParams.get('maxBudget')) : null,
        startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')) : null,
        endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')) : null,
      }), [searchParams]);

    const [gigs, setGigs] = useState([]);
    const [lastDoc, setLastDoc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [viewType, setViewType] = useState('map');
    const newUser = location.state?.newUser;
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [pendingFilters, setPendingFilters] = useState(filters);
    const [showFilters, setShowFilters] = useState(false);
    const [gigMarkerDisplay, setGigMarkerDisplay] = useState('budget');
    const [clickedGigs, setClickedGigs] = useState([]);

    const { location: userLocation, error: locationError } = useUserLocation();

    // Group gigs by their gigSlots relationship (same logic as venue dashboard)
    const groupedGigs = useMemo(() => {
      const processed = new Set();
      const groups = [];
      
      gigs.forEach(gig => {
        if (processed.has(gig.gigId)) return;
        
        // Check if this gig has gigSlots (is part of a multi-slot group)
        const hasSlots = Array.isArray(gig.gigSlots) && gig.gigSlots.length > 0;
        
        if (hasSlots) {
          // Build the complete group by collecting all related gigs
          const groupGigs = [gig];
          const groupIds = new Set([gig.gigId]);
          processed.add(gig.gigId);
          
          // Use a queue to find all related gigs
          const queue = [...gig.gigSlots];
          
          while (queue.length > 0) {
            const slotId = queue.shift();
            if (processed.has(slotId)) continue;
            
            const slotGig = gigs.find(g => g.gigId === slotId);
            if (slotGig) {
              groupGigs.push(slotGig);
              groupIds.add(slotId);
              processed.add(slotId);
              
              // Add any slots from this gig that we haven't seen yet
              if (Array.isArray(slotGig.gigSlots)) {
                slotGig.gigSlots.forEach(id => {
                  if (!groupIds.has(id) && !processed.has(id)) {
                    queue.push(id);
                  }
                });
              }
            }
          }
          
          // Sort by startDateTime to get the first slot
          groupGigs.sort((a, b) => {
            const aDate = toJsDate(a.startDateTime);
            const bDate = toJsDate(b.startDateTime);
            if (!aDate || !bDate) return 0;
            return aDate.getTime() - bDate.getTime();
          });
          
          groups.push({
            isGroup: true,
            primaryGig: groupGigs[0],
            allGigs: groupGigs,
            gigIds: Array.from(groupIds)
          });
        } else {
          // Standalone gig
          groups.push({
            isGroup: false,
            primaryGig: gig,
            allGigs: [gig],
            gigIds: [gig.gigId]
          });
          processed.add(gig.gigId);
        }
      });
      
      return groups;
    }, [gigs]);

    // Extract only primary gigs for map display
    const primaryGigsForMap = useMemo(() => {
      return groupedGigs.map(group => group.primaryGig);
    }, [groupedGigs]);

    // Note: Removed auto-show filters when active - user can toggle manually

    useEffect(() => {
      if (locationError) {
        console.warn('User location error:', locationError);
      }
    }, [locationError]);

    useEffect(() => {
        if (newUser) {
            setShowWelcomeModal(true);
        }
    }, [newUser]);

    const updateFilters = (newFilters) => {
        const updatedParams = new URLSearchParams();
      
        if (newFilters.kind) updatedParams.set('kind', newFilters.kind);
        if (newFilters.musicianType) updatedParams.set('musicianType', newFilters.musicianType);
        if (newFilters.minBudget != null) updatedParams.set('minBudget', newFilters.minBudget);
        if (newFilters.maxBudget != null) updatedParams.set('maxBudget', newFilters.maxBudget);
        if (newFilters.startDate) updatedParams.set('startDate', newFilters.startDate.toISOString());
        if (newFilters.endDate) updatedParams.set('endDate', newFilters.endDate.toISOString());
        newFilters.genres.forEach((g) => updatedParams.append('genre', g));
      
        setSearchParams(updatedParams);
        setShowFilters(false);
      };

    useEffect(() => {
        let cancelled = false;
        const fetch = async () => {
          setLoading(true);
          try {
            const { gigs: newGigs, lastVisible } = await fetchNearbyGigs({
              location: userLocation,
              radiusInKm: 100,
              lastDoc: null,
              filters,
            });
            if (!cancelled) {
              // Filter out private gigs unless artist is invited
              const artistProfileIds = user?.artistProfiles?.map(profile => profile.id || profile.profileId).filter(Boolean) || [];
              const filteredGigs = newGigs.filter(gig => {
                // If gig is not private, show it
                if (!gig.private) return true;
                
                // If gig is private and user is not logged in, hide it
                if (!user || !artistProfileIds.length) return false;
                
                // If gig is private, check if artist is in applicants array with invited: true
                const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
                const isInvited = applicants.some(applicant => 
                  applicant?.id && 
                  artistProfileIds.includes(applicant.id) &&
                  applicant?.invited === true
                );
                
                // Only show private gigs if artist is invited
                return isInvited;
              });
              
              setGigs(filteredGigs);
              setLastDoc(lastVisible);
              setHasMore(newGigs.length === 50);
            }
          } catch (err) {
            console.error('Error fetching gigs:', err);
          } finally {
            if (!cancelled) setTimeout(() => {
                setLoading(false)
            }, 1000);
          }
        };
      
        if (userLocation) {
          setGigs([]);
          setLastDoc(null);
          setHasMore(true);
          fetch();
        }
      
        return () => {
          cancelled = true;
        };
      }, [userLocation, filters, user]);

    const toggleFilters = () => {
        setLoading(true);
        setShowFilters(prev => !prev);
        setTimeout(() => {
            setLoading(false)
        }, 500);
    };

    return (
        <section className='gig-finder'>
            {!user || !user.artistProfiles || user.artistProfiles.length === 0 ? (
                <CommonHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                    setNoProfileModal={setNoProfileModal}
                    noProfileModal={noProfileModal}
                    noProfileModalClosable={true}
                    setNoProfileModalClosable={setNoProfileModalClosable}
                />
            ) : (
                <MusicianHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                    setNoProfileModal={setNoProfileModal}
                    noProfileModal={noProfileModal}
                    noProfileModalClosable={true}
                    setNoProfileModalClosable={setNoProfileModalClosable}
                />
            )}
            <div className="body">
                <button 
                    className="btn secondary filter-toggle-btn" 
                    onClick={toggleFilters}
                    aria-label={showFilters ? 'Close filters' : 'Open filters'}
                >
                    {showFilters ? (
                      <>
                        <CloseIcon />
                        <span>Hide Filters</span>
                      </>
                    ) : (
                      filters.genres.length > 0 || filters.kind || filters.musicianType || filters.minBudget !== null || filters.maxBudget !== null || filters.startDate !== null || filters.endDate !== null ? (
                        <>
                          <FilterIconFull />
                          <span>Show Filters</span>
                        </>
                      ) : (
                        <>
                          <FilterIconEmpty />
                          <span>Show Filters</span>
                        </>
                      )
                    )}
                </button>
                <div className="content-grid">
                    {showFilters && (
                        <FilterPanel
                          filters={pendingFilters}
                          pendingFilters={pendingFilters}
                          setPendingFilters={setPendingFilters}
                          setFilters={updateFilters}
                          applyFilters={() => updateFilters(pendingFilters)}
                          toggleFilters={toggleFilters}
                      />
                    )}
                    <div className={`output-container ${viewType === 'map' ? 'map-view' : 'list-view'}`}>
                    {viewType === 'map' && (
                      <MapOutput
                        upcomingGigs={primaryGigsForMap}
                        clickedGigs={clickedGigs}
                        setClickedGigs={setClickedGigs}
                        gigMarkerDisplay={gigMarkerDisplay}
                        loading={loading}
                        userLocation={userLocation}
                        groupedGigs={groupedGigs}
                        onSearchArea={async (center) => {
                          setLoading(true);
                          try {
                            const { gigs: newGigs, lastVisible } = await fetchNearbyGigs({
                              location: center,
                              radiusInKm: 50,
                              lastDoc: null,
                              filters,
                            });
                            // Filter out private gigs unless artist is invited
                            const artistProfileIds = user?.artistProfiles?.map(profile => profile.id || profile.profileId).filter(Boolean) || [];
                            const filteredGigs = newGigs.filter(gig => {
                              // If gig is not private, show it
                              if (!gig.private) return true;
                              
                              // If gig is private and user is not logged in, hide it
                              if (!user || !artistProfileIds.length) return false;
                              
                              // If gig is private, check if artist is in applicants array with invited: true
                              const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
                              const isInvited = applicants.some(applicant => 
                                applicant?.id && 
                                artistProfileIds.includes(applicant.id) &&
                                applicant?.invited === true
                              );
                              
                              // Only show private gigs if artist is invited
                              return isInvited;
                            });
                            
                            setGigs(filteredGigs);
                            setLastDoc(lastVisible);
                            setHasMore(newGigs.length === 50);
                          } catch (err) {
                            console.error('Error fetching gigs in area:', err);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        showFilters={showFilters}
                        toggleFilters={toggleFilters}
                      />
                    )}
                  </div>
                </div>
            </div>
            {showWelcomeModal && (
              <Portal>
                <WelcomeModal
                    user={user}
                    setShowWelcomeModal={setShowWelcomeModal}
                    role='musician'
                />
              </Portal>
            )}
        </section>
    );
};

// <ListView
//     upcomingGigs={gigs}
//     location={userLocation}
//     loading={loading}
// />