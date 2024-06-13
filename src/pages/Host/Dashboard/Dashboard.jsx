import { Route, Routes } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { useState, useEffect } from "react"
import { GigPostModal } from "./GigPost/GigPostModal";
import { useAuth } from '../../../hooks/useAuth';
import axios from "axios";

export const HostDashboard = () => {

    const { user } = useAuth();

    const [venueProfiles, setVenueProfiles] = useState([]);
    const [gigPostModal, setGigPostModal] = useState(false);

    useEffect(() => {
        const fetchHostData = async () => {
            try {
                const response = await axios.post('/api/venues/findVenue', {
                    userId: user.userId,
                    requestType: 'Complete profiles',
                });

                if (response.data.completeProfiles) {
                    setVenueProfiles(response.data.completeProfiles)
                }
                
            } catch (error) {
                console.error(error)
            }
        }

        if (user) {
            fetchHostData()
        }
    }, [user])

    return (
        <>
            <Sidebar
                setGigPostModal={setGigPostModal}
            />
            <div className="window">
                <Routes>
                    <Route index element={<h1>Overview</h1>} />
                    <Route path="gigs" element={<h1>Gigs</h1>} />
                    <Route path="venues" element={<h1>Venues</h1>} />
                    <Route path="musicians" element={<h1>musicians</h1>} />
                    <Route path="finances" element={<h1>financials</h1>} />
                </Routes>
            </div>
            {gigPostModal && <GigPostModal setGigPostModal={setGigPostModal} venueProfiles={venueProfiles} user={user} />}
        </>
    )
}