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
} from '@features/shared/ui/extras/Icons';
import { useAuth } from '@hooks/useAuth';
import { useVenueDashboard } from '@context/VenueDashboardContext';
import '@assets/fonts/fonts.css';
import { toast } from 'sonner';
import { FEATURES } from '../../../config/features';
import { countNewApplications } from '../home/nights';
import { CloseIcon as HomeCloseIcon, HomeIcon } from '../home/icons';
import '../home/sidebar-badges.css';

function SidebarPanelIcon() {
  return (
    <svg
      className="sidebar__collapse-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1.2" y="1.7" width="13.6" height="12.6" rx="2" stroke="currentColor" strokeWidth="1.35" />
      <path d="M6.15 1.7v12.6" stroke="currentColor" strokeWidth="1.35" />
      <path d="M2.55 4.05c0-.75.55-1.35 1.25-1.35h1.7v10.6h-1.7c-.7 0-1.25-.6-1.25-1.35V4.05z" fill="currentColor" />
    </svg>
  );
}

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

export const Sidebar = ({ user, newMessages, forceExpanded = false, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed, venueProfiles, gigs } = useVenueDashboard();
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

  const collapsed = sidebarCollapsed && !forceExpanded;
  const newApplications = countNewApplications(
    selectedVenueId ? (gigs || []).filter((gig) => gig.venueId === selectedVenueId) : gigs,
  );

  const menuItems = [
    {
      path: '/venues/dashboard',
      label: 'Home',
      exact: true,
      icon: <HomeIcon />,
      iconActive: <HomeIcon />,
    },
    {
      path: '/venues/dashboard/gigs',
      label: 'Gigs',
      icon: <CalendarIconLight />,
      iconActive: <CalendarIconSolid />,
      count: newApplications,
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
    onClose?.();
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
    <div className={`sidebar sidebar--console${collapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar__logo-row">
        <Link to="/venues/dashboard/gigs" className="sidebar__wordmark" aria-label="Gigin" aria-hidden={collapsed || undefined} tabIndex={collapsed ? -1 : undefined}>
          gigin<span className="sidebar__wordmark-dot">.</span>
        </Link>
        {onClose ? (
          <button type="button" className="sidebar__collapse" onClick={onClose} aria-label="Close menu">
            <HomeCloseIcon />
          </button>
        ) : (
          <button
            type="button"
            className="sidebar__collapse"
            onClick={() => {
              setVenueMenuOpen(false);
              setShowDropdown(false);
              setSidebarCollapsed((value) => !value);
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <SidebarPanelIcon />
          </button>
        )}
      </div>

      {venues.length > 0 && (
        <div className="sidebar__venue-wrap" ref={venueMenuRef}>
          {canSwitchVenue ? (
            <button
              type="button"
              className="sidebar__venue"
              aria-expanded={venueMenuOpen}
              aria-haspopup="listbox"
              aria-label={displayedVenue?.name || 'All venues'}
              title={collapsed ? (displayedVenue?.name || 'All venues') : undefined}
              onClick={() => {
                setShowDropdown(false);
                setVenueMenuOpen((open) => !open);
              }}
            >
              <span className="sidebar__venue-copy">
                <span className="sidebar__venue-name">{displayedVenue?.name || 'All venues'}</span>
                <span className="sidebar__venue-meta">{venueCountLabel}</span>
              </span>
              <span className="sidebar__chevron" aria-hidden="true"><DownChevronIcon /></span>
            </button>
          ) : (
            <div className="sidebar__venue" title={collapsed ? venues[0].name : undefined}>
              <span className="sidebar__venue-copy">
                <span className="sidebar__venue-name">{venues[0].name}</span>
                <span className="sidebar__venue-meta">{venueCountLabel}</span>
              </span>
              <span className="sidebar__chevron sidebar__chevron--when-collapsed" aria-hidden="true"><DownChevronIcon /></span>
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

      <span className="sidebar__section" aria-hidden={collapsed || undefined}>Manage</span>

      <ul className="menu">
        {menuItems.map(({ path, label, icon, iconActive, exact, notification, count }) => {
          const isActive = exact ? pathname === path || pathname === `${path}/` : pathname.includes(path);
          const collapsedTitle = count > 0 ? `${label} · ${count} new application${count === 1 ? '' : 's'}` : label;
          const shown = count > 99 ? '99+' : count;
          return (
            <li
              key={path}
              className={`menu-item${isActive ? ' active' : ''}`}
              onClick={() => navigateTo(path)}
              title={collapsed ? collapsedTitle : undefined}
            >
              <span className="body">
                <span className="sidebar__nav-icon">
                  {isActive ? iconActive : icon}
                  {count > 0 && collapsed ? <span className="sidebar__count-dot" aria-label={`${count} new applications`} /> : null}
                </span>
                <span className="sidebar__nav-label">{label}</span>
              </span>
              {count > 0 && !collapsed ? (
                <span className="sidebar__count" aria-label={`${count} new applications`}>{shown}</span>
              ) : notification && !collapsed ? (
                <span className="notification"><DotIcon /></span>
              ) : notification ? (
                <span className="notification notification--dot"><DotIcon /></span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="sidebar__spacer" aria-hidden="true" />

      <div className="sidebar__account-wrap" ref={accountMenuRef}>
        <button
          type="button"
          className="sidebar__account"
          title={collapsed ? 'Account' : undefined}
          aria-expanded={showDropdown}
          aria-haspopup="menu"
          onClick={() => {
            setVenueMenuOpen(false);
            if (collapsed) {
              setSidebarCollapsed(false);
              setShowDropdown(true);
            } else {
              setShowDropdown((open) => !open);
            }
          }}
        >
          <span className="sidebar__avatar">{nameInitials(user?.name)}</span>
          <span className="sidebar__account-copy">
            <span className="sidebar__account-name">{user?.name}</span>
            <span className="sidebar__account-email">{user?.email}</span>
          </span>
          <span className="sidebar__chevron" aria-hidden="true"><DownChevronIcon /></span>
        </button>
        {showDropdown && !collapsed && (
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
