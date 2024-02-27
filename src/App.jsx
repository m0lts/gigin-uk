// Dependencies
import { Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/homepage/Homepage';

// Components
import { AccountPage } from './pages/account/Account';
import { LogIn } from './pages/account/Login';
import { SignUp } from './pages/account/Signup';
import { ForgotPassword } from './pages/account/ForgotPassword';
import { ResetPassword } from './pages/account/ResetPassword';

// Styles and extras
import "/assets/global.styles.css"
import { ControlCentre } from './pages/control-centre/ControlCentre';
import { OverviewTab } from './pages/control-centre/OverviewTab';
import { GigsTab } from './pages/control-centre/GigsTab';
import { VenuesTab } from './pages/control-centre/VenuesTab';




export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/accounts" element={<AccountPage />}>
        <Route index element={<LogIn />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
      </Route>
      <Route path="/control-centre" element={<ControlCentre />}>
        <Route index element={<OverviewTab />} />
        <Route path="gigs" element={<GigsTab />} />
        <Route path="venues" element={<VenuesTab />} />
      </Route>

    </Routes>
  );
}



