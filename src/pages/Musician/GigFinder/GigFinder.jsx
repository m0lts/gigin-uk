import { useState, useEffect } from "react"
import { MapView } from "./MapView";
import { ListView } from "./ListView";
import { Header } from "../../../components/common/Header";
import axios from "axios";
import '/styles/musician/gig-finder.styles.css';

export const GigFinder = () => {
    const [viewType, setViewType] = useState('map');
    const [upcomingGigs, setUpcomingGigs] = useState([]);

    useEffect(() => {
        const fetchGigs = async () => {
            try {
                const response = await axios.post('/api/gigs/getGigs');
                if (response.status === 200) {
                    setUpcomingGigs(response.data.upcomingGigs);
                } else {
                    throw new Error('Failed to fetch gigs');
                }
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
                <MapView upcomingGigs={upcomingGigs} /> // Pass gigs data to MapView component
            ) : (
                <ListView upcomingGigs={upcomingGigs} /> // Pass gigs data to ListView component
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