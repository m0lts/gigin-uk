// import { useEffect, useState } from 'react'
// import { 
//   CalendarIcon,
//   CoinsIcon,
//   DoorIcon,
//   GuitarsIcon,
//   HouseIconLight,
//   PlusIcon } from '@features/shared/ui/extras/Icons'
// import { useLocation, useNavigate } from 'react-router-dom';
// import { NoTextLogo, TextLogo, TextLogoMed, WhiteBckgrdLogo } from '../../shared/ui/logos/Logos';
// import '@assets/fonts/fonts.css'
// import { DownChevronIcon, UserIcon } from '../../shared/ui/extras/Icons';

// export const Sidebar = ({ setGigPostModal, user }) => {
//     const navigate = useNavigate();
//     const location = useLocation();
  
//     const [expandedItem, setExpandedItem] = useState('');

//     useEffect(() => {
//         if (location.pathname.includes('/venues/dashboard/gigs')) {
//             setExpandedItem('gigs');
//         } else if (location.pathname.includes('/venues/dashboard/venues')) {
//             setExpandedItem('venues');
//         } else if (location.pathname.includes('/venues/dashboard/musicians')) {
//             setExpandedItem('musicians');
//         } else if (location.pathname.includes('/venues/dashboard/finances')) {
//             setExpandedItem('finances');
//         } else {
//             setExpandedItem('')
//         }
//     }, [location.pathname])
  
//     return (
//       <div className='sidebar'>
//         <div className="logo">
//           <TextLogoMed />
//         </div>
//         <div className="menu-dropdown" >
//           <div>
//             <h6>Venue Dashboard</h6>
//             <div className='user-container'>
//               <UserIcon />
//               <div className='user-details'>
//                 <h4>{user.name}</h4>
//                 <p>{user.email}</p>
//               </div>
//             </div>
//           </div>
//           <DownChevronIcon />
//         </div>
//         <button className='btn primary-alt' onClick={() => setGigPostModal(true)}>
//           <PlusIcon />
//           Post a Gig
//         </button>
//         <ul className='menu'>
//           <li className={`menu-item ${location.pathname === '/venues/dashboard' && 'active'}`} onClick={() => navigate('/venues/dashboard')}>
//             <HouseIconLight />
//             Overview
//           </li>
//         </ul>
//         <ul className='menu'>
//           <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/gig') && 'active'}`} onClick={() => {navigate('/venues/dashboard/gigs')}}>
//             <CalendarIcon />
//             Gigs
//           </li>
//           {expandedItem === 'gigs' && (
//             <>
//               <li className='menu-item sub top' onClick={() => navigate('/venues/dashboard/gigs?status=confirmed')}>
//                 Confirmed
//               </li>
//               <li className='menu-item sub' onClick={() => navigate('/venues/dashboard/gigs?status=upcoming')}>
//                 Upcoming
//               </li>
//               <li className='menu-item sub bottom' onClick={() => navigate('/venues/dashboard/gigs?status=previous')}>
//                 Previous
//               </li>
//             </>
//           )}
//         </ul>
//         <ul className='menu'>
//         <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/venues') && 'active'}`} onClick={() => {navigate('/venues/dashboard/venues')}}>
//           <DoorIcon />
//           My Venues
//         </li>
//       </ul>
//       <ul className='menu'>
//         <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/musicians') && 'active'}`} onClick={() => {navigate('/venues/dashboard/musicians')}}>
//           <GuitarsIcon />
//           Musicians
//         </li>
//         {expandedItem === 'musicians' && (
//           <>
//             <li className='menu-item sub top' onClick={() => navigate('/venues/dashboard/musicians')}>
//               Saved Musicians
//             </li>
//             <li className='menu-item sub bottom' onClick={() => navigate('/venues/dashboard/musicians/find')}>
//               Find Musicians
//             </li>
//           </>
//         )}
//       </ul>
//       <ul className='menu'>
//         <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/finances') && 'active'}`} onClick={() => {navigate('/venues/dashboard/finances')}}>
//           <CoinsIcon />
//           Finances
//         </li>
//         </ul>
//       </div>
//     );
//   };

  import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarIcon,
  CoinsIcon,
  DoorIcon,
  GuitarsIcon,
  HouseIconLight,
  PlusIcon,
  DownChevronIcon,
  MailboxEmptyIcon,
  MailboxFullIcon,
  DashboardIcon,
  VenueBuilderIcon,
  SettingsIcon,
  LogOutIcon,
  UserIcon
} from '@features/shared/ui/extras/Icons';
import { TextLogoMed } from '../../shared/ui/logos/Logos';
import { listenToUserConversations } from '@services/conversations';
import { useAuth } from '@hooks/useAuth';
import '@assets/fonts/fonts.css';
import { UpChevronIcon } from '../../shared/ui/extras/Icons';

