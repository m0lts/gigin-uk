// Dependencies
import { Routes, Route } from 'react-router-dom'

// Styles and extras
import "/assets/global.styles.css"
import "/assets/fonts/fonts.css"
import { WaitingList } from './global/pages/waiting-list/WaitingList';
import { LandingPage } from './global/pages/landing-page/LandingPage';




export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WaitingList />} />
      <Route path="/access" element={<LandingPage />} />
    </Routes>
  );
}



