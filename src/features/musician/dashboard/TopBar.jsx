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
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { getBreadcrumbs } from '@services/utils/breadcrumbs';
import { listenToUserConversations } from '@services/client-side/conversations';
import { CloseIcon, DashboardIconSolid, HamburgerMenuIcon } from '../../shared/ui/extras/Icons';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { MobileMenu } from '../../shared/components/MobileMenu';

export const TopBar = ({ user, bandProfiles }) => {
    
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);
    const [newMessages, setNewMessages] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);
    const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname, 'musician', bandProfiles), [location.pathname, bandProfiles]);
    const { isMdUp, isLgUp, isXlUp } = useBreakpoint();

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

    useEffect(() => {
        const handleClickOutside = (event) => {
          if (
            menuRef.current &&
            !menuRef.current.contains(event.target) &&
            buttonRef.current &&
            !buttonRef.current.contains(event.target)
          ) {
            setAccountMenu(false);
          }
        };
      
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }, []);


    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (err) {
            console.error(err);
        }
    }
    
    return (
        <header className='top-bar'>
            {location.pathname !== '/dashboard' && (
                <div className="breadcrumbs">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.path}>
                        <Link className="breadcrumb" to={crumb.path}>
                            {index !== breadcrumbs.length - 1 ? (
                            <p className='breadcrumb-link'>{crumb.label}</p>
                            ) : (
                            <p className='breadcrumb-text'>{crumb.label}</p>
                            )}
                        </Link>
                        {index !== breadcrumbs.length - 1 && (
                            <div className="breadcrumb-separator">
                            <RightChevronIcon />
                            </div>
                        )}
                        </React.Fragment>
                    ))}
                </div>
            )} 
            <div className="right buttons">
                {isLgUp && (
                    <>
                        <Link className='link' to={'/find-a-gig'}>
                            <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                <MapIcon />
                                Find a Gig
                            </button>
                        </Link>
                    </>
                )}
                {isXlUp && (
                    <Link className='link' to={'/find-venues'}>
                        <button className={`btn secondary ${location.pathname === '/find-venues' ? 'disabled' : ''}`}>
                            <TelescopeIcon />
                            Find a Venue
                        </button>
                    </Link>
                )}
                {isLgUp && (
                    newMessages ? (
                        <Link className='link' to={'/messages'}>
                            <button className='btn secondary messages'>
                                <MailboxFullIcon />
                                Messages
                                <span className='notification-dot'><DotIcon /></span>
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
                <button className='btn icon hamburger-menu-btn' onClick={() => setAccountMenu(!accountMenu)} ref={buttonRef}>
                    {accountMenu ? <CloseIcon /> : <HamburgerMenuIcon />}
                </button>
            </div>
            {accountMenu && (
                <MobileMenu 
                    setMobileOpen={setAccountMenu}
                    user={user}
                    showAuthModal={null}
                    setAuthType={null}
                    handleLogout={handleLogout}
                    newMessages={newMessages}
                    isMobile={!isMdUp}
                    menuStyle={{right: '1rem'}}
                />
            )}
        </header>
    )
}