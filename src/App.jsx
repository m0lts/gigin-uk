// Dependencies
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'

// Styles and extras
import '@assets/fonts/fonts.css'
import '@styles/shared/buttons.styles.css'
import { LandingPage } from '@features/landing-page/LandingPage';
import { VenueLandingPage } from '@features/landing-page/VenueLandingPage';
import { useEffect, useState, useRef } from 'react';
import { MainLayout } from '@layouts/MainLayout';
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
import { MusicianDashboard } from '@features/artist/dashboard/Dashboard';
import { ProfileCreator } from '@features/artist/profile-creator/ProfileCreator';
import { MusicianProfile } from '@features/artist/components/MusicianProfile';
import { ArtistProfile } from '@features/artist/artist-profile/ArtistProfile';
import { ArtistProfileViewer } from '@features/artist/artist-profile/ArtistProfileViewer';
import { MessagePage } from '@features/artist/messages/MessagePage';
import { MessagesLayout } from '@layouts/MessagesLayout';
import { VenueDashboardLayout } from '@layouts/VenueDashboardLayout';
import { Account } from '@features/account/Account';
import { Testimonials } from '@features/artist/profile/TestimonialPage';
import { VenuePage } from './features/venue/components/VenuePage';
import { VerifyEmailModal } from './features/shared/components/VerifyEmailModal';
import { auth } from "@lib/firebase";
import { NoProfileModal } from './features/artist/components/NoProfileModal';
import { VenueFinder } from './features/venue-discovery/VenueFinder';
import Portal from './features/shared/components/Portal';
import { logClientError } from './services/client-side/errors';
import { TermsAndConditions } from './features/legals/TermsAndConditions';
import { PrivacyPolicy } from './features/legals/PrivacyPolicy';
import { JoinVenuePage } from './features/venue/components/JoinVenue';
import { JoinArtistPage } from './features/artist/components/JoinArtist';
import { EmailActionHandler } from './features/shared/components/EmailActionHandler';
import { VenueDashboardProvider } from './context/VenueDashboardContext';
import { ArtistDashboardProvider } from './context/ArtistDashboardContext';



