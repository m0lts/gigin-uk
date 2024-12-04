import { useEffect, useState } from "react"
import { CalendarIcon, CardIcon, ClockIcon, CoinsIcon, DoorIcon, DownChevronIcon, GuitarsIcon, HouseIcon, InvoiceIcon, LightBulbIcon, PlusIcon, PreviousIcon, TelescopeIcon, TickIcon } from "/components/ui/Extras/Icons"
import { useLocation, useNavigate } from "react-router-dom";


export const Sidebar = ({ setGigPostModal }) => {
    const navigate = useNavigate();
    const location = useLocation();
  
    const [expandedItem, setExpandedItem] = useState('');

    useEffect(() => {
        if (location.pathname.includes('/venues/dashboard/gigs')) {
            setExpandedItem('gigs');
        } else if (location.pathname.includes('/venues/dashboard/venues')) {
            setExpandedItem('venues');
        } else if (location.pathname.includes('/venues/dashboard/musicians')) {
            setExpandedItem('musicians');
        } else if (location.pathname.includes('/venues/dashboard/finances')) {
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
          <li className={`menu-item ${location.pathname === '/venues/dashboard' && 'active'}`} onClick={() => navigate('/venues/dashboard')}>
            <HouseIcon />
            Overview
          </li>
        </ul>
        <ul className="menu">
          <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/gig') && 'active'}`} onClick={() => {navigate('/venues/dashboard/gigs')}}>
            <CalendarIcon />
            Gigs
          </li>
          {expandedItem === 'gigs' && (
            <>
              <li className="menu-item sub top" onClick={() => navigate('/venues/dashboard/gigs?status=confirmed')}>
                Confirmed
              </li>
              <li className="menu-item sub" onClick={() => navigate('/venues/dashboard/gigs?status=upcoming')}>
                Upcoming
              </li>
              <li className="menu-item sub bottom" onClick={() => navigate('/venues/dashboard/gigs?status=previous')}>
                Previous
              </li>
            </>
          )}
        </ul>
        <ul className="menu">
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/venues') && 'active'}`} onClick={() => {navigate('/venues/dashboard/venues')}}>
          <DoorIcon />
          Venues
        </li>
        {expandedItem === 'venues' && (
          <>
            <li className="menu-item sub top" onClick={() => navigate('/venues/dashboard/venues')}>
              My Venues
            </li>
            <li className="menu-item sub bottom" onClick={() => navigate('/venues/add-venue')}>
              Add Venue
            </li>
          </>
        )}
      </ul>
      <ul className="menu">
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/musicians') && 'active'}`} onClick={() => {navigate('/venues/dashboard/musicians')}}>
          <GuitarsIcon />
          Musicians
        </li>
        {expandedItem === 'musicians' && (
          <>
            <li className="menu-item sub top" onClick={() => navigate('/venues/dashboard/musicians')}>
              Saved Musicians
            </li>
            <li className="menu-item sub bottom" onClick={() => navigate('/venues/dashboard/musicians/find')}>
              Find Musicians
            </li>
          </>
        )}
      </ul>
      <ul className="menu">
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/finances') && 'active'}`} onClick={() => {navigate('/venues/dashboard/finances')}}>
          <CoinsIcon />
          Finances
        </li>
        </ul>
      </div>
    );
  };