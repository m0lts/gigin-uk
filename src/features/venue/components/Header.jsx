import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { TextLogoLink, VenueLogoLink } from '@features/shared/ui/logos/Logos';
import { listenToUserConversations } from '@services/client-side/conversations';
import { CloseIcon, HamburgerMenuIcon, HouseIconSolid, VenueIconSolid } from '../../shared/ui/extras/Icons';
import { MobileMenu } from '../../shared/components/MobileMenu';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export const Header = ({ setAuthModal, setAuthType, user, padding }) => {
    
    const { logout } = useAuth();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);
    const [newMessages, setNewMessages] = useState(false);
    const { isMdUp } = useBreakpoint();

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
    };

    const menuStyle = {
        right: location.pathname.includes('dashboard') ? '1rem' : '5%',
    };

    
    return (
        <>
            <header className='header venue' style={headerStyle}>
                {isMdUp ? (
                    user ? (
                        <>
                            <div className='left venues'>
                                <VenueLogoLink />
                            </div>
                            <div className='right'>
                                <div className='buttons'>
                                    {!(user.venueProfiles && user.venueProfiles.length > 0 && user.venueProfiles.some(profile => profile.completed)) && (
                                        <Link className='link' to={'/venues/add-venue'}>
                                            <button className='btn secondary important'>
                                                <VenueIconSolid />
                                                Add Your Venue
                                            </button>
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
                                />
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
                />
            )}
        </>
    )
}