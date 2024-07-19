import { useEffect, useState } from "react"
import { CalendarIcon, CardIcon, ClockIcon, CoinsIcon, DoorIcon, DownChevronIcon, GuitarsIcon, HouseIcon, InvoiceIcon, LightBulbIcon, PlusIcon, PreviousIcon, TelescopeIcon, TickIcon } from "/components/ui/Extras/Icons"
import { useLocation, useNavigate } from "react-router-dom";
import { PeopleGroupIcon, ProfileIcon } from "../../../components/ui/Extras/Icons";


export const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
  
    const [expandedItem, setExpandedItem] = useState('');

    useEffect(() => {
        if (location.pathname.includes('/musician/dashboard/profile')) {
            setExpandedItem('profile');
        } else if (location.pathname.includes('/musician/dashboard/gigs')) {
            setExpandedItem('gigs');
        } else if (location.pathname.includes('/musician/dashboard/bands')) {
            setExpandedItem('bands');
        } else if (location.pathname.includes('/musician/dashboard/finances')) {
            setExpandedItem('finances');
        } else {
            setExpandedItem('')
        }
    }, [location.pathname])
  
    return (
      <div className="sidebar">
        <ul className="menu">
          <li className={`menu-item ${location.pathname === '/musician/dashboard' && 'active'}`} onClick={() => navigate('/musician/dashboard')}>
            <GuitarsIcon />
            Overview
          </li>
        </ul>
        <ul className="menu">
          <li className={`menu-item expandable ${location.pathname.includes('/musician/dashboard/profile') && 'active'}`} onClick={() => {navigate('/musician/dashboard/profile')}}>
            <ProfileIcon />
            Profile
          </li>
        </ul>
        <ul className="menu">
            <li className={`menu-item expandable ${location.pathname.includes('/musician/dashboard/gigs') && 'active'}`} onClick={() => {navigate('/musician/dashboard/gigs')}}>
                <CalendarIcon />
                Gigs
            </li>
            {expandedItem === 'gigs' && (
                <>
                <li className="menu-item sub top" onClick={() => navigate('/musician/dashboard/gigs?status=confirmed')}>
                    Confirmed
                </li>
                <li className="menu-item sub" onClick={() => navigate('/musician/dashboard/gigs?status=upcoming')}>
                    Upcoming
                </li>
                <li className="menu-item sub bottom" onClick={() => navigate('/musician/dashboard/gigs?status=previous')}>
                    Previous
                </li>
                </>
            )}
        </ul>
        <ul className="menu">
            <li className={`menu-item expandable ${location.pathname.includes('/musician/dashboard/bands') && 'active'}`} onClick={() => {navigate('/musician/dashboard/bands')}}>
                <PeopleGroupIcon />
                Bands
            </li>
            {expandedItem === 'bands' && (
            <>
                <li className="menu-item sub top" onClick={() => navigate('/musician/dashboard/bands')}>
                    Create a band
                </li>
                <li className="menu-item sub bottom" onClick={() => navigate('/musician/dashboard/bands')}>
                    Join a band
                </li>
            </>
            )}
        </ul>
        <ul className="menu">
            <li className={`menu-item expandable ${location.pathname.includes('/musician/dashboard/finances') && 'active'}`} onClick={() => {navigate('/musician/dashboard/finances')}}>
                <CoinsIcon />
                Finances
            </li>
            {expandedItem === 'finances' && (
            <>
                <li className={`menu-item sub top`} onClick={() => navigate('/musician/dashboard/finances')}>
                    Card Details
                </li>
                <li className={`menu-item sub bottom`} onClick={() => navigate('/musician/dashboard/finances')}>
                    Invoices
                </li>
            </>
            )}
        </ul>
      </div>
    );
  };