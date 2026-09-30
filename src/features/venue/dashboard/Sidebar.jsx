import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  HouseIconLight,
  HouseIconSolid,
  MessageIcon,
  MessageIconSolid,
  SettingsIcon,
  LogOutIcon,
  DownChevronIcon,
  AddressBookIcon,
  CalendarIconLight,
  CalendarIconSolid,
  CoinsIcon,
  CoinsIconSolid,
  DotIcon,
  LeftChevronIcon,
  RightChevronIcon,
} from '@features/shared/ui/extras/Icons';
import { useAuth } from '@hooks/useAuth';
import { useVenueDashboard } from '@context/VenueDashboardContext';
import '@assets/fonts/fonts.css';
import { toast } from 'sonner';
import { FEATURES } from '../../../config/features';

function nameInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const skip = new Set(['the', 'a', 'an', 'and']);
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
    .filter((word) => word && !skip.has(word.toLowerCase()));
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return '?';
}

export const Sidebar = ({ user, newMessages }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed, venueProfiles } = useVenueDashboard();
  const pathname = useMemo(() => location.pathname, [location.pathname]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [venueMenuOpen, setVenueMenuOpen] = useState(false);
  const venueMenuRef = useRef(null);
  const accountMenuRef = useRef(null);

  const venues = venueProfiles || [];
  const selectedVenueId = searchParams.get('venue') || '';
  const selectedVenue = venues.find((venue) => venue.venueId === selectedVenueId) || null;
  const displayedVenue = selectedVenue || (venues.length === 1 ? venues[0] : null);
  const canSwitchVenue = venues.length > 1;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      toast.error('Failed to logout. Please try again.');
      console.error('Logout Failed:', err);
    }
  };

  useEffect(() => {
    if (location.pathname === '/venues/dashboard' || location.pathname === '/venues/dashboard/') {
      navigate('/venues/dashboard/gigs');
    }
  }, [location, navigate]);

  useEffect(() => {
    if (!venueMenuOpen && !showDropdown) return undefined;
    const onPointerDown = (event) => {
      if (venueMenuRef.current && !venueMenuRef.current.contains(event.target)) {
        setVenueMenuOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [venueMenuOpen, showDropdown]);

  const menuItems = [
    {
      path: '/venues/dashboard/gigs',
      label: 'Gigs',
      icon: <CalendarIconLight />,
      iconActive: <CalendarIconSolid />,
    },
    ...(FEATURES.chat ? [{
      path: '/venues/dashboard/messages',
      label: 'Messages',
      icon: <MessageIcon />,
      iconActive: <MessageIconSolid />,
      notification: newMessages,
    }] : []),
    {
      path: '/venues/dashboard/artists',
      label: 'My Contacts',
      icon: <AddressBookIcon />,
      iconActive: <AddressBookIcon />,
    },
    ...(FEATURES.finances ? [{
      path: '/venues/dashboard/finances',
      label: 'Finances',
      icon: <CoinsIcon />,
      iconActive: <CoinsIconSolid />,
    }] : []),
    {
      path: '/venues/dashboard/my-venues',
      label: 'Venue Settings',
      icon: <HouseIconLight />,
      iconActive: <HouseIconSolid />,
    },
  ];

  const navigateTo = (path) => {
    const venue = searchParams.get('venue');
    navigate(venue ? { pathname: path, search: `?venue=${encodeURIComponent(venue)}` } : path);
  };

  const selectVenue = (venueId) => {
    const next = new URLSearchParams(searchParams);
    if (venueId) next.set('venue', venueId);
    else next.delete('venue');
    setSearchParams(next);
    setVenueMenuOpen(false);
  };

  const venueCountLabel = `${venues.length} venue${venues.length === 1 ? '' : 's'}`;

  return (
    <div className={`sidebar sidebar--console${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar__logo-row">
        <Link to="/venues/dashboard/gigs" className="sidebar__wordmark" aria-label="Gigin">
          {sidebarCollapsed ? (
            <>g<span className="sidebar__wordmark-dot">.</span></>
          ) : (
            <>gigin<span className="sidebar__wordmark-dot">.</span></>
          )}
        </Link>
        {!sidebarCollapsed && <span className="sidebar__beta">BETA</span>}
      </div>

      {!sidebarCollapsed && venues.length > 0 && (
        <div className="sidebar__venue-wrap" ref={venueMenuRef}>
          {canSwitchVenue ? (
            <button
              type="button"
              className="sidebar__venue"
              aria-expanded={venueMenuOpen}
              aria-haspopup="listbox"
              onClick={() => {
                setShowDropdown(false);
                setVenueMenuOpen((open) => !open);
              }}
            >
              <span className="sidebar__venue-mark">
                {displayedVenue ? nameInitials(displayedVenue.name) : nameInitials('All venues')}
              </span>
              <span className="sidebar__venue-copy">
                <span className="sidebar__venue-name">{displayedVenue?.name || 'All venues'}</span>
                <span className="sidebar__venue-meta">{venueCountLabel}</span>
              </span>
              <span className="sidebar__chevron" aria-hidden="true"><DownChevronIcon /></span>
            </button>
          ) : (
            <div className="sidebar__venue">
              <span className="sidebar__venue-mark">{nameInitials(venues[0].name)}</span>
              <span className="sidebar__venue-copy">
                <span className="sidebar__venue-name">{venues[0].name}</span>
                <span className="sidebar__venue-meta">{venueCountLabel}</span>
              </span>
            </div>
          )}
          {venueMenuOpen && (
            <div className="sidebar__popover sidebar__venue-menu" role="listbox" aria-label="Venues">
              <button
                type="button"
                className={`sidebar__popover-item${!selectedVenueId ? ' is-selected' : ''}`}
                onClick={() => selectVenue('')}
              >
                All venues
              </button>
              {venues.map((venue) => (
                <button
                  type="button"
                  key={venue.venueId}
                  className={`sidebar__popover-item${selectedVenueId === venue.venueId ? ' is-selected' : ''}`}
                  onClick={() => selectVenue(venue.venueId)}
                >
                  {venue.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!sidebarCollapsed && <span className="sidebar__section">Manage</span>}

      <ul className="menu">
        {menuItems.map(({ path, label, icon, iconActive, exact, notification }) => {
          const isActive = exact ? pathname === path : pathname.includes(path);
          return (
            <li
              key={path}
              className={`menu-item${isActive ? ' active' : ''}`}
              onClick={() => navigateTo(path)}
              title={sidebarCollapsed ? label : undefined}
            >
              <span className="body">
                <span className="sidebar__nav-icon">{isActive ? iconActive : icon}</span>
                {!sidebarCollapsed && label}
              </span>
              {notification && !sidebarCollapsed ? (
                <span className="notification"><DotIcon /></span>
              ) : notification ? (
                <span className="notification notification--dot"><DotIcon /></span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="sidebar__spacer" aria-hidden="true" />

      <button
        type="button"
        className="sidebar__collapse"
        onClick={() => {
          setVenueMenuOpen(false);
          setShowDropdown(false);
          setSidebarCollapsed((collapsed) => !collapsed);
        }}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Close sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : undefined}
      >
        <span className="sidebar__collapse-icon">
          {sidebarCollapsed ? <RightChevronIcon /> : <LeftChevronIcon />}
        </span>
        {!sidebarCollapsed && 'Close sidebar'}
      </button>

      <div className="sidebar__account-wrap" ref={accountMenuRef}>
        <button
          type="button"
          className="sidebar__account"
          title={sidebarCollapsed ? 'Account' : undefined}
          aria-expanded={showDropdown}
          aria-haspopup="menu"
          onClick={() => {
            setVenueMenuOpen(false);
            if (sidebarCollapsed) {
              setSidebarCollapsed(false);
              setShowDropdown(true);
            } else {
              setShowDropdown((open) => !open);
            }
          }}
        >
          <span className="sidebar__avatar">{nameInitials(user?.name)}</span>
          {!sidebarCollapsed && (
            <>
              <span className="sidebar__account-copy">
                <span className="sidebar__account-name">{user?.name}</span>
                <span className="sidebar__account-email">{user?.email}</span>
              </span>
              <span className="sidebar__chevron" aria-hidden="true"><DownChevronIcon /></span>
            </>
          )}
        </button>
        {showDropdown && !sidebarCollapsed && (
          <div className="sidebar__popover sidebar__account-menu" role="menu">
            <button
              type="button"
              className="sidebar__popover-item"
              role="menuitem"
              onClick={() => navigate('/account')}
            >
              Settings
              <SettingsIcon />
            </button>
            <button
              type="button"
              className="sidebar__popover-item sidebar__popover-item--danger"
              role="menuitem"
              onClick={handleLogout}
            >
              Log Out
              <LogOutIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
