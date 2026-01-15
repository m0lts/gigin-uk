import { useNavigate } from 'react-router-dom';
import { TextLogo, TextLogoLink } from '@features/shared/ui/logos/Logos';
import '@styles/shared/landing-page.styles.css'
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../hooks/useAuth';
import { useState } from 'react';
import { RightArrowIcon, MicrophoneLinesIcon, AlbumCollectionIcon, FileUserIcon, CoinsIconSolid, MediaIcon } from '../shared/ui/extras/Icons';
import ArtistProfileExample from '@assets/images/artist-profile-example.png';
import { Footer } from '../shared/components/Footer';

export const LandingPage = ({ setAuthModal, authType, setAuthType, authClosable, setAuthClosable, noProfileModal, setNoProfileModal, setInitialEmail }) => {
    const navigate = useNavigate();
    const { isXlUp } = useBreakpoint();
    const { user } = useAuth();
    const [heroEmail, setHeroEmail] = useState('');

    const handleCreateArtistProfile = () => {
        if (!user) {
            // User not logged in - navigate to artist profile with signup flag and show signup modal
            navigate('/artist-profile?signup=true');
            setAuthType('signup');
            setAuthModal(true);
        } else {
            // User is logged in - navigate normally
            navigate('/artist-profile');
        }
    };

    const handleStartNow = () => {
        // Set initial email if provided, then show signup modal
        if (setInitialEmail && heroEmail) {
            setInitialEmail(heroEmail);
        }
        setAuthType('signup');
        setAuthModal(true);
    };

    const handlePricingClick = () => {
        const pricingSection = document.getElementById('pricing-section');
        if (pricingSection) {
            pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="landing-page">
            <nav className="landing-navbar">
                <div className={`navbar-container ${isXlUp ? 'constrained' : ''}`}>
                    <div className="navbar-left">
                        <TextLogo />
                        <button className="nav-link" onClick={() => navigate('/find-a-gig')}>
                            Find Gig
                        </button>
                        <button className="nav-link" onClick={() => navigate('/find-venues')}>
                            Find Venue
                        </button>
                        <button className="nav-link" onClick={handlePricingClick}>
                            Pricing
                        </button>
                    </div>
                    <div className="navbar-right">
                        <button className="btn tertiary" onClick={() => navigate('/venues/add-venue')}>
                            I'm a Venue
                        </button>
                        <button className="btn artist-profile" onClick={handleCreateArtistProfile}>
                            Create Artist Profile
                        </button>
                    </div>
                </div>
            </nav>
            <div className={`landing-content ${isXlUp ? 'constrained' : ''}`}>
                <section className="hero-section">
                    <div className="hero-left">
                        <h1>The heartbeat of grassroots live music.</h1>
                        <h4>Venues and artists use Gigin for gig organisation and booking to start or power their music career progression, creating a more structured grassroots live music scene.</h4>
                        <div className="hero-cta">
                            <input
                                type="email"
                                className="hero-email-input"
                                placeholder="Email address"
                                value={heroEmail}
                                onChange={(e) => setHeroEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleStartNow();
                                    }
                                }}
                            />
                            <button className="btn primary" onClick={handleStartNow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Start Now <RightArrowIcon />
                            </button>
                        </div>
                    </div>
                    <div className="hero-right">
                        <div className="heartbeat-animation">
                            <div className="pulse-dot"></div>
                        </div>
                    </div>
                </section>
                <section className="epk-section">
                    <h2>An Artist's EPK Solution</h2>
                    <div className="epk-features">
                        <div className="epk-feature">
                            <div className="epk-icon-circle">
                                <MicrophoneLinesIcon />
                            </div>
                            <h4>Gigs</h4>
                        </div>
                        <div className="epk-connector"></div>
                        <div className="epk-feature">
                            <div className="epk-icon-circle">
                                <AlbumCollectionIcon />
                            </div>
                            <h4>Profile</h4>
                        </div>
                        <div className="epk-connector"></div>
                        <div className="epk-feature">
                            <div className="epk-icon-circle">
                                <FileUserIcon />
                            </div>
                            <h4>Tech Rider</h4>
                        </div>
                        <div className="epk-connector"></div>
                        <div className="epk-feature">
                            <div className="epk-icon-circle">
                                <CoinsIconSolid />
                            </div>
                            <h4>Finances</h4>
                        </div>
                        <div className="epk-connector"></div>
                        <div className="epk-feature">
                            <div className="epk-icon-circle">
                                <MediaIcon />
                            </div>
                            <h4>Media Storage</h4>
                        </div>
                    </div>
                </section>
                <section className="artist-profile-section">
                    <img 
                        src={ArtistProfileExample} 
                        alt="Artist profile example" 
                        className="artist-profile-screenshot"
                    />
                </section>
                <section id="pricing-section" className="pricing-section">
                    <div className="pricing-cards">
                        <div className="pricing-card">
                            <h3>Free</h3>
                            <ul className="pricing-features">
                                <li>One artist profile</li>
                                <li>Gig booking system</li>
                                <li>Tech rider</li>
                                <li>3GB media storage</li>
                            </ul>
                            <button className="btn primary">Get Started</button>
                        </div>
                        <div className="pricing-card">
                            <h3>Pro - £8.99</h3>
                            <ul className="pricing-features">
                                <li>Up to 3 artist profiles</li>
                                <li>Gig booking system</li>
                                <li>Tech rider</li>
                                <li>5GB media storage</li>
                                <li>Increased profile visibility</li>
                            </ul>
                            <button className="btn primary">Get Started</button>
                        </div>
                        <div className="pricing-card venue-card">
                            <h3>Are you a venue?</h3>
                            <button className="btn tertiary" onClick={() => navigate('/venues/add-venue')}>
                                Get Started
                            </button>
                        </div>
                    </div>
                </section>
            </div>
            <Footer />
        </div>
    )
}

