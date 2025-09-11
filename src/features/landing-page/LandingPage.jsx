import { useNavigate } from 'react-router-dom';
import { TextLogoXL } from '@features/shared/ui/logos/Logos';
import MusicianImg from '@assets/images/musician-landing-page.png'
import VenuesImg from '@assets/images/venue-welcome.png'
import GigGoersImg from '@assets/images/gig-goers-lannding.png'

import '@styles/shared/landing-page.styles.css'
import { SignupForm } from './SignUpForm';
import { useAuth } from '../../hooks/useAuth';
import { useState } from 'react';
import { MusicianIconSolid, VenueIconSolid } from '../shared/ui/extras/Icons';

export const LandingPage = ({ setAuthModal, authType, setAuthType, authClosable, setAuthClosable, noProfileModal, setNoProfileModal }) => {

    const navigate = useNavigate();

    const { login, signup, resetPassword, checkUser, loginWithGoogle } = useAuth();
    const [credentials, setCredentials] = useState({ name: '', phoneNumber: '', email: '', password: '' });
    const [error, setError] = useState({ status: false, input: '', message: '' });
    const [loading, setLoading] = useState(false);
  
    const clearCredentials = () => {
      setCredentials({ name: '', phoneNumber: '', email: '', password: '' });
    };
  
    const clearError = () => {
      setError({ status: false, input: '', message: '' });
    };
  
    const handleModalClick = (e) => {
      if (loading) return;
      if (!authClosable) return;
      if (e.target.className !== 'modal') {
        setAuthModal(false);
      }
    };

    return (
        <div className='landing-page'>
            <div className='heading'>
                <div className='welcome-hero'>
                    <h1>Welcome to</h1>
                    <TextLogoXL />
                </div>
                <div className="two-buttons">
                    <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
                    <button className="btn tertiary" onClick={() => navigate('/venues')}><VenueIconSolid />Create a Venue Profile</button>
                </div>
            </div>
            <div className='sign-up-form'>
                <SignupForm
                    authClosable={authClosable}
                    setAuthClosable={setAuthClosable}
                    credentials={credentials}
                    setCredentials={setCredentials}
                    error={error}
                    setError={setError}
                    clearCredentials={clearCredentials}
                    clearError={clearError}
                    setAuthType={setAuthType}
                    signup={signup}
                    setAuthModal={setAuthModal}
                    loading={loading}
                    setLoading={setLoading}
                    checkUser={checkUser}
                    noProfileModal={noProfileModal}
                    setNoProfileModal={setNoProfileModal}
                />
            </div>
        </div>
    )
}