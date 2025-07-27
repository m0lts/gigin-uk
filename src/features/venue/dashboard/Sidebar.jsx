import { useEffect, useState, useMemo } from 'react';
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
import { useAuth } from '@hooks/useAuth';
import '@assets/fonts/fonts.css';
import { CalendarIconLight, CalendarIconSolid, CoinsIconSolid, DashboardIconLight, DashboardIconSolid, DotIcon, FeedbackIcon, GigIcon, HouseIconSolid, MailboxEmptyIconSolid, MailboxFullIconSolid, MusicianIconLight, MusicianIconSolid, UpChevronIcon, VenueIconLight, VenueIconSolid } from '../../shared/ui/extras/Icons';
import { FeedbackBox } from './FeedbackBox';
import { toast } from 'sonner';

export const Sidebar = ({ setGigPostModal, user, newMessages }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const pathname = useMemo(() => location.pathname, [location.pathname]);
  const [showDropdown, setShowDropdown] = useState(false);


  const handleLogout = async () => {
    try {
      await logout();
      navigate('/venues');
    } catch (err) {
      toast.error('Failed to logout. Please try again.')
      console.error('Logout Failed:', err);
    }
  };

  const menuItems = [
    {
      path: '/venues/dashboard',
      label: 'Overview',
      icon: <DashboardIconLight />,
      iconActive: <DashboardIconSolid />,
      exact: true,
    },
    {
      path: '/venues/dashboard/gigs',
      label: 'Gigs',
      icon: <CalendarIconLight />,
      iconActive: <CalendarIconSolid />,
    },
    {
      path: '/venues/dashboard/messages',
      label: 'Messages',
      icon: !newMessages ? <MailboxEmptyIcon /> : <MailboxFullIcon />,
      iconActive: !newMessages ? <MailboxEmptyIconSolid /> : <MailboxFullIconSolid />,
      notification: newMessages,
    },
    {
      path: '/venues/dashboard/my-venues',
      label: 'My Venues',
      icon: <VenueIconLight />,
      iconActive: <VenueIconSolid />,
    },
    {
      path: '/venues/dashboard/musicians',
      label: 'Musicians',
      icon: <MusicianIconLight />,
      iconActive: <MusicianIconSolid />,
    },
    {
      path: '/venues/dashboard/finances',
      label: 'Finances',
      icon: <CoinsIcon />,
      iconActive: <CoinsIconSolid />,
    }
  ];

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
          {showDropdown ? <UpChevronIcon /> : <DownChevronIcon />}
        </li>
        {showDropdown && (
          <>
            {/* <li className='account-dropdown-item' onClick={() => navigate('/create-profile')}>
              Create a Musician Profile <GuitarsIcon />
            </li> */}
            <li className='account-dropdown-item' onClick={() => navigate('/account')}>
              Settings <SettingsIcon />
            </li>
            <li className='account-dropdown-item red' onClick={handleLogout}>
              Log Out <LogOutIcon />
            </li>
          </>
        )}
      </ul>
      <button className='btn primary' onClick={() => setGigPostModal(true)}>
        Post a Gig <GigIcon />
      </button>
      <ul className="menu">
        {menuItems.map(({ path, label, icon, iconActive, exact, notification }) => {
          const isActive = exact ? pathname === path : pathname.includes(path);
          return (
            <li
              key={path}
              className={`menu-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(path)}
            >
              <span className="body">
                {isActive ? iconActive : icon} {label}
              </span>
              {notification ? 
              <span className='notification'><DotIcon /></span>
               : null}
            </li>
          );
        })}
      </ul>
      {pathname !== '/venues/dashboard' && (
        <FeedbackBox user={user} />
      )}
    </div>
  );
};