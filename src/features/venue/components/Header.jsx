import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { TextLogoLink, VenueLogoLink } from '@features/shared/ui/logos/Logos';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { 
    DotIcon,
    DashboardIcon,
    FaceFrownIcon,
    FaceHeartsIcon,
    FaceMehIcon,
    FaceSmileIcon,
    LogOutIcon,
    SettingsIcon,
    UserIcon,
    VenueBuilderIcon,
    MailboxEmptyIcon,
    MailboxFullIcon,
    GuitarsIcon,
    RightChevronIcon,
    TelescopeIcon } from '@features/shared/ui/extras/Icons';
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
            navigate('/venues');
        } catch (err) {
            console.error(err);
        } finally {
            window.location.reload();
        }
    }

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : `0 ${padding || '5%'}`,
    };

    const menuStyle = {
        right: location.pathname.includes('dashboard') ? '1rem' : '5%',
    };

    
    return (
        <header className='header venue' style={headerStyle}>
            {user ? (
                <>
                    <div className='left venues'>
                        <VenueLogoLink />
                        {location.pathname.includes('dashboard') && (
                            <div className='breadcrumbs'>
                                <span className='item breadcrumb' onClick={() => navigate('/venues/dashboard')}>Dashboard</span>
                                {location.pathname === ('/venues/dashboard') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb' onClick={() => navigate('/venues/dashboard')}>Overview</span>
                                    </>
                                )}
                                {location.pathname.includes('gig') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb' onClick={() => navigate('/venues/dashboard/gigs')}>Gigs</span>
                                        {location.pathname.includes('applications') && (
                                            <>
                                                <RightChevronIcon />
                                                <span className='item active breadcrumb' onClick={() => navigate('/venues/dashboard/gig-applications')}>Gig Applications</span>
                                            </>
                                        )}
                                    </>
                                )}
                                {location.pathname === ('/venues/dashboard/venues') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb' onClick={() => navigate('/venues/dashboard/venues')}>Venues</span>
                                    </>
                                )}
                                {location.pathname.includes('musicians') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb' onClick={() => navigate('/venues/dashboard/musicians')}>Musicians</span>
                                    </>
                                )}
                                {location.pathname.includes('finances') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className='item active breadcrumb' onClick={() => navigate('/venues/dashboard/finances')}>Finances</span>
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
                            {user.venueProfiles && user.venueProfiles.length > 0 && user.venueProfiles.some(profile => profile.completed) ? (
                                location.pathname.includes('dashboard') ? (
                                    windowWidth > 900 && (
                                        <Link className='link' to={'/venues/dashboard/musicians/find'}>
                                            <button className='btn tertiary'>
                                                <TelescopeIcon />
                                                Find a Musician
                                            </button>
                                        </Link>
                                    )
                                ) : (
                                    <Link className='link' to={'/venues/dashboard'}>
                                        <button className='btn secondary'>
                                            <DashboardIcon />
                                            Dashboard
                                        </button>
                                    </Link>
                                )
                            ) : (
                                <Link className='link' to={'/venues/add-venue'}>
                                    <button className='btn primary'>
                                        Add my Venue
                                    </button>
                                </Link>
                            )}
                            {user.venueProfiles && (
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
                        <button className='btn icon' onClick={() => setAccountMenu(!accountMenu)}>
                            <UserIcon />
                        </button>
                    </div>
                    {accountMenu && (
                        <nav className='account-menu' style={menuStyle}>
                            <div className='item name-and-email no-margin'>
                                <h6>{user.name}</h6>
                                <p>{user.email}</p>
                            </div>
                            {user.venueProfiles && (
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
                                    <Link className='link' to={'/venues/dashboard'}>
                                        <div className='item no-margin'>
                                            Dashboard
                                            <DashboardIcon />
                                        </div>
                                    </Link>
                                    <Link to={'/venues/add-venue'} className='item link'>
                                        Add another venue
                                        <VenueBuilderIcon />
                                    </Link>
                                </>
                            ) : (
                                <Link to={'/venues/add-venue'} className='item link'>
                                    Add my Venue
                                    <VenueBuilderIcon />
                                </Link>
                            )}
                            <div className='break' />
                            <Link to={'/create-profile'} className='item no-margin link'>
                                Create a Musician Profile
                                <GuitarsIcon />
                            </Link>
                            {/* <div className='item no-margin'>
                                Find Gigs
                                <MapIcon />
                            </div> */}
                            <Link to={'/account'} className='item no-margin link'>
                                Settings
                                <SettingsIcon />
                            </Link>
                            <button className='btn logout no-margin' onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>
                    )}
                    {feedbackForm && (
                        <div className='feedback-box'>
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
            )}
        </header>
    )
}