import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { TextLogoLink, VenueLogoLink } from '@features/shared/ui/logos/Logos';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { 
    DotIcon,
    DashboardIconLight,
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
import { HouseIconSolid, VenueIconSolid } from '../../shared/ui/extras/Icons';

export const Header = ({ setAuthModal, setAuthType, user, padding }) => {
    
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const menuRef = useRef(null);
    const buttonRef = useRef(null);
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
                    </div>
                    <div className='right'>
                        <div className='buttons'>
                            {user.venueProfiles && user.venueProfiles.length > 0 && user.venueProfiles.some(profile => profile.completed) ? (
                                <Link className='link' to={'/venues/dashboard/gigs'}>
                                    <button className='btn secondary'>
                                        <DashboardIconLight />
                                        Dashboard
                                    </button>
                                </Link>
                            ) : (
                                <Link className='link' to={'/venues/add-venue'}>
                                    <button className='btn primary important'>
                                        <VenueIconSolid />
                                        Add Your Venue
                                    </button>
                                </Link>
                            )}
                        </div>
                        <button className='btn icon account' onClick={() => setAccountMenu(!accountMenu)} ref={buttonRef}>
                            <UserIcon />
                        </button>
                    </div>
                    {accountMenu && (
                        <nav className='account-menu' style={menuStyle} ref={menuRef}>
                            <div className='item name-and-email no-margin'>
                                <h6>{user.name}</h6>
                                <p>{user.email}</p>
                            </div>
                            {user.venueProfiles && user.venueProfiles.length > 0 ? (
                                <>
                                    <Link className='link' to={'/venues/dashboard/gigs'}>
                                        <div className='item no-margin'>
                                            Dashboard
                                            <DashboardIconLight />
                                        </div>
                                    </Link>
                                    {newMessages ? (
                                        <Link className='link item message no-margin' to={'/venues/dashboard/messages'}>
                                                Messages
                                                <MailboxFullIcon />
                                        </Link>
                                    ) : (
                                        <Link className='link item no-margin' to={'/venues/dashboard/messages'}>
                                                Messages
                                                <MailboxEmptyIcon />
                                        </Link>
                                    )}
                                    <Link to={'/venues/add-venue'} className='item link'>
                                        Add another venue
                                        <VenueBuilderIcon />
                                    </Link>
                                </>
                            ) : (
                                <Link to={'/venues/add-venue'} className='item link'>
                                    Add My Venue
                                    <VenueBuilderIcon />
                                </Link>
                            )}
                            <div className='break' />
                            {/* <Link onClick={() => setShowProfileModal(true)} className='item no-margin link'>
                                Create a Musician Profile
                                <GuitarsIcon />
                            </Link> */}
                            {/* <div className='item no-margin'>
                                Find Gigs
                                <MapIcon />
                            </div> */}
                            <Link to={'/account'} className='item no-margin link settings'>
                                Settings
                                <SettingsIcon />
                            </Link>
                            <button className='btn logout no-margin' onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>
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