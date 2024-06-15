import { Route, Routes } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { useState, useEffect } from "react"
import { GigPostModal } from "./GigPost/GigPostModal";
import { useAuth } from '../../../hooks/useAuth';
import axios from "axios";

export const HostDashboard = () => {

    const { user } = useAuth();

    const [gigPostModal, setGigPostModal] = useState(false);
    const [venueProfiles, setVenueProfiles] = useState([]);
    const [gigs, setGigs] = useState([]);
    const [incompleteGigs, setIncompleteGigs] = useState([]);
    const [templates, setTemplates] = useState([]);

    useEffect(() => {
        const fetchHostData = async () => {
            try {
                const response = await axios.post('/api/venues/findVenue', {
                    userId: user.userId,
                    requestType: 'Complete profiles',
                });

                if (response.data.completeProfiles) {
                    setVenueProfiles(response.data.completeProfiles)
                    console.log(response.data.completeProfiles);

                }
                
            } catch (error) {
                console.error(error)
            }
        }

        if (user) {
            fetchHostData()
        }
    }, [user])

    useEffect(() => {
        const fetchVenueData = async () => {
            if (venueProfiles.length > 0) {
                const venueIds = venueProfiles.map(profile => profile.venueId);
                try {
                    const response = await axios.post('/api/venues/getVenueData', { venueIds });
                    if (response.data) {
                        const fetchedGigs = response.data.gigs;
                        const completeGigs = fetchedGigs.filter(gig => gig.complete !== false);
                        const incompleteGigs = fetchedGigs.filter(gig => gig.complete === false);

                        setGigs(completeGigs);
                        setIncompleteGigs(incompleteGigs);

                        setTemplates(response.data.templates);
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        };

        fetchVenueData();
    }, [venueProfiles]);

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
            {gigPostModal && <GigPostModal setGigPostModal={setGigPostModal} venueProfiles={venueProfiles} user={user} templates={templates} incompleteGigs={incompleteGigs} />}
        </>
    )
}