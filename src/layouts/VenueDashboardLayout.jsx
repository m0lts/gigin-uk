import { useEffect } from 'react';
import { useAuth } from '@hooks/useAuth'
import '@styles/shared/dashboard.styles.css'
import { useLocation, useNavigate } from 'react-router-dom';
import { VenueDashboardProvider } from '@context/VenueDashboardContext';

export const VenueDashboardLayout = ({ children, setAuthModal, setAuthType, user, setAuthClosable }) => {

    const { loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/venues')
            setAuthModal(true);
            setAuthClosable(false);
        }
        if (user && !user.venueProfiles) {
            navigate('/venues/add-venue')
        }
    }, [user])

    return (
        <VenueDashboardProvider user={user}>
            <section className="dashboard">
                { children }
            </section>
        </VenueDashboardProvider>
    )
};
