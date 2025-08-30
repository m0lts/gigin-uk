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
      const hasMusicianType = !!(p.musicianType);
      const hasBio = !!(p.bio?.text && p.bio.text.trim().length > 0);
      const hasPhotos = Array.isArray(p.photos) && p.photos.length > 0;
      const hasVideos = Array.isArray(p.videos) && p.videos.length > 0;
      const hasGenres = Array.isArray(p.genres) && p.genres.length > 0;
      const hasInstruments = Array.isArray(p.instruments) && p.instruments.length > 0;
      const hasLocation =
        !!p.location && (
          (Array.isArray(p.location.coordinates) && p.location.coordinates.length === 2) ||
          Object.keys(p.location).length > 0
        );
      const hasSocials =
        !!p.socials && Object.values(p.socials).some(v => typeof v === 'string' ? v.trim() : v);
      const anyContent =
        hasMusicianType || hasBio || hasPhotos || hasVideos || hasGenres || hasInstruments || hasLocation || hasSocials;
      return !anyContent;
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