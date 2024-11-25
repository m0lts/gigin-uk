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
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { firestore } from "../../../firebase";
import { GigApplications } from "./GigApplications";
import { useGigs } from "../../../context/GigsContext";
import { Overview } from "./Overview";
import { Finances } from "./Finances";
import { SavedMusicians } from "./SavedMusicians";
import { FindMusicians } from "./FindMusicians";
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';


export const VenueDashboard = ({  }) => {

    const { user } = useAuth();
    const { gigs } = useGigs();

    const [loadingData, setLoadingData] = useState(false);
    const [gigPostModal, setGigPostModal] = useState(false);
    const [venueProfiles, setVenueProfiles] = useState([]);
    const [gigsData, setGigsData] = useState([]);
    const [incompleteGigs, setIncompleteGigs] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [editGigData, setEditGigData] = useState();
    const [savedCards, setSavedCards] = useState([]);
    const [loadingStripeDetails, setLoadingStripeDetails] = useState(true);
    const [customerDetails, setCustomerDetails] = useState();
    const [receipts, setReceipts] = useState([]);
    

    useEffect(() => {
        const filterVenueData = async () => {
            if (!user) return;

            try {
                setLoadingData(true);

                // Filter the user's completed venue profiles
                const completeProfiles = user.venueProfiles.filter(profile => profile.completed);
                setVenueProfiles(completeProfiles);

                if (completeProfiles.length === 0) {
                    setLoadingData(false);
                    return;
                }

                // Extract venue IDs from completed profiles
                const venueIds = completeProfiles.map(profile => profile.venueId);

                // Filter gigs based on the venue IDs from context
                const completeGigs = gigs.filter(gig => venueIds.includes(gig.venueId) && gig.complete !== false);
                const incompleteGigs = gigs.filter(gig => venueIds.includes(gig.venueId) && gig.complete === false);

                setGigsData(completeGigs);
                setIncompleteGigs(incompleteGigs);

                // Set up templates listener
                const templatesRef = collection(firestore, 'templates');
                const templatesQuery = query(templatesRef, where('venueId', 'in', venueIds));
                const unsubscribeTemplates = onSnapshot(templatesQuery, (templatesSnapshot) => {
                    const fetchedTemplates = templatesSnapshot.docs.map(doc => doc.data());
                    setTemplates(fetchedTemplates);
                });

                // Cleanup listeners when the component unmounts
                return () => {
                    unsubscribeTemplates();
                };

            } catch (error) {
                console.error('Error filtering venue data:', error);
            } finally {
                setLoadingData(false);
            }
        };

        const fetchCustomerData = async () => {
            setLoadingStripeDetails(true);
            try {
              const getCustomerData = httpsCallable(functions, 'getCustomerData');
              const response = await getCustomerData();
        
              // Destructure response data
              const { customer, receipts, paymentMethods } = response.data;

              const filteredReceipts = receipts.filter((receipt) => receipt.metadata.gigId)
        
              // Save data to state
              setSavedCards(paymentMethods);
              setReceipts(filteredReceipts);
              setCustomerDetails(customer);
            } catch (error) {
              console.error('Error fetching customer data:', error);
            } finally {
              setLoadingStripeDetails(false);
            }
        };
        
          
        filterVenueData();
        fetchCustomerData();
    }, [user, gigs]); 

    return (
        <>  
            {loadingData && <LoadingScreen />}
            <Sidebar
              setGigPostModal={setGigPostModal}
            />
            <div className="dashboard window">
                <Routes>
                    <Route index element={<Overview savedCards={savedCards} loadingStripeDetails={loadingStripeDetails} receipts={receipts} />} />
                    <Route path="gigs" element={<Gigs gigs={gigsData} venues={venueProfiles} setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} />} />
                    <Route path="gig-applications" element={<GigApplications />} />
                    <Route path="venues" element={<Venues venues={venueProfiles} />} />
                    <Route path="musicians" element={<SavedMusicians user={user} />} />
                    <Route path="musicians/find" element={<FindMusicians user={user} />} />
                    <Route path="finances" element={<Finances savedCards={savedCards} loadingStripeDetails={loadingStripeDetails} receipts={receipts} customerDetails={customerDetails} setSavedCards={setSavedCards} />} />
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