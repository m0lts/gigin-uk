import { useEffect } from 'react';
import { Header } from '@features/musician/components/Header'
import { useAuth } from '@hooks/useAuth'
import '@styles/shared/dashboard.styles.css'
import { useNavigate, useLocation } from 'react-router-dom';
import { MusicianDashboardProvider } from '../context/MusicianDashboardContext';

export const MusicianDashboardLayout = ({ children, setAuthModal, setAuthType, user, setAuthClosable }) => {

    const { loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const newUser = location.state?.newUser;

    useEffect(() => {
        if (!loading && !user) {
            setAuthModal(true);
            setAuthClosable(false);
        }
        if (user && !user.musicianProfile) {
            navigate('/create-profile')
        }
        if (user.musicianProfile && !user.musicianProfile.completed) {
            const musicianProfile = user.musicianProfile;
            navigate('/create-profile', { state: { musicianProfile } })
        }
    }, [user, loading])

    return (
        <MusicianDashboardProvider user={user}>
            <section className="dashboard">
                { children }
            </section>
        </MusicianDashboardProvider>
    )
};