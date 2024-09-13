import { useEffect } from "react";
import { Header } from "../components/musician-components/Header"
import { useAuth } from "../hooks/useAuth"
import '/styles/common/dashboard.styles.css'
import { useNavigate } from "react-router-dom";

export const MusicianDashboardLayout = ({ children, setAuthModal, setAuthType, user, setAuthClosable }) => {

    const { loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            setAuthModal(true);
            setAuthClosable(false);
        }
        if (user && !user.musicianProfile) {
            navigate('/create-musician-profile')
        }
        if (user.musicianProfile && !user.musicianProfile.completed) {
            const musicianProfile = user.musicianProfile;
            navigate('/create-musician-profile', { state: { musicianProfile } })
        }
    }, [user, loading])


    return (
        <section className="dashboard">
            <Header 
                setAuthType={setAuthType}
                setAuthModal={setAuthModal}
                user={user}
            />
            <main className="main">
                { children }
            </main>
        </section>
    )
}