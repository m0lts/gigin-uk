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

export const Sidebar = ({ user, newMessages, unseenInvites }) => {
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
          label: 'Gig Applications',
          icon: <CalendarIconLight />,
          iconActive: <CalendarIconSolid />,
          notification: unseenInvites.length > 0,
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
        <div className='sidebar musician'>
          <div className='logo'>
            <TextLogoMed />
            <div className="beta-box">
              <p>BETA</p>
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