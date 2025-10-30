import { Link, useNavigate } from "react-router-dom";
import { AllGigsIcon, CoinsIcon, DashboardIconLight, FeedbackIcon, GigIcon, GuitarsIcon, LogOutIcon, MailboxEmptyIcon, MailboxFullIcon, MapIcon, MusicianIconLight, PeopleGroupIcon, ProfileIcon, SettingsIcon, TelescopeIcon, TicketIcon, VenueBuilderIcon, VenueIconLight, VenueIconSolid } from "../ui/extras/Icons";
import { useBreakpoint } from "../../../hooks/useBreakpoint";

export const MobileMenu = ({ setMobileOpen, user, showAuthModal, setAuthType, handleLogout, newMessages, isMobile, menuStyle }) => {
    const { isLgUp, isXlUp, isMdUp } = useBreakpoint();
    const navigate = useNavigate();
    return (
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
            ) : user && !user?.musicianProfile && !user.venueProfiles ? (
                <>
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
                    <button className='btn secondary logout' onClick={() => handleLogout()}>
                        Log Out
                    </button>
                </>
            ) : user && !user?.musicianProfile && user?.venueProfiles ? (
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
                        Gigs
                        <AllGigsIcon />
                    </Link>
                    {newMessages ? (
                        <Link className='link item no-margin' to={'/venues/dashboard/messages'}>
                            Messages
                            <MailboxFullIcon />
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
                    <button className="btn inline item no-margin">
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
            ) : user && user?.musicianProfile && !user?.venueProfiles && (
                <>
                    <div className='item name-and-email no-margin'>
                        <h6>{user.name}</h6>
                        <p>{user.email}</p>
                    </div>
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
                    {user.musicianProfile && !isLgUp ? (
                        <Link className='link item no-margin' to={'/dashboard'}>
                            Dashboard
                            <DashboardIconLight />
                        </Link>
                    ) : !isLgUp && (
                        <Link className='link item no-margin' onClick={() => setNoProfileModal(true)}>
                            Create Musician Profile
                            <GuitarsIcon />
                        </Link>
                    )}
                    {!isLgUp && (
                        newMessages ? (
                            <Link className='link item no-margin' to={'/messages'}>
                                Messages
                                <MailboxFullIcon />
                            </Link>
                        ) : (
                            <Link className='link item no-margin' to={'/messages'}>
                                Messages
                                <MailboxEmptyIcon />
                            </Link>
                        )
                    )}
                    {isMobile && (
                        <>
                            <Link className='link item no-margin' to={'/dashboard/profile'}>
                                My Profile
                                <ProfileIcon />
                            </Link>
                            <Link className='link item no-margin' to={'/dashboard/gigs'}>
                                Gigs
                                <AllGigsIcon />
                            </Link>
                            <Link className='link item no-margin' to={'/dashboard/bands'}>
                                My Band(s)
                                <PeopleGroupIcon />
                            </Link>
                            <Link className='link item no-margin' to={'/dashboard/finances'}>
                                Finances
                                <CoinsIcon />
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
                    <button className="btn inline item no-margin">
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
            )}
        </nav>
    )
}