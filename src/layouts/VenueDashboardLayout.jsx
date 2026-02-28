import { useEffect } from 'react';
import { useAuth } from '@hooks/useAuth'
import '@styles/shared/dashboard.styles.css'
import { useNavigate } from 'react-router-dom';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Header } from '../features/venue/components/Header';
import { useVenueDashboard } from '../context/VenueDashboardContext';

export const VenueDashboardLayout = ({ children, setAuthModal, setAuthType, user, setAuthClosable }) => {

    const { loading } = useAuth();
    const navigate = useNavigate();
    const { isMdUp } = useBreakpoint();
    const { loading: dashboardLoading, sidebarCollapsed } = useVenueDashboard();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/')
            setAuthModal(true);
            setAuthClosable(false);
        }
        if (user && !user.venueProfiles) {
            if (isMdUp) {
                navigate('/venues/add-venue');
            } else {
                navigate('/');
            }
        }
    }, [user])

    return (
        <>
            {!isMdUp && !dashboardLoading && <Header setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} />}
            <section className={`dashboard${sidebarCollapsed ? ' dashboard--sidebar-collapsed' : ''}`}>
                { children }
            </section>
        </>
    )
};
