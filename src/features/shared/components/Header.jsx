import { useNavigate, useLocation, Link } from 'react-router-dom';
import { VenueLogoLink, MusicianLogoLink, TextLogoLink } from '@features/shared/ui/logos/Logos';
import { GuitarsIcon, LogOutIcon, TelescopeIcon, UserIcon, VenueBuilderIcon } from '@features/shared/ui/extras/Icons';
import '@styles/shared/header.styles.css';
import { useAuth } from '@hooks/useAuth'
import { useState, useEffect } from 'react'
import { listenToUserConversations } from '@services/client-side/conversations';
import { ProfileCreator } from '../../artist/profile-creator/ProfileCreator';
import { CloseIcon, ExitIcon, FeedbackIcon, HamburgerMenuIcon, MapIcon } from '../ui/extras/Icons';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { MobileMenu } from './MobileMenu';
import { submitUserFeedback } from '../../../services/client-side/reports';
import { toast } from 'sonner';
import Portal from './Portal';
import { LoadingSpinner } from '../ui/loading/Loading';
import { NoTextLogoLink, NoTextMusicianLogoLink, NoTextVenueLogoLink } from '../ui/logos/Logos';

export const Header = ({ setAuthModal, setAuthType, user, noProfileModal, setNoProfileModal, noProfileModalClosable = false, setNoProfileModalClosable }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
    const location = useLocation();
    const { isMdUp } = useBreakpoint();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedback, setFeedback] = useState({
        feedback: '',
        user: user?.uid,
        date: Date.now(),
    });
    const [submitting, setSubmitting] = useState(false);

    const handleFeedbackSubmit = async () => {
        if (!feedback.feedback.trim()) {
          toast.error('Please enter some feedback.');
          return;
        }
        setSubmitting(true);
        try {
          await submitUserFeedback(feedback);
          toast.success('Thanks for your feedback!');
          setFeedback({
            feedback: '',
            user: user?.uid || null,
            date: Date.now(),
          });
        } catch (err) {
          console.error('Error submitting feedback:', err);
          toast.error('Something went wrong. Please try again.');
        } finally {
          setSubmitting(false);
        }
    }

    // useEffect(() => { setMobileOpen(false); }, [location.pathname]);
    // useEffect(() => { if (isMdUp && mobileOpen) setMobileOpen(false); }, [isMdUp, mobileOpen]);

    window.addEventListener('click', () => {
        setMobileOpen(false);
    });

    const showAuthModal = (type) => {
        setAuthModal(true);
        setAuthType(type);
    }

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.error(err);
        }
    }

    const getLocation = () => {
        if (location.pathname.includes('host')) {
            return <NoTextVenueLogoLink />;
        } else if (location.pathname.includes('musician')) {
            return <NoTextMusicianLogoLink />;
        } else {
            return <NoTextLogoLink />;
        }
    }

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : '0 2.5%',
    };
    

    return (
        <>
            <header className='header default' style={headerStyle}>
                {isMdUp ? (
                    user ? (
                        <>
                            <div className='left'>
                                { getLocation() }
                                <Link className='link' to={'/find-a-gig'}>
                                    <button className={`btn secondary-alt ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                        Find a Gig
                                    </button>
                                </Link>
                                <Link className='link' to={'/find-venues'}>
                                    <button className={`btn secondary-alt ${location.pathname === '/find-venues' ? 'disabled' : ''}`}>
                                        Find a Venue
                                    </button>
                                </Link>
                            </div>
                            {user.artistProfiles && user.artistProfiles.length > 0 ? (
                                <div className="right">
                                    <button className={`btn text-no-underline ${noProfileModal ? 'disabled' : ''}`}  onClick={() => navigate(`/artist-profile`)}>
                                        <GuitarsIcon />
                                        Artist Dashboard
                                    </button>
                                    <button
                                        className='btn icon hamburger-menu-btn'
                                        aria-label='Open menu'
                                        aria-expanded={mobileOpen}
                                        aria-controls='mobile-menu'
                                        onClick={(e) => {setMobileOpen(o => !o); e.stopPropagation();}}
                                    >
                                        <HamburgerMenuIcon />
                                    </button>
                                </div>
                            ) : (
                            <div className='right'>
                                <Link className='link' to={'/venues/add-venue'}>
                                    <button className='btn text-no-underline'>
                                        I'm a Venue
                                    </button>
                                </Link>
                                <button className={`btn artist-profile ${noProfileModal ? 'disabled' : ''}`}  onClick={() => navigate('/artist-profile')}>
                                    <GuitarsIcon />
                                    Create Artist Profile
                                </button>
                                <button
                                    className='btn icon hamburger-menu-btn'
                                    onClick={(e) => {e.stopPropagation(); setMobileOpen(o => !o)}}
                                >
                                    {mobileOpen ? <CloseIcon /> : <HamburgerMenuIcon />}
                                </button>
                            </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className='left'>
                                { getLocation() }
                                <Link className='link' to={'/find-a-gig'}>
                                    <button className={`btn secondary-alt ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                        Find a Gig
                                    </button>
                                </Link>
                                <Link className='link' to={'/find-venues'}>
                                    <button className={`btn secondary-alt ${location.pathname === '/find-venues' ? 'disabled' : ''}`}>
                                        Find a Venue
                                    </button>
                                </Link>
                            </div>
                            <nav className='nav-list right'>
                                <Link className='link' to={'/venues/add-venue'}>
                                    <button className='btn text'>
                                        I'm a Venue
                                    </button>
                                </Link>
                                <button className='item btn secondary' onClick={() => {showAuthModal(true); setAuthType('login')}}>
                                    Log In
                                </button>
                                <button className='item btn primary' onClick={() => {showAuthModal(true); setAuthType('signup')}}>
                                    Sign Up
                                </button>
                            </nav>
                        </>
                    )
                ) : (
                    mobileOpen ? (
                        <>
                            { getLocation() }
                            <button
                                className='btn icon hamburger-menu-btn'
                                aria-label='Close menu'
                                aria-expanded={mobileOpen}
                                aria-controls='mobile-menu'
                                onClick={(e) => {setMobileOpen(o => !o); e.stopPropagation();}}
                            >
                                <CloseIcon />
                            </button>
                        </>
                    ) : (
                        <>
                            { getLocation() }
                            <button
                                className='btn icon hamburger-menu-btn'
                                aria-label='Open menu'
                                aria-expanded={mobileOpen}
                                aria-controls='mobile-menu'
                                onClick={(e) => {setMobileOpen(o => !o); e.stopPropagation();}}
                            >
                                <HamburgerMenuIcon />
                            </button>
                        </>
                    )
                )}
            </header>
            {mobileOpen && (
                <MobileMenu
                    setMobileOpen={setMobileOpen}
                    user={user}
                    showAuthModal={showAuthModal}
                    setAuthType={setAuthType}
                    handleLogout={handleLogout}
                    setNoProfileModal={setNoProfileModal}
                    setNoProfileModalClosable={setNoProfileModalClosable}
                    noProfileModal={noProfileModal}
                    noProfileModalClosable={noProfileModalClosable}
                    setShowFeedbackModal={setShowFeedbackModal}
                    feedback={feedback}
                    setFeedback={setFeedback}
                    showFeedbackModal={showFeedbackModal}
                />
            )}
            {showFeedbackModal && (
                <Portal>
                    <div className="modal feedback">
                        <div className="modal-content">
                            <div className="modal-header">
                                <FeedbackIcon />
                                <h3 style={{marginBottom: '0.5rem'}}>Help us help you</h3>
                                <p>We’ve just launched — your feedback can help shape the future of Gigin.</p>
                            </div>
                            {submitting ? (
                                <LoadingSpinner />
                            ) : (
                                <>
                                    <div className="modal-body">
                                        <div className="input-group">
                                            <label htmlFor="feedback">Your Feedback</label>
                                            <textarea id="feedback" value={feedback.feedback} onChange={(e) => setFeedback(prev => ({ ...prev, feedback: e.target.value }))} placeholder="Share your thoughts here..."></textarea>
                                        </div>
                                        <button className="btn primary" onClick={handleFeedbackSubmit} disabled={!feedback.feedback} style={{marginTop: '1rem'}}>Submit</button>
                                    </div>
                                    <button className="btn close tertiary" onClick={() => setShowFeedbackModal(false)}>Close</button>
                                </>
                            )}
                        </div>
                    </div>
                </Portal>
            )}

        </>
    )
}