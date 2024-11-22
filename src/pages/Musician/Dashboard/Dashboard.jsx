import { Route, Routes, useNavigate } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { useState, useEffect } from "react"
import { useAuth } from '../../../hooks/useAuth';
import { LoadingScreen } from "/components/ui/loading/LoadingScreen";
import '/styles/musician/musician-dashboard.styles.css'
import { ProfileTab } from "./Profile/ProfileTab";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "../../../firebase";
import { ProfileCreator } from "./ProfileCreator/ProfileCreator";
import { Gigs } from "./Gigs";
import { Bands } from "./Bands";
import { Finances } from "./Finances";
import { Overview } from "./Overview";


export const MusicianDashboard = () => {

    const { user } = useAuth();
    const navigate = useNavigate();

    const [loadingData, setLoadingData] = useState(true);
    const [musicianProfile, setMusicianProfile] = useState(null);
    const [gigApplications, setGigApplications] = useState([]);

    useEffect(() => {
        if (!user) return;
    
        const fetchMusicianData = () => {
            setLoadingData(true);
    
            // Check if the user has a musician profile
            if (!user.musicianProfile) {
                navigate('/musician/create-musician-profile');
                setLoadingData(false);
                return;
            }
    
            // Reference to the musician profile document in Firestore
            const musicianRef = doc(firestore, 'musicianProfiles', user.musicianProfile.musicianId);
    
            // Listen for real-time updates
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
    
            // Cleanup the listener on unmount
            return unsubscribe;
        };
    
        const unsubscribe = fetchMusicianData();
    
        // Cleanup function for the effect
        return () => unsubscribe && unsubscribe();
    }, [user]);


    return (
        <>  
            {loadingData ? (<LoadingScreen /> ) : (
                <>
                    <Sidebar />
                    <div className="window musician">
                        <Routes>
                            <Route index element={<Overview />} />
                            <Route path="profile" element={<ProfileTab musicianProfile={musicianProfile} />} />
                            <Route path="gigs" element={<Gigs gigApplications={gigApplications} musicianId={musicianProfile.musicianId} />} />
                            <Route path="bands" element={<Bands />} />
                            <Route path="finances" element={<Finances musicianProfile={musicianProfile} />} />
                        </Routes>
                    </div>
                </>
            )}
        </>
    )
}