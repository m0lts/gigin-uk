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
import { VenueBuilder } from './pages/Host/VenueBuilder';
import { useAuth } from './hooks/useAuth';
import { AuthModal } from './components/common/AuthModal';




export default function App() {

  const { user, loading, login, logout } = useAuth();
  const [authModal, setAuthModal] = useState(false);

  if (loading) {
    return <div><h1>Loading...</h1></div>;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<MainLayout setAuthModal={setAuthModal}><LandingPage /></MainLayout>} />
        <Route path="/host" element={<HostLayout />}>
          <Route index element={<HostInfo user={user} setAuthModal={setAuthModal} />} />
        </Route>
        <Route path='/host/venue-builder' element={<NoHeaderFooterLayout><VenueBuilder /></NoHeaderFooterLayout>} />
        <Route path="/musician" element={<MusicianLayout><MusicianInfo /></MusicianLayout>} />
        <Route path="/giggoer" element={<GigGoerLayout><GigGoerInfo /></GigGoerLayout>} />
      </Routes>
      
      {authModal && <AuthModal setAuthModal={setAuthModal} login={login} /> }
    </>
  );
}



