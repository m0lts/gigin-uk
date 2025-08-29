import { useNavigate, useLocation, Link } from 'react-router-dom';
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
import { useState, useEffect } from 'react'
import { listenToUserConversations } from '@services/conversations';
import { submitUserFeedback } from '@services/reports';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { ProfileCreator } from '../profile-creator/ProfileCreator';
import { NoProfileModal } from './NoProfileModal';

export const Header = ({ setAuthModal, setAuthType, user, padding, noProfileModal, setNoProfileModal }) => {
    
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);
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
    }, [user, location.pathname]);

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
                    </div>
                    <div className='right'>
                        <div className='buttons'>
                            {user.venueProfiles && !user.musicianProfile ? (
                                <Link className='link' to={'/venues/dashboard/gigs'}>
                                    <button className='btn secondary'>
                                        <DashboardIconLight />
                                        Dashboard
                                    </button>
                                </Link>
                            ) : (
                                <>
                                    <Link className='link' to={'/find-a-gig'}>
                                        <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                            <MapIcon />
                                            Find A Gig
                                        </button>
                                    </Link>
                                    {user.musicianProfile ? (
                                        windowWidth > 1100 && (
                                            <Link className='link' to={'/dashboard'}>
                                                <button className={`btn secondary ${location.pathname.includes('dashboard') ? 'disabled' : ''}`}>
                                                    <DashboardIconLight />
                                                    Dashboard
                                                </button>
                                            </Link>
                                        )
                                    ) : (
                                        <button className='btn secondary' onClick={() => setNoProfileModal(true)}>
                                            <GuitarsIcon />
                                            Create Musician Profile
                                        </button>
                                    )}
                                </>
                            )}
                            {user.musicianProfile && (
                                newMessages ? (
                                    <Link className='link' to={'/messages'}>
                                        <button className={`btn secondary messages ${location.pathname === '/messages' ? 'disabled' : ''}`}>
                                            <span className='notification-dot'><DotIcon /></span>
                                            <MailboxFullIcon />
                                            Messages
                                        </button>
                                    </Link>
                                ) : (
                                    <Link className='link' to={'/messages'}>
                                        <button className={`btn secondary ${location.pathname === '/messages' ? 'disabled' : ''}`}>
                                            <MailboxEmptyIcon />
                                            Messages
                                        </button>
                                    </Link>
                                )
                            )}
                        </div>
                        <button className={`btn account-btn ${accountMenu ? 'active' : ''}`} onClick={() => setAccountMenu(!accountMenu)}>
                            <h4 className='withdrawable-earnings'>My Gigin</h4>
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
                                    <Link className='link item no-margin' to={'/venues/dashboard/gigs'}>
                                        Dashboard
                                        <DashboardIconLight />
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
                            <Link className='link item no-margin' onClick={() => setNoProfileModal(true)}>
                                Create a Musician Profile
                                <GuitarsIcon />
                            </Link>
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
                                        <DashboardIconLight />
                                    </Link>
                                ) : (
                                    <Link className='link item' onClick={() => setNoProfileModal(true)}>
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