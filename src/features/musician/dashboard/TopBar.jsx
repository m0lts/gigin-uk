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
import { listenToUserConversations } from '@services/conversations';
import { submitUserFeedback } from '@services/reports';
import { useResizeEffect } from '@hooks/useResizeEffect';

export const TopBar = ({ user, bandProfiles }) => {
    
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);
    const [newMessages, setNewMessages] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);
    const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname, 'musician', bandProfiles), [location.pathname, bandProfiles]);

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
                          <div className="breadcrumb">
                              {index !== breadcrumbs.length - 1 ? (
                              <Link to={crumb.path} className='breadcrumb-link'>{crumb.label}</Link>
                              ) : (
                                <p className='breadcrumb-text'>{crumb.label}</p>
                              )}
                          </div>
                          {index !== breadcrumbs.length - 1 && (
                              <div className="breadcrumb-separator">
                              <RightChevronIcon />
                              </div>
                          )}
                          </React.Fragment>
                      ))}
                  </div>
              )}
            <div className="right">
                <div className='buttons'>
                    <Link className='link' to={'/find-a-gig'}>
                        <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                            <TelescopeIcon />
                            Find A Gig
                        </button>
                    </Link>
                            {newMessages ? (
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
                            )}
                </div>
                <button className={`btn account-btn ${accountMenu ? 'active' : ''}`} onClick={() => setAccountMenu(!accountMenu)} ref={buttonRef}>
                    <h4 className='withdrawable-earnings'>£{user?.musicianProfile?.withdrawableEarnings ? parseFloat(user.musicianProfile.withdrawableEarnings).toFixed(2) : '0.00'}</h4>
                    <UserIcon />
                </button>
            </div>
            {accountMenu && (
                    <nav className='account-menu' ref={menuRef}>
                        <div className='item name-and-email no-margin'>
                            <h6>{user.name}</h6>
                            <p>{user.email}</p>
                        </div>
                        {
                        newMessages ? (
                            <Link className='link item no-margin' to={'/messages'}>
                                    Messages
                                    <MailboxFullIcon />
                            </Link>
                        ) : (
                            <Link className='link item no-margin' to={'/messages'}>
                                    Messages
                                    <MailboxEmptyIcon />
                            </Link>
                        )
                        }
                        <Link className='link item no-margin' to={'/find-a-gig'}>
                            Find a Gig
                            <MapIcon />
                        </Link>
                        {/* <div className='break' />
                        <Link className='link item no-margin' to={'/venues/add-venue'}>
                            Create a Venue Profile
                            <VenueBuilderIcon />
                        </Link> */}
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
                
            )}
        </header>
    )
}