// Dependencies
import { Routes, Route } from 'react-router-dom'

// Styles and extras
import "/assets/global.styles.css"
import "/assets/fonts/fonts.css"
import "/styles/common/buttons.styles.css"
import { LandingPage } from './pages/LandingPage/LandingPage';
import { useEffect, useState } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { HostInfo } from './pages/Host/Info';
import { MusicianInfo } from './pages/Musician/Info';
import { GigGoerInfo } from './pages/GigGoer/Info';
import { HostLayout } from './layouts/HostLayout';
import { MusicianLayout } from './layouts/MusicianLayout';
import { GigGoerLayout } from './layouts/GigGoerLayout';
import { NoHeaderFooterLayout } from './layouts/NoHeaderFooterLayout';
import { VenueBuilder } from './pages/Host/VenueBuilder/VenueBuilder';
import { useAuth } from './hooks/useAuth';
import { AuthModal } from './components/common/AuthModal';
import { LoadingThreeDots } from './components/ui/loading/Loading';
import { DashboardLayout } from './layouts/DashboardLayout';
import { HostDashboard } from './pages/Host/Dashboard/Dashboard';
import { LoadingScreen } from './components/ui/loading/LoadingScreen';
import { GigFinder } from './pages/Musician/GigFinder/GigFinder';
import { GigPage } from './pages/Musician/GigPage';




export default function App() {

  const { user, loading, logout } = useAuth();
  const [authModal, setAuthModal] = useState(false);
  const [authType, setAuthType] = useState('login');

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<MainLayout setAuthModal={setAuthModal} setAuthType={setAuthType} user={user} logout={logout}><LandingPage /></MainLayout>} />
        <Route path="/host">
          <Route index element={<HostInfo user={user} setAuthModal={setAuthModal} />} />
          <Route path='dashboard/*' element={<DashboardLayout setAuthModal={setAuthModal} setAuthType={setAuthType}><HostDashboard /></DashboardLayout>} />
        </Route>
        <Route path='/host/venue-builder/*' element={<NoHeaderFooterLayout><VenueBuilder user={user} setAuthModal={setAuthModal} authModal={authModal} /></NoHeaderFooterLayout>} />
        <Route path="/musician">
          <Route index element={<GigFinder />} />
          <Route path=':gigId' element={<GigPage />} />
        </Route>
        <Route path="/giggoer" element={<GigGoerLayout><GigGoerInfo /></GigGoerLayout>} />
      </Routes>
      
      {authModal && <AuthModal setAuthModal={setAuthModal} authType={authType} setAuthType={setAuthType} /> }
    </>
  );
}