export default function App() {

  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authModal, setAuthModal] = useState(false);
  const [authType, setAuthType] = useState('login');
  const [authClosable, setAuthClosable] = useState(true);
  const [verifyEmailModal, setVerifyEmailModal] = useState(false);
  const [verifyInfoModal, setVerifyInfoModal] = useState(false);
  const [noProfileModal, setNoProfileModal] = useState(false)
  const [noProfileModalClosable, setNoProfileModalClosable] = useState(false);
  const [initialEmail, setInitialEmail] = useState('');
  const newUser =  sessionStorage.getItem('newUser');
  const justLoggedInRef = useRef(false);

  useEffect(() => {
    if (location.pathname.includes('dashboard') || location.pathname.includes('venue-builder') || location.pathname.includes('create-profile')) {
      setAuthClosable(false);
    } else {
      setAuthClosable(true);
    }
    if (location.pathname === ('/email-verified')) {
      navigate('/')
    }
    if (location.pathname === ('/venues/add-venue')) {
      setAuthClosable(false);
    }
  }, [location.pathname]);

  let __loggingNow = false;

  window.addEventListener('error', (event) => {
    if (__loggingNow || !event?.error) return;
    __loggingNow = true;
    logClientError({
      message: event.error?.message || 'window.error',
      stack: event.error?.stack || null,
      path: window.location.pathname + window.location.search,
      userAgent: navigator.userAgent,
      extra: { source: 'window.error' },
    }).finally(() => { __loggingNow = false; });
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    if (__loggingNow) return;
    const reason = event?.reason;
    const message = typeof reason === 'string' ? reason : reason?.message || 'unhandledrejection';
    const stack = typeof reason === 'object' ? reason?.stack || null : null;
  
    __loggingNow = true;
    logClientError({
      message,
      stack,
      path: window.location.pathname + window.location.search,
      userAgent: navigator.userAgent,
      extra: { source: 'unhandledrejection' },
    }).finally(() => { __loggingNow = false; });
  });

  
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      justLoggedInRef.current = false;
      return;
    }
    // Only show verify email modal if:
    // 1. Email is not verified
    // 2. Modal is not already open (to prevent reopening after login)
    // 3. We didn't just log in (to prevent reopening immediately after successful login)
    // This prevents reopening the modal immediately after successful login
    if (!u.emailVerified && !authModal && !justLoggedInRef.current) {
      setAuthType('verify-email');
      setAuthModal(true);
      setAuthClosable(false);
      return;
    }
    // Reset the flag after a short delay to allow normal email verification checks
    if (justLoggedInRef.current) {
      const timer = setTimeout(() => {
        justLoggedInRef.current = false;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, authModal]);

  if (loading) {
    return <LoadingScreen />;
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
          {/* <Route index element={<MainLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} logout={logout} setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} setNoProfileModalClosable={setNoProfileModalClosable}  ><LandingPage setAuthModal={setAuthModal} authType={authType} setAuthType={setAuthType} authClosable={authClosable} setAuthClosable={setAuthClosable} noProfileModal={noProfileModal} setNoProfileModal={setNoProfileModal} setNoProfileModalClosable={setNoProfileModalClosable} /></MainLayout>} /> */}
          <Route index element={<LandingPage setAuthModal={setAuthModal} authType={authType} setAuthType={setAuthType} authClosable={authClosable} setAuthClosable={setAuthClosable} noProfileModal={noProfileModal} setNoProfileModal={setNoProfileModal} setNoProfileModalClosable={setNoProfileModalClosable} setInitialEmail={setInitialEmail} />} />
          <Route path='artist-profile/:profileId?/*' element={<ArtistDashboardProvider user={user}><ArtistProfile user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} /></ArtistDashboardProvider>} />
          <Route path='dashboard/*' element={<ArtistDashboardProvider user={user}><MusicianDashboardLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} authClosable={authClosable} setAuthClosable={setAuthClosable} setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} setNoProfileModalClosable={setNoProfileModalClosable}  ><MusicianDashboard user={user} /></MusicianDashboardLayout></ArtistDashboardProvider>} />
          <Route path=':musicianId' element={<MusicianProfile user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
          <Route path=':musicianId/:gigId' element={<MusicianProfile user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
          <Route path='artist/:artistId' element={<ArtistProfileViewer user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        </Route>

        {/* VENUES ROUTES */}
        <Route path='/venues'>
          <Route index element={<VenueLandingPage setAuthModal={setAuthModal} authType={authType} setAuthType={setAuthType} authClosable={authClosable} setAuthClosable={setAuthClosable} noProfileModal={noProfileModal} setNoProfileModal={setNoProfileModal} setNoProfileModalClosable={setNoProfileModalClosable} setInitialEmail={setInitialEmail} />} />
          <Route path='add-venue/*' element={<NoHeaderFooterLayout><VenueBuilder user={user} setAuthModal={setAuthModal} authModal={authModal} authClosable={authClosable} setAuthClosable={setAuthClosable} setAuthType={setAuthType} /></NoHeaderFooterLayout>} />
          <Route path='dashboard/*' element={<VenueDashboardProvider user={user}><VenueDashboardLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} authClosable={authClosable} setAuthClosable={setAuthClosable} ><VenueDashboard user={user} /></VenueDashboardLayout></VenueDashboardProvider>} />
          <Route path='/venues/:venueId' element={<VenuePage user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        </Route>

        {/* OTHER ROUTES */}
        <Route path='/messages' element={<MessagesLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} logout={logout}><MessagePage /></MessagesLayout>} />
        <Route path='/gig/:gigId' element={<GigPage user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} setInitialEmail={setInitialEmail} noProfileModal={noProfileModal} setNoProfileModal={setNoProfileModal} setNoProfileModalClosable={setNoProfileModalClosable}  />} />
        <Route path='/account' element={<MainLayout user={user}><Account /></MainLayout>} />
        <Route path='/testimonials' element={<Testimonials />} />
        <Route path='/join-venue' element={<JoinVenuePage user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        <Route path='/join-artist' element={<JoinArtistPage user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        <Route path='/terms-and-conditions' element={<TermsAndConditions />} />
        <Route path='/privacy-policy' element={<PrivacyPolicy />} />
        <Route path="/auth/email-verified" element={<EmailActionHandler user={user} />} />
        
      </Routes>
      
      {authModal && (
        <Portal>
          <AuthModal setAuthModal={setAuthModal} authType={authType} setAuthType={setAuthType} authClosable={authClosable} setAuthClosable={setAuthClosable} noProfileModal={noProfileModal} setNoProfileModal={setNoProfileModal} setNoProfileModalClosable={setNoProfileModalClosable} initialEmail={initialEmail} setInitialEmail={setInitialEmail} user={user} justLoggedInRef={justLoggedInRef} />
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



