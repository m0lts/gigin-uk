import { useNavigate, useLocation, Link } from 'react-router-dom';
import { VenueLogoLink, MusicianLogoLink, TextLogoLink } from '@features/shared/ui/logos/Logos';
import { GuitarsIcon, LogOutIcon, TelescopeIcon, UserIcon, VenueBuilderIcon } from '@features/shared/ui/extras/Icons';
import '@styles/shared/header.styles.css';
import { useAuth } from '@hooks/useAuth'
import { useState, useEffect } from 'react'
import { listenToUserConversations } from '@services/client-side/conversations';
import { ProfileCreator } from '../../musician/profile-creator/ProfileCreator';
import { CloseIcon, ExitIcon, HamburgerMenuIcon, MapIcon } from '../ui/extras/Icons';
import { NoProfileModal } from '../../musician/components/NoProfileModal';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { MobileMenu } from './MobileMenu';

export const Header = ({ setAuthModal, setAuthType, user, noProfileModal, setNoProfileModal, noProfileModalClosable = false, setNoProfileModalClosable }) => {
    
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { isMdUp } = useBreakpoint();
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => { setMobileOpen(false); }, [location.pathname]);
    useEffect(() => { if (isMdUp && mobileOpen) setMobileOpen(false); }, [isMdUp, mobileOpen]);

    window.addEventListener('click', () => {
        setMobileOpen(false);
    });

    const showAuthModal = (type) => {
        setAuthModal(true);
        setAuthType(type);
    }

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.error(err);
        }
    }

    const getLocation = () => {
        if (location.pathname.includes('host')) {
            return <VenueLogoLink />;
        } else if (location.pathname.includes('musician')) {
            return <MusicianLogoLink />;
        } else {
            return <TextLogoLink />;
        }
    }

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : '0 2.5%',
    };
    return (
        <>
            <header className='header default' style={headerStyle}>
                {isMdUp ? (
                    user ? (
                        <>
                            { getLocation() }
                            <div className='right'>
                                <div className='buttons'>
                                    <Link className='link' to={'/find-a-gig'}>
                                        <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                            <MapIcon />
                                            Find a Gig
                                        </button>
                                    </Link>
                                    <button className={`btn secondary ${noProfileModal ? 'disabled' : ''}`}  onClick={() => {setNoProfileModal(true); setNoProfileModalClosable(!noProfileModalClosable)}}>
                                        <GuitarsIcon />
                                        Create a Musician Profile
                                    </button>
                                    <Link className='link' to={'/venues/add-venue'}>
                                        <button className='btn text'>
                                            I'm a Venue
                                        </button>
                                    </Link>
                                </div>
                                <button className='btn secondary logout' onClick={() => handleLogout()}>
                                    Log Out
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            { getLocation() }
                            <nav className='nav-list right'>
                                <Link className='link' to={'/venues/add-venue'}>
                                        <button className='btn text'>
                                            I'm a Venue
                                        </button>
                                </Link>
                                <Link className='link' to={'/find-a-gig'}>
                                    <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                        <MapIcon />
                                        Find a Gig
                                    </button>
                                </Link>
                                <Link className='link' to={'/find-venues'}>
                                    <button className={`btn secondary ${location.pathname === '/find-venues' ? 'disabled' : ''}`}>
                                        <TelescopeIcon />
                                        Find a Venue
                                    </button>
                                </Link>
                                <button className='item btn secondary' onClick={() => {showAuthModal(true); setAuthType('login')}}>
                                    Log In
                                </button>
                                <button className='item btn primary' onClick={() => {showAuthModal(true); setAuthType('signup')}}>
                                    Sign Up
                                </button>
                            </nav>
                        </>
                    )
                ) : (
                    mobileOpen ? (
                        <>
                            { getLocation() }
                            <button
                                className='btn icon exit'
                                aria-label='Close menu'
                                aria-expanded={mobileOpen}
                                aria-controls='mobile-menu'
                                onClick={(e) => {setMobileOpen(o => !o); e.stopPropagation();}}
                            >
                                <CloseIcon />
                            </button>
                        </>
                    ) : (
                        <>
                            { getLocation() }
                            <button
                                className='btn icon hamburger'
                                aria-label='Open menu'
                                aria-expanded={mobileOpen}
                                aria-controls='mobile-menu'
                                onClick={(e) => {setMobileOpen(o => !o); e.stopPropagation();}}
                            >
                                <HamburgerMenuIcon />
                            </button>
                        </>
                    )
                )}
            </header>
            {mobileOpen && (
                <MobileMenu
                    setMobileOpen={setMobileOpen}
                    user={user}
                    showAuthModal={showAuthModal}
                    setAuthType={setAuthType}
                    handleLogout={handleLogout}
                />
            )}
        </>
    )
}


