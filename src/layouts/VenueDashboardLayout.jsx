import { useEffect } from 'react';
import { useAuth } from '@hooks/useAuth'
import '@styles/shared/dashboard.styles.css'
import { useNavigate } from 'react-router-dom';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useVenueDashboard } from '../context/VenueDashboardContext';
import { FEATURES } from '../config/features';

export const VenueDashboardLayout = ({ children, setAuthModal, setAuthType, user, setAuthClosable }) => {

    const { loading } = useAuth();
    const navigate = useNavigate();
    const { isMdUp } = useBreakpoint();
    const { sidebarCollapsed } = useVenueDashboard();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/')
            setAuthModal(true);
            setAuthClosable(false);
        }
        if (user && !user.venueProfiles) {
            if (!FEATURES.venueSignup || isMdUp) {
                navigate('/venues/add-venue');
            } else {
                navigate('/');
            }
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
