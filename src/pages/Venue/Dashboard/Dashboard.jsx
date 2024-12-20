import { Route, Routes, useLocation } from "react-router-dom"
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
import { ReviewModal } from "../../../components/common/ReviewModal";
import { WelcomeModal } from "../../../components/musician-components/WelcomeModal";


export const VenueDashboard = () => {

    const { user } = useAuth();
    const { gigs } = useGigs();
    const location = useLocation();
    const newUser = location.state?.newUser;
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);

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
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [gigToReview, setGigToReview] = useState(null);
    

    useEffect(() => {
        const filterVenueData = async () => {
            if (!user) return;
            try {
                setLoadingData(true);
                const completeProfiles = user.venueProfiles.filter(profile => profile.completed);
                setVenueProfiles(completeProfiles);
                if (completeProfiles.length === 0) {
                    setLoadingData(false);
                    return;
                }
                const venueIds = completeProfiles.map(profile => profile.venueId);
                const completeGigs = gigs.filter(gig => venueIds.includes(gig.venueId) && gig.complete !== false);
                const incompleteGigs = gigs.filter(gig => venueIds.includes(gig.venueId) && gig.complete === false);
                setGigsData(completeGigs);
                setIncompleteGigs(incompleteGigs);
                const templatesRef = collection(firestore, 'templates');
                const templatesQuery = query(templatesRef, where('venueId', 'in', venueIds));
                const unsubscribeTemplates = onSnapshot(templatesQuery, (templatesSnapshot) => {
                    const fetchedTemplates = templatesSnapshot.docs.map(doc => doc.data());
                    setTemplates(fetchedTemplates);
                });
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
              const { customer, receipts, paymentMethods } = response.data;
              const filteredReceipts = receipts.filter((receipt) => receipt.metadata.gigId)
              setSavedCards(paymentMethods);
              setReceipts(filteredReceipts);
              setCustomerDetails(customer);
            } catch (error) {
              console.error('Error fetching customer data:', error);
            } finally {
              setLoadingStripeDetails(false);
            }
        };

        const checkGigsForReview = () => {
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const gigsToReview = gigs.filter((gig) => {
                const gigDateTime = new Date(`${gig.date.toDate().toISOString().split('T')[0]}T${gig.startTime}`);
                const hasBeenReviewed = localStorage.getItem(`reviewedGig-${gig.gigId}`) === 'true';
                const gigReviewed = gig.venueHasReviewed;
                const hasAcceptedApplicant = gig.applicants.some((applicant) => applicant.status === "confirmed");

            return gigDateTime > twentyFourHoursAgo &&
            gigDateTime <= now &&
            !hasBeenReviewed &&
            !gigReviewed &&
            hasAcceptedApplicant;
            });
            if (gigsToReview.length > 0) {
                setGigToReview(gigsToReview[0]);
                setShowReviewModal(true);
            }
        };

        filterVenueData();
        fetchCustomerData();
        checkGigsForReview();
    }, [user, gigs]); 

    useEffect(() => {
        if (newUser) {
            setShowWelcomeModal(true);
        }
    }, [newUser]);

    return (
        <>  
            {loadingData && <LoadingScreen />}
            <Sidebar
              setGigPostModal={setGigPostModal}
            />
            <div className="dashboard window venue">
                <Routes>
                    <Route index element={<Overview savedCards={savedCards} loadingStripeDetails={loadingStripeDetails} receipts={receipts} gigs={gigsData} loadingGigs={loadingData} venues={venueProfiles} setGigPostModal={setGigPostModal} />} />
                    <Route path="gigs" element={<Gigs gigs={gigsData} venues={venueProfiles} setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} />} />
                    <Route path="gig-applications" element={<GigApplications setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} />} />
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
            {showReviewModal && 
                <ReviewModal
                    gigData={gigToReview}
                    reviewer="venue"
                    onClose={() => {
                        setShowReviewModal(false);
                        localStorage.setItem(`reviewedGig-${gigToReview.gigId}`, 'true');
                    }}
                />
            }
            {showWelcomeModal && (
                <WelcomeModal
                    user={user}
                    setShowWelcomeModal={setShowWelcomeModal}
                    role="venue"
                />
            )}
        </>
    )
}