export const Sidebar = ({ setGigPostModal, user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [expandedItem, setExpandedItem] = useState('');
  const [newMessages, setNewMessages] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToUserConversations(user, (conversations) => {
      const hasUnread = conversations.some((conv) => {
        const lastViewed = conv.lastViewed?.[user.uid]?.seconds || 0;
        const lastMessage = conv.lastMessageTimestamp?.seconds || 0;
        const isNotSender = conv.lastMessageSenderId !== user.uid;
        const isDifferentPage = !location.pathname.includes(conv.id);
        return lastMessage > lastViewed && isNotSender && isDifferentPage;
      });
      setNewMessages(hasUnread);
    });
    return () => unsubscribe();
  }, [user]);

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
      setExpandedItem('');
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/venues');
    } catch (err) {
      console.error(err);
    } finally {
      window.location.reload();
    }
  };

  return (
    <div className='sidebar'>
      <div className='logo'>
        <TextLogoMed />
      </div>
      <ul className='account-dropdown' onClick={() => setShowDropdown(!showDropdown)}>
        <li className='account-dropdown-item'>
          <div>
            <h6>Venue Dashboard</h6>
            <div className='user-container'>
              <UserIcon />
              <div className='user-details'>
                <h4>{user?.name}</h4>
                <p>{user?.email}</p>
              </div>
            </div>
          </div>
          {showDropdown ? (
            <UpChevronIcon />
          ) : (
            <DownChevronIcon />
          )}
        </li>
        {showDropdown && (
          <>
            <li className='account-dropdown-item' onClick={() => navigate('/create-profile')}>
              Create a Musician Profile <GuitarsIcon />
            </li>
            <li className='account-dropdown-item' onClick={() => navigate('/account')}>
              Settings <SettingsIcon />
            </li>
            <li className='account-dropdown-item red' onClick={handleLogout}>
              Log Out <LogOutIcon />
            </li>
          </>
        )}
      </ul>
      <button className='btn primary-alt' onClick={() => setGigPostModal(true)}>
        <PlusIcon /> Post a Gig
      </button>
      <ul className='menu'>
        <li className={`menu-item ${location.pathname === '/venues/dashboard' && 'active'}`} onClick={() => navigate('/venues/dashboard')}>
          <HouseIconLight /> Overview
        </li>
      </ul>
      <ul className='menu'>
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/gig') && 'active'}`} onClick={() => navigate('/venues/dashboard/gigs')}>
          <CalendarIcon /> Gigs
        </li>
        {expandedItem === 'gigs' && (
          <>
            <li className='menu-item sub top' onClick={() => navigate('/venues/dashboard/gigs?status=confirmed')}>
              Confirmed
            </li>
            <li className='menu-item sub' onClick={() => navigate('/venues/dashboard/gigs?status=upcoming')}>
              Upcoming
            </li>
            <li className='menu-item sub bottom' onClick={() => navigate('/venues/dashboard/gigs?status=previous')}>
              Previous
            </li>
          </>
        )}
      </ul>
      <ul className="menu">
      {newMessages ? (
              <li className='menu-item' onClick={() => navigate('/messages')}>
                <MailboxFullIcon /> Messages
              </li>
            ) : (
              <li className='menu-item' onClick={() => navigate('/messages')}>
                <MailboxEmptyIcon /> Messages
              </li>
            )}
      </ul>
      <ul className='menu'>
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/venues') && 'active'}`} onClick={() => navigate('/venues/dashboard/venues')}>
          <DoorIcon /> My Venues
        </li>
      </ul>
      <ul className='menu'>
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/musicians') && 'active'}`} onClick={() => navigate('/venues/dashboard/musicians')}>
          <GuitarsIcon /> Musicians
        </li>
        {expandedItem === 'musicians' && (
          <>
            <li className='menu-item sub top' onClick={() => navigate('/venues/dashboard/musicians')}>
              Saved Musicians
            </li>
            <li className='menu-item sub bottom' onClick={() => navigate('/venues/dashboard/musicians/find')}>
              Find Musicians
            </li>
          </>
        )}
      </ul>
      <ul className='menu'>
        <li className={`menu-item expandable ${location.pathname.includes('/venues/dashboard/finances') && 'active'}`} onClick={() => navigate('/venues/dashboard/finances')}>
          <CoinsIcon /> Finances
        </li>
      </ul>
    </div>
  );
};