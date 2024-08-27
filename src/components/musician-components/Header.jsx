import { useNavigate, useLocation, Link } from "react-router-dom"
import { VenueLogoLink, MusicianLogoLink, TextLogo, TextLogoLink } from "../ui/logos/Logos"
import '/styles/common/header.styles.css'
import { useAuth } from "../../hooks/useAuth"
import { DashboardIcon, DownChevronIcon, MailboxEmptyIcon, RightChevronIcon } from "/components/ui/Extras/Icons"
import { useState, useEffect } from "react"
import { firestore } from "../../firebase"
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { GuitarsIcon, DotIcon, FaceFrownIcon, FaceHeartsIcon, FaceMehIcon, FaceSmileIcon, HouseIcon, LogOutIcon, MailboxFullIcon, MapIcon, NewTabIcon, SettingsIcon, TelescopeIcon, UserIcon, VenueBuilderIcon, VillageHallIcon } from "../ui/Extras/Icons"

export const Header = ({ setAuthModal, setAuthType, user }) => {
    
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState(false);
    const [feedback, setFeedback] = useState({
        scale: '',
        feedback: '',
        user: user?.uid,
    });


    const handleScaleSelection = (scale) => {
        setFeedback(prev => ({ ...prev, scale }));
    };

    const handleFeedbackSubmit = async () => {
        try {
            await addDoc(collection(firestore, 'feedback'), {
                ...feedback,
                timestamp: serverTimestamp()
            });
        
            setFeedback({ scale: '', feedback: '' });
            setFeedbackForm(false);
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    };

    const showAuthModal = (type) => {
        setAuthModal(true);
        setAuthType(type);
    }

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/find-a-gig');
        } catch (err) {
            console.error(err);
        } finally {
            window.location.reload();
        }
    }

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : '0 5%',
      };

    const menuStyle = {
        right: location.pathname.includes('dashboard') ? '1rem' : '5%',
      };
    
    return (
        <header className="header default" style={headerStyle}>
            {user ? (
                <>
                    <div className="left">
                        <MusicianLogoLink />
                        {location.pathname.includes('dashboard') && (
                            <div className="breadcrumbs">
                                <span className="item">Dashboard</span>
                                {location.pathname === ('/musician/dashboard') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Overview</span>
                                    </>
                                )}
                                {location.pathname.includes('gig') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Gigs</span>
                                        {location.pathname.includes('applications') && (
                                            <>
                                                <RightChevronIcon />
                                                <span className="item active">Gig Applications</span>
                                            </>
                                        )}
                                    </>
                                )}
                                {location.pathname.includes('venues') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Venues</span>
                                    </>
                                )}
                                {location.pathname.includes('musicians') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Musicians</span>
                                    </>
                                )}
                                {location.pathname.includes('finances') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Finances</span>
                                    </>
                                )}
                                {location.pathname.includes('bands') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Bands</span>
                                    </>
                                )}
                                {location.pathname.includes('profile') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Profile</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="right">
                        <div className="buttons">
                            <button className="btn text" onClick={() => setFeedbackForm(!feedbackForm)}>
                                Feedback
                            </button>
                            {user.venueProfiles && !user.musicianProfile ? (
                                <Link className="link" to={'/venues/dashboard'}>
                                    <button className="btn secondary">
                                        <DashboardIcon />
                                        Dashboard
                                    </button>
                                </Link>
                            ) : (
                                location.pathname.includes('/dashboard') ? (
                                    <Link className="link" to={'/find-a-gig'}>
                                        <button className="btn secondary">
                                            <TelescopeIcon />
                                            Find A Gig
                                        </button>
                                    </Link>
                                ) : (
                                    <Link className="link" to={'/dashboard'}>
                                        <button className="btn secondary">
                                            <DashboardIcon />
                                            Dashboard
                                        </button>
                                    </Link>
                                )
                            )}
                            <Link className="link" to={'/messages'}>
                                <button className="btn secondary messages">
                                    <span className="notification-dot"><DotIcon /></span>
                                    <MailboxFullIcon />
                                    Messages
                                </button>
                            </Link>
                        </div>
                        <button className="btn icon" onClick={() => setAccountMenu(!accountMenu)}>
                            <UserIcon />
                        </button>
                    </div>
                    {accountMenu && (
                        user.venueProfiles && user.musicianProfile ? (
                            <nav className="account-menu" style={menuStyle}>
                            <div className="item name-and-email no-margin">
                                <h6>{user.name}</h6>
                                <p>{user.email}</p>
                            </div>
                            <div className="item">
                                Messages
                                <MailboxEmptyIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">venues</h6>
                            {user.venueProfiles && user.venueProfiles.length > 0 ? (
                                <>
                                    <div className="item no-margin">
                                        Dashboard
                                        <DashboardIcon />
                                    </div>
                                    <div className="item">
                                        Add another venue
                                        <VenueBuilderIcon />
                                    </div>
                                </>
                            ) : (
                                <div className="item">
                                    Add my Venue
                                    <VenueBuilderIcon />
                                </div>
                            )}
                            <div className="break" />
                            <div className="item no-margin">
                                Create a Musician Profile
                                <GuitarsIcon />
                            </div>
                            <div className="item no-margin">
                                Find Gigs
                                <MapIcon />
                            </div>
                            <div className="item no-margin">
                                Settings
                                <SettingsIcon />
                            </div>
                            <button className="btn danger no-margin" onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>

                        ) : (
                            <nav className="account-menu" style={menuStyle}>
                                <div className="item name-and-email no-margin">
                                    <h6>{user.name}</h6>
                                    <p>{user.email}</p>
                                </div>
                                <div className="item">
                                    Messages
                                    <MailboxEmptyIcon />
                                </div>
                                <div className="break" />
                                <h6 className="title">musicians</h6>
                                <div className="item no-margin">
                                    Dashboard
                                    <DashboardIcon />
                                </div>
                                <div className="item">
                                    Find a Gig
                                    <MapIcon />
                                </div>
                                <div className="break" />
                                <div className="item">
                                    Create a Venue Profile
                                    <HouseIcon />
                                </div>
                                <div className="item no-margin">
                                    Settings
                                    <SettingsIcon />
                                </div>
                                <button className="btn danger no-margin" onClick={handleLogout}>
                                    Log Out
                                    <LogOutIcon />
                                </button>
                            </nav>
                        )
                    )}
                    {feedbackForm && (
                        <div className="feedback">
                            <div className="body">
                                <textarea
                                    name="feedbackBox"
                                    id="feedbackBox"
                                    onChange={(e) => setFeedback(prev => ({ ...prev, feedback: e.target.value }))}
                                    value={feedback.feedback}
                                    placeholder="Your feedback..."
                                    
                                ></textarea>
                            </div>
                            <div className="foot">
                                <div className="faces">
                                    <button className={`btn icon ${feedback.scale === 'hearts' ? 'active' : ''}`} onClick={() => handleScaleSelection('hearts')}>
                                        <FaceHeartsIcon />
                                    </button>
                                    <button className={`btn icon ${feedback.scale === 'smiles' ? 'active' : ''}`} onClick={() => handleScaleSelection('smiles')}>
                                        <FaceSmileIcon />
                                    </button>
                                    <button className={`btn icon ${feedback.scale === 'meh' ? 'active' : ''}`} onClick={() => handleScaleSelection('meh')}>
                                        <FaceMehIcon />
                                    </button>
                                    <button className={`btn icon ${feedback.scale === 'frown' ? 'active' : ''}`} onClick={() => handleScaleSelection('frown')}>
                                        <FaceFrownIcon />
                                    </button>
                                </div>
                                <button className="btn primary-alt" onClick={handleFeedbackSubmit}>
                                    Send
                                </button>
                            </div>
                        </div>
                    )}
                    {/* {messagesPopUp && (
                        <MessagesPopUp conversations={conversations} onClose={() => setMessagesPopUp(false)} user={user} />
                    )} */}
                </>
            ) : (
                <>
                    <MusicianLogoLink />
                    <nav className="nav-list">
                        <button className="item btn secondary" onClick={() => {showAuthModal(true); setAuthType('login')}}>
                            Log In
                        </button>
                        <button className="item btn primary-alt" onClick={() => {showAuthModal(true); setAuthType('signup')}}>
                            Sign Up
                        </button>
                    </nav>
                </>
            )}
        </header>
    )
}