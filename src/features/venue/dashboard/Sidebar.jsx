import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CoinsIcon,
  DoorIcon,
  GuitarsIcon,
  HouseIconLight,
  PlusIcon,
  DownChevronIcon,
  MailboxEmptyIcon,
  MailboxFullIcon,
  VenueBuilderIcon,
  SettingsIcon,
  LogOutIcon,
  UserIcon
} from '@features/shared/ui/extras/Icons';
import { TextLogoMed } from '../../shared/ui/logos/Logos';
import { listenToUserConversations } from '@services/conversations';
import { useAuth } from '@hooks/useAuth';
import '@assets/fonts/fonts.css';
import { CalendarIconLight, CalendarIconSolid, CoinsIconSolid, DashboardIconLight, DashboardIconSolid, FeedbackIcon, GigIcon, HouseIconSolid, MusicianIconLight, MusicianIconSolid, UpChevronIcon, VenueIconLight, VenueIconSolid } from '../../shared/ui/extras/Icons';
import { FeedbackBox } from './FeedbackBox';

export const Sidebar = ({ setGigPostModal, user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [expandedItem, setExpandedItem] = useState('');
  const [newMessages, setNewMessages] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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
    if (location.pathname.includes('/venues/dashboard/gigs')) {
      setExpandedItem('gigs');
    } else if (location.pathname.includes('/venues/dashboard/my-venues')) {
      setExpandedItem('venues');
    } else if (location.pathname.includes('/venues/dashboard/musicians')) {
      setExpandedItem('musicians');
    } else if (location.pathname.includes('/venues/dashboard/finances')) {
      setExpandedItem('finances');
    } else {
      setExpandedItem('');
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/venues');
    } catch (err) {
      console.error(err);
    } finally {
      window.location.reload();
    }
  };

  return (
    <div className='sidebar'>
      <div className='logo'>
        <TextLogoMed />
        <div className="beta-box">
          <p>BETA</p>
        </div>
      </div>
      <ul className={`account-dropdown ${showDropdown ? 'open' : ''}`} onClick={() => setShowDropdown(!showDropdown)}>
        <li className='account-dropdown-item exempt'>
          <div>
            <h6>Venue Dashboard</h6>
            <div className='user-container'>
              <UserIcon />
              <div className='user-details'>
                <h4>{user?.name}</h4>
                <p>{user?.email}</p>
              </div>
            </div>
          </div>
          {showDropdown ? (
            <UpChevronIcon />
          ) : (
            <DownChevronIcon />
          )}
        </li>
        {showDropdown && (
          <>
            <li className={`account-dropdown-item ${showDropdown ? 'open' : ''}`} onClick={() => navigate('/create-profile')}>
              Create a Musician Profile <GuitarsIcon />
            </li>
            <li className={`account-dropdown-item ${showDropdown ? 'open' : ''}`} onClick={() => navigate('/account')}>
              Settings <SettingsIcon />
            </li>
            <li className={`account-dropdown-item red ${showDropdown ? 'open' : ''}`} onClick={handleLogout}>
              Log Out <LogOutIcon />
            </li>
          </>
        )}
      </ul>
      <button className='btn primary' onClick={() => setGigPostModal(true)}>
        Post a Gig <GigIcon />
      </button>
      <ul className='menu'>
        <li className={`menu-item ${location.pathname === '/venues/dashboard' && 'active'}`} onClick={() => navigate('/venues/dashboard')}>
          {location.pathname === '/venues/dashboard' ? (
            <DashboardIconSolid />
          ) : (
            <DashboardIconLight />
          )}
           Overview
        </li>
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/gigs') && 'active'}`} onClick={() => navigate('/venues/dashboard/gigs')}>
          {location.pathname.includes('/venues/dashboard/gigs') ? (
              <>
                <CalendarIconSolid /> Gigs
              </>
            ) : (
              <>
                <CalendarIconLight /> Gigs
              </>
          )}
        </li>
      {newMessages ? (
              <li className='menu-item' onClick={() => navigate('/messages')}>
                <MailboxFullIcon /> Messages
              </li>
            ) : (
              <li className='menu-item' onClick={() => navigate('/messages')}>
                <MailboxEmptyIcon /> Messages
              </li>
            )}
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/my-venues') && 'active'}`} onClick={() => navigate('/venues/dashboard/my-venues')}>
        {location.pathname.includes('/venues/dashboard/my-venues') ? (
            <VenueIconSolid />
          ) : (
            <VenueIconLight />
          )}
          My Venues
        </li>
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/musicians') && 'active'}`} onClick={() => navigate('/venues/dashboard/musicians')}>
        {location.pathname.includes('/venues/dashboard/musicians') ? (
            <MusicianIconSolid />
          ) : (
            <MusicianIconLight />
          )} Musicians
        </li>
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/finances') && 'active'}`} onClick={() => navigate('/venues/dashboard/finances')}>
        {location.pathname.includes('/venues/dashboard/finances') ? (
            <CoinsIconSolid />
          ) : (
            <CoinsIcon />
          )}
          Finances
        </li>
      </ul>
      <FeedbackBox user={user} />
    </div>
  );
};