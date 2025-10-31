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
import { useBreakpoint } from '../../hooks/useBreakpoint';

export const LandingPage = ({ setAuthModal, authType, setAuthType, authClosable, setAuthClosable, noProfileModal, setNoProfileModal }) => {

    const navigate = useNavigate();
    const { isMdUp } = useBreakpoint();

    const { login, signup, resetPassword, checkUser, continueWithGoogle, user } = useAuth();
    const [credentials, setCredentials] = useState({ name: '', phoneNumber: '', email: '', password: '' });
    const [error, setError] = useState({ status: false, input: '', message: '' });
    const [loading, setLoading] = useState(false);
  
    const clearCredentials = () => {
      setCredentials({ name: '', phoneNumber: '', email: '', password: '' });
    };
  
    const clearError = () => {
      setError({ status: false, input: '', message: '' });
    };

    return (
        <div className={`landing-page ${user ? 'user' : ''}`}>
            <div className={`heading`}>
                <div className='welcome-hero'>
                    <h1>Welcome {user && 'back'} tooooo</h1>
                    <TextLogoXL />
                </div>
                {isMdUp ? (
                    !user ? (
                        <div className="two-buttons">
                            <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
                            <button className="btn tertiary" onClick={() => navigate('/venues/add-venue')}><VenueIconSolid />Create a Venue Profile</button>
                        </div>
                    ) : (
                        <div className="two-buttons">
                            {user?.musicianProfile ? (
                                <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
                            ) : user?.venueProfiles ? (
                                <button className="btn tertiary" onClick={() => navigate('/venues/dashboard/gigs')}><VenueIconSolid />Go To Dashboard</button>
                            ) : (
                                <>
                                    <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
                                    {isMdUp && (
                                        <button className="btn tertiary" onClick={() => navigate('/venues/add-venue')}><VenueIconSolid />Create a Venue Profile</button>
                                    )}
                                </>
                            )}
                        </div>
                    )
                ) : (
                    !user ? (
                        <div className="two-buttons">
                            <button className="btn secondary" onClick={() => {setAuthModal(true); setAuthType('login')}}>Log In</button>
                            <button className="btn primary" onClick={() => {setAuthModal(true); setAuthType('signup')}}>Sign Up</button>
                        </div>
                    ) : (
                        <div className="two-buttons">
                            {user?.musicianProfile ? (
                                <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
                            ) : user?.venueProfiles ? (
                                <button className="btn tertiary" onClick={() => navigate('/venues/dashboard/gigs')}><VenueIconSolid />Go To Dashboard</button>
                            ) : (
                                <>
                                    <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
                                    <button className="btn tertiary" onClick={() => navigate('/venues/add-venue')}><VenueIconSolid />Create a Venue Profile</button>
                                </>
                            )}
                        </div>
                    )
                )}
            </div>
            {!user && isMdUp && (
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
            )}
        </div>
    )
}