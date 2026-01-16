import { useNavigate } from 'react-router-dom';
import { TextLogo, TextLogoLink } from '@features/shared/ui/logos/Logos';
import '@styles/shared/landing-page.styles.css'
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import { RightArrowIcon, MicrophoneLinesIcon, AlbumCollectionIcon, FileUserIcon, CoinsIconSolid, MediaIcon, SuccessIcon } from '../shared/ui/extras/Icons';
import ArtistProfileExample from '@assets/images/artist-profile-example.png';
import ArtistProfileExample2 from '@assets/images/artist-profile-example2.png';
import ArtistProfileExample3 from '@assets/images/artist-profile-example3.png';
import { Footer } from '../shared/components/Footer';

export const LandingPage = ({ setAuthModal, authType, setAuthType, authClosable, setAuthClosable, noProfileModal, setNoProfileModal, setInitialEmail }) => {
    const navigate = useNavigate();
    const { isXlUp } = useBreakpoint();
    const { user } = useAuth();
    const [heroEmail, setHeroEmail] = useState('');
    const [activeEpkFeature, setActiveEpkFeature] = useState('profile'); // Default to profile
    const [isImageTransitioning, setIsImageTransitioning] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const slideshowIntervalRef = useRef(null);
    
    // Map EPK features to images
    const epkImages = {
        profile: ArtistProfileExample,
        gigs: ArtistProfileExample2,
        'tech-rider': ArtistProfileExample3,
        finances: ArtistProfileExample,
        'media-storage': ArtistProfileExample2
    };

    // Array of features in order for slideshow
    const epkFeatures = ['profile', 'gigs', 'tech-rider', 'finances', 'media-storage'];

    const handleEpkFeatureChange = (feature) => {
        setUserInteracted(true);
        setIsImageTransitioning(true);
        setActiveEpkFeature(feature);
        setTimeout(() => {
            setIsImageTransitioning(false);
        }, 500); // Match animation duration
    };

    // Auto-slideshow effect
    useEffect(() => {
        // Only start slideshow if user hasn't interacted
        if (!userInteracted) {
            slideshowIntervalRef.current = setInterval(() => {
                setActiveEpkFeature((current) => {
                    const currentIndex = epkFeatures.indexOf(current);
                    const nextIndex = (currentIndex + 1) % epkFeatures.length;
                    return epkFeatures[nextIndex];
                });
            }, 7000); // 7 seconds
        }

        return () => {
            if (slideshowIntervalRef.current) {
                clearInterval(slideshowIntervalRef.current);
            }
        };
    }, [userInteracted]);

    const handleCreateArtistProfile = () => {
        if (!user) {
            // User not logged in - navigate to artist profile example page (don't show auth modal)
            navigate('/artist-profile?signup=true');
        } else {
            // User is logged in - navigate normally
            navigate('/artist-profile');
        }
    };

    const handleLogin = () => {
        if (!user) {
            setAuthType('login');
            setAuthModal(true);
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
                        <button className="btn tertiary" onClick={() => navigate('/venues')}>
                            I'm a Venue
                        </button>
                        <button className="btn artist-profile" onClick={handleCreateArtistProfile}>
                            Create Artist Profile
                        </button>
                        <h6 className="or-separator">
                            OR
                        </h6>
                        <button className="btn secondary" onClick={handleLogin}>
                            Log In
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
                            <button 
                                className={`epk-icon-circle ${activeEpkFeature === 'profile' ? 'active' : ''}`}
                                onClick={() => handleEpkFeatureChange('profile')}
                            >
                                <AlbumCollectionIcon />
                            </button>
                            <h4>Profile</h4>
                        </div>
                        <div className="epk-connector"></div>
                        <div className="epk-feature">
                            <button 
                                className={`epk-icon-circle ${activeEpkFeature === 'gigs' ? 'active' : ''}`}
                                onClick={() => handleEpkFeatureChange('gigs')}
                            >
                                <MicrophoneLinesIcon />
                            </button>
                            <h4>Gigs</h4>
                        </div>
                        <div className="epk-connector"></div>
                        <div className="epk-feature">
                            <button 
                                className={`epk-icon-circle ${activeEpkFeature === 'tech-rider' ? 'active' : ''}`}
                                onClick={() => handleEpkFeatureChange('tech-rider')}
                            >
                                <FileUserIcon />
                            </button>
                            <h4>Tech Rider</h4>
                        </div>
                        <div className="epk-connector"></div>
                        <div className="epk-feature">
                            <button 
                                className={`epk-icon-circle ${activeEpkFeature === 'finances' ? 'active' : ''}`}
                                onClick={() => handleEpkFeatureChange('finances')}
                            >
                                <CoinsIconSolid />
                            </button>
                            <h4>Finances</h4>
                        </div>
                        <div className="epk-connector last-connector"></div>
                        <div className="epk-feature">
                            <button 
                                className={`epk-icon-circle ${activeEpkFeature === 'media-storage' ? 'active' : ''}`}
                                onClick={() => handleEpkFeatureChange('media-storage')}
                            >
                                <MediaIcon />
                            </button>
                            <h4>Media Storage</h4>
                        </div>
                    </div>
                </section>
                <section className="artist-profile-section">
                    <div className="artist-profile-image-container">
                        <img 
                            src={epkImages[activeEpkFeature]} 
                            alt="Artist profile example" 
                            className="artist-profile-screenshot"
                            key={activeEpkFeature}
                        />
                    </div>
                </section>
                <section id="pricing-section" className="pricing-section">
                    <h2>We have two pricing tiers to suit your needs</h2>
                    <div className="pricing-cards">
                        <div className="pricing-card">
                            <h2 className="pricing-price">Free</h2>
                            <h3>Starter</h3>
                            <h4>Best for artists just starting out.</h4>
                            <ul className="pricing-features">
                                <li className="black"><SuccessIcon /> One artist profile</li>
                                <li className="black"><SuccessIcon /> Gig booking system</li>
                                <li className="black"><SuccessIcon /> Tech rider</li>
                                <li className="black"><SuccessIcon /> 3GB media storage</li>
                            </ul>
                            <button className="btn primary" onClick={handleCreateArtistProfile}>Get Started <RightArrowIcon /></button>
                        </div>
                        <div className="pricing-card pricing-card-pro">
                            <h2 className="pricing-price">
                                <span className="pricing-amount">£8.99</span>
                                <span className="pricing-period"> / month</span>
                            </h2>
                            <h3>Gigin Pro</h3>
                            <h4>Best for artists looking to grow their career.</h4>
                            <ul className="pricing-features">
                                <li><SuccessIcon /> Up to 3 artist profiles</li>
                                <li><SuccessIcon /> Gig booking system</li>
                                <li><SuccessIcon /> Tech rider</li>
                                <li><SuccessIcon /> 5GB media storage</li>
                                <li><SuccessIcon /> Increased profile visibility</li>
                            </ul>
                            <button className="btn secondary" onClick={() => { setAuthType('signup'); setAuthModal(true); }}>Get Started <RightArrowIcon /></button>
                        </div>
                        <div className="pricing-card venue-card">
                            <h3>Are you a venue?</h3>
                            <h4>Take a look at our venue pricing.</h4>
                            <button className="btn tertiary" onClick={() => navigate('/venues')}>
                                Get Started <RightArrowIcon />
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