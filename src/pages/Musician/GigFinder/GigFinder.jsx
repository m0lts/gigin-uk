import { useState, useEffect } from "react"
import { MapView } from "./MapView";
import { ListView } from "./ListView";
import { Header } from "../../../components/common/Header";
import { collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "../../../firebase";
import '/styles/musician/gig-finder.styles.css';

export const GigFinder = () => {
    const [viewType, setViewType] = useState('map');
    const [upcomingGigs, setUpcomingGigs] = useState([]);

    useEffect(() => {
        const fetchGigs = async () => {
            try {
                const gigsRef = collection(firestore, 'gigs');
                const currentDate = new Date();
                const gigsQuery = query(gigsRef, where('date', '>=', currentDate));
                const gigsSnapshot = await getDocs(gigsQuery);
                const gigsList = gigsSnapshot.docs.map(doc => doc.data());
                setUpcomingGigs(gigsList);
            } catch (error) {
                console.error('Error fetching gigs:', error.message);
            }
        };

        fetchGigs();
    }, []);


    return (
        <section className="gig-finder">
            <Header />
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