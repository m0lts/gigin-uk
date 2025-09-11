// Dependencies
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'

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
import { VerifyEmailModal } from './features/shared/components/VerifyEmailModal';
import { auth } from "@lib/firebase";
import { NoProfileModal } from './features/musician/components/NoProfileModal';
import { VenueFinder } from './features/venue-discovery/VenueFinder';
import Portal from './features/shared/components/Portal';



export default function App() {

  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authModal, setAuthModal] = useState(false);
  const [authType, setAuthType] = useState('login');
  const [authClosable, setAuthClosable] = useState(true);
  const [isScreenTooSmall, setIsScreenTooSmall] = useState(false);
  const [verifyEmailModal, setVerifyEmailModal] = useState(false);
  const [verifyInfoModal, setVerifyInfoModal] = useState(false);
  const [noProfileModal, setNoProfileModal] = useState(false)
  const [noProfileModalClosable, setNoProfileModalClosable] = useState(false);
  const newUser =  sessionStorage.getItem('newUser');

  useResizeEffect((width) => {
    setIsScreenTooSmall(width < 768);
  });

  useEffect(() => {
    if (location.pathname.includes('dashboard') || location.pathname.includes('venue-builder') || location.pathname.includes('create-profile')) {
      setAuthClosable(false);
    } else {
      setAuthClosable(true);
    }
    if (location.pathname === ('email-verified')) {
      navigate('/')
    }
  }, [location.pathname]);

  const getCreatedAtMs = (authUser, userDoc) => {
    const meta = authUser?.metadata?.creationTime;
    const fromAuth = meta ? Date.parse(meta) : NaN;
    if (!Number.isNaN(fromAuth)) return fromAuth;
    const raw = userDoc?.createdAt;
    if (!raw) return NaN;
    if (typeof raw === 'number') return raw;
    if (raw?.toDate) {
      try { return raw.toDate().getTime(); } catch { /* ignore */ }
    }
    return NaN;
  }

  useEffect(() => {
    // ✅ Skip all checks in dev mode
    if (import.meta.env.MODE === 'development' || location.pathname.includes('gigin-uk-git-dev-gigin-dev-team.vercel.app')) {
      setVerifyEmailModal(false);
      setVerifyInfoModal(false);
      return;
    }
  
    const u = auth.currentUser;
    if (!u) {
      setVerifyEmailModal(false);
      return;
    }
    if (u.emailVerified) {
      setVerifyEmailModal(false);
      return;
    }
    const createdAtMs = getCreatedAtMs(u, user);
    if (Number.isNaN(createdAtMs)) {
      setVerifyEmailModal(false);
      return;
    }
    const hours = (Date.now() - createdAtMs) / 36e5;
    setVerifyEmailModal(hours >= 48);
    if (newUser) setVerifyInfoModal(true);
  }, [user, newUser]);

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

        {/* FIND GIGS */}
        <Route path='/find-a-gig' element={<GigFinder user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} setNoProfileModalClosable={setNoProfileModalClosable}  />} />

        {/* FIND VENUES */}
        <Route path='/find-venues' element={<VenueFinder user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} setNoProfileModalClosable={setNoProfileModalClosable}   />} />

        {/* MUSICIAN ROUTES */}
        <Route path='/'>
          <Route index element={<MainLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} logout={logout} setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} setNoProfileModalClosable={setNoProfileModalClosable}  ><LandingPage setAuthModal={setAuthModal} authType={authType} setAuthType={setAuthType} authClosable={authClosable} setAuthClosable={setAuthClosable} noProfileModal={noProfileModal} setNoProfileModal={setNoProfileModal} setNoProfileModalClosable={setNoProfileModalClosable} /></MainLayout>} />
          <Route path='dashboard/*' element={<MusicianDashboardLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} authClosable={authClosable} setAuthClosable={setAuthClosable} setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} setNoProfileModalClosable={setNoProfileModalClosable}  ><MusicianDashboard user={user} /></MusicianDashboardLayout>} />
          <Route path=':musicianId' element={<MusicianProfile user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
          <Route path=':musicianId/:gigId' element={<MusicianProfile user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        </Route>

        {/* VENUES ROUTES */}
        <Route path='/venues'>
          <Route index element={<VenueHome user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} setNoProfileModalClosable={setNoProfileModalClosable} />} />
          <Route path='add-venue/*' element={<NoHeaderFooterLayout><VenueBuilder user={user} setAuthModal={setAuthModal} authModal={authModal} authClosable={authClosable} setAuthClosable={setAuthClosable} /></NoHeaderFooterLayout>} />
          <Route path='dashboard/*' element={<VenueDashboardLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} authClosable={authClosable} setAuthClosable={setAuthClosable} ><VenueDashboard user={user} /></VenueDashboardLayout>} />
          <Route path='/venues/:venueId' element={<VenuePage user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        </Route>

        {/* OTHER ROUTES */}
        <Route path='/messages' element={<MessagesLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} logout={logout}><MessagePage /></MessagesLayout>} />
        <Route path='/gig/:gigId' element={<GigPage user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} noProfileModal={noProfileModal} setNoProfileModal={setNoProfileModal} setNoProfileModalClosable={setNoProfileModalClosable}  />} />
        <Route path='/account' element={<MainLayout user={user}><Account /></MainLayout>} />
        <Route path='/testimonials' element={<Testimonials />} />
        
      </Routes>
      
      {authModal && (
        <Portal>
          <AuthModal setAuthModal={setAuthModal} authType={authType} setAuthType={setAuthType} authClosable={authClosable} setAuthClosable={setAuthClosable} noProfileModal={noProfileModal} setNoProfileModal={setNoProfileModal} setNoProfileModalClosable={setNoProfileModalClosable}  />
        </Portal>
      )}
      {noProfileModal && (
        <Portal>
          <NoProfileModal isOpen={noProfileModal} onClose={() => {setNoProfileModal(false); setNoProfileModalClosable(false)}} noProfileModalClosable={noProfileModalClosable} />
        </Portal>
      )}
      {verifyEmailModal && (
        <Portal>
          <VerifyEmailModal onClose={() => setVerifyEmailModal(false)} />
        </Portal>
      )}
      {verifyInfoModal && (
        <Portal>
          <VerifyEmailModal onClose={() => setVerifyInfoModal(false)} />
        </Portal>
      )}
    </>
  );
}