// export const LandingPage = ({ setAuthModal, authType, setAuthType, authClosable, setAuthClosable, noProfileModal, setNoProfileModal }) => {

//     const navigate = useNavigate();
//     const { isMdUp } = useBreakpoint();

//     const { login, signup, resetPassword, checkUser, continueWithGoogle, user } = useAuth();
//     const [credentials, setCredentials] = useState({ name: '', phoneNumber: '', email: '', password: '' });
//     const [error, setError] = useState({ status: false, input: '', message: '' });
//     const [loading, setLoading] = useState(false);
  
//     const clearCredentials = () => {
//       setCredentials({ name: '', phoneNumber: '', email: '', password: '' });
//     };
  
//     const clearError = () => {
//       setError({ status: false, input: '', message: '' });
//     };

//     return (
//         <div className={`landing-page ${user ? 'user' : ''}`}>
//             <div className={`heading`}>
//                 <div className='welcome-hero'>
//                     <h1>Welcome {user && 'back'} to</h1>
//                     <TextLogoXL />
//                 </div>
//                 {isMdUp ? (
//                     !user ? (
//                         <div className="two-buttons">
//                             <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
//                             <button className="btn tertiary" onClick={() => navigate('/venues/add-venue')}><VenueIconSolid />Create a Venue Profile</button>
//                         </div>
//                     ) : (
//                         <div className="two-buttons">
//                             {user?.musicianProfile ? (
//                                 <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
//                             ) : user?.venueProfiles ? (
//                                 <button className="btn tertiary" onClick={() => navigate('/venues/dashboard/gigs')}><VenueIconSolid />Go To Dashboard</button>
//                             ) : (
//                                 <>
//                                     <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
//                                     {isMdUp && (
//                                         <button className="btn tertiary" onClick={() => navigate('/venues/add-venue')}><VenueIconSolid />Create a Venue Profile</button>
//                                     )}
//                                 </>
//                             )}
//                         </div>
//                     )
//                 ) : (
//                     !user ? (
//                         <div className="two-buttons">
//                             <button className="btn secondary" onClick={() => {setAuthModal(true); setAuthType('login')}}>Log In</button>
//                             <button className="btn primary" onClick={() => {setAuthModal(true); setAuthType('signup')}}>Sign Up</button>
//                         </div>
//                     ) : (
//                         <div className="two-buttons">
//                             {user?.musicianProfile ? (
//                                 <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
//                             ) : user?.venueProfiles ? (
//                                 <button className="btn tertiary" onClick={() => navigate('/venues/dashboard/gigs')}><VenueIconSolid />Go To Dashboard</button>
//                             ) : (
//                                 <>
//                                     <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}><MusicianIconSolid />Find a Gig To Play</button>
//                                     <button className="btn tertiary" onClick={() => navigate('/venues/add-venue')}><VenueIconSolid />Create a Venue Profile</button>
//                                 </>
//                             )}
//                         </div>
//                     )
//                 )}
//             </div>
//             {!user && isMdUp && (
//                 <div className='sign-up-form'>
//                     <SignupForm
//                         authClosable={authClosable}
//                         setAuthClosable={setAuthClosable}
//                         credentials={credentials}
//                         setCredentials={setCredentials}
//                         error={error}
//                         setError={setError}
//                         clearCredentials={clearCredentials}
//                         clearError={clearError}
//                         setAuthType={setAuthType}
//                         signup={signup}
//                         setAuthModal={setAuthModal}
//                         loading={loading}
//                         setLoading={setLoading}
//                         checkUser={checkUser}
//                         noProfileModal={noProfileModal}
//                         setNoProfileModal={setNoProfileModal}
//                     />
//                 </div>
//             )}
//         </div>
//     )
// }