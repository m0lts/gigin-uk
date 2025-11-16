import { useState, useEffect } from 'react'
import { MapOutput } from './MapView';
import { Header as MusicianHeader } from '@features/artist/components/Header';
import { Header as CommonHeader } from '@features/shared/components/Header';
import '@styles/artists/gig-finder.styles.css';
import { WelcomeModal } from '@features/artist/components/WelcomeModal';
import { useUserLocation } from '@hooks/useUserLocation';
import { fetchNearbyVenues } from '../../services/client-side/venues';
import Portal from '../shared/components/Portal';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export const VenueFinder = ({ user, setAuthModal, setAuthType, setNoProfileModal, noProfileModal }) => {
  const [venues, setVenues] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [clickedVenues, setClickedVenues] = useState([]);
  const {isMdUp} = useBreakpoint();

  const { location: userLocation, error: locationError } = useUserLocation();

  useEffect(() => {
    if (locationError) console.warn('User location error:', locationError);
  }, [locationError]);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const { venues: newVenues, lastVisible } = await fetchNearbyVenues({
          location: userLocation,
          radiusInKm: 50,
          lastDoc: null,
        });
        if (!cancelled) {
          setVenues(newVenues);
          setLastDoc(lastVisible);
          setHasMore(newVenues.length === 50);
        }
      } catch (err) {
        console.error('Error fetching venues:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (userLocation) {
      setVenues([]);
      setLastDoc(null);
      setHasMore(true);
      fetch();
    }
    return () => { cancelled = true; };
  }, [userLocation]);

  return (
    <section className='gig-finder'>
      {!user || !user.musicianProfile ? (
        <CommonHeader setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} />
      ) : (
        <MusicianHeader setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} />
      )}
      <div className="body">
        <div className="content-grid">
          <div className="output-container map-view">
            <MapOutput
              venues={venues}
              loading={loading}
              userLocation={userLocation}
              clickedVenues={clickedVenues}
              setClickedVenues={setClickedVenues}
              onSearchArea={async (center) => {
                setLoading(true);
                try {
                  const { venues: newVenues, lastVisible } = await fetchNearbyVenues({
                    location: center,   // { latitude, longitude }
                    radiusInKm: 100,
                    lastDoc: null,
                  });
                  setVenues(newVenues);
                  setLastDoc(lastVisible);
                  setHasMore(newVenues.length === 50);
                } catch (err) {
                  console.error('Error fetching venues in area:', err);
                } finally {
                  setLoading(false);
                }
              }}
              user={user}
            />
          </div>
        </div>
      </div>
      {showWelcomeModal && (
        <Portal>
          <WelcomeModal user={user} setShowWelcomeModal={setShowWelcomeModal} role='musician' />
        </Portal>
      )}
    </section>
  );
};