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
        <div className="landing-page venue">
            <nav className="landing-navbar">
                <div className={`navbar-container ${isXlUp ? 'constrained' : ''}`}>
                    <div className="navbar-left">
                        <TextLogo />
                        {isMdUp && (
                            <>
                                <button className="nav-link" onClick={() => navigate('/find-a-gig')}>
                                    Find Gig
                                </button>
                                <button className="nav-link" onClick={() => navigate('/find-venues')}>
                                    Find Venue
                                </button>
                                <button className="nav-link" onClick={handlePricingClick}>
                                    Pricing
                                </button>
                            </>
                        )}
                    </div>
                    {isMdUp ? (
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
                            <div className="hero-image-placeholder">
                                <img src={ArtistProfileExample} alt="Venue management" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '1rem' }} />
                            </div>
                        </div>
                    )}
                    <div className="hero-left">
                        <h1>Frustrated with organising live music?</h1>
                        <h4>We make gig organisation simple and easy. Keep everything in one place - from creating gigs and inviting musicians to managing your artist relationships and venue profile. All the tools you need, all in one platform.</h4>
                        <div className="hero-cta">
                            <button className="btn primary" onClick={() => navigate('/venues/add-venue')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Add Your Venue <RightArrowIcon />
                            </button>
                        </div>
                    </div>
                    {isMdUp && (
                        <div className="hero-right">
                            <div className="hero-image-placeholder">
                                <img src={ArtistProfileExample} alt="Venue management" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '1rem' }} />
                            </div>
                        </div>
                    )}
                </section>

                <section className="venue-features-section">
                    <h2 className="venue-features-title">Everything you need to manage live music</h2>
                    <div className="venue-feature-item">
                        <div className="venue-feature-content">
                            <h2>Create Gigs</h2>
                            <p>Post your gig opportunities in minutes. Set dates, times, fees, and requirements all in one place. Reach talented musicians who are actively looking for gigs.</p>
                        </div>
                        <div className="venue-feature-image">
                            <img src={ArtistProfileExample} alt="Create gigs" />
                        </div>
                    </div>

                    <div className="venue-feature-item venue-feature-reverse">
                        <div className="venue-feature-content">
                            <h2>Invite Musicians</h2>
                            <p>Directly invite artists to your gigs or let them discover and apply. Manage all applications in one streamlined interface, making it easy to find the perfect match for your venue.</p>
                        </div>
                        <div className="venue-feature-image">
                            <img src={ArtistProfileExample} alt="Invite musicians" />
                        </div>
                    </div>

                    <div className="venue-feature-item">
                        <div className="venue-feature-content">
                            <h2>Artist CRM</h2>
                            <p>Build and maintain relationships with your favorite artists. Track past performances, manage communications, and keep all your artist information organized in one central hub.</p>
                        </div>
                        <div className="venue-feature-image">
                            <img src={ArtistProfileExample} alt="Artist CRM" />
                        </div>
                    </div>

                    <div className="venue-feature-item venue-feature-reverse">
                        <div className="venue-feature-content">
                            <h2>Venue Profile</h2>
                            <p>Showcase your venue with photos, location, capacity, and equipment details. Let musicians discover what makes your venue special and attract the right talent.</p>
                        </div>
                        <div className="venue-feature-image">
                            <img src={ArtistProfileExample} alt="Venue profile" />
                        </div>
                    </div>

                    <div className="venue-feature-item">
                        <div className="venue-feature-content">
                            <h2>Add Staff Members</h2>
                            <p>Collaborate with your team. Add staff members with different permission levels so everyone can help manage gigs, applications, and venue operations efficiently.</p>
                        </div>
                        <div className="venue-feature-image">
                            <img src={ArtistProfileExample} alt="Add staff members" />
                        </div>
                    </div>
                </section>

                <section id="pricing-section" className="venue-pricing-section">
                    <h2>Pricing</h2>
                    <div className="venue-pricing-card">
                        <h3>Early Access</h3>
                        <p>We are currently not charging during Early Access. Join now to start using Gigin for free!</p>
                        <button className="btn primary" onClick={() => navigate('/venues/add-venue')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                            Get Started <RightArrowIcon />
                        </button>
                    </div>
                </section>
            </div>
            <Footer />
        </div>
    )
}
