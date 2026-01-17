import { useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import { MusicianLogoLink } from '@features/shared/ui/logos/Logos';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading'
import { 
    DashboardIconLight,
    MailboxEmptyIcon,
    RightChevronIcon,
    GuitarsIcon,
    DotIcon,
    FaceFrownIcon,
    FaceHeartsIcon,
    FaceMehIcon,
    FaceSmileIcon,
    LogOutIcon,
    MailboxFullIcon,
    MapIcon,
    SettingsIcon,
    TelescopeIcon,
    UserIcon,
    VenueBuilderIcon,
    TicketIcon } from '@features/shared/ui/extras/Icons';
import '@styles/shared/header.styles.css';
import { useAuth } from '@hooks/useAuth';
import { useState, useEffect, useMemo } from 'react'
import { listenToUserConversations } from '@services/client-side/conversations';
import { CloseIcon, FeedbackIcon, HamburgerMenuIcon, DownChevronIcon } from '../../shared/ui/extras/Icons';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { MobileMenu } from '../../shared/components/MobileMenu';
import Portal from '../../shared/components/Portal';
import { submitUserFeedback } from '../../../services/client-side/reports';
import { toast } from 'sonner';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { NoTextLogoLink, NoTextMusicianLogoLink } from '../../shared/ui/logos/Logos';

export const Header = ({ setAuthModal, setAuthType, user, padding, noProfileModal, setNoProfileModal, setNoProfileModalClosable, noProfileModalClosable = false }) => {
   
    const { logout } = useAuth();
    const { isMdUp, isLgUp } = useBreakpoint();
    const location = useLocation();
    const navigate = useNavigate();
    const { profileId: urlProfileId } = useParams();
    const [accountMenu, setAccountMenu] = useState(false);
    const [newMessages, setNewMessages] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    // Track localStorage changes to force re-render when active profile changes
    const [activeProfileIdFromStorage, setActiveProfileIdFromStorage] = useState(() => {
        if (!user?.uid) return null;
        try {
            return localStorage.getItem(`activeArtistProfileId_${user.uid}`);
        } catch (e) {
            return null;
        }
    });

    // Listen for storage events to update when localStorage changes
    useEffect(() => {
        if (!user?.uid) return;
        
        const handleStorageChange = (e) => {
            if (e.key === `activeArtistProfileId_${user.uid}`) {
                setActiveProfileIdFromStorage(e.newValue);
            }
        };
        
        // Listen for custom event for same-window updates
        const handleCustomStorageChange = () => {
            try {
                const stored = localStorage.getItem(`activeArtistProfileId_${user.uid}`);
                setActiveProfileIdFromStorage(stored);
            } catch (e) {
                // Ignore errors
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('activeProfileChanged', handleCustomStorageChange);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('activeProfileChanged', handleCustomStorageChange);
        };
    }, [user?.uid]);
    
    // Get active profile object from URL, localStorage, or default to primary/first profile
    const activeProfile = useMemo(() => {
        if (!user?.artistProfiles || user.artistProfiles.length === 0) {
            return null;
        }
        
        let targetProfileId = null;
        
        // If URL has profileId, use it
        if (urlProfileId) {
            targetProfileId = urlProfileId;
        }
        // Check localStorage for stored active profile (use state value for reactivity)
        else if (user?.uid) {
            const stored = activeProfileIdFromStorage;
            if (stored) {
                // Verify the stored profile still exists
                const profileExists = user.artistProfiles?.some(
                    (p) => (p.id === stored || p.profileId === stored)
                );
                if (profileExists) {
                    targetProfileId = stored;
                }
            }
        }
        
        // Fallback to primary profile or first complete profile
        if (!targetProfileId) {
            if (user?.primaryArtistProfileId) {
                targetProfileId = user.primaryArtistProfileId;
            } else {
                const firstComplete = user?.artistProfiles?.find((p) => p.isComplete);
                if (firstComplete) {
                    targetProfileId = firstComplete.id || firstComplete.profileId;
                }
            }
        }
        
        // Find and return the full profile object
        if (targetProfileId) {
            const profile = user.artistProfiles.find(
                (p) => (p.id === targetProfileId || p.profileId === targetProfileId)
            );
            return profile || null;
        }
        
        return null;
    }, [urlProfileId, user?.uid, user?.primaryArtistProfileId, user?.artistProfiles, activeProfileIdFromStorage]);

    
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
        setShowProfileDropdown(false);
    });

    useEffect(() => {
        if (!user) return;

        // Get the active artist profile ID from localStorage
        let activeProfileId = null;
        if (user?.uid) {
            try {
                const stored = localStorage.getItem(`activeArtistProfileId_${user.uid}`);
                if (stored) {
                    // Verify the stored profile still exists
                    const profileExists = user.artistProfiles?.some(
                        (p) => (p.id === stored || p.profileId === stored)
                    );
                    if (profileExists) {
                        activeProfileId = stored;
                    }
                }
            } catch (e) {
                // Ignore localStorage errors
            }
        }

        // Fallback: if no stored profile, use URL profileId or primary profile
        if (!activeProfileId) {
            if (urlProfileId) {
                activeProfileId = urlProfileId;
            } else if (user?.primaryArtistProfileId) {
                activeProfileId = user.primaryArtistProfileId;
            } else if (user?.artistProfiles?.length > 0) {
                // Use first complete profile or first profile
                const completed = user.artistProfiles.find((p) => p?.isComplete);
                activeProfileId = completed?.id || completed?.profileId || user.artistProfiles[0]?.id || user.artistProfiles[0]?.profileId;
            }
        }

        const unsubscribe = listenToUserConversations(user, (conversations) => {
          const hasUnread = conversations.some((conv) => {
            const lastViewed = conv.lastViewed?.[user.uid]?.seconds || 0;
            const lastMessage = conv.lastMessageTimestamp?.seconds || 0;
            const isNotSender = conv.lastMessageSenderId !== user.uid;
            const isDifferentPage = !location.pathname.includes(conv.id);

            // Only consider conversations that involve the active artist profile
            const involvesActiveArtistProfile =
              !activeProfileId
                ? false
                : Array.isArray(conv.participants)
                  ? conv.participants.includes(activeProfileId)
                  : false;

            return (
              involvesActiveArtistProfile &&
              lastMessage > lastViewed &&
              isNotSender &&
              isDifferentPage
            );
          });

          setNewMessages(hasUnread);
        });

        return () => unsubscribe();
    }, [user, location.pathname, urlProfileId]);

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

    return (
        <>
            <header className='header musician'>
                {isMdUp ? (
                    user ? (
                        <>
                            <div className='left-block'>
                                <NoTextLogoLink />
                                <Link className={`link ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`} to={'/find-a-gig'}>
                                    Find a Gig
                                </Link>
                                {isLgUp && (
                                    <Link className={`link ${location.pathname === '/find-venues' ? 'disabled' : ''}`} to={'/find-venues'}>
                                        Find a Venue
                                    </Link>
                                )}
                            </div>
                            {location.pathname.includes('artist-profile') ? (

                                <div className={`right-block ${user.artistProfiles && user.artistProfiles.length > 0 && user.artistProfiles.some(profile => profile.isComplete === true) ? '' : 'empty'}`}>
                                    {user.artistProfiles && user.artistProfiles.length > 0 && user.artistProfiles.some(profile => profile.isComplete === true) ? (
                                        <>
                                            {activeProfile ? (
                                                <>
                                                    <Link 
                                                        className={`link ${location.pathname === `/artist-profile/${activeProfile.id || activeProfile.profileId}` || (location.pathname === '/artist-profile' && !urlProfileId) ? 'disabled' : ''}`} 
                                                        to={`/artist-profile/${activeProfile.id || activeProfile.profileId}`}
                                                    >
                                                        Profile
                                                    </Link>
                                                    <Link 
                                                        className={`link ${location.pathname.includes('/gigs') ? 'disabled' : ''}`} 
                                                        to={`/artist-profile/${activeProfile.id || activeProfile.profileId}/gigs`}
                                                    >
                                                        Gigs
                                                    </Link>
                                                    <Link
                                                        className={`link ${location.pathname.includes('/messages') ? 'disabled' : ''}`}
                                                        to={`/artist-profile/${activeProfile.id || activeProfile.profileId}/messages`}
                                                    >
                                                        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            Messages
                                                            {newMessages && (
                                                                <span
                                                                    style={{
                                                                        position: 'absolute',
                                                                        top: -6,
                                                                        right: -12,
                                                                        width: 6,
                                                                        height: 6,
                                                                        borderRadius: '50%',
                                                                        backgroundColor: 'var(--gn-orange)',
                                                                    }}
                                                                />
                                                            )}
                                                        </span>
                                                    </Link>
                                                    <Link 
                                                        className={`link ${location.pathname.includes('/finances') ? 'disabled' : ''}`} 
                                                        to={`/artist-profile/${activeProfile.id || activeProfile.profileId}/finances`}
                                                    >
                                                        Finances
                                                    </Link>
                                                </>
                                            ) : (
                                                <>
                                                    <Link className={`link ${location.pathname === '/artist-profile' ? 'disabled' : ''}`} to={'/artist-profile'}>
                                                        Profile
                                                    </Link>
                                                    <Link className={`link ${location.pathname.includes('/gigs') ? 'disabled' : ''}`} to={'/artist-profile/gigs'}>
                                                        Gigs
                                                    </Link>
                                                    <Link
                                                        className={`link ${location.pathname.includes('/messages') ? 'disabled' : ''}`}
                                                        to={'/artist-profile/messages'}
                                                    >
                                                        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            Messages
                                                            {newMessages && (
                                                                <span
                                                                    style={{
                                                                        position: 'absolute',
                                                                        top: -6,
                                                                        right: -12,
                                                                        width: 6,
                                                                        height: 6,
                                                                        borderRadius: '50%',
                                                                        backgroundColor: 'var(--gn-orange)',
                                                                    }}
                                                                />
                                                            )}
                                                        </span>
                                                    </Link>
                                                    <Link className={`link ${location.pathname.includes('/finances') ? 'disabled' : ''}`} to={'/artist-profile/finances'}>
                                                        Finances
                                                    </Link>
                                                </>
                                            )}
                                        </>
                                    ) : location.pathname !== '/artist-profile' && (
                                        <>
                                            <button className='btn artist-profile' onClick={() => navigate('/artist-profile')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem'}}>
                                                <GuitarsIcon />
                                                Create Artist Profile
                                            </button>
                                        </>
                                    )}
                                    <button
                                        className='btn icon hamburger-menu-btn'
                                        onClick={(e) => {e.stopPropagation(); setAccountMenu(!accountMenu)}}
                                    >
                                        {accountMenu ? <CloseIcon /> : <HamburgerMenuIcon />}
                                    </button>
                                </div>
                            ) : (
                                <div className="right">
                                    {activeProfile?.isComplete ? (
                                        <>
                                            <div 
                                                className={`active-profile ${user?.artistProfiles && user.artistProfiles.length > 1 ? 'clickable' : ''}`}
                                                style={{ position: 'relative' }}
                                                onClick={(e) => {
                                                    if (user?.artistProfiles && user.artistProfiles.length > 1) {
                                                        e.stopPropagation();
                                                        setShowProfileDropdown(!showProfileDropdown);
                                                    }
                                                }}
                                            >
                                                <div className="title-container">
                                                    <div className="title-container-inner">
                                                        <h6 className="subtitle">Active Profile:</h6>
                                                        <h4 className="title">{activeProfile?.name}</h4>
                                                    </div>
                                                    {user?.artistProfiles && user.artistProfiles.length > 1 && (
                                                        <div className={`chevron-icon ${showProfileDropdown ? 'open' : ''}`}>
                                                            <DownChevronIcon  />
                                                        </div>
                                                    )}
                                                </div>
                                                {showProfileDropdown && user?.artistProfiles && user.artistProfiles.length > 1 && (
                                                    <div 
                                                        className="profile-dropdown"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {user.artistProfiles.map((artistProfile) => {
                                                            const profileId = artistProfile.id || artistProfile.profileId;
                                                            const isActive = profileId === (activeProfile?.id || activeProfile?.profileId);
                                                            const isIncomplete = artistProfile.isComplete === false;
                                                            const isDraft = artistProfile.status === 'draft';
                                                            const shouldShowCreationFlow = isIncomplete || isDraft;
                                                            const hasName = artistProfile.name && typeof artistProfile.name === 'string' && artistProfile.name.trim();
                                                            
                                                            return (
                                                                <div
                                                                    key={profileId}
                                                                    className={`profile-dropdown-item ${isActive ? 'active' : ''}`}
                                                                    onClick={() => {
                                                                        if (shouldShowCreationFlow) {
                                                                            navigate(`/artist-profile/${profileId}`);
                                                                            setShowProfileDropdown(false);
                                                                        } else {
                                                                            if (user?.uid && profileId !== (activeProfile?.id || activeProfile?.profileId)) {
                                                                                try {
                                                                                    localStorage.setItem(`activeArtistProfileId_${user.uid}`, profileId);
                                                                                    window.dispatchEvent(new Event('activeProfileChanged'));
                                                                                    toast.info(`Switched to ${hasName ? artistProfile.name : 'artist profile'}`);
                                                                                    setShowProfileDropdown(false);
                                                                                    
                                                                                    if (location.pathname.includes('/artist-profile')) {
                                                                                        navigate(`/artist-profile/${profileId}`, { replace: true });
                                                                                    }
                                                                                } catch (e) {
                                                                                    console.error('Failed to update active profile:', e);
                                                                                    toast.error('Failed to switch profile');
                                                                                }
                                                                            } else {
                                                                                setShowProfileDropdown(false);
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <span className={`profile-name ${!hasName ? 'unnamed' : ''}`}>
                                                                        {hasName ? artistProfile.name : 'Unnamed Profile'}
                                                                    </span>
                                                                    {isActive && (
                                                                        <span className="active-badge">
                                                                            Active
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            <button className='btn text-no-underline' onClick={() => navigate(`/artist-profile/${activeProfile.id || activeProfile.profileId}`)}>
                                                <GuitarsIcon />
                                                Artist Dashboard
                                            </button>
                                        </>
                                    ) : (
                                        <button className='btn artist-profile' onClick={() => navigate(`/artist-profile`)}>
                                            <GuitarsIcon />
                                            Create Artist Profile
                                        </button>
                                    )}
                                    <button
                                        className='btn icon hamburger-menu-btn'
                                        onClick={(e) => {e.stopPropagation(); setAccountMenu(!accountMenu)}}
                                    >
                                        {accountMenu ? <CloseIcon /> : <HamburgerMenuIcon />}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <MusicianLogoLink />
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
                        <div className='left'>
                            <NoTextMusicianLogoLink />
                        </div>
                        <div className='right'>
                            <button
                                className='btn icon hamburger-menu-btn'
                                aria-label={accountMenu ? 'Close Menu' : 'Open Menu'}
                                aria-expanded={accountMenu}
                                aria-controls='account-menu'
                                onClick={(e) => {setAccountMenu(o => !o); e.stopPropagation();}}
                            >
                                {accountMenu ? <CloseIcon /> : <HamburgerMenuIcon />}
                            </button>
                        </div>
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
                    menuStyle={{right: '2rem'}}
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