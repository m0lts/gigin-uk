import { useState, useEffect } from "react"
import { MapView } from "./MapView";
import { ListView } from "./ListView";
import { Header as VenuesHeader } from "../../components/venue-components/Header";
import { Header as MusicianHeader } from "../../components/musician-components/Header";
import { Header as CommonHeader } from "../../components/common/Header";
import { collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "../../firebase";
import '/styles/musician/gig-finder.styles.css';
import { useGigs } from "../../context/GigsContext";
import { useLocation } from "react-router-dom";
import { WelcomeModal } from "../../components/musician-components/WelcomeModal";

export const GigFinder = ({ user, setAuthModal, setAuthType }) => {

    const { gigs } = useGigs();
    const location = useLocation();

    const [viewType, setViewType] = useState('map');
    const [upcomingGigs, setUpcomingGigs] = useState([]);
    const [userLocation, setUserLocation] = useState(null);
    const newUser = location.state?.newUser;
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLocation({ latitude, longitude });
                },
                (error) => {
                    console.error("Error getting location:", error.message);
                }
            );
        } else {
            console.error("Geolocation is not supported by this browser.");
        }
    }, []);

    useEffect(() => {
        if (!gigs) return;
        const currentDate = new Date();
        const filteredGigs = gigs
            .filter(gig => {
                const gigDate = gig.date.toDate();
                const [hours, minutes] = gig.startTime.split(':').map(Number);
                gigDate.setHours(hours, minutes, 0, 0);
                return gigDate > currentDate && gig.status !== 'closed' && gig.complete;
            })
            .sort((a, b) => {
                const gigDateA = a.date.toDate();
                const [hoursA, minutesA] = a.startTime.split(':').map(Number);
                gigDateA.setHours(hoursA, minutesA, 0, 0);
    
                const gigDateB = b.date.toDate();
                const [hoursB, minutesB] = b.startTime.split(':').map(Number);
                gigDateB.setHours(hoursB, minutesB, 0, 0);
    
                return gigDateA - gigDateB;
            });

        setUpcomingGigs(filteredGigs);
    }, [gigs]);

    useEffect(() => {
        if (newUser) {
            setShowWelcomeModal(true);
        }
    }, [newUser]);


    return (
        <section className="gig-finder">
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
            <button className="btn secondary view-type" onClick={() => setViewType(viewType === 'map' ? 'list' : 'map')}>
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
                    role="musician"
                />
            )}
        </section>
    );
};