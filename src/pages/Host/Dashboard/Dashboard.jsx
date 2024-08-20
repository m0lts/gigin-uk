import { Route, Routes } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { useState, useEffect } from "react"
import { GigPostModal } from "./GigPost/GigPostModal";
import { useAuth } from '../../../hooks/useAuth';
import axios from "axios";
import { LoadingScreen } from "/components/ui/loading/LoadingScreen";
import { Gigs } from "./Gigs";
import '/styles/host/host-dashboard.styles.css'
import { Venues } from "./Venues";
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from "../../../firebase";
import { GigApplications } from "./GigApplications";

export const HostDashboard = ({  }) => {

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
          if (!user) return;
          setLoadingData(true);
    
          try {
            const venuesRef = collection(firestore, 'venueProfiles');
            const q = query(venuesRef, where('user', '==', user.uid), where('completed', '==', true));
            const querySnapshot = await getDocs(q);
    
            const completeProfiles = querySnapshot.docs.map(doc => doc.data());
            setVenueProfiles(completeProfiles);
            setLoadingData(false);
          } catch (error) {
            console.error('Error fetching venue profiles:', error);
            setLoadingData(false);
          }
        };
    
        fetchHostData();
    }, [user]);

    useEffect(() => {
      const fetchVenueData = async () => {
        if (venueProfiles.length === 0) return;
        setLoadingData(true);
    
        const venueIds = venueProfiles.map(profile => profile.venueId);
    
        try {
          const gigsRef = collection(firestore, 'gigs');
          const templatesRef = collection(firestore, 'templates');
    
          // Query gigs based on top-level venueId
          const gigsQuery = query(gigsRef, where('venueId', 'in', venueIds));
          const gigsSnapshot = await getDocs(gigsQuery);
          const fetchedGigs = gigsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              date: data.date.toDate(), // Convert Firestore Timestamp to JS Date
              createdAt: data.createdAt.toDate() // Convert Firestore Timestamp to JS Date
            };
          });
    
          const completeGigs = fetchedGigs.filter(gig => gig.complete !== false);
          const incompleteGigs = fetchedGigs.filter(gig => gig.complete === false);
    
          setGigs(completeGigs);
          setIncompleteGigs(incompleteGigs);
    
          // Query templates based on top-level venueId
          const templatesQuery = query(templatesRef, where('venueId', 'in', venueIds));
          const templatesSnapshot = await getDocs(templatesQuery);
          const fetchedTemplates = templatesSnapshot.docs.map(doc => doc.data());
    
          setTemplates(fetchedTemplates);
          setLoadingData(false);
        } catch (error) {
          console.error('Error fetching venue data:', error);
          setLoadingData(false);
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
                    <Route path="gig-applications" element={<GigApplications />} />
                    <Route path="venues" element={<Venues venues={venueProfiles} />} />
                    <Route path="musicians" element={<h1>musicians</h1>} />
                    <Route path="finances" element={<h1>financials</h1>} />
                </Routes>
            </div>
            {gigPostModal && 
              <GigPostModal 
                setGigPostModal={setGigPostModal} 
                venueProfiles={venueProfiles} 
                user={user} 
                templates={templates} 
                incompleteGigs={incompleteGigs} 
                editGigData={editGigData}
              />
            }
        </>
    )
}