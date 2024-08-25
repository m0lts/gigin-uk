import { useState, useEffect } from "react"
import { MapView } from "./MapView";
import { ListView } from "./ListView";
import { Header } from "../../components/musician-components/Header";
import { collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "../../firebase";
import '/styles/musician/gig-finder.styles.css';
import { useGigs } from "../../context/GigsContext";

export const GigFinder = ({ user, setAuthModal, setAuthType }) => {

    const { gigs } = useGigs();

    const [viewType, setViewType] = useState('map');
    const [upcomingGigs, setUpcomingGigs] = useState([]);

    useEffect(() => {
        if (!gigs) return;

        const currentDate = new Date();

        const filteredGigs = gigs
            .filter(gig => {
                const gigDate = gig.date.toDate();
                return gigDate >= currentDate && !gig.applicants.some(applicant => applicant.status === 'Accepted');
            });

        setUpcomingGigs(filteredGigs);
    }, [gigs]);


    return (
        <section className="gig-finder">
            <Header
                setAuthType={setAuthType}
                setAuthModal={setAuthModal}
                user={user}
            />
            {viewType === 'map' ? (
                <MapView upcomingGigs={upcomingGigs} />
            ) : (
                <ListView upcomingGigs={upcomingGigs} />
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