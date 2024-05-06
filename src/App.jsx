// Dependencies
import { Routes, Route, useNavigate } from 'react-router-dom'

// Styles and extras
import "/assets/global.styles.css"
import "/assets/fonts/fonts.css"
import { WaitingList } from './global/pages/waiting-list/WaitingList';
import { LandingPage } from './global/pages/landing-page/LandingPage';
import { useEffect, useState } from 'react';




export default function App() {

  const [user, setUser] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch('/api/auth/TokenVerification', {
          method: 'GET',
        });
        if (response.status === 201) {
          setUser(null);
        } else if (response.status === 200) {
          const responseJson = await response.json();
          const token = responseJson.user;
          setUser(token);
          navigate('/');
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        return null;
      }
    };

    verifyToken();
    navigate('/waiting-list');

  }, []);

  return (
    <Routes>
      <Route path="/" element={<LandingPage user={user} setUser={setUser} />} />
      <Route path="/waiting-list" element={<WaitingList user={user} setUser={setUser} />} />
    </Routes>
  );
}



