import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { TextLogoLink, VenueLogoLink } from '@features/shared/ui/logos/Logos';
import { listenToUserConversations } from '@services/client-side/conversations';
import { CloseIcon, FeedbackIcon, HamburgerMenuIcon, HouseIconSolid, VenueIconSolid } from '../../shared/ui/extras/Icons';
import { MobileMenu } from '../../shared/components/MobileMenu';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { submitUserFeedback } from '../../../services/client-side/reports';
import { toast } from 'sonner';
import Portal from '../../shared/components/Portal';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { NoTextVenueLogoLink } from '../../shared/ui/logos/Logos';

export const Header = ({ setAuthModal, setAuthType, user, padding }) => {
    
    const { logout } = useAuth();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);
    const [newMessages, setNewMessages] = useState(false);
    const { isMdUp } = useBreakpoint();
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

    window.addEventListener('click', () => {
        setAccountMenu(false);
    });

    useEffect(() => {
        if (!user) return;
        const unsubscribe = listenToUserConversations(user, (conversations) => {
          const hasUnread = conversations.some((conv) => {
            const lastViewed = conv.lastViewed?.[user.uid]?.seconds || 0;
            const lastMessage = conv.lastMessageTimestamp?.seconds || 0;
            const isNotSender = conv.lastMessageSenderId !== user.uid;
            const isDifferentPage = !location.pathname.includes(conv.id);
            return lastMessage > lastViewed && isNotSender && isDifferentPage;
          });
          setNewMessages(hasUnread);
        });
        return () => unsubscribe();
    }, [user, location.pathname]);

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

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : `0 ${padding || '5%'}`,
        justifyContent: user?.venueProfiles && user?.venueProfiles?.length > 0 ? 'flex-end' : '',
    };

    const menuStyle = {
        right: location.pathname.includes('dashboard') ? '1rem' : '5%',
    };

    
    return (
        <>
            <header className={`header venue`} style={headerStyle}>
                {isMdUp ? (
                    user ? (
                        <>
                            <div className='right'>
                                <div className='buttons'>
                                    {!(user.venueProfiles && user.venueProfiles.length > 0 && user.venueProfiles.some(profile => profile.completed)) ? (
                                        <Link className='link' to={'/venues/add-venue'}>
                                            <button className='btn secondary important'>
                                                <VenueIconSolid />
                                                Add Your Venue
                                            </button>
                                        </Link>
                                    ) : (
                                        <Link className={`btn text-no-underline`} to={'/venues/dashboard'} style={{ color: 'black'}}>
                                            <VenueIconSolid />
                                            Venue Dashboard
                                        </Link>
                                    )}
                                </div>
                                <button
                                    className='btn icon hamburger-menu-btn'
                                    onClick={(e) => {e.stopPropagation(); setAccountMenu(!accountMenu)}}
                                >
                                    {accountMenu ? <CloseIcon /> : <HamburgerMenuIcon />}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <TextLogoLink />
                            <nav className='nav-list'>
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
                    <>
                        <VenueLogoLink />
                        <button
                            className='btn icon hamburger-menu-btn'
                            aria-label={accountMenu ? 'Close Menu' : 'Open Menu'}
                            aria-expanded={accountMenu}
                            aria-controls='account-menu'
                            onClick={(e) => {setAccountMenu(o => !o); e.stopPropagation();}}
                        >
                            {accountMenu ? <CloseIcon /> : <HamburgerMenuIcon />}
                        </button>
                    </>
                )}
            </header>
            {accountMenu && (
                <MobileMenu
                    setMobileOpen={setAccountMenu}
                    user={user}
                    showAuthModal={showAuthModal}
                    setAuthType={setAuthType}
                    handleLogout={handleLogout}
                    newMessages={newMessages}
                    isMobile={!isMdUp}
                    menuStyle={menuStyle}
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