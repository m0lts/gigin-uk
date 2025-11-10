import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@hooks/useAuth'
import { useArtistDashboard } from '../context/ArtistDashboardContext';
import '@styles/shared/dashboard.styles.css'
import { ProfileCreator } from '../features/artist/profile-creator/ProfileCreator';
import { Header } from '../features/artist/components/Header';
import { useBreakpoint } from '../hooks/useBreakpoint';

export const MusicianDashboardLayout = ({
    children,
    setAuthModal,
    setAuthType,
    user,
    setAuthClosable,
    setNoProfileModal,
    noProfileModal,
    setNoProfileModalClosable
  }) => {
    const { loading } = useAuth();
    const { isMdUp } = useBreakpoint();
    const { loading: dashboardLoading } = useArtistDashboard();

    const hasBasics = useMemo(() => {
      const p = user?.musicianProfile || null;
      const hasName = typeof p?.name === 'string' && p.name.trim().length >= 2;
      const hasOnboarded = !!p?.onboarded;
      return hasName && hasOnboarded;
    }, [user?.musicianProfile]);
  
    useEffect(() => {
      if (!loading && !user) {
        setAuthModal(true);
        setAuthType?.('login');
        setAuthClosable?.(false);
        return;
      }

      if (!loading && user && !user.musicianProfile) {
        setNoProfileModal(true);
        setAuthClosable?.(false);
        return;
      }

      if (!loading && user?.musicianProfile === undefined) {
        setNoProfileModal(true);
        setNoProfileModalClosable(false);
        setAuthClosable?.(false);
        return;
      }

      if (!loading && Array.isArray(user?.musicianProfile) && user.musicianProfile.length > 0) {
        return;
      }

      if (!loading && user?.musicianProfile && !hasBasics) {
        setNoProfileModal(true);
        setNoProfileModalClosable(false);
        setAuthClosable?.(false);
        return;
      }

      if (!loading && user && hasBasics) {
        setNoProfileModal(false);
        setAuthClosable?.(true);
      }
    }, [loading, user, hasBasics, setAuthModal, setAuthType, setAuthClosable]);
  
    return (
      hasBasics && (
        <>
          {!isMdUp && !dashboardLoading && <Header setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} />}
          <section className="dashboard">
            {children}
          </section>
        </>
      )
    );
  };
