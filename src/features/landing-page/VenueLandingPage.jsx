import { useNavigate, Link } from 'react-router-dom';
import { TextLogo, TextLogoLink } from '@features/shared/ui/logos/Logos';
import '@styles/shared/landing-page.styles.css'
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../hooks/useAuth';
import { Footer } from '../shared/components/Footer';
import { useEffect, useState } from 'react';
import { RightArrowIcon, HamburgerMenuIcon, CloseIcon } from '../shared/ui/extras/Icons';
import ArtistProfileExample from '@assets/images/artist-profile-example.png';
import Portal from '../shared/components/Portal';
import { TextLogoVenueLandingPage } from '../shared/ui/logos/Logos';
import Top1 from '@assets/images/landing_page/venue/top_1.png';
import Top2 from '@assets/images/landing_page/venue/top_2.png';
import Top3 from '@assets/images/landing_page/venue/top_3.png';
import Messages from '@assets/images/landing_page/venue/messages.png';
import Crm from '@assets/images/landing_page/venue/crm.png';
import FindArtists from '@assets/images/landing_page/venue/find_artists.png';
import ArtistProfile from '@assets/images/landing_page/venue/artist_profile.png';
import ArtistTr from '@assets/images/landing_page/venue/artist_tr.png';


export const VenueLandingPage = ({ setAuthModal, authType, setAuthType, authClosable, setAuthClosable, noProfileModal, setNoProfileModal, setInitialEmail }) => {
    const navigate = useNavigate();
    const { isXlUp, isMdUp } = useBreakpoint();
    const { user, logout } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const hasArtistProfile = user && user.artistProfiles && user.artistProfiles.length > 0;
    const hasVenueProfile = user && user.venueProfiles && user.venueProfiles.length > 0;
    const hasNoProfiles = user && 
        (!user.venueProfiles || user.venueProfiles.length === 0) && 
        (!user.artistProfiles || user.artistProfiles.length === 0);

    // Auto-redirect if user has venue profile
    useEffect(() => {
        if (hasVenueProfile) {
            navigate('/venues/dashboard/gigs');
        }
    }, [hasVenueProfile, navigate]);

    // Auto-redirect if user has artist profile (and no venue profile)
    useEffect(() => {
        if (hasArtistProfile && !hasVenueProfile) {
            navigate('/artist-profile');
        }
    }, [hasArtistProfile, hasVenueProfile, navigate]);

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
        <div className="landing-page venue">
            <nav className="landing-navbar">
                <div className={`navbar-container ${isXlUp ? 'constrained' : ''}`}>
                    <div className="navbar-left">
                        <TextLogoVenueLandingPage />
                    </div>
                    {isMdUp ? (
                        <div className="navbar-right">
                            {hasVenueProfile ? (
                                <button className="btn artist-profile" onClick={() => navigate('/venues/dashboard/gigs')}>
                                    Venue Dashboard
                                </button>
                            ) : (
                                <>
                                    {!user && (
                                        <button className="btn tertiary" onClick={() => navigate('/')}>
                                            I'm an Artist
                                        </button>
                                    )}
                                    <button className="btn artist-profile" onClick={() => navigate('/venues/add-venue')}>
                                        Create Venue Profile
                                    </button>
                                </>
                            )}
                            {!user && (
                                <>
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
                                        </>
                                    )}
                                    <h6 className="or-separator">
                                        OR
                                    </h6>
                                    <button className="btn secondary" onClick={handleLogout}>
                                        Log Out
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="navbar-right">
                            <button 
                                className="btn icon hamburger-menu-btn"
                                aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
                                aria-expanded={mobileMenuOpen}
                                onClick={(e) => {
                                    setMobileMenuOpen(!mobileMenuOpen);
                                    e.stopPropagation();
                                }}
                            >
                                {mobileMenuOpen ? <CloseIcon /> : <HamburgerMenuIcon />}
                            </button>
                        </div>
                    )}
                </div>
            </nav>
            {!isMdUp && mobileMenuOpen && (
                <Portal>
                    <nav className='mobile-menu' style={{ right: '2rem', top: '8%' }}>
                        {!user ? (
                            <>
                                <Link className='link item no-margin' to='/find-a-gig' onClick={() => setMobileMenuOpen(false)}>
                                    Find a Gig
                                </Link>
                                <Link className='link item no-margin' to='/find-venues' onClick={() => setMobileMenuOpen(false)}>
                                    Find a Venue
                                </Link>
                                <button className='link item no-margin' onClick={() => { handlePricingClick(); setMobileMenuOpen(false); }}>
                                    Pricing
                                </button>
                                <Link className='link item no-margin' to='/' onClick={() => setMobileMenuOpen(false)}>
                                    I'm an Artist
                                </Link>
                                <div className="two-buttons">
                                    <button className='btn secondary' onClick={() => { setAuthType('login'); setAuthModal(true); setMobileMenuOpen(false); }}>
                                        Log In
                                    </button>
                                    <button className='btn primary' onClick={() => { setAuthType('signup'); setAuthModal(true); setMobileMenuOpen(false); }}>
                                        Sign Up
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {hasVenueProfile ? (
                                    <Link className='link item no-margin' to='/venues/dashboard/gigs' onClick={() => setMobileMenuOpen(false)}>
                                        Venue Dashboard
                                    </Link>
                                ) : (
                                    <Link className='link item no-margin' to='/venues/add-venue' onClick={() => setMobileMenuOpen(false)}>
                                        Create Venue Profile
                                    </Link>
                                )}
                                <Link className='link item no-margin' to='/find-a-gig' onClick={() => setMobileMenuOpen(false)}>
                                    Find a Gig
                                </Link>
                                <Link className='link item no-margin' to='/find-venues' onClick={() => setMobileMenuOpen(false)}>
                                    Find a Venue
                                </Link>
                                <button className='link item no-margin' onClick={() => { handlePricingClick(); setMobileMenuOpen(false); }}>
                                    Pricing
                                </button>
                                {!hasVenueProfile && !hasArtistProfile && (
                                    <Link className='link item no-margin' to='/' onClick={() => setMobileMenuOpen(false)}>
                                        I'm an Artist
                                    </Link>
                                )}
                                <div className="two-buttons">
                                    <button className='btn secondary' onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
                                        Log Out
                                    </button>
                                </div>
                            </>
                        )}
                    </nav>
                </Portal>
            )}
            <div className={`landing-content ${isXlUp ? 'constrained' : ''}`}>
                <section className="hero-section venue">
                    {!isMdUp && (
                        <div className="hero-right-mobile">
                            <div className="hero-image-stack">
                                <div className="hero-image-placeholder stack-item stack-item-1">
                                    <img src={Top1} alt="Venue management" style={{ width: '100%', height: 'auto', borderRadius: '1rem' }} />
                                </div>
                                <div className="hero-image-placeholder stack-item stack-item-2">
                                    <img src={Top2} alt="Venue management" style={{ width: '100%', height: 'auto', borderRadius: '1rem' }} />
                                </div>
                                <div className="hero-image-placeholder stack-item stack-item-3">
                                    <img src={Top3} alt="Venue management" style={{ width: '100%', height: 'auto', borderRadius: '1rem' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="hero-left">
                        <h1>Run your live music with clarity and control.</h1>
                        <h4>Save time and stress by giving your live music bookings a dedicated home.</h4>
                        <div className="hero-cta">
                            <button className="btn artist-profile" onClick={() => navigate('/venues/add-venue')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Get Started for Free <RightArrowIcon />
                            </button>
                            <span className="small-text">(Set-up time: 5 Minutes)</span>
                        </div>
                    </div>
                    {isMdUp && (
                        <div className="hero-right">
                            <div className="hero-image-stack">
                                <div className="hero-image-placeholder stack-item stack-item-1">
                                    <img src={Top1} alt="Venue management" style={{ width: '100%', height: 'auto', borderRadius: '1rem' }} />
                                </div>
                                <div className="hero-image-placeholder stack-item stack-item-2">
                                    <img src={Top2} alt="Venue management" style={{ width: '100%', height: 'auto', borderRadius: '1rem' }} />
                                </div>
                                <div className="hero-image-placeholder stack-item stack-item-3">
                                    <img src={Top3} alt="Venue management" style={{ width: '100%', height: 'auto', borderRadius: '1rem' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <section className="venue-profile-section">
                    <h2>Your Venue Profile.</h2>
                    <h4>One place for artists to find out what they need.</h4>
                    <img src={Top1} alt="Venue profile" />
                    <button className="btn artist-profile" onClick={() => navigate('/venues/add-venue')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Make My Profile <RightArrowIcon />
                    </button>
                </section>

                <section className="product-demonstration-section">
                    <h2>Get gigs out of your inbox.</h2>
                    <h4>Clarity for you and your team on your Dashboard.</h4>
                    <div className="product-demonstration-images">
                        <img src={Top2} alt="Product demo 1" />
                        <img src={Messages} alt="Product demo 2" />
                    </div>
                    <button className="btn artist-profile" onClick={() => navigate('/venues/add-venue')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Get Started <RightArrowIcon />
                    </button>
                </section>

                <section className="product-demonstration-section">
                    <h2>Keep your network in one place</h2>
                    <h4>Add artists, put their contact info, and send gig invites with one click.</h4>
                    <div className="product-demonstration-images">
                        <img src={Crm} alt="Demo 1" />
                    </div>
                </section>

                <section className="product-demonstration-section">
                    <h2>... Or Find Artists already on Gigin</h2>
                    <div className="product-demonstration-images">
                    <img src={FindArtists} alt="Demo 2" />
                    </div>
                </section>

                <section className="image-text-section">
                    <div className="image-text-item">
                        <div className="image-text-image">
                            <img src={ArtistProfile} alt="Feature" />
                        </div>
                        <div className="image-text-content">
                            <h4>Where they put down all the information you need. <br /> <br />Including Videos, Tracks, links to their social medias...</h4>
                        </div>
                    </div>
                    <div className="image-text-item image-text-item-reverse">
                        <div className="image-text-image">
                            <img src={ArtistTr} alt="Feature" />
                        </div>
                        <div className="image-text-content">
                            <h4>and Tech Riders, to ensure nothing is missed on the night.</h4>
                        </div>
                    </div>
                </section>

                <section className="venue-pricing-section">
                    <h2>Our Early-Access Offer</h2>
                    <h4>Get started now for free.</h4>
                    <button className="btn artist-profile" onClick={() => navigate('/venues/add-venue')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Get Started <RightArrowIcon />
                    </button>
                    <span className="small-text">(Set-up time: 5 Minutes)</span>
                </section>
            </div>
            <Footer />
        </div>
    )
}
