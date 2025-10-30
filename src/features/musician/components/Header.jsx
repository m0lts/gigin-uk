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
import { listenToUserConversations } from '@services/client-side/conversations';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { ProfileCreator } from '../profile-creator/ProfileCreator';
import { NoProfileModal } from './NoProfileModal';
import { CloseIcon, HamburgerMenuIcon } from '../../shared/ui/extras/Icons';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { MobileMenu } from '../../shared/components/MobileMenu';

export const Header = ({ setAuthModal, setAuthType, user, padding, noProfileModal, setNoProfileModal, setNoProfileModalClosable, noProfileModalClosable = false }) => {
    
    const { logout } = useAuth();
    const { isMdUp, isLgUp } = useBreakpoint();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);
    const [newMessages, setNewMessages] = useState(false);

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
        padding: (location.pathname.includes('dashboard') || location.pathname.includes('venues')) ? '0 1rem' : location.pathname.startsWith('/gig/') 
        ? `0 ${padding}` 
        : '0 1rem',
      };

    return (
        <>
            <header className='header default' style={headerStyle}>
                {isMdUp ? (
                    user ? (
                        <>
                            <div className='left musician'>
                                <MusicianLogoLink />
                            </div>
                            <div className='right'>
                                <div className='buttons'>
                                    <Link className='link no-margin' to={'/find-a-gig'}>
                                        <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                            <MapIcon />
                                            Find a Gig
                                        </button>
                                    </Link>
                                    {isLgUp && (
                                        <Link className='link no-margin' to={'/find-venues'}>
                                            <button className={`btn secondary ${location.pathname === '/find-venues' ? 'disabled' : ''}`}>
                                                <TelescopeIcon />
                                                Find a Venue
                                            </button>
                                        </Link>
                                    )}
                                    {user.musicianProfile && isLgUp ? (
                                            <Link className='link' to={'/dashboard'}>
                                                <button className={`btn secondary ${location.pathname.includes('dashboard') ? 'disabled' : ''}`}>
                                                    <DashboardIconLight />
                                                    Dashboard
                                                </button>
                                            </Link>
                                    ) : isLgUp && (
                                        <button className='btn secondary' onClick={() => {setNoProfileModal(true); setNoProfileModalClosable(noProfileModalClosable)}}>
                                            <GuitarsIcon />
                                            Create Musician Profile
                                        </button>
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
                                <button
                                    className='btn icon hamburger-menu-btn'
                                    onClick={(e) => {e.stopPropagation(); setAccountMenu(!accountMenu)}}
                                >
                                    {accountMenu ? <CloseIcon /> : <HamburgerMenuIcon />}
                                </button>
                            </div>
                            {accountMenu && (
                                <MobileMenu
                                    setMobileOpen={setAccountMenu}
                                    user={user}
                                    showAuthModal={showAuthModal}
                                    setAuthType={setAuthType}
                                    handleLogout={handleLogout}
                                    newMessages={newMessages}
                                    isMobile={!isMdUp}
                                    menuStyle={{right: '1rem'}}
                                    setNoProfileModal={setNoProfileModal}
                                    setNoProfileModalClosable={setNoProfileModalClosable}
                                    noProfileModal={noProfileModal}
                                    noProfileModalClosable={noProfileModalClosable}
                                />
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
                        <MusicianLogoLink />
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
                    menuStyle={{right: '1rem'}}
                    setNoProfileModal={setNoProfileModal}
                    setNoProfileModalClosable={setNoProfileModalClosable}
                    noProfileModal={noProfileModal}
                    noProfileModalClosable={noProfileModalClosable}
                />
            )}
        </>
    )
}