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

export const GigFinder = ({ user, setAuthModal, setAuthType }) => {

    const { gigs } = useGigs();

    const [viewType, setViewType] = useState('map');
    const [upcomingGigs, setUpcomingGigs] = useState([]);
    const [location, setLocation] = useState(null);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setLocation({ latitude, longitude });
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
                return gigDate >= currentDate && gig.status !== 'closed' && gig.complete;
            });

        setUpcomingGigs(filteredGigs);
    }, [gigs]);


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
                <MapView upcomingGigs={upcomingGigs} location={location} />
            ) : (
                <ListView upcomingGigs={upcomingGigs} location={location} />
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
        </section>
    );
};