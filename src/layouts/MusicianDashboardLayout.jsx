import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@hooks/useAuth'
import { MusicianDashboardProvider } from '../context/MusicianDashboardContext';
import '@styles/shared/dashboard.styles.css'
import { ProfileCreator } from '../features/musician/profile-creator/ProfileCreator';

export const MusicianDashboardLayout = ({
    children,
    setAuthModal,
    setAuthType,
    user,
    setAuthClosable,
  }) => {
    const { loading } = useAuth();
    const [showProfileModal, setShowProfileModal] = useState(false);

    const hasBasics = useMemo(() => {
      const p = user?.musicianProfile || null;
      const hasName = typeof p?.name === 'string' && p.name.trim().length >= 2;
      const hasPhoto = !!p?.picture;
      return hasName && hasPhoto;
    }, [user?.musicianProfile]);
  
    useEffect(() => {
      if (!loading && !user) {
        setAuthModal(true);
        setAuthType?.('login');
        setAuthClosable?.(false);
        return;
      }

      if (!loading && user && !user.musicianProfile) {
        setShowProfileModal(true);
        setAuthClosable?.(false);
        return;
      }

      if (!loading && user?.musicianProfile && !hasBasics) {
        setShowProfileModal(true);
        setAuthClosable?.(false);
        return;
      }

      if (!loading && user && hasBasics) {
        setShowProfileModal(false);
        setAuthClosable?.(true);
      }
    }, [loading, user, hasBasics, setAuthModal, setAuthType, setAuthClosable]);
  
    return (
      <MusicianDashboardProvider user={user}>
        <section className="dashboard">
          {children}
        </section>
  
        {showProfileModal && (
          <ProfileCreator
            user={user}
            setShowModal={setShowProfileModal}
            closable={false}
          />
        )}
      </MusicianDashboardProvider>
    );
  };