// export const Header = (props) => {
//     const { setAuthModal, setAuthType, user, noProfileModal, setNoProfileModal, noProfileModalClosable = false, setNoProfileModalClosable } = props;
//     const { logout } = useAuth();
//     const { isMdUp } = useBreakpoint();
//     const location = useLocation();
//     const [mobileOpen, setMobileOpen] = useState(false);
//     const firstFocusableRef = useRef(null); // for simple focus management

  
//     useEffect(() => {
//       if (!mobileOpen) return;
//       const prev = document.body.style.overflow;
//       document.body.style.overflow = 'hidden';
//       const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
//       window.addEventListener('keydown', onKey);
//       setTimeout(() => { firstFocusableRef.current?.focus?.(); }, 0);
//       return () => {
//         document.body.style.overflow = prev;
//         window.removeEventListener('keydown', onKey);
//       };
//     }, [mobileOpen]);
  
//     const showAuthModal = (type) => { setAuthModal(true); setAuthType(type); };
//     const handleLogout = async () => { try { await logout(); } catch (e) { console.error(e); } };
  
//     const getLocation = () => {
//         if (location.pathname.includes('host')) return <VenueLogoLink />;
//         if (location.pathname.includes('musician')) return <MusicianLogoLink />;
//         return <TextLogoLink />;
//     };
  
//     const headerStyle = { padding: location.pathname.includes('dashboard') ? '0 1rem' : '0 2.5%' };
  
//     return (
//       <header className='header default' style={headerStyle}>
//         <div className='left'>{getLocation()}</div>
  
//         {isMdUp ? (
//           // ===== Desktop =====
//           user ? (
//             <div className='right'>
//               <div className='buttons'>
//                 <Link className='link' to='/find-a-gig'>
//                   <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
//                     <MapIcon /> Find a Gig
//                   </button>
//                 </Link>
//                 <button
//                   className={`btn secondary ${noProfileModal ? 'disabled' : ''}`}
//                   onClick={() => { setNoProfileModal(true); setNoProfileModalClosable(!noProfileModalClosable); }}
//                 >
//                   <GuitarsIcon /> Create a Musician Profile
//                 </button>
//                 <Link className='link' to='/venues/add-venue'>
//                   <button className='btn text'>I'm a Venue</button>
//                 </Link>
//               </div>
//               <button className='btn secondary logout' onClick={handleLogout}>Log Out</button>
//             </div>
//           ) : (
//             <nav className='nav-list right'>
//               <Link className='link' to='/venues/add-venue'><button className='btn text'>I'm a Venue</button></Link>
//               <Link className='link' to='/find-a-gig'><button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}><MapIcon /> Find a Gig</button></Link>
//               <Link className='link' to='/find-venues'><button className={`btn secondary ${location.pathname === '/find-venues' ? 'disabled' : ''}`}><TelescopeIcon /> Find a Venue</button></Link>
//               <button className='item btn secondary' onClick={() => { showAuthModal(true); setAuthType('login'); }}>Log In</button>
//               <button className='item btn primary' onClick={() => { showAuthModal(true); setAuthType('signup'); }}>Sign Up</button>
//             </nav>
//           )
//         ) : (
//           // ===== Mobile (md down) =====
//           <button
//             className='btn icon hamburger'
//             aria-label='Open menu'
//             aria-expanded={mobileOpen}
//             aria-controls='mobile-menu'
//             onClick={() => setMobileOpen(o => !o)}
//           >
//             <HamburgerMenuIcon />
//           </button>
//         )}
  
