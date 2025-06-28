import { useState, useEffect } from 'react'
import { MapView } from './MapView';
import { ListView } from './ListView';
import { Header as MusicianHeader } from '@features/musician/components/Header';
import { Header as CommonHeader } from '@features/shared/components/Header';
import '@styles/musician/gig-finder.styles.css';
import { useGigs } from '@context/GigsContext';
import { useLocation } from 'react-router-dom';
import { WelcomeModal } from '@features/musician/components/WelcomeModal';
import { useUpcomingGigs } from '@hooks/useUpcomingGigs';
import { useUserLocation } from '@hooks/useUserLocation';

export const GigFinder = ({ user, setAuthModal, setAuthType }) => {

    const { gigs } = useGigs();
    const location = useLocation();
    const upcomingGigs = useUpcomingGigs(gigs);

    const [viewType, setViewType] = useState('map');
    const newUser = location.state?.newUser;
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);

    const { location: userLocation, error: locationError } = useUserLocation();

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
            {viewType === 'map' ? (
                <MapView upcomingGigs={upcomingGigs} location={userLocation} />
            ) : (
                <ListView upcomingGigs={upcomingGigs} location={userLocation} />
            )}
            <button className='btn secondary view-type' onClick={() => setViewType(viewType === 'map' ? 'list' : 'map')}>
                {viewType === 'map' ? (
                    <>
                        List View
                    </>
                ) : (
                    <>
                        Map View
                    </>
                )}
            </button>
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