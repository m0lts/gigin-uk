import { Route, Routes } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { useState, useEffect } from "react"
import { GigPostModal } from "./GigPost/GigPostModal";
import { useAuth } from '../../../hooks/useAuth';
import axios from "axios";
import { LoadingScreen } from "../../../components/ui/loading/LoadingScreen";
import { Gigs } from "./Gigs";
import '/styles/host/host-dashboard.styles.css'
import { Venues } from "./Venues";

export const HostDashboard = () => {

    const { user } = useAuth();

    const [loadingData, setLoadingData] = useState(false);
    const [gigPostModal, setGigPostModal] = useState(false);
    const [venueProfiles, setVenueProfiles] = useState([]);
    const [gigs, setGigs] = useState([]);
    const [incompleteGigs, setIncompleteGigs] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [editGigData, setEditGigData] = useState();

    useEffect(() => {
        const fetchHostData = async () => {
            try {
                const response = await axios.post('/api/venues/findVenue', {
                    userId: user.userId,
                    requestType: 'Complete profiles',
                });

                if (response.data.completeProfiles) {
                    setVenueProfiles(response.data.completeProfiles)
                    setLoadingData(false)
                }
                
            } catch (error) {
                console.error(error)
                setLoadingData(false)
            }
        }

        if (user) {
            fetchHostData()
            setLoadingData(true);
        }
    }, [user])

    useEffect(() => {
        const fetchVenueData = async () => {
            setLoadingData(true);
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
                        setLoadingData(false)

                    }
                } catch (error) {
                    console.error(error);
                    setLoadingData(false)

                }
            }
        };

        fetchVenueData();
    }, [venueProfiles]);

    return (
        <>  
            {loadingData && <LoadingScreen />}
            <Sidebar
                setGigPostModal={setGigPostModal}
            />
            <div className="window">
                <Routes>
                    <Route index element={<h1>Overview</h1>} />
                    <Route path="gigs" element={<Gigs gigs={gigs} venues={venueProfiles} setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} />} />
                    <Route path="venues" element={<Venues venues={venueProfiles} />} />
                    <Route path="musicians" element={<h1>musicians</h1>} />
                    <Route path="finances" element={<h1>financials</h1>} />
                </Routes>
            </div>
            {gigPostModal && <GigPostModal setGigPostModal={setGigPostModal} venueProfiles={venueProfiles} user={user} templates={templates} incompleteGigs={incompleteGigs} editGigData={editGigData} />}
        </>
    )
}