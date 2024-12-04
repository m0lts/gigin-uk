import { Route, Routes, useNavigate } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { useState, useEffect } from "react"
import { useAuth } from '../../../hooks/useAuth';
import { LoadingScreen } from "/components/ui/loading/LoadingScreen";
import '/styles/musician/musician-dashboard.styles.css'
import { ProfileTab } from "./Profile/ProfileTab";
import { doc, onSnapshot, collection, getDocs, where, query, getDoc } from "firebase/firestore";
import { firestore } from "../../../firebase";
import { ProfileCreator } from "./ProfileCreator/ProfileCreator";
import { Gigs } from "./Gigs";
import { Bands } from "./Bands";
import { Finances } from "./Finances";
import { Overview } from "./Overview";
import { ReviewModal } from "../../../components/common/ReviewModal";
import { useGigs } from "../../../context/GigsContext";


export const MusicianDashboard = () => {

    const { user } = useAuth();
    const { gigs } = useGigs();
    const navigate = useNavigate();

    const [loadingData, setLoadingData] = useState(true);
    const [musicianProfile, setMusicianProfile] = useState(null);
    const [gigApplications, setGigApplications] = useState([]);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [gigToReview, setGigToReview] = useState(null);

    useEffect(() => {
        if (!user) return;
        const fetchMusicianData = () => {
            if (musicianProfile) return;
            setLoadingData(true);
            if (!user.musicianProfile) {
                navigate('/musician/create-musician-profile');
                setLoadingData(false);
                return;
            }
            const musicianRef = doc(firestore, 'musicianProfiles', user.musicianProfile.musicianId);
            const unsubscribe = onSnapshot(musicianRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const musicianData = docSnapshot.data();
                    setMusicianProfile(musicianData);
                    setGigApplications(musicianData.gigApplications ? musicianData.gigApplications : []);
                } else {
                    console.warn("Musician profile does not exist.");
                    setMusicianProfile(null);
                    setGigApplications([]);
                }
                setLoadingData(false);
            }, (error) => {
                console.error("Error fetching musician profile:", error);
                setLoadingData(false);
            });
            return unsubscribe;
        };

        const checkGigsForReview = () => {
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const gigsToReview = gigs.filter((gig) => {
                const gigDateTime = new Date(`${gig.date.toDate().toISOString().split('T')[0]}T${gig.startTime}`);
                const hasBeenReviewed = localStorage.getItem(`reviewedGig-${gig.gigId}`) === 'true';
                const gigReviewed = gig.musicianHasReviewed;
                const musicianPlayedGig = gig.applicants.some((applicant) => applicant.id === musicianProfile.musicianId && applicant.status === "confirmed");

                return (
                    gigDateTime > twentyFourHoursAgo && // Gig is within the past week
                    gigDateTime <= now && // Gig has already started
                    !hasBeenReviewed && // Gig has not been marked as reviewed in localStorage
                    !gigReviewed && // Gig has not been reviewed in the database
                    musicianPlayedGig // Musician was confirmed to have played the gig
                );
                });
                if (gigsToReview.length > 0) {
                    setGigToReview(gigsToReview[0]);
                    setShowReviewModal(true);
                }
        };      
        if (musicianProfile) {
            checkGigsForReview();
        }    
        const unsubscribe = fetchMusicianData();
        return () => unsubscribe && unsubscribe();
    }, [user, gigs, musicianProfile]);

    return (
        <>  
            {loadingData ? (<LoadingScreen /> ) : (
                <>
                    <Sidebar />
                    <div className="window dashboard musician">
                        <Routes>
                            <Route index element={<Overview musicianProfile={musicianProfile} gigApplications={gigApplications} />} />
                            <Route path="profile" element={<ProfileTab musicianProfile={musicianProfile} />} />
                            <Route path="gigs" element={<Gigs gigApplications={gigApplications} musicianId={musicianProfile.musicianId} />} />
                            <Route path="bands" element={<Bands />} />
                            <Route path="finances" element={<Finances musicianProfile={musicianProfile} setMusicianProfile={setMusicianProfile} />} />
                        </Routes>
                    </div>
                </>
            )}
            {showReviewModal &&
                <ReviewModal
                    gigData={gigToReview}
                    reviewer="musician"
                    onClose={() => {
                        setShowReviewModal(false);
                        localStorage.setItem(`reviewedGig-${gigToReview.gigId}`, 'true');
                    }}
                />
            }
        </>
    )
}