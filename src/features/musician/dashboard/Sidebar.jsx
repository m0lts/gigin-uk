import { useEffect, useState } from 'react'
import { 
    CalendarIcon,
    CoinsIcon,
    GuitarsIcon,
    PeopleGroupIcon,
    ProfileIcon } from '@features/shared/ui/extras/Icons';
import { useLocation, useNavigate } from 'react-router-dom';


export const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
  
    const [expandedItem, setExpandedItem] = useState('');

    useEffect(() => {
        if (location.pathname.includes('/dashboard/profile')) {
            setExpandedItem('profile');
        } else if (location.pathname.includes('/dashboard/gigs')) {
            setExpandedItem('gigs');
        } else if (location.pathname.includes('/dashboard/bands')) {
            setExpandedItem('bands');
        } else if (location.pathname.includes('/dashboard/finances')) {
            setExpandedItem('finances');
        } else {
            setExpandedItem('')
        }
    }, [location.pathname])
  
    return (
      <div className='sidebar'>
        <ul className='menu'>
          <li className={`menu-item ${location.pathname === '/dashboard' && 'active'}`} onClick={() => navigate('/dashboard')}>
            <GuitarsIcon />
            Overview
          </li>
        </ul>
        <ul className='menu'>
          <li className={`menu-item expandable ${location.pathname.includes('/dashboard/profile') && 'active'}`} onClick={() => {navigate('/dashboard/profile')}}>
            <ProfileIcon />
            Profile
          </li>
        </ul>
        <ul className='menu'>
            <li className={`menu-item expandable ${location.pathname.includes('/dashboard/gigs') && 'active'}`} onClick={() => {navigate('/dashboard/gigs')}}>
                <CalendarIcon />
                Gigs
            </li>
            {expandedItem === 'gigs' && (
                <>
                <li className='menu-item sub top' onClick={() => navigate('/dashboard/gigs?status=confirmed')}>
                    Confirmed
                </li>
                <li className='menu-item sub' onClick={() => navigate('/dashboard/gigs?status=pending')}>
                    Pending
                </li>
                <li className='menu-item sub bottom' onClick={() => navigate('/dashboard/gigs?status=previous')}>
                    Previous
                </li>
                </>
            )}
        </ul>
        <ul className='menu'>
            <li className={`menu-item expandable ${location.pathname.includes('/dashboard/bands') && 'active'}`} onClick={() => {navigate('/dashboard/bands')}}>
                <PeopleGroupIcon />
                Bands
            </li>
            {expandedItem === 'bands' && (
            <>
                <li className='menu-item sub top' onClick={() => navigate('/dashboard/bands/create')}>
                    Create a band
                </li>
                <li className='menu-item sub bottom' onClick={() => navigate('/dashboard/bands/join')}>
                    Join a band
                </li>
            </>
            )}
        </ul>
        <ul className='menu'>
            <li className={`menu-item expandable ${location.pathname.includes('/dashboard/finances') && 'active'}`} onClick={() => {navigate('/dashboard/finances')}}>
                <CoinsIcon />
                Finances
            </li>
        </ul>
      </div>
    );
  };