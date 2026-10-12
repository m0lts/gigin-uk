import { useEffect } from 'react';
import { useAuth } from '@hooks/useAuth'
import '@styles/shared/dashboard.styles.css'
import { useNavigate } from 'react-router-dom';
import { useVenueDashboard } from '../context/VenueDashboardContext';
import { pathWhenSignedInWithoutVenue } from '../config/venueAccess';

export const VenueDashboardLayout = ({ children, setAuthModal, setAuthType, user, setAuthClosable }) => {

    const { loading } = useAuth();
    const navigate = useNavigate();
    const { sidebarCollapsed } = useVenueDashboard();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/')
            setAuthModal(true);
            setAuthClosable(false);
        }
        if (user && !user.venueProfiles) {
            navigate(pathWhenSignedInWithoutVenue());
        }
    }, [user])

    return (
        <>
            <section className={`dashboard${sidebarCollapsed ? ' dashboard--sidebar-collapsed' : ''}`}>
                { children }
            </section>
        </>
    )
};
