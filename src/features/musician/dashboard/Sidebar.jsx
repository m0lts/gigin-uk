import { useEffect, useState, useMemo } from 'react'
import { 
    CalendarIconSolid,
    CoinsIcon,
    GuitarsIcon,
    PeopleGroupIcon,
    ProfileIcon } from '@features/shared/ui/extras/Icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { toast } from 'sonner';
import { CalendarIconLight, CoinsIconSolid, DashboardIconLight, DashboardIconSolid, DotIcon, DownChevronIcon, LocationPinIcon, LogOutIcon, MailboxEmptyIcon, MailboxEmptyIconSolid, MailboxFullIcon, MailboxFullIconSolid, PeopleGroupIconSolid, PeopleRoofIconLight, ProfileIconSolid, SettingsIcon, UpChevronIcon, UserIcon } from '../../shared/ui/extras/Icons';
import { TextLogoMed } from '../../shared/ui/logos/Logos';
import { FeedbackBox } from '../../venue/dashboard/FeedbackBox';

export const Sidebar = ({ user, newMessages }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const pathname = useMemo(() => location.pathname, [location.pathname]);
  
    const [showDropdown, setShowDropdown] = useState(false);

    const handleLogout = async () => {
        try {
          await logout();
          navigate('/find-a-gig');
        } catch (err) {
          toast.error('Failed to logout. Please try again.')
          console.error('Logout Failed:', err);
        }
    };

    const menuItems = [
        {
          path: '/dashboard',
          label: 'Overview',
          icon: <DashboardIconLight />,
          iconActive: <DashboardIconSolid />,
          exact: true,
        },
        {
          path: '/dashboard/profile',
          label: 'Profile',
          icon: <ProfileIcon />,
          iconActive: <ProfileIconSolid />,
        },
        {
          path: '/dashboard/gigs',
          label: 'Gigs',
          icon: <CalendarIconLight />,
          iconActive: <CalendarIconSolid />,
        },
        {
          path: '/dashboard/messages',
          label: 'Messages',
          icon: !newMessages ? <MailboxEmptyIcon /> : <MailboxFullIcon />,
          iconActive: !newMessages ? <MailboxEmptyIconSolid /> : <MailboxFullIconSolid />,
          notification: newMessages,
        },
        {
          path: '/dashboard/bands',
          label: 'Bands',
          icon: <PeopleGroupIcon />,
          iconActive: <PeopleGroupIconSolid />,
        },
        {
          path: '/dashboard/finances',
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
                <h6>Musician Dashboard</h6>
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
                {/* <li className='account-dropdown-item' onClick={() => navigate('/add-venue')}>
                  Create a Venue Profile <VenueIcon />
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
          <button className='btn primary' onClick={() => navigate('/find-a-gig')}>
            Find a Gig <LocationPinIcon />
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
          {pathname !== '/dashboard' && (
            <FeedbackBox user={user} />
          )}
        </div>
      );
  };