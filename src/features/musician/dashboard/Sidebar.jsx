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

export const Sidebar = ({ user, newMessages, unseenInvites, bandProfiles, musicianProfile }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const pathname = useMemo(() => location.pathname, [location.pathname]);
  
    const isOnlyNameFilled = useMemo(() => {
      const p = musicianProfile;
      if (!p) return true;
      const isEmptyVal = (v) =>
        v == null ||
        v === '' ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
      const exclude = new Set(['name', 'id', 'uid', 'createdAt', 'updatedAt']);
      for (const [k, v] of Object.entries(p)) {
        if (exclude.has(k)) continue;
        if (!isEmptyVal(v)) return false;
      }
      return true;
    }, [musicianProfile]);
  
    const menuItems = useMemo(() => {
      const items = [
        {
          path: '/dashboard',
          label: 'Overview',
          icon: <DashboardIconLight />,
          iconActive: <DashboardIconSolid />,
          exact: true,
        },
        {
          path: '/dashboard/profile',
          label: 'My Profile',
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
          label: 'My Band(s)',
          icon: <PeopleGroupIcon />,
          iconActive: <PeopleGroupIconSolid />,
        },
        {
          path: '/dashboard/finances',
          label: 'Finances',
          icon: <CoinsIcon />,
          iconActive: <CoinsIconSolid />,
        },
      ];
      const hasBand = Array.isArray(bandProfiles) && bandProfiles.length > 0;
      const shouldSwap = hasBand && isOnlyNameFilled;
      if (shouldSwap) {
        const profileIndex = items.findIndex(i => i.path === '/dashboard/profile');
        const bandsIndex = items.findIndex(i => i.path === '/dashboard/bands');
        if (profileIndex !== -1 && bandsIndex !== -1) {
          [items[profileIndex], items[bandsIndex]] = [items[bandsIndex], items[profileIndex]];
        }
      }
      return items;
    }, [unseenInvites.length, bandProfiles, isOnlyNameFilled]);

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