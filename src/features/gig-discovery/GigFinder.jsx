import { useState, useEffect, useMemo } from 'react'
import { MapOutput } from './MapView';
import { ListView } from './ListView';
import { Header as MusicianHeader } from '@features/musician/components/Header';
import { Header as CommonHeader } from '@features/shared/components/Header';
import '@styles/musician/gig-finder.styles.css';
import { useLocation, useSearchParams } from 'react-router-dom';
import { WelcomeModal } from '@features/musician/components/WelcomeModal';
import { useUpcomingGigs } from '@hooks/useUpcomingGigs';
import { useUserLocation } from '@hooks/useUserLocation';
import { fetchNearbyGigs } from '../../services/gigs';
import { FilterPanel } from './FilterPanel';
import { TopBanner } from './TopBanner';

export const GigFinder = ({ user, setAuthModal, setAuthType }) => {

    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

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

    useEffect(() => {
        const hasActiveFilters =
          (filters.genres && filters.genres.length > 0) ||
          filters.kind ||
          filters.musicianType ||
          filters.minBudget !== null ||
          filters.maxBudget !== null ||
          filters.startDate !== null ||
          filters.endDate !== null;
      
        if (hasActiveFilters) {
          setShowFilters(true);
        }
      }, [filters]);

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
      };

    useEffect(() => {
        let cancelled = false;
        const fetch = async () => {
          setLoading(true);
          try {
            const fakeCambridge = { latitude: 52.1205, longitude: 0.1690 };
            const { gigs: newGigs, lastVisible } = await fetchNearbyGigs({
              location: fakeCambridge,
              radiusInKm: 50,
              lastDoc: null,
              filters,
            });
            if (!cancelled) {
              setGigs(newGigs);
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
      }, [userLocation, filters]);

    const toggleFilters = () => {
        setLoading(true);
        setShowFilters(prev => !prev);
        setTimeout(() => {
            setLoading(false)
        }, 500);
    };

    return (
        <section className='gig-finder'>
            {!user || !user.musicianProfile ? (
                <CommonHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                />
            ) : (
                <MusicianHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                />
            )}
            <div className="body">
                <TopBanner
                    showFilters={showFilters}
                    setShowFilters={setShowFilters}
                    gigCount={gigs.length}
                    gigMarkerDisplay={gigMarkerDisplay}
                    setGigMarkerDisplay={setGigMarkerDisplay}
                    viewType={viewType}
                    setViewType={setViewType}
                    toggleFilters={toggleFilters}
                />
                <div className={`content-grid ${showFilters ? 'with-filters' : ''}`}>
                    {showFilters && (
                        <FilterPanel
                        filters={pendingFilters}
                        pendingFilters={pendingFilters}
                        setPendingFilters={setPendingFilters}
                        setFilters={updateFilters}
                        applyFilters={() => updateFilters(pendingFilters)}
                      />
                    )}
                    <div className={`output-container ${viewType === 'map' ? 'map-view' : 'list-view'}`}>
                    {viewType === 'map' ? (
                        <MapOutput
                            upcomingGigs={gigs}
                            clickedGigs={clickedGigs}
                            setClickedGigs={setClickedGigs}
                            gigMarkerDisplay={gigMarkerDisplay}
                            loading={loading}
                        />
                    ) : (
                        <ListView
                            upcomingGigs={gigs}
                            location={userLocation}
                            loading={loading}
                        />
                    )}
                    </div>
                </div>
            </div>
            {showWelcomeModal && (
                <WelcomeModal
                    user={user}
                    setShowWelcomeModal={setShowWelcomeModal}
                    role='musician'
                />
            )}
        </section>
    );
};