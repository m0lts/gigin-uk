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
import { useVenueDashboard } from '@context/VenueDashboardContext';
import '@assets/fonts/fonts.css';
import { CalendarIconLight, CalendarIconSolid, CoinsIconSolid, DashboardIconLight, DashboardIconSolid, DotIcon, FeedbackIcon, GigIcon, HouseIconSolid, LeftChevronIcon, MailboxEmptyIconSolid, MailboxFullIconSolid, MusicianIconLight, MusicianIconSolid, RightChevronIcon, UpChevronIcon, VenueIconLight, VenueIconSolid } from '../../shared/ui/extras/Icons';
import { FeedbackBox } from './FeedbackBox';
import { toast } from 'sonner';

export const Sidebar = ({ user, newMessages, setShowWelcomeModal, setRevisitingModal }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed } = useVenueDashboard();
  const pathname = useMemo(() => location.pathname, [location.pathname]);
  const [showDropdown, setShowDropdown] = useState(false);


  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      toast.error('Failed to logout. Please try again.')
      console.error('Logout Failed:', err);
    }
  };

  useEffect(() => {
    if (location.pathname === '/venues/dashboard' || location.pathname === '/venues/dashboard/' ) {
      navigate('/venues/dashboard/gigs');
      return;
    };
  }, [location])

  const menuItems = [
    // {
    //   path: '/venues/dashboard',
    //   label: 'Overview',
    //   icon: <DashboardIconLight />,
    //   iconActive: <DashboardIconSolid />,
    //   exact: true,
    // },
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
      path: '/venues/dashboard/artists',
      label: 'My Artists',
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
    <div className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
      <div className='sidebar__header'>
        <div className='logo'>
          {sidebarCollapsed ? (
            <a href="/venues/dashboard/gigs" className="sidebar__logo-link" aria-label="Gigin">
              <img src="/icons/favicon.svg" alt="Gigin" className="sidebar__favicon" />
            </a>
          ) : (
            <>
              <TextLogoMed />
              <div className="beta-box">
                <p>BETA</p>
              </div>
            </>
          )}
        </div>
      </div>
      <ul className="menu">
        {menuItems.map(({ path, label, icon, iconActive, exact, notification }) => {
          const isActive = exact ? pathname === path : pathname.includes(path);
          return (
            <li
              key={path}
              className={`menu-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(path)}
              title={sidebarCollapsed ? label : undefined}
            >
              <span className="body">
                {isActive ? iconActive : icon}
                {!sidebarCollapsed && ` ${label}`}
              </span>
              {notification && !sidebarCollapsed ?
              <span className='notification'><DotIcon /></span>
               : notification ? <span className='notification notification--dot'><DotIcon /></span> : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="sidebar__collapse-btn sidebar__collapse-btn--nav"
        onClick={() => setSidebarCollapsed((c) => !c)}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <RightChevronIcon /> : <LeftChevronIcon />}
        {!sidebarCollapsed && 'Collapse sidebar'}
      </button>
      <div className="sidebar__spacer" aria-hidden="true" />
      <ul
        className={`account-dropdown ${showDropdown ? 'open' : ''}`}
        onClick={() => {
          if (sidebarCollapsed) {
            setSidebarCollapsed(false);
            setShowDropdown(true);
          } else {
            setShowDropdown(!showDropdown);
          }
        }}
      >
        <li className='account-dropdown-item exempt' title={sidebarCollapsed ? 'Account' : undefined}>
          <div className='account-info'>
            {!sidebarCollapsed && <h6>Venue Dashboard</h6>}
            <div className='user-container'>
              <UserIcon />
              {!sidebarCollapsed && (
                <div className='user-details'>
                  <h4>{user?.name}</h4>
                  <p>
                    {user?.email}
                  </p>
                </div>
              )}
            </div>
          </div>
          {!sidebarCollapsed && (showDropdown ? <UpChevronIcon /> : <DownChevronIcon />)}
        </li>
        {showDropdown && (
          <>
            {/* <li className='account-dropdown-item' onClick={() => navigate('/dashboard')}>
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
      {/* {pathname !== '/venues/dashboard' && (
        <FeedbackBox user={user} setShowWelcomeModal={setShowWelcomeModal} setRevisitingModal={setRevisitingModal} />
      )} */}
    </div>
  );
};