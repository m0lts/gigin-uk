import { useEffect, useState } from "react"
import { CalendarIcon, CardIcon, ClockIcon, CoinsIcon, DoorIcon, DownChevronIcon, GuitarsIcon, HouseIcon, InvoiceIcon, LightBulbIcon, PlusIcon, PreviousIcon, TelescopeIcon, TickIcon } from "/components/ui/Extras/Icons"
import { useLocation, useNavigate } from "react-router-dom";


export const Sidebar = ({ setGigPostModal }) => {
    const navigate = useNavigate();
    const location = useLocation();
  
    const [expandedItem, setExpandedItem] = useState('');

    useEffect(() => {
        if (location.pathname.includes('/host/dashboard/gigs')) {
            setExpandedItem('gigs');
        } else if (location.pathname.includes('/host/dashboard/venues')) {
            setExpandedItem('venues');
        } else if (location.pathname.includes('/host/dashboard/musicians')) {
            setExpandedItem('musicians');
        } else if (location.pathname.includes('/host/dashboard/finances')) {
            setExpandedItem('finances');
        } else {
            setExpandedItem('')
        }
    }, [location.pathname])
  
    return (
      <div className="sidebar">
        <button className="btn primary-alt" onClick={() => setGigPostModal(true)}>
          <PlusIcon />
          Post a Gig
        </button>
        <ul className="menu">
          <li className={`menu-item ${location.pathname === '/host/dashboard' && 'active'}`} onClick={() => navigate('/host/dashboard')}>
            <HouseIcon />
            Overview
          </li>
        </ul>
        <ul className="menu">
          <li className={`menu-item expandable ${location.pathname.includes('/host/dashboard/gigs') && 'active'}`} onClick={() => {navigate('/host/dashboard/gigs')}}>
            <CalendarIcon />
            Gigs
          </li>
          {expandedItem === 'gigs' && (
            <>
              <li className="menu-item sub top" onClick={() => navigate('/host/dashboard/gigs?status=confirmed')}>
                Confirmed
              </li>
              <li className="menu-item sub" onClick={() => navigate('/host/dashboard/gigs?status=upcoming')}>
                Upcoming
              </li>
              <li className="menu-item sub bottom" onClick={() => navigate('/host/dashboard/gigs?status=previous')}>
                Previous
              </li>
            </>
          )}
        </ul>
        <ul className="menu">
        <li className={`menu-item expandable ${location.pathname.includes('/host/dashboard/venues') && 'active'}`} onClick={() => {navigate('/host/dashboard/venues')}}>
          <DoorIcon />
          Venues
        </li>
        {expandedItem === 'venues' && (
          <>
            <li className="menu-item sub top" onClick={() => navigate('/host/dashboard/venues')}>
              My Venues
            </li>
            <li className="menu-item sub bottom" onClick={() => navigate('/host/venue-builder')}>
              New Venue
            </li>
          </>
        )}
      </ul>
      <ul className="menu">
        <li className={`menu-item expandable ${location.pathname.includes('/host/dashboard/musicians') && 'active'}`} onClick={() => {navigate('/host/dashboard/musicians')}}>
          <GuitarsIcon />
          Musicians
        </li>
        {expandedItem === 'musicians' && (
          <>
            <li className="menu-item sub top" onClick={() => navigate('/host/dashboard/musicians')}>
              Saved Musicians
            </li>
            <li className="menu-item sub bottom" onClick={() => navigate('/host/dashboard/musicians/find')}>
              Find Musicians
            </li>
          </>
        )}
      </ul>
      <ul className="menu">
        <li className={`menu-item expandable ${location.pathname.includes('/host/dashboard/finances') && 'active'}`} onClick={() => {navigate('/host/dashboard/finances')}}>
          <CoinsIcon />
          Finances
        </li>
        {expandedItem === 'finances' && (
          <>
            <li className={`menu-item sub top`} onClick={() => navigate('/host/dashboard/finances')}>
              Card Details
            </li>
            <li className={`menu-item sub bottom`} onClick={() => navigate('/host/dashboard/finances')}>
              Invoices
            </li>
          </>
          )}
        </ul>
      </div>
    );
  };