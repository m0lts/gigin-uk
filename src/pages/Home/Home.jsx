import { useEffect, useState } from "react"
import { MapView } from "/pages/Home/MapView/MapView.jsx"
import { ListView } from "/pages/Home/ListView/ListView.jsx"
import { ChangeViewTypeButton } from "/pages/Home/Buttons/home.buttons"
import { Header } from "/components/Header/Header"
import { queryDatabase } from "/utils/queryDatabase"
import './home.styles.css'

export const Home = () => {

    // Handle view change
    const [showMap, setShowMap] = useState(true);

    // Get gig data from database
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [gigs, setGigs] = useState([]);

    useEffect(() => {
        const fetchGigData = async () => {
            setIsLoading(true);
            const dataPayload = {
                userLocation: 'Cambridge'
            }
            try {
                const response = await queryDatabase('/api/Gigs/GetGigsFromDatabase.js', dataPayload);
                const responseData = await response.json();
                if (response.ok) {
                    setIsLoading(false);
                    setGigs(responseData.gigs);
                } else {
                    setIsLoading(false);
                    setError(responseData.message);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
        fetchGigData();
    }, [])

    return (
        <div className="home">
            <Header />
            <section className="body">
                {showMap ? (
                    <MapView
                        gigs={gigs}
                    />
                ) : (
                    <ListView
                        gigs={gigs}
                    />
                )}
                <ChangeViewTypeButton 
                    showMap={showMap}
                    setShowMap={setShowMap}
                    isLoading={isLoading}
                />
            </section>
        </div>
    )
}