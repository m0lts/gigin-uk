// Dependencies
import { Routes, Route, useLocation } from 'react-router-dom'

// Styles and extras
import '@assets/fonts/fonts.css'
import '@styles/shared/buttons.styles.css'
import { LandingPage } from '@features/landing-page/LandingPage';
import { useEffect, useState } from 'react';
import { MainLayout } from '@layouts/MainLayout';
import { VenueHome } from '@features/venue/builder/Home';
import { NoHeaderFooterLayout } from '@layouts/NoHeaderFooterLayout';
import { VenueBuilder } from '@features/venue/builder/VenueBuilder';
import { useAuth } from '@hooks/useAuth';
import { AuthModal } from '@features/shared/components/AuthModal';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { TextLogo } from '@features/shared/ui/logos/Logos';
import { MusicianDashboardLayout } from '@layouts/MusicianDashboardLayout';
import { VenueDashboard } from '@features/venue/dashboard/Dashboard';
import { GigFinder } from '@features/gig-discovery/GigFinder';
import { GigPage } from '@features/gig-discovery/GigPage';
import { MusicianDashboard } from '@features/musician/dashboard/Dashboard';
import { ProfileCreator } from '@features/musician/profile-creator/ProfileCreator';
import { MusicianProfile } from '@features/musician/components/MusicianProfile';
import { MessagePage } from '@features/musician/messages/MessagePage';
import { MessagesLayout } from '@layouts/MessagesLayout';
import { VenueDashboardLayout } from '@layouts/VenueDashboardLayout';
import { Account } from '@features/account/Account';
import { Testimonials } from '@features/musician/profile/TestimonialPage';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { VenuePage } from './features/venue/components/VenuePage';



export default function App() {

  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const [authModal, setAuthModal] = useState(false);
  const [authType, setAuthType] = useState('login');
  const [authClosable, setAuthClosable] = useState(true);
  const [isScreenTooSmall, setIsScreenTooSmall] = useState(false);

  useResizeEffect((width) => {
    setIsScreenTooSmall(width < 768);
  });

  useEffect(() => {
    if (location.pathname.includes('dashboard') || location.pathname.includes('venue-builder') || location.pathname.includes('create-profile')) {
      setAuthClosable(false);
    } else {
      setAuthClosable(true);
    }
  }, [location.pathname]);


  if (loading) {
    return <LoadingScreen />;
  }

  if (isScreenTooSmall) {
    return (
      <div className='small-screen-message'>
        <TextLogo />
        <h1>Beta Mode</h1>
        <p style={{ padding: '0 2rem', textAlign: 'center' }}>Gigin is in the beta testing phase and we don't support screen sizes smaller than 768px.</p>
      </div>
    );
  }

  return (
    <>
      <Routes>

        {/* MAP */}
        <Route path='/find-a-gig' element={<GigFinder user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />

        {/* MUSICIAN ROUTES */}
        <Route path='/'>
          <Route index element={<MainLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} logout={logout}><LandingPage /></MainLayout>} />
          <Route path='dashboard/*' element={<MusicianDashboardLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} authClosable={authClosable} setAuthClosable={setAuthClosable} ><MusicianDashboard user={user} /></MusicianDashboardLayout>} />
          <Route path=':musicianId' element={<MusicianProfile user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
          <Route path=':musicianId/:gigId' element={<MusicianProfile user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        </Route>

        {/* VENUES ROUTES */}
        <Route path='/venues'>
          <Route index element={<VenueHome user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
          <Route path='add-venue/*' element={<NoHeaderFooterLayout><VenueBuilder user={user} setAuthModal={setAuthModal} authModal={authModal} authClosable={authClosable} setAuthClosable={setAuthClosable} /></NoHeaderFooterLayout>} />
          <Route path='dashboard/*' element={<VenueDashboardLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} authClosable={authClosable} setAuthClosable={setAuthClosable} ><VenueDashboard user={user} /></VenueDashboardLayout>} />
          <Route path='/venues/:venueId' element={<VenuePage user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        </Route>

        {/* OTHER ROUTES */}
        <Route path='/messages' element={<MessagesLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} logout={logout}><MessagePage /></MessagesLayout>} />
        <Route path='/gig/:gigId' element={<GigPage user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        <Route path='/account' element={<MainLayout user={user}><Account /></MainLayout>} />
        <Route path='/testimonials' element={<Testimonials />} />
        
      </Routes>
      
      {authModal && <AuthModal setAuthModal={setAuthModal} authType={authType} setAuthType={setAuthType} authClosable={authClosable} setAuthClosable={setAuthClosable} /> }
    </>
  );
}



