import { Link, useLocation, useNavigate } from "react-router-dom";
import { AllGigsIcon, CoinsIcon, DashboardIconLight, FeedbackIcon, GigIcon, GuitarsIcon, LogOutIcon, MailboxEmptyIcon, MailboxFullIcon, MapIcon, MusicianIconLight, PeopleGroupIcon, ProfileIcon, SettingsIcon, TelescopeIcon, TicketIcon, VenueBuilderIcon, VenueIconLight, VenueIconSolid } from "../ui/extras/Icons";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import Portal from "./Portal";
import { useState } from "react";
import { toast } from "sonner";

export const MobileMenu = ({ setMobileOpen, user, showAuthModal, setAuthType, handleLogout, newMessages, isMobile, menuStyle, setNoProfileModal, setNoProfileModalClosable, noProfileModal, noProfileModalClosable, setShowFeedbackModal, showFeedbackModal, feedback, setFeedback }) => {
  const navigate = useNavigate();
  const { isLgUp, isXlUp, isMdUp } = useBreakpoint();
    const location = useLocation();
    return (
        <>
            <nav className='mobile-menu' style={menuStyle}>
                {!user ? (
                    <>
                        <Link className='link item no-margin' to={'/venues/add-venue'}>
                            I'm a Venue
                            <VenueIconLight />
                        </Link>
                        <Link className='link item no-margin' to={'/find-a-gig'}>
                            Find a Gig
                            <MapIcon />
                        </Link>
                        <Link className='link item' to={'/find-venues'}>
                            Find a Venue
                            <TelescopeIcon />
                        </Link>
                        <div className="two-buttons">
                            <button className='btn secondary' onClick={() => {showAuthModal(true); setAuthType('login')}}>
                                Log In
                            </button>
                            <button className='btn primary' onClick={() => {showAuthModal(true); setAuthType('signup')}}>
                                Sign Up
                            </button>
                        </div>
                    </>
                ) : user && !user?.artistProfiles && !user?.venueProfiles ? (
                    <>
                        <div className='item name-and-email no-margin'>
                            <h6>{user.name}</h6>
                            <p>{user.email}</p>
                        </div>
                        <Link to={'/account'} className='item no-margin link settings'>
                            Settings
                            <SettingsIcon />
                        </Link>
                        <button className='btn logout no-margin' onClick={handleLogout}>
                            Log Out
                            <LogOutIcon />
                        </button>
                    </>
                ) : user && !user?.artistProfiles && !user?.artistProfiles?.length > 0 && user?.venueProfiles?.length > 0 ? (
                    <>
                        <div className='item name-and-email no-margin'>
                            <h6>{user.name}</h6>
                            <p>{user.email}</p>
                        </div>
                        {isMobile && (
                            <button 
                                className="btn primary inline no-margin"
                                onClick={() => 
                                    navigate(
                                        '/venues/dashboard/gigs',
                                        { state: {
                                            showGigPostModal: true,
                                        }}
                                    )
                                }
                            >
                                Post a Gig
                                <GigIcon />
                            </button>
                        )}
                        <Link className='link item no-margin' to={'/venues/dashboard/gigs'}>
                            Dashboard
                            <DashboardIconLight />
                        </Link>
                        {newMessages ? (
                            <Link className='link item no-margin message' to={'/venues/dashboard/messages'}>
                                <div>
                                    Messages
                                    <MailboxFullIcon />
                                </div>
                                <span className="notification-dot" />
                            </Link>
                        ) : (
                            <Link className='link item no-margin' to={'/venues/dashboard/messages'}>
                                Messages
                                <MailboxEmptyIcon />
                            </Link>
                        )}
                        {!isMobile && (
                            <Link className='link item no-margin' to={'/venues/add-venue'}>
                                Add Venue
                                <VenueBuilderIcon />
                            </Link>
                        )}
                        {isMobile && (
                            <>
                                <Link className='link item no-margin' to={'/venues/dashboard/my-venues'}>
                                    My Venues
                                    <VenueIconLight />
                                </Link>
                                <Link className='link item no-margin' to={'/venues/dashboard/artists'}>
                                    Artists
                                    <MusicianIconLight />
                                </Link>
                                <Link className='link item no-margin' to={'/venues/dashboard/finances'}>
                                    Finances
                                    <CoinsIcon />
                                </Link>
                            </>
                        )}
                        <div className='break' />
                        <a className='link item no-margin' href='mailto:toby@giginmusic.com'>
                            Contact Us
                            <TicketIcon />
                        </a>
                        <button className="btn inline item no-margin" style={{ color: 'var(--gn-black)'}} onClick={() => setShowFeedbackModal(!showFeedbackModal)}>
                            Feedback
                            <FeedbackIcon />
                        </button>
                        <Link to={'/account'} className='item no-margin link settings'>
                            Settings
                            <SettingsIcon />
                        </Link>
                        <button className='btn logout no-margin' onClick={handleLogout}>
                            Log Out
                            <LogOutIcon />
                        </button>
                    </>
                ) : user && user?.artistProfiles && user?.artistProfiles.length > 0 && !user?.venueProfiles ? (
                    <>
                        <div className='item name-and-email no-margin'>
                            <h6>{user.name}</h6>
                            <p>{user.email}</p>
                        </div>
                        {user.artistProfiles && user.artistProfiles.length > 1 && (() => {
                            // Get active profile ID from localStorage (once, outside the map)
                            let activeProfileId = null;
                            if (user?.uid) {
                                try {
                                    const stored = localStorage.getItem(`activeArtistProfileId_${user.uid}`);
                                    if (stored) {
                                        const profileExists = user.artistProfiles?.some(
                                            (p) => (p.id === stored || p.profileId === stored)
                                        );
                                        if (profileExists) {
                                            activeProfileId = stored;
                                        }
                                    }
                                } catch (e) {
                                    // Ignore localStorage errors
                                }
                            }
                            
                            // Fallback to primary profile if no stored active profile
                            if (!activeProfileId && user?.primaryArtistProfileId) {
                                activeProfileId = user.primaryArtistProfileId;
                            }
                            
                            return (
                                <>
                                    <div className="break" />
                                    <h6 className="title">Artist Profiles</h6>
                                    {user.artistProfiles.map((artistProfile) => {
                                        const profileId = artistProfile.id || artistProfile.profileId;
                                        const isActive = profileId === activeProfileId;
                                        const isIncomplete = artistProfile.isComplete === false;
                                        const isDraft = artistProfile.status === 'draft';
                                        const shouldShowCreationFlow = isIncomplete || isDraft;
                                        const hasName = artistProfile.name && typeof artistProfile.name === 'string' && artistProfile.name.trim();
                                        
                                        return (
                                            <button 
                                                className={`btn inline item no-margin ${isActive ? 'primary-profile-item' : ''} ${!hasName ? 'placeholder' : ''}`}
                                                key={profileId} 
                                                onClick={() => {
                                                    if (shouldShowCreationFlow) {
                                                        // Navigate to profile with creation flow for incomplete profiles
                                                        navigate(`/artist-profile/${profileId}`);
                                                    } else {
                                                        // For complete profiles, update localStorage and navigate if on artist-profile route
                                                        if (user?.uid && profileId !== activeProfileId) {
                                                            try {
                                                                localStorage.setItem(`activeArtistProfileId_${user.uid}`, profileId);
                                                                // Dispatch custom event to notify other components
                                                                window.dispatchEvent(new Event('activeProfileChanged'));
                                                                toast.info(`Switched to ${hasName ? artistProfile.name : 'artist profile'}`);
                                                                setMobileOpen(false); // Close the mobile menu
                                                                
                                                                // If currently on artist-profile route, navigate to new profile
                                                                if (location.pathname.includes('/artist-profile')) {
                                                                    navigate(`/artist-profile/${profileId}`, { replace: true });
                                                                }
                                                            } catch (e) {
                                                                console.error('Failed to update active profile:', e);
                                                                toast.error('Failed to switch profile');
                                                            }
                                                        }
                                                    }
                                                }}
                                            >
                                                {hasName ? artistProfile.name : <span className="placeholder">Unnamed Profile</span>}
                                                {isActive && <span className="primary-profile-badge">ACTIVE</span>}
                                            </button>
                                        );
                                    })}
                                    <div className="break" />
                                </>
                            );
                        })()}
                        {user.artistProfiles && user.artistProfiles.length === 1 && (
                            <>
                                <button 
                                    className="btn artist-profile item no-margin"
                                    style= {{width: '100%'}}
                                    onClick={() => {
                                        navigate('/artist-profile?create=true');
                                        setMobileOpen(false);
                                    }}
                                >
                                    Create Another Profile
                                    <GuitarsIcon />
                                </button>
                            </>
                        )}
                        {!isLgUp && (
                            <Link className='link item no-margin' to={'/find-a-gig'}>
                                Find a Gig
                                <MapIcon />
                            </Link>
                        )}
                        {!isXlUp && (
                            <Link className='link item no-margin' to={'/find-venues'}>
                                Find a Venue
                                <TelescopeIcon />
                            </Link>
                        )}
                        {isMobile && (() => {
                            // Get active profile ID from localStorage or default
                            const getActiveProfileId = () => {
                                if (!user?.uid) return null;
                                try {
                                    const stored = localStorage.getItem(`activeArtistProfileId_${user.uid}`);
                                    if (stored) {
                                        const profileExists = user.artistProfiles?.some(
                                            (p) => (p.id === stored || p.profileId === stored)
                                        );
                                        if (profileExists) return stored;
                                    }
                                } catch (e) {}
                                if (user?.primaryArtistProfileId) return user.primaryArtistProfileId;
                                const firstComplete = user?.artistProfiles?.find((p) => p.isComplete);
                                return firstComplete?.id || firstComplete?.profileId || null;
                            };
                            const activeProfileId = getActiveProfileId();
                            const basePath = activeProfileId ? `/artist-profile/${activeProfileId}` : '/artist-profile';
                            return (
                                <>
                                    <Link className='link item no-margin' to={basePath}>
                                        Profile
                                        <ProfileIcon />
                                    </Link>
                                    <Link className='link item no-margin' to={`${basePath}/gigs`}>
                                        Gigs
                                        <AllGigsIcon />
                                    </Link>
                                    <Link className='link item no-margin' to={`${basePath}/messages`}>
                                        Messages
                                        {newMessages ? <MailboxFullIcon /> : <MailboxEmptyIcon />}
                                    </Link>
                                    <Link className='link item no-margin' to={`${basePath}/finances`}>
                                        Finances
                                        <CoinsIcon />
                                    </Link>
                                </>
                            );
                        })()}
                        {!isLgUp && !isMobile && (() => {
                            // Get active profile ID from localStorage or default
                            const getActiveProfileId = () => {
                                if (!user?.uid) return null;
                                try {
                                    const stored = localStorage.getItem(`activeArtistProfileId_${user.uid}`);
                                    if (stored) {
                                        const profileExists = user.artistProfiles?.some(
                                            (p) => (p.id === stored || p.profileId === stored)
                                        );
                                        if (profileExists) return stored;
                                    }
                                } catch (e) {}
                                if (user?.primaryArtistProfileId) return user.primaryArtistProfileId;
                                const firstComplete = user?.artistProfiles?.find((p) => p.isComplete);
                                return firstComplete?.id || firstComplete?.profileId || null;
                            };
                            const activeProfileId = getActiveProfileId();
                            const messagesPath = activeProfileId ? `/artist-profile/${activeProfileId}/messages` : '/artist-profile/messages';
                            return newMessages ? (
                                <Link className='link item no-margin message' to={messagesPath}>
                                    <div>
                                        Messages
                                        <MailboxFullIcon />
                                    </div>
                                    <span className="notification-dot" />
                                </Link>
                            ) : (
                                <Link className='link item no-margin' to={messagesPath}>
                                    Messages
                                    <MailboxEmptyIcon />
                                </Link>
                            );
                        })()}

                        {!isXlUp && (
                            <div className='break' />
                        )}
                        <a className='link item no-margin' href='mailto:toby@giginmusic.com'>
                            Contact Us
                            <TicketIcon />
                        </a>
                        <button className="btn inline item no-margin" style={{ color: 'var(--gn-black)'}} onClick={() => setShowFeedbackModal(!showFeedbackModal)}>
                            Feedback
                            <FeedbackIcon />
                        </button>
                        <Link to={'/account'} className='item no-margin link'>
                            Settings
                            <SettingsIcon />
                        </Link>
                        <button className='btn logout no-margin' onClick={handleLogout}>
                            Log Out
                            <LogOutIcon />
                        </button>
                    </>
                ) : user && user?.artistProfiles && user?.artistProfiles.length > 0 && user?.venueProfiles.length > 0 ? (
                    <>
                        <div className='item name-and-email no-margin'>
                            <h6>{user.name}</h6>
                            <p>{user.email}</p>
                        </div>
                        {isMobile && (
                            <>
                                <Link className='link item no-margin' to={'/venues/dashboard/gigs'}>
                                    Venue Dashboard
                                    <VenueIconLight />
                                </Link>
                            </>
                        )}
                        {!isXlUp && (
                            <div className='break' />
                        )}
                        <a className='link item no-margin' href='mailto:toby@giginmusic.com'>
                            Contact Us
                            <TicketIcon />
                        </a>
                        <button className="btn inline item no-margin" style={{ color: 'var(--gn-black)'}} onClick={() => setShowFeedbackModal(!showFeedbackModal)}>
                            Feedback
                            <FeedbackIcon />
                        </button>
                        <Link to={'/account'} className='item no-margin link'>
                            Settings
                            <SettingsIcon />
                        </Link>
                        <button className='btn logout no-margin' onClick={handleLogout}>
                            Log Out
                            <LogOutIcon />
                        </button>
                    </>
                ) : null}
            </nav>
        </>
    )
}