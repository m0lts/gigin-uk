import { useNavigate, useLocation, Link } from 'react-router-dom';
import { MusicianLogoLink } from '@features/shared/ui/logos/Logos';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading'
import { 
    DashboardIcon,
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
import { useState, useEffect } from 'react'
import { listenToUserConversations } from '@services/conversations';
import { submitUserFeedback } from '@services/reports';
import { useResizeEffect } from '@hooks/useResizeEffect';

export const Header = ({ setAuthModal, setAuthType, user, padding }) => {
    
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState(false);
    const [feedback, setFeedback] = useState({
        scale: '',
        feedback: '',
        user: user?.uid,
    });
    const [feedbackLoading, setFeedbackLoading] = useState(false);

    const [newMessages, setNewMessages] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useResizeEffect((width) => {
        setWindowWidth(width);
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
    }, [user]);


    const handleScaleSelection = (scale) => {
        setFeedback(prev => ({ ...prev, scale }));
    };

    const handleFeedbackSubmit = async () => {
        setFeedbackLoading(true);
        try {
          await submitUserFeedback(feedback);
          setFeedback({ scale: '', feedback: '' });
          setFeedbackForm(false);
        } catch (error) {
          console.error('Error submitting feedback:', error);
        } finally {
          setFeedbackLoading(false);
        }
    };

    const showAuthModal = (type) => {
        setAuthModal(true);
        setAuthType(type);
    }

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (err) {
            console.error(err);
        } finally {
            window.location.reload();
        }
    }

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : location.pathname.startsWith('/gig/') 
        ? `0 ${padding}` 
        : '0 1rem',
      };

    const menuStyle = {
        right: location.pathname.includes('dashboard') ? '1rem' : '5%',
      };
    
    return (
        <header className='header default' style={headerStyle}>
            {user ? (
                <>
                    <div className='left musician'>
                        <MusicianLogoLink />
                        {location.pathname.includes('dashboard') && (
                            <div className='breadcrumbs'>
                                <span className='item breadcrumb' onClick={() => navigate('/dashboard')}>Dashboard</span>
                                {location.pathname === ('/dashboard') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb' onClick={() => navigate('/dashboard')}>Overview</span>
                                    </>
                                )}
                                {location.pathname.includes('gig') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb' onClick={() => navigate('/dashboard/gigs')}>Gigs</span>
                                    </>
                                )}
                                {location.pathname.includes('finances') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb'  onClick={() => navigate('/dashboard/finances')}>Finances</span>
                                    </>
                                )}
                                {location.pathname.includes('bands') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb' onClick={() => navigate('/dashboard/bands')}>Bands</span>
                                    </>
                                )}
                                {location.pathname.includes('profile') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb' onClick={() => navigate('/dashboard/profile')}>Profile</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className='right'>
                        <div className='buttons'>
                            <button className='btn text' onClick={() => setFeedbackForm(!feedbackForm)}>
                                Feedback
                            </button>
                            {user.venueProfiles && !user.musicianProfile ? (
                                <Link className='link' to={'/venues/dashboard'}>
                                    <button className='btn secondary'>
                                        <DashboardIcon />
                                        Dashboard
                                    </button>
                                </Link>
                            ) : (
                                <>
                                    {location.pathname !== '/find-a-gig' && windowWidth > 1100 && (
                                        <Link className='link' to={'/find-a-gig'}>
                                            <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                                <TelescopeIcon />
                                                Find A Gig
                                            </button>
                                        </Link>
                                    )}
                                    {user.musicianProfile ? (
                                        windowWidth > 1100 && (
                                            <Link className='link' to={'/dashboard'}>
                                                <button className={`btn secondary ${location.pathname.includes('dashboard') ? 'disabled' : ''}`}>
                                                    <DashboardIcon />
                                                    Dashboard
                                                </button>
                                            </Link>
                                        )
                                    ) : (
                                        <Link className='link' to={'/create-profile'}>
                                            <button className='btn secondary'>
                                                <GuitarsIcon />
                                                Create Musician Profile
                                            </button>
                                        </Link>
                                    )}
                                </>
                            )}
                            {user.musicianProfile && (
                                    newMessages ? (
                                        <Link className='link' to={'/messages'}>
                                            <button className='btn secondary messages'>
                                                <span className='notification-dot'><DotIcon /></span>
                                                <MailboxFullIcon />
                                                Messages
                                            </button>
                                        </Link>
                                    ) : (
                                        <Link className='link' to={'/messages'}>
                                            <button className='btn secondary'>
                                                <MailboxEmptyIcon />
                                                Messages
                                            </button>
                                        </Link>
                                    )
                            )}
                        </div>
                        <button className={`btn account-btn ${accountMenu ? 'active' : ''}`} onClick={() => setAccountMenu(!accountMenu)}>
                            <h4 className='withdrawable-earnings'>£{user.musicianProfile?.withdrawableEarnings ? parseFloat(user.musicianProfile.withdrawableEarnings).toFixed(2) : '0.00'}</h4>
                            <UserIcon />
                        </button>
                    </div>
                    {accountMenu && (
                        user.venueProfiles && user.musicianProfile ? (
                            <nav className='account-menu' style={menuStyle}>
                            <div className='item name-and-email no-margin'>
                                <h6>{user.name}</h6>
                                <p>{user.email}</p>
                            </div>
                            {user.musicianProfile && (
                                newMessages ? (
                                    <Link className='link item message' to={'/messages'}>
                                            Messages
                                            <MailboxFullIcon />
                                    </Link>
                                ) : (
                                    <Link className='link item' to={'/messages'}>
                                            Messages
                                            <MailboxEmptyIcon />
                                    </Link>
                                )
                            )}
                            <div className='break' />
                            <h6 className='title'>venues</h6>
                            {user.venueProfiles && user.venueProfiles.length > 0 ? (
                                <>
                                    <Link className='link item no-margin' to={'/venues/dashboard'}>
                                        Dashboard
                                        <DashboardIcon />
                                    </Link>
                                    <Link className='link item' to={'/venues/add-venue'}>
                                        Add another venue
                                        <VenueBuilderIcon />
                                    </Link>
                                </>
                            ) : (
                                <Link className='link item' to={'/venues/add-venue'}>
                                    Add my Venue
                                    <VenueBuilderIcon />
                                </Link>
                            )}
                            <div className='break' />
                            <Link className='link item no-margin' to={'/create-profile'}>
                                Create a Musician Profile
                                <GuitarsIcon />
                            </Link>
                            {/* <Link className='link item' to={'/find-a-gig'}>
                                Find Gigs
                                <MapIcon />
                            </Link> */}
                            <Link to={'/account'} className='item no-margin link'>
                                Settings
                                <SettingsIcon />
                            </Link>
                            <button className='btn logout no-margin' onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>

                        ) : (
                            <nav className='account-menu' style={menuStyle}>
                                <div className='item name-and-email no-margin'>
                                    <h6>{user.name}</h6>
                                    <p>{user.email}</p>
                                </div>
                                {
                                newMessages ? (
                                    <Link className='link item message' to={'/messages'}>
                                            Messages
                                            <MailboxFullIcon />
                                    </Link>
                                ) : (
                                    <Link className='link item' to={'/messages'}>
                                            Messages
                                            <MailboxEmptyIcon />
                                    </Link>
                                )
                            }
                                <div className='break' />
                                <h6 className='title'>musicians</h6>
                                {user.musicianProfile ? (
                                    <Link className='link item' to={'/dashboard'}>
                                        Dashboard
                                        <DashboardIcon />
                                    </Link>
                                ) : (
                                    <Link className='link item' to={'/create-profile'}>
                                        Create Musician Profile
                                        <GuitarsIcon />
                                    </Link>
                                )}
                                <Link className='link item no-margin' to={'/find-a-gig'}>
                                    Find a Gig
                                    <MapIcon />
                                </Link>
                                {/* <div className='break' />
                                <Link className='link item no-margin' to={'/venues/add-venue'}>
                                    Create a Venue Profile
                                    <VenueBuilderIcon />
                                </Link> */}
                                <div className='break' />
                                <a className='link item no-margin' href='mailto:hq.gigin@gmail.com'>
                                    Contact Us
                                    <TicketIcon />
                                </a>
                                <Link to={'/account'} className='item no-margin link'>
                                    Settings
                                    <SettingsIcon />
                                </Link>
                                <button className='btn logout no-margin' onClick={handleLogout}>
                                    Log Out
                                    <LogOutIcon />
                                </button>
                            </nav>
                        )
                    )}
                    {feedbackForm && (
                        <div className='feedback'>
                            <div className='body'>
                                <textarea
                                    name='feedbackBox'
                                    id='feedbackBox'
                                    onChange={(e) => setFeedback(prev => ({ ...prev, feedback: e.target.value }))}
                                    value={feedback.feedback}
                                    placeholder='Give us your thoughts...'
                                ></textarea>
                            </div>
                            <div className='foot'>
                                <div className='faces'>
                                    <button className={`btn icon ${feedback.scale === 'hearts' ? 'active' : ''}`} onClick={() => handleScaleSelection('hearts')}>
                                        <FaceHeartsIcon />
                                    </button>
                                    <button className={`btn icon ${feedback.scale === 'smiles' ? 'active' : ''}`} onClick={() => handleScaleSelection('smiles')}>
                                        <FaceSmileIcon />
                                    </button>
                                    <button className={`btn icon ${feedback.scale === 'meh' ? 'active' : ''}`} onClick={() => handleScaleSelection('meh')}>
                                        <FaceMehIcon />
                                    </button>
                                    <button className={`btn icon ${feedback.scale === 'frown' ? 'active' : ''}`} onClick={() => handleScaleSelection('frown')}>
                                        <FaceFrownIcon />
                                    </button>
                                </div>
                                <button className='btn primary' onClick={handleFeedbackSubmit}>
                                    {feedbackLoading ? (
                                        <LoadingThreeDots />
                                    ) : (
                                        'Send'
                                    )}
                                </button>
                            </div>
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
            )}
        </header>
    )
}