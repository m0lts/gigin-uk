import { Link, useLocation, useNavigate } from "react-router-dom";
import { AllGigsIcon, CoinsIcon, DashboardIconLight, FeedbackIcon, GigIcon, GuitarsIcon, LogOutIcon, MailboxEmptyIcon, MailboxFullIcon, MapIcon, MusicianIconLight, PeopleGroupIcon, ProfileIcon, SettingsIcon, TelescopeIcon, TicketIcon, VenueBuilderIcon, VenueIconLight, VenueIconSolid } from "../ui/extras/Icons";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import Portal from "./Portal";
import { useState } from "react";

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
                ) : user && !user?.artistProfiles && !user.venueProfiles ? (
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
                ) : user && !user?.artistProfiles && user?.venueProfiles ? (
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
                                <Link className='link item no-margin' to={'/venues/dashboard/musicians'}>
                                    Musicians
                                    <MusicianIconLight />
                                </Link>
                                <Link className='link item no-margin' to={'/venues/dashboard/finances'}>
                                    Finances
                                    <CoinsIcon />
                                </Link>
                            </>
                        )}
                        <div className='break' />
                        <a className='link item no-margin' href='mailto:hq.gigin@gmail.com'>
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
                ) : user && user?.artistProfiles && !user?.venueProfiles ? (
                    <>
                        <div className='item name-and-email no-margin'>
                            <h6>{user.name}</h6>
                            <p>{user.email}</p>
                        </div>
                        <button className="btn artist-profile inline" style={{ fontWeight: 500}} onClick={() => {
                            // Navigate to base path first to clear any existing profileId
                            navigate('/artist-profile?create=true', { replace: true });
                        }}>
                            New Artist Profile
                            <GuitarsIcon />
                        </button>
                        {user.artistProfiles && user.artistProfiles.length > 1 && (
                            <>
                                <div className="break" />
                                <h6 className="title">Artist Profiles</h6>
                                {user.artistProfiles.map((artistProfile) => {
                                    const profileId = artistProfile.id || artistProfile.profileId;
                                    const isPrimary = profileId === user.primaryArtistProfileId;
                                    return (
                                        <button 
                                            className={`btn inline item no-margin ${isPrimary ? 'primary-profile-item' : ''}`}
                                            key={profileId} 
                                            onClick={() => navigate(`/artist-profile/${profileId}`)}
                                        >
                                            {artistProfile.name}
                                            {isPrimary && <span className="primary-profile-badge">Primary</span>}
                                    </button>
                                    );
                                })}
                                <div className="break" />
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
                        <a className='link item no-margin' href='mailto:hq.gigin@gmail.com'>
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
                ) : user && user?.artistProfiles && user?.venueProfiles ? (
                    <>
                        <div className='item name-and-email no-margin'>
                            <h6>{user.name}</h6>
                            <p>{user.email}</p>
                        </div>
                        {isMobile && (
                            <>
                                <Link className='link item no-margin' to={'/artist-profile'}>
                                    Artist Profile
                                    <GuitarsIcon />
                                </Link>
                                <Link className='link item no-margin' to={'/venues/dashboard/gigs'}>
                                    Venue Dashboard
                                    <VenueIconLight />
                                </Link>
                            </>
                        )}
                        {!isXlUp && (
                            <div className='break' />
                        )}
                        <a className='link item no-margin' href='mailto:hq.gigin@gmail.com'>
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