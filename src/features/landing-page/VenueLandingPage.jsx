import { useNavigate } from 'react-router-dom';
import { TextLogo, TextLogoLink } from '@features/shared/ui/logos/Logos';
import '@styles/shared/landing-page.styles.css'
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../hooks/useAuth';
import { Footer } from '../shared/components/Footer';
import { useEffect } from 'react';

export const VenueLandingPage = ({ setAuthModal, authType, setAuthType, authClosable, setAuthClosable, noProfileModal, setNoProfileModal, setInitialEmail }) => {
    const navigate = useNavigate();
    const { isXlUp } = useBreakpoint();
    const { user, logout } = useAuth();

    const hasArtistProfile = user && user.artistProfiles && user.artistProfiles.length > 0;
    const hasVenueProfile = user && user.venueProfiles && user.venueProfiles.length > 0;
    const hasNoProfiles = user && 
        (!user.venueProfiles || user.venueProfiles.length === 0) && 
        (!user.artistProfiles || user.artistProfiles.length === 0);

    // Auto-redirect if user has artist profile
    useEffect(() => {
        if (hasArtistProfile) {
            navigate('/artist-profile');
        }
    }, [hasArtistProfile, navigate]);

    const handlePricingClick = () => {
        const pricingSection = document.getElementById('pricing-section');
        if (pricingSection) {
            pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.error(err);
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
                        {hasVenueProfile ? (
                            <button className="btn tertiary" onClick={() => navigate('/venues/dashboard/gigs')}>
                                Venue Dashboard
                            </button>
                        ) : (
                            <button className="btn tertiary" onClick={() => navigate('/venues/add-venue')}>
                                Create Venue Profile
                            </button>
                        )}
                        {!user && (
                            <>
                                <button className="btn artist-profile" onClick={() => navigate('/')}>
                                    I'm an Artist
                                </button>
                                <h6 className="or-separator">
                                    OR
                                </h6>
                                <button className="btn secondary" onClick={() => { 
                                    setAuthType('login'); 
                                    setAuthModal(true); 
                                }}>
                                    Log In
                                </button>
                            </>
                        )}
                        {user && (
                            <>
                                {!hasVenueProfile && !hasArtistProfile && (
                                    <>
                                        <button className="btn artist-profile" onClick={() => navigate('/')}>
                                            I'm an Artist
                                        </button>
                                        <h6 className="or-separator">
                                            OR
                                        </h6>
                                    </>
                                )}
                                <button className="btn secondary" onClick={handleLogout}>
                                    Log Out
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>
            <div className={`landing-content ${isXlUp ? 'constrained' : ''}`}>
                <section className="hero-section">
                    <div className="hero-left">
                        <h1>Venue Landing Page</h1>
                        <h4>This is a placeholder for the venue landing page. Content will be added here.</h4>
                    </div>
                </section>
            </div>
            <Footer />
        </div>
    )
}