//         {/* Mobile full-screen overlay menu */}
//         {!isMdUp && mobileOpen && (
//           <>
//             <div className='mobile-menu-backdrop' onClick={() => setMobileOpen(false)} />
//             <div id='mobile-menu' className='mobile-menu' role='dialog' aria-modal='true'>
//               <div className='mobile-menu__header' style={headerStyle}>
//                 {getLocation()}
//                 <button className='btn icon close' aria-label='Close menu' onClick={() => setMobileOpen(false)}>
//                   <CloseIcon />
//                 </button>
//               </div>
  
//               <div className='mobile-menu__content'>
//                 {user ? (
//                   <>
//                     <Link className='link' to='/find-a-gig'>
//                       <button
//                         ref={firstFocusableRef}
//                         className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}
//                         onClick={() => setMobileOpen(false)}
//                       >
//                         <MapIcon /> Find a Gig
//                       </button>
//                     </Link>
  
//                     <button
//                       className={`btn secondary ${noProfileModal ? 'disabled' : ''}`}
//                       onClick={() => { setNoProfileModal(true); setNoProfileModalClosable(!noProfileModalClosable); }}
//                     >
//                       <GuitarsIcon /> Create a Musician Profile
//                     </button>
  
//                     <Link className='link' to='/venues/add-venue'>
//                       <button className='btn text' onClick={() => setMobileOpen(false)}>I'm a Venue</button>
//                     </Link>
  
//                     <button className='btn secondary' onClick={handleLogout}>Log Out</button>
//                   </>
//                 ) : (
//                   <>
//                     <Link className='link' to='/venues/add-venue'>
//                       <button ref={firstFocusableRef} className='btn text' onClick={() => setMobileOpen(false)}>
//                         I'm a Venue
//                       </button>
//                     </Link>
  
//                     <Link className='link' to='/find-a-gig'>
//                       <button
//                         className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}
//                         onClick={() => setMobileOpen(false)}
//                       >
//                         <MapIcon /> Find a Gig
//                       </button>
//                     </Link>
  
//                     <Link className='link' to='/find-venues'>
//                       <button
//                         className={`btn secondary ${location.pathname === '/find-venues' ? 'disabled' : ''}`}
//                         onClick={() => setMobileOpen(false)}
//                       >
//                         <TelescopeIcon /> Find a Venue
//                       </button>
//                     </Link>
  
//                     <button className='item btn secondary' onClick={() => { showAuthModal(true); setAuthType('login'); setMobileOpen(false); }}>
//                       Log In
//                     </button>
//                     <button className='item btn primary' onClick={() => { showAuthModal(true); setAuthType('signup'); setMobileOpen(false); }}>
//                       Sign Up
//                     </button>
//                   </>
//                 )}
//               </div>
//             </div>
//           </>
//         )}
//       </header>
//     );
//   };

// @media (--bp-md) {
//     .btn.hamburger { display: inline-flex; }
  
//     .mobile-menu-backdrop {
//       position: fixed;
//       inset: 0;
//       background: rgba(0,0,0,0.45);
//       backdrop-filter: blur(1px);
//       z-index: 1000; /* above header */
//       opacity: 1;
//       transition: opacity 160ms ease;
//     }
  
//     .mobile-menu {
//       position: fixed;
//       inset: 0;              /* full screen */
//       background: var(--gn-white);
//       z-index: 1001;         /* above backdrop */
//       display: flex;
//       flex-direction: column;
//       transform: translateY(-8px);
//       opacity: 0;
//       animation: mm-fade-in 160ms ease forwards;
//     }
//     @keyframes mm-fade-in {
//       to { opacity: 1; transform: translateY(0); }
//     }
  
//     .mobile-menu__header {
//       height: 60px;
//       display: flex;
//       align-items: center;
//       justify-content: space-between;
//     }
  
//     .mobile-menu__content {
//       display: flex;
//       flex-direction: column;
//       align-items: center;
//       justify-content: center;
//       flex-grow: 1;
//     }
//   }
  
//   /* Desktop hides mobile bits */
//   @media (--bp-md-up) {
//     .btn.hamburger,
//     .mobile-menu,
//     .mobile-menu-backdrop { display: none; }
//   }