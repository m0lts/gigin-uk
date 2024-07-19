import { Route, Routes } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { useState, useEffect } from "react"
import { useAuth } from '../../../hooks/useAuth';
import { LoadingScreen } from "/components/ui/loading/LoadingScreen";
import '/styles/musician/musician-dashboard.styles.css'
import { Profile } from "./Profile";
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from "../../../firebase";


export const MusicianDashboard = () => {

    const { user } = useAuth();

    const [loadingData, setLoadingData] = useState(false);
    const [musicianProfile, setMusicianProfile] = useState(null);

    useEffect(() => {
        const fetchMusicianData = async () => {
          if (!user) return;
          setLoadingData(true);
    
          try {
            const profileRef = doc(firestore, 'musicianProfiles', user.uid);
            const docSnapshot = await getDoc(profileRef);

            if (docSnapshot.exists()) {
                setMusicianProfile(docSnapshot.data());
            }

            setLoadingData(false);
        } catch (error) {
            console.error('Error fetching musician profile:', error);
            setLoadingData(false);
        }
        };
    
        fetchMusicianData();
    }, [user]);


    return (
        <>  
            {loadingData && <LoadingScreen />}
            <Sidebar />
            <div className="window musician">
                <Routes>
                    <Route index element={<h1>Overview</h1>} />
                    <Route path="profile" element={<Profile musicianProfile={musicianProfile} />} />
                    <Route path="gigs" element={<h1>Gigs</h1>} />
                    <Route path="bands" element={<h1>Bands</h1>} />
                    <Route path="finances" element={<h1>Finances</h1>} />
                </Routes>
            </div>
        </>
    )
}