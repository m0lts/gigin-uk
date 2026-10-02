import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from '../dashboard/Sidebar';
import { countNewApplications } from './nights';
import { BellIcon, MenuIcon } from './icons';
import './venue-mobile.css';

export function VenueMobileChrome({
  user,
  newMessages,
  gigs,
  venues,
  open,
  onOpen,
  onClose,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedVenueId = searchParams.get('venue') || '';
  const scoped = selectedVenueId
    ? (gigs || []).filter((gig) => gig.venueId === selectedVenueId)
    : (gigs || []);
  const count = countNewApplications(scoped.length ? scoped : (venues?.length === 1 ? (gigs || []).filter((gig) => gig.venueId === venues[0].venueId) : gigs));
  const label = count > 0 ? `${count} new applications` : 'No new applications';

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const pathRef = useRef(location.pathname);
  useEffect(() => {
    if (pathRef.current === location.pathname) return;
    pathRef.current = location.pathname;
    onClose();
  }, [location.pathname, onClose]);

  const goAttention = () => {
    const venue = searchParams.get('venue');
    const path = venue ? `/venues/dashboard?venue=${encodeURIComponent(venue)}` : '/venues/dashboard';
    if (location.pathname === '/venues/dashboard' || location.pathname === '/venues/dashboard/') {
      document.getElementById('needs-attention')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    navigate(path, { state: { scrollTo: 'needs-attention' } });
  };

  return (
    <>
      <header className="venue-mobile-bar">
        <Link to="/venues/dashboard" className="venue-mobile-bar__wordmark" aria-label="Gigin">
          gigin<span className="venue-mobile-bar__dot">.</span>
        </Link>
        <div className="venue-mobile-bar__tools">
          <button type="button" className="venue-mobile-bar__icon" aria-label={label} onClick={goAttention}>
            <BellIcon />
            {count > 0 && <span className="venue-mobile-bar__count">{count > 99 ? '99+' : count}</span>}
          </button>
          <button type="button" className="venue-mobile-bar__icon" aria-label="Menu" onClick={onOpen}>
            <MenuIcon />
          </button>
        </div>
      </header>
      {open && (
        <div className="venue-drawer">
          <button type="button" className="venue-drawer__backdrop" aria-label="Close menu" onClick={onClose} />
          <div className="venue-drawer__panel">
            <Sidebar user={user} newMessages={newMessages} forceExpanded onClose={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
