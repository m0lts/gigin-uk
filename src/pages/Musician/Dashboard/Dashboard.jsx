import { Route, Routes, useNavigate } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { useState, useEffect } from "react"
import { useAuth } from '../../../hooks/useAuth';
import { LoadingScreen } from "/components/ui/loading/LoadingScreen";
import '/styles/musician/musician-dashboard.styles.css'
import { ProfileTab } from "./Profile/ProfileTab";
import { collection, getDocs, query, where } from 'firebase/firestore';
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
        const fetchMusicianData = async () => {
            if (!user) return;
            setLoadingData(true);

            if (!user.musicianProfile) {
                navigate('/musician/create-musician-profile');
                setLoadingData(false);
            }

            setMusicianProfile(user.musicianProfile);
            setGigApplications(user.musicianProfile.gigApplications ? user.musicianProfile.gigApplications : []);
            setLoadingData(false);
        };
    
        fetchMusicianData();
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
                            <Route path="finances" element={<Finances />} />
                        </Routes>
                    </div>
                </>
            )}
        </>
    )
}