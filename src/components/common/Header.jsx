import { useNavigate, useLocation, Link } from "react-router-dom"
import { HostLogoLink, MusicianLogoLink, TextLogo, TextLogoLink } from "../ui/logos/Logos"
import '/styles/common/header.styles.css'
import { useAuth } from "../../hooks/useAuth"
import { DashboardIcon, DownChevronIcon, MailboxEmptyIcon, RightChevronIcon } from "/components/ui/Extras/Icons"
import { useState, useEffect } from "react"
import { firestore } from "../../firebase"
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { DotIcon, ExitIcon, FaceFrownIcon, FaceHeartsIcon, FaceMehIcon, FaceSmileIcon, HouseIcon, LogOutIcon, MailboxFullIcon, MapIcon, NewTabIcon, SettingsIcon, TelescopeIcon, UserIcon, VenueBuilderIcon, VillageHallIcon } from "../ui/Extras/Icons"
import { MessagesPopUp } from "./MessagesPopUp"

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
    const [messagesPopUp, setMessagesPopUp] = useState(false);
    const [newMessages, setNewMessages] = useState(false);
    const [conversations, setConversations] = useState([]);

    useEffect(() => {
        if (!user) return;

        // Check for conversations where the user is a participant
        const checkForNewMessages = () => {
            const conversationsRef = collection(firestore, 'conversations');
            const queries = [];

            // Query by musicianProfile ID
            if (user.musicianProfile && user.musicianProfile.length > 0) {
                const musicianQuery = query(conversationsRef, where('participants', 'array-contains', user.musicianProfile[0]));
                queries.push(musicianQuery);
            }

            // Query by each venueProfile ID
            if (user.venueProfiles && user.venueProfiles.length > 0) {
                user.venueProfiles.forEach(venueProfileId => {
                    const venueQuery = query(conversationsRef, where('participants', 'array-contains', venueProfileId));
                    queries.push(venueQuery);
                });
            }

            // Set up listeners for each query
            const unsubscribeFunctions = queries.map(q => 
                onSnapshot(q, snapshot => {
                    if (!snapshot.empty) {
                        const newConversations = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                        }));
                        
                        setConversations(prevConversations => {
                            // Merge new conversations into the existing state
                            const updatedConversations = [...prevConversations];
                            newConversations.forEach(newConv => {
                                const existingIndex = updatedConversations.findIndex(conv => conv.id === newConv.id);
                                if (existingIndex !== -1) {
                                    updatedConversations[existingIndex] = newConv;
                                } else {
                                    updatedConversations.push(newConv);
                                }
                            });
                            return updatedConversations;
                        });
                        // Check if there are any new messages
                        snapshot.docChanges().forEach(change => {
                            if (change.type === 'added') {
                                setNewMessages(true); // New message detected
                            }
                        });
                    }
                })
            );

            // Clean up the listeners when the component unmounts
            return () => {
                unsubscribeFunctions.forEach(unsub => unsub());
            };
        };

        checkForNewMessages();
    }, [user]);

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
            navigate();
        } catch (err) {
            console.error(err);
        } finally {
            window.location.reload();
        }
    }

    const getLocation = () => {
        if (location.pathname.includes('host')) {
            return <HostLogoLink />;
        } else if (location.pathname.includes('musician')) {
            return <MusicianLogoLink />;
        } else {
            return <TextLogoLink />;
        }
    }

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : '0 5%',
      };

    const menuStyle = {
        right: location.pathname.includes('dashboard') ? '1rem' : '5%',
      };


    if (location.pathname === '/') {
        return (
            user ? (
                <header className="header default" style={headerStyle}>
                    <TextLogo />
                    <div className="left">

                    </div>
                    <div className="right">
                        <div className="buttons">
                            <Link className="link" to={'/musician'}>
                                <button className="btn primary-alt">
                                    Musicians
                                </button>
                            </Link>
                            <Link className="link" to={'/host/dashboard'}>
                                <button className="btn primary-alt">
                                    Hosts
                                </button>
                            </Link>
                            <Link className="link" to={'/host/dashboard'}>
                                <button className="btn primary-alt">
                                    Gig-Goers
                                </button>
                            </Link>
                        </div>
                        <button className="btn icon" onClick={() => setAccountMenu(!accountMenu)}>
                            <UserIcon />
                        </button>
                    </div>
                    {accountMenu && (
                        <nav className="account-menu" style={menuStyle}>
                            <div className="item name-and-email no-margin">
                                <h6>{user.name}</h6>
                                <p>{user.email}</p>
                            </div>
                            <Link className="link item" to={'/messages'}>
                                Messages
                                <MailboxEmptyIcon />
                            </Link>
                            <div className="break" />
                            <h6 className="title">musicians</h6>
                            <div className="item no-margin">
                                Dashboard
                                <DashboardIcon />
                            </div>
                            <div className="item">
                                Map
                                <MapIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">hosts</h6>
                            <div className="item no-margin">
                                Dashboard
                                <DashboardIcon />
                            </div>
                            <div className="item">
                                Venue Builder
                                <VenueBuilderIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">gig-goers</h6>
                            <div className="item no-margin">
                                Map
                                <MapIcon />
                            </div>
                            <div className="break" />
                            <div className="item no-margin">
                                Settings
                                <SettingsIcon />
                            </div>
                            <button className="btn danger no-margin" onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>
                    )}
                </header>
            ) : (
                <header className="header default" style={headerStyle}>
                    <TextLogo />
                    <nav className="nav-list">
                        <button className="item btn secondary" onClick={() => {showAuthModal(true); setAuthType('login')}}>
                            Log In
                        </button>
                        <button className="item btn primary-alt" onClick={() => {showAuthModal(true); setAuthType('signup')}}>
                            Sign Up
                        </button>
                    </nav>
                </header>
            )
        )
    }
    
    return (
        <header className="header default" style={headerStyle}>
            {user ? (
                <>
                    <div className="left">
                        { getLocation() }
                        {location.pathname.includes('dashboard') && (
                            <div className="breadcrumbs">
                                <span className="item">Dashboard</span>
                                {location.pathname === ('/host/dashboard') || location.pathname === ('/musician/dashboard') && (
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
                            {location.pathname.includes('/musician/dashboard') ? (
                                <Link className="link" to={'/musician'}>
                                    <button className="btn secondary">
                                        <TelescopeIcon />
                                        Find Gigs
                                    </button>
                                </Link>
                            ) : (
                                <Link className="link" to={`${location.pathname.includes('host') ? '/host/dashboard' : '/musician/dashboard'}`}>
                                    <button className="btn secondary">
                                        <DashboardIcon />
                                        Dashboard
                                    </button>
                                </Link>
                            )}
                            {newMessages ? (
                                <Link className="link" to={'/messages'}>
                                    <button className="btn secondary messages" onClick={() => setMessagesPopUp(!messagesPopUp)}>
                                        <span className="notification-dot"><DotIcon /></span>
                                        <MailboxFullIcon />
                                        Messages
                                    </button>
                                </Link>
                            ) : (
                                <Link className="link" to={'/messages'}>
                                    <button className="btn secondary" onClick={() => setMessagesPopUp(!messagesPopUp)}>
                                        <MailboxEmptyIcon />
                                        Messages
                                    </button>
                                </Link>
                            )}
                        </div>
                        <button className="btn icon" onClick={() => setAccountMenu(!accountMenu)}>
                            <UserIcon />
                        </button>
                    </div>
                    {accountMenu && (
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
                                Map
                                <MapIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">hosts</h6>
                            <div className="item no-margin">
                                Dashboard
                                <DashboardIcon />
                            </div>
                            <div className="item">
                                Venue Builder
                                <VenueBuilderIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">gig-goers</h6>
                            <div className="item no-margin">
                                Map
                                <MapIcon />
                            </div>
                            <div className="break" />
                            <div className="item no-margin">
                                Settings
                                <SettingsIcon />
                            </div>
                            <button className="btn danger no-margin" onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>
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
                    {messagesPopUp && (
                        <MessagesPopUp conversations={conversations} onClose={() => setMessagesPopUp(false)} user={user} />
                    )}
                </>
            ) : (
                <>
                    { getLocation() }
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
