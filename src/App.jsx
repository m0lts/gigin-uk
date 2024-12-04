// Dependencies
import { Routes, Route, useLocation } from 'react-router-dom'

// Styles and extras
import "/assets/global.styles.css"
import "/assets/fonts/fonts.css"
import "/styles/common/buttons.styles.css"
import { LandingPage } from './pages/LandingPage/LandingPage';
import { useEffect, useState } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { VenueHome } from './pages/Venue/Home';
import { MusicianInfo } from './pages/Musician/Info';
import { GigGoerInfo } from './pages/GigGoer/Info';
import { GigGoerLayout } from './layouts/GigGoerLayout';
import { NoHeaderFooterLayout } from './layouts/NoHeaderFooterLayout';
import { VenueBuilder } from './pages/Venue/VenueBuilder/VenueBuilder';
import { useAuth } from './hooks/useAuth';
import { AuthModal } from './components/common/AuthModal';
import { LoadingThreeDots } from './components/ui/loading/Loading';
import { MusicianDashboardLayout } from './layouts/MusicianDashboardLayout';
import { VenueDashboard } from './pages/Venue/Dashboard/Dashboard';
import { LoadingScreen } from './components/ui/loading/LoadingScreen';
import { GigFinder } from './pages/Home/GigFinder';
import { GigPage } from './pages/Musician/GigPage';
import { MusicianDashboard } from './pages/Musician/Dashboard/Dashboard';
import { ProfileCreator } from './pages/Musician/Dashboard/ProfileCreator/ProfileCreator';
import { MusicianProfile } from './pages/Musician/Profile/Profile';
import { MessagePage } from './pages/Messages/MessagePage';
import { MessagesLayout } from './layouts/MessagesLayout';
import { VenueDashboardLayout } from './layouts/VenueDashboardLayout';
import { AccountPage } from './pages/AccountPage/AccountPage';
import { Testimonials } from './pages/Musician/TestimonialPage';
import { TextLogo } from './components/ui/logos/Logos';




export default function App() {

  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const [authModal, setAuthModal] = useState(false);
  const [authType, setAuthType] = useState('login');
  const [authClosable, setAuthClosable] = useState(true);
  const [isScreenTooSmall, setIsScreenTooSmall] = useState(false);

  // Monitor screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsScreenTooSmall(window.innerWidth < 768);
    };

    checkScreenSize(); // Check on mount
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  useEffect(() => {
    if (location.pathname.includes('dashboard') || location.pathname.includes('venue-builder') || location.pathname.includes('create-musician-profile')) {
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
      <div className="small-screen-message">
        <TextLogo />
        <h1>Oops!</h1>
        <p>Gigin is in the pilot phase and we don't support screen sizes smaller than 768px.</p>
        <p>Please switch to a device with a larger screen to use Gigin.</p>
      </div>
    );
  }


  return (
    <>
      <Routes>

        {/* MAP */}
        <Route path="/find-a-gig" element={<GigFinder user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />

        {/* MUSICIAN ROUTES */}
        <Route path="/">
          <Route index element={<MainLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} logout={logout}><LandingPage /></MainLayout>} />
          <Route path='create-musician-profile/*' element={<NoHeaderFooterLayout><ProfileCreator user={user} setAuthModal={setAuthModal} authModal={authModal} authClosable={authClosable} setAuthClosable={setAuthClosable} /></NoHeaderFooterLayout>} />
          <Route path='dashboard/*' element={<MusicianDashboardLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} authClosable={authClosable} setAuthClosable={setAuthClosable} ><MusicianDashboard /></MusicianDashboardLayout>} />
          <Route path=':musicianId' element={<MusicianProfile user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
          <Route path=':musicianId/:gigId' element={<MusicianProfile user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        </Route>

        {/* VENUES ROUTES */}
        <Route path="/venues">
          <Route index element={<VenueHome user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
          <Route path='add-venue/*' element={<NoHeaderFooterLayout><VenueBuilder user={user} setAuthModal={setAuthModal} authModal={authModal} authClosable={authClosable} setAuthClosable={setAuthClosable} /></NoHeaderFooterLayout>} />
          <Route path='dashboard/*' element={<VenueDashboardLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} authClosable={authClosable} setAuthClosable={setAuthClosable} ><VenueDashboard /></VenueDashboardLayout>} />
        </Route>

        {/* OTHER ROUTES */}
        <Route path="/messages" element={<MessagesLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} logout={logout}><MessagePage /></MessagesLayout>} />
        <Route path='/gig/:gigId' element={<GigPage user={user} setAuthModal={setAuthModal} setAuthType={setAuthType} />} />
        <Route path="/giggoer" element={<GigGoerLayout><GigGoerInfo /></GigGoerLayout>} />
        <Route path="/account" element={<MainLayout user={user}><AccountPage /></MainLayout>} />
        <Route path="/testimonials" element={<Testimonials />} />
        
      </Routes>
      
      {authModal && <AuthModal setAuthModal={setAuthModal} authType={authType} setAuthType={setAuthType} authClosable={authClosable} setAuthClosable={setAuthClosable} /> }
    </>
  );
